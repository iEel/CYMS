import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';
import { deriveReeferEscalation } from '@/lib/reeferEscalation';
import {
  chooseEffectiveReeferPolicy,
  deriveReeferCheckStatus,
  deriveReeferDueStatus,
  filterApplicableReeferPolicies,
  normalizeReeferPolicy,
  type ReeferPolicyInput,
} from '@/lib/reeferMonitoring';
import { buildReeferExceptionDraft } from '@/lib/reeferExceptions';

type Db = Awaited<ReturnType<typeof getDb>>;

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeManualStatus(value: unknown) {
  return value === 'unreadable' || value === 'power_issue' ? value : 'normal';
}

async function fetchPolicies(db: Db, yardId: number) {
  const result = await db.request()
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT policy_id, yard_id, customer_id, booking_id, container_id,
        scope_type, cargo_profile, interval_hours, warning_grace_minutes,
        min_temp_c, max_temp_c, is_active
      FROM ReeferCheckPolicies
      WHERE is_active = 1
        AND (scope_type = 'default' OR yard_id = @yardId OR yard_id IS NULL)
    `);
  return result.recordset as ReeferPolicyInput[];
}

function effectivePolicyFor(row: Record<string, unknown>, policies: ReeferPolicyInput[]) {
  return chooseEffectiveReeferPolicy(filterApplicableReeferPolicies(policies, {
    yard_id: Number(row.yard_id || 0) || null,
    customer_id: Number(row.customer_id || 0) || null,
    booking_id: Number(row.booking_id || 0) || null,
    container_id: Number(row.container_id || 0) || null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parsePositiveInt(searchParams.get('yard_id'));
    if (!yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id' }, { status: 400 });

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requirePermission(request, db, 'reefer.check.read', 'คุณไม่มีสิทธิ์ดูรายการตรวจอุณหภูมิตู้เย็น');
    if (actor instanceof NextResponse) return actor;

    const containerId = parsePositiveInt(searchParams.get('container_id'));
    const limit = Math.min(parsePositiveInt(searchParams.get('limit')) || 200, 500);
    const req = db.request()
      .input('yardId', sql.Int, yardId)
      .input('limit', sql.Int, limit);
    const filters = ['c.yard_id = @yardId', "c.type = 'RF'"];
    if (containerId) {
      req.input('containerId', sql.Int, containerId);
      filters.push('c.container_id = @containerId');
    }

    const result = await req.query(`
      SELECT TOP (@limit)
        c.container_id, c.container_number, c.size, c.type, c.shipping_line,
        c.status AS container_status, c.is_laden, c.yard_id, c.zone_id,
        c.bay, c.[row] AS [row], c.tier,
        z.zone_name,
        latestBooking.booking_id, latestBooking.booking_number, latestBooking.customer_id,
        latestCheck.check_id AS latest_check_id,
        latestCheck.measured_temp_c AS latest_measured_temp_c,
        latestCheck.set_point_c AS latest_set_point_c,
        latestCheck.supply_temp_c AS latest_supply_temp_c,
        latestCheck.return_temp_c AS latest_return_temp_c,
        latestCheck.status AS latest_check_status,
        latestCheck.photo_url AS latest_photo_url,
        latestCheck.notes AS latest_notes,
        latestCheck.checked_at AS latest_checked_at,
        latestCheck.checked_by_user_id AS latest_checked_by_user_id,
        activeException.exception_id AS active_exception_id,
        activeException.severity AS active_exception_severity,
        activeException.status AS active_exception_status,
        activeException.reason AS active_exception_reason,
        activeException.recommended_action AS active_exception_action,
        activeException.created_at AS active_exception_created_at
      FROM Containers c
      LEFT JOIN YardZones z ON z.zone_id = c.zone_id
      OUTER APPLY (
        SELECT TOP 1 b.booking_id, b.booking_number, b.customer_id
        FROM BookingContainers bc
        JOIN Bookings b ON b.booking_id = bc.booking_id
        WHERE bc.container_id = c.container_id
          OR bc.container_number = c.container_number
        ORDER BY COALESCE(b.eta, b.created_at) DESC, b.booking_id DESC
      ) latestBooking
      OUTER APPLY (
        SELECT TOP 1 rc.*
        FROM ReeferTemperatureChecks rc
        WHERE rc.container_id = c.container_id
        ORDER BY rc.checked_at DESC, rc.check_id DESC
      ) latestCheck
      OUTER APPLY (
        SELECT TOP 1 e.*
        FROM ReeferExceptions e
        WHERE e.container_id = c.container_id
          AND e.status IN ('open', 'in_progress')
        ORDER BY
          CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
          e.created_at DESC,
          e.exception_id DESC
      ) activeException
      WHERE ${filters.join(' AND ')}
      ORDER BY
        CASE WHEN latestCheck.checked_at IS NULL THEN 0 ELSE 1 END,
        latestCheck.checked_at ASC,
        c.container_number ASC
    `);

    const policies = await fetchPolicies(db, yardId);
    const items = result.recordset.map((row) => {
      const policy = effectivePolicyFor(row, policies);
      const escalation = row.active_exception_id
        ? deriveReeferEscalation({
          severity: row.active_exception_severity,
          status: row.active_exception_status,
          created_at: row.active_exception_created_at,
        })
        : null;
      return {
        ...row,
        policy,
        due_status: deriveReeferDueStatus({ last_checked_at: row.latest_checked_at, policy }),
        escalation_level: escalation?.level || 'none',
        escalation_breached: escalation?.breached || false,
        escalation_due_minutes: escalation?.due_minutes || null,
        escalation_age_minutes: escalation?.age_minutes || null,
        escalation_label: escalation?.label || null,
        escalation_action: escalation?.recommended_action || null,
      };
    });

    let history: Record<string, unknown>[] = [];
    if (containerId) {
      const historyResult = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('containerId', sql.Int, containerId)
        .query(`
          SELECT TOP 100
            rc.check_id, rc.container_id, rc.booking_id, rc.yard_id, rc.customer_id,
            rc.measured_temp_c, rc.set_point_c, rc.supply_temp_c, rc.return_temp_c,
            rc.status, rc.photo_url, rc.notes, rc.checked_by_user_id,
            u.full_name AS checked_by_name,
            rc.checked_at, rc.created_at,
            ex.exception_id, ex.severity AS exception_severity, ex.status AS exception_status,
            ex.reason AS exception_reason, ex.recommended_action AS exception_action
          FROM ReeferTemperatureChecks rc
          JOIN Containers c ON c.container_id = rc.container_id
          LEFT JOIN Users u ON u.user_id = rc.checked_by_user_id
          OUTER APPLY (
            SELECT TOP 1 e.*
            FROM ReeferExceptions e
            WHERE e.check_id = rc.check_id
            ORDER BY e.created_at DESC, e.exception_id DESC
          ) ex
          WHERE rc.container_id = @containerId
            AND rc.yard_id = @yardId
            AND c.yard_id = @yardId
            AND c.type = 'RF'
          ORDER BY rc.checked_at DESC, rc.check_id DESC
        `);
      history = historyResult.recordset;
    }

    return NextResponse.json({ items, policies: policies.map(normalizeReeferPolicy), history });
  } catch (error) {
    console.error('❌ GET reefer checks error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายการตรวจตู้เย็นได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = parsePositiveInt(body.yard_id);
    const containerId = parsePositiveInt(body.container_id);
    if (!yardId || !containerId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id และ container_id' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requirePermission(request, db, 'reefer.check.record', 'คุณไม่มีสิทธิ์บันทึกอุณหภูมิตู้เย็น');
    if (actor instanceof NextResponse) return actor;

    const containerResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('containerId', sql.Int, containerId)
      .query(`
        SELECT TOP 1
          c.container_id, c.container_number, c.type, c.yard_id,
          latestBooking.booking_id, latestBooking.customer_id
        FROM Containers c
        OUTER APPLY (
          SELECT TOP 1 b.booking_id, b.customer_id
          FROM BookingContainers bc
          JOIN Bookings b ON b.booking_id = bc.booking_id
          WHERE bc.container_id = c.container_id
            OR bc.container_number = c.container_number
          ORDER BY COALESCE(b.eta, b.created_at) DESC, b.booking_id DESC
        ) latestBooking
        WHERE c.container_id = @containerId
          AND c.yard_id = @yardId
      `);

    const container = containerResult.recordset[0];
    if (!container) return NextResponse.json({ error: 'ไม่พบตู้ในลานนี้' }, { status: 404 });
    if (container.type !== 'RF') return NextResponse.json({ error: 'บันทึกอุณหภูมิได้เฉพาะตู้ RF เท่านั้น' }, { status: 400 });

    const policies = await fetchPolicies(db, yardId);
    const policy = effectivePolicyFor(container, policies);
    const manualStatus = normalizeManualStatus(body.status);
    const measuredTemp = parseOptionalNumber(body.measured_temp_c);
    const setPoint = parseOptionalNumber(body.set_point_c);
    const supplyTemp = parseOptionalNumber(body.supply_temp_c);
    const returnTemp = parseOptionalNumber(body.return_temp_c);
    const status = deriveReeferCheckStatus({ measured_temp_c: measuredTemp, manual_status: manualStatus, policy });

    const insertResult = await db.request()
      .input('containerId', sql.Int, container.container_id)
      .input('bookingId', sql.Int, container.booking_id || null)
      .input('yardId', sql.Int, yardId)
      .input('customerId', sql.Int, container.customer_id || null)
      .input('measuredTempC', sql.Decimal(6, 2), measuredTemp)
      .input('setPointC', sql.Decimal(6, 2), setPoint)
      .input('supplyTempC', sql.Decimal(6, 2), supplyTemp)
      .input('returnTempC', sql.Decimal(6, 2), returnTemp)
      .input('status', sql.NVarChar(30), status)
      .input('photoUrl', sql.NVarChar(500), body.photo_url || null)
      .input('notes', sql.NVarChar(1000), body.notes || null)
      .input('checkedByUserId', sql.Int, actor.userId)
      .input('policySnapshot', sql.NVarChar(sql.MAX), JSON.stringify(policy))
      .query(`
        INSERT INTO ReeferTemperatureChecks (
          container_id, booking_id, yard_id, customer_id,
          measured_temp_c, set_point_c, supply_temp_c, return_temp_c,
          status, photo_url, notes, checked_by_user_id, policy_snapshot, checked_at
        )
        OUTPUT INSERTED.*
        VALUES (
          @containerId, @bookingId, @yardId, @customerId,
          @measuredTempC, @setPointC, @supplyTempC, @returnTempC,
          @status, @photoUrl, @notes, @checkedByUserId, @policySnapshot, GETDATE()
        )
      `);

    const check = insertResult.recordset[0];
    const exceptionDraft = buildReeferExceptionDraft(check);
    let exception = null;
    if (exceptionDraft) {
      const exceptionResult = await db.request()
        .input('checkId', sql.Int, exceptionDraft.check_id)
        .input('containerId', sql.Int, exceptionDraft.container_id)
        .input('bookingId', sql.Int, exceptionDraft.booking_id)
        .input('yardId', sql.Int, exceptionDraft.yard_id)
        .input('customerId', sql.Int, exceptionDraft.customer_id)
        .input('severity', sql.NVarChar(20), exceptionDraft.severity)
        .input('status', sql.NVarChar(30), exceptionDraft.status)
        .input('reason', sql.NVarChar(80), exceptionDraft.reason)
        .input('recommendedAction', sql.NVarChar(500), exceptionDraft.recommended_action)
        .query(`
          INSERT INTO ReeferExceptions (
            check_id, container_id, booking_id, yard_id, customer_id,
            severity, status, reason, recommended_action
          )
          OUTPUT INSERTED.*
          SELECT
            @checkId, @containerId, @bookingId, @yardId, @customerId,
            @severity, @status, @reason, @recommendedAction
          WHERE NOT EXISTS (
            SELECT 1
            FROM ReeferExceptions
            WHERE container_id = @containerId
              AND status IN ('open', 'in_progress')
              AND reason = @reason
          )
        `);
      exception = exceptionResult.recordset[0] || null;
    }

    await logAudit({
      userId: actor.userId,
      yardId,
      action: 'reefer_check_record',
      entityType: 'reefer_temperature_check',
      entityId: check.check_id,
      details: {
        container_id: container.container_id,
        container_number: container.container_number,
        booking_id: container.booking_id || null,
        status,
        measured_temp_c: measuredTemp,
      },
    });

    return NextResponse.json({ success: true, check, policy, exception });
  } catch (error) {
    console.error('❌ POST reefer check error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกอุณหภูมิตู้เย็นได้' }, { status: 500 });
  }
}
