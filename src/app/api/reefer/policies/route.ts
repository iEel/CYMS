import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';
import { normalizeReeferPolicy, type ReeferPolicyScope } from '@/lib/reeferMonitoring';

const scopes: ReeferPolicyScope[] = ['default', 'yard', 'customer', 'booking', 'container'];

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScope(value: unknown): ReeferPolicyScope | null {
  return scopes.includes(value as ReeferPolicyScope) ? value as ReeferPolicyScope : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parsePositiveInt(searchParams.get('yard_id'));
    if (!yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id' }, { status: 400 });

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requirePermission(request, db, 'reefer.policy.manage', 'คุณไม่มีสิทธิ์จัดการ policy ตู้เย็น');
    if (actor instanceof NextResponse) return actor;

    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT policy_id, yard_id, customer_id, booking_id, container_id,
          scope_type, cargo_profile, interval_hours, warning_grace_minutes,
          min_temp_c, max_temp_c, is_active, created_at, updated_at
        FROM ReeferCheckPolicies
        WHERE is_active = 1
          AND (scope_type = 'default' OR yard_id = @yardId OR yard_id IS NULL)
        ORDER BY
          CASE scope_type
            WHEN 'container' THEN 1
            WHEN 'booking' THEN 2
            WHEN 'customer' THEN 3
            WHEN 'yard' THEN 4
            ELSE 5
          END,
          policy_id DESC
      `);

    return NextResponse.json({ policies: result.recordset.map(normalizeReeferPolicy) });
  } catch (error) {
    console.error('❌ GET reefer policies error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด policy ตู้เย็นได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scope = parseScope(body.scope_type);
    const yardId = parsePositiveInt(body.yard_id);
    if (!scope) return NextResponse.json({ error: 'scope_type ไม่ถูกต้อง' }, { status: 400 });
    if (scope !== 'default' && !yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id' }, { status: 400 });

    const db = await getDb();
    if (yardId) {
      const yardAccess = await requireYardAccess(request, db, yardId);
      if (yardAccess instanceof NextResponse) return yardAccess;
    }
    const actor = await requirePermission(request, db, 'reefer.policy.manage', 'คุณไม่มีสิทธิ์จัดการ policy ตู้เย็น');
    if (actor instanceof NextResponse) return actor;

    const intervalHours = parsePositiveInt(body.interval_hours);
    const graceMinutes = parsePositiveInt(body.warning_grace_minutes) || 30;
    if (!intervalHours || intervalHours > 720) {
      return NextResponse.json({ error: 'รอบตรวจต้องอยู่ระหว่าง 1-720 ชั่วโมง' }, { status: 400 });
    }
    const customerId = scope === 'customer' ? parsePositiveInt(body.customer_id) : null;
    const bookingId = scope === 'booking' ? parsePositiveInt(body.booking_id) : null;
    const containerId = scope === 'container' ? parsePositiveInt(body.container_id) : null;
    if ((scope === 'customer' && !customerId) || (scope === 'booking' && !bookingId) || (scope === 'container' && !containerId)) {
      return NextResponse.json({ error: 'scope นี้ต้องระบุ id ให้ครบ' }, { status: 400 });
    }

    const minTemp = parseOptionalNumber(body.min_temp_c);
    const maxTemp = parseOptionalNumber(body.max_temp_c);
    if (minTemp !== null && maxTemp !== null && minTemp > maxTemp) {
      return NextResponse.json({ error: 'อุณหภูมิต่ำสุดต้องไม่มากกว่าสูงสุด' }, { status: 400 });
    }

    const result = await db.request()
      .input('policyId', sql.Int, parsePositiveInt(body.policy_id))
      .input('yardId', sql.Int, yardId)
      .input('customerId', sql.Int, customerId)
      .input('bookingId', sql.Int, bookingId)
      .input('containerId', sql.Int, containerId)
      .input('scopeType', sql.NVarChar(20), scope)
      .input('cargoProfile', sql.NVarChar(40), body.cargo_profile || null)
      .input('intervalHours', sql.Int, intervalHours)
      .input('warningGraceMinutes', sql.Int, graceMinutes)
      .input('minTempC', sql.Decimal(6, 2), minTemp)
      .input('maxTempC', sql.Decimal(6, 2), maxTemp)
      .query(`
        IF @policyId IS NOT NULL AND EXISTS (SELECT 1 FROM ReeferCheckPolicies WHERE policy_id = @policyId)
        BEGIN
          UPDATE ReeferCheckPolicies
          SET yard_id = @yardId,
              customer_id = @customerId,
              booking_id = @bookingId,
              container_id = @containerId,
              scope_type = @scopeType,
              cargo_profile = @cargoProfile,
              interval_hours = @intervalHours,
              warning_grace_minutes = @warningGraceMinutes,
              min_temp_c = @minTempC,
              max_temp_c = @maxTempC,
              is_active = 1,
              updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE policy_id = @policyId;
        END
        ELSE
        BEGIN
          INSERT INTO ReeferCheckPolicies (
            yard_id, customer_id, booking_id, container_id,
            scope_type, cargo_profile, interval_hours, warning_grace_minutes,
            min_temp_c, max_temp_c, is_active
          )
          OUTPUT INSERTED.*
          VALUES (
            @yardId, @customerId, @bookingId, @containerId,
            @scopeType, @cargoProfile, @intervalHours, @warningGraceMinutes,
            @minTempC, @maxTempC, 1
          );
        END
      `);

    const policy = result.recordset[0];
    await logAudit({
      userId: actor.userId,
      yardId: yardId || undefined,
      action: 'reefer_policy_upsert',
      entityType: 'reefer_check_policy',
      entityId: policy.policy_id,
      details: { scope_type: scope, interval_hours: intervalHours, warning_grace_minutes: graceMinutes },
    });

    return NextResponse.json({ success: true, policy: normalizeReeferPolicy(policy) });
  } catch (error) {
    console.error('❌ POST reefer policies error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก policy ตู้เย็นได้' }, { status: 500 });
  }
}
