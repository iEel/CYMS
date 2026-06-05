import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

import { logAudit } from '@/lib/audit';
import { requireAnyPermission, requireRequestActor, requireYardAccess } from '@/lib/apiAuth';
import { getDb } from '@/lib/db';
import {
  loadOperationalActionRecords,
  upsertOperationalAction,
  type OperationalActionRecord,
} from '@/lib/operationalExceptionActions';
import {
  normalizeApprovalException,
  normalizeReconciliationException,
  normalizeReeferException,
  normalizeTransportException,
  summarizeOperationalExceptions,
  type OperationalExceptionAction,
  type OperationalExceptionItem,
  type OperationalExceptionSeverity,
  type OperationalExceptionSource,
  type OperationalExceptionStatus,
} from '@/lib/operationalExceptions';
import {
  RECONCILIATION_ISSUE_DEFINITIONS,
  buildReconciliationIssueResponse,
  loadReconciliationActionRecords,
  runReconciliationIssue,
} from '@/lib/reconciliationIssueRegistry';
import {
  updateReeferExceptionAction,
  type ReeferExceptionAction,
} from '@/lib/reeferExceptions';
import {
  applyPortalGrants,
  buildReeferExceptionGrants,
  fetchContainerPortalGrantRows,
} from '@/lib/portalGrantRules';

const SOURCES: OperationalExceptionSource[] = ['reconciliation', 'reefer', 'approval', 'transport'];
const SEVERITIES: OperationalExceptionSeverity[] = ['critical', 'warning', 'info'];
const PATCH_ACTIONS: Array<Exclude<OperationalExceptionAction, 'open_detail'>> = [
  'assign',
  'acknowledge',
  'resolve',
  'ignore',
  'reopen',
];
const REEFER_SOURCE_ACTIONS: ReeferExceptionAction[] = ['assign', 'acknowledge', 'resolve', 'ignore', 'reopen'];
const CLOSED_STATUSES = new Set<OperationalExceptionStatus>(['resolved', 'ignored']);

const statusByAction = {
  assign: 'open',
  acknowledge: 'open',
  resolve: 'resolved',
  ignore: 'ignored',
  reopen: 'open',
} as const;

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value: unknown, max = 500) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function parseSource(value: unknown) {
  const source = cleanText(value, 30) as OperationalExceptionSource | null;
  return source && SOURCES.includes(source) ? source : null;
}

function parseSeverity(value: unknown) {
  const severity = cleanText(value, 20) as OperationalExceptionSeverity | null;
  return severity && SEVERITIES.includes(severity) ? severity : null;
}

function parseLimit(value: unknown) {
  const parsed = Number(value || 100);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.floor(parsed), 1), 500);
}

function parseIncludeClosed(value: unknown) {
  return value === '1' || value === 'true' || value === true;
}

function normalizeIssueCode(source: OperationalExceptionSource, code: string) {
  return code.startsWith(`${source}.`) ? code : `${source}.${code}`;
}

function actionKey(action: OperationalActionRecord) {
  return `${action.issue_code}:${String(action.entity_id ?? action.entity_ref ?? 'unknown')}`;
}

function itemActionKey(item: OperationalExceptionItem) {
  return `${item.issue_code}:${String(item.entity_id ?? item.entity_ref ?? 'unknown')}`;
}

function isClosed(item: OperationalExceptionItem) {
  return CLOSED_STATUSES.has(item.status);
}

function applyOperationalOverlays(
  items: OperationalExceptionItem[],
  actions: OperationalActionRecord[],
  includeClosed: boolean,
) {
  const actionMap = new Map(actions.map(action => [actionKey(action), action]));

  return items
    .map((item) => {
      const action = actionMap.get(itemActionKey(item));
      if (!action || item.source === 'approval') return item;

      const actionContext = { ...item.context, operational_action: action };
      if (item.source === 'reefer') {
        return {
          ...item,
          assigned_to: action.assigned_to ?? item.assigned_to,
          updated_at: action.updated_at ? String(action.updated_at) : item.updated_at,
          context: actionContext,
        };
      }

      return {
        ...item,
        status: action.status,
        assigned_to: action.assigned_to ?? item.assigned_to,
        updated_at: action.updated_at ? String(action.updated_at) : item.updated_at,
        context: actionContext,
      };
    })
    .filter(item => includeClosed || !isClosed(item));
}

function matchesSearch(item: OperationalExceptionItem, search: string | null) {
  if (!search) return true;
  const haystack = [
    item.source,
    item.issue_code,
    item.title,
    item.message,
    item.entity_ref,
    item.assigned_to,
    JSON.stringify(item.context || {}),
  ].join(' ').toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function filterItems(
  items: OperationalExceptionItem[],
  filters: {
    source: OperationalExceptionSource | null;
    status: string | null;
    severity: OperationalExceptionSeverity | null;
    search: string | null;
    includeClosed: boolean;
    limit: number;
  },
) {
  return items
    .filter(item => !filters.source || item.source === filters.source)
    .filter(item => !filters.status || item.status === filters.status)
    .filter(item => !filters.severity || item.severity === filters.severity)
    .filter(item => filters.includeClosed || !isClosed(item))
    .filter(item => matchesSearch(item, filters.search))
    .sort((left, right) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
      if (severityDiff !== 0) return severityDiff;
      if (left.sla_breached !== right.sla_breached) return left.sla_breached ? -1 : 1;
      return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    })
    .slice(0, filters.limit);
}

async function loadReconciliationExceptions(
  db: sql.ConnectionPool,
  yardId: number,
  limit: number,
  includeClosed: boolean,
) {
  const actions = await loadReconciliationActionRecords(db, yardId);
  const items: OperationalExceptionItem[] = [];

  for (const definition of RECONCILIATION_ISSUE_DEFINITIONS) {
    const issue = await runReconciliationIssue(db, yardId, limit, definition);
    const response = buildReconciliationIssueResponse({ issue, actions, includeClosed });
    if (response.unavailable) continue;

    for (const row of response.rows) {
      items.push(normalizeReconciliationException({ issue: response, row }));
    }
  }

  return items;
}

async function loadReeferExceptions(
  db: sql.ConnectionPool,
  params: {
    yardId: number;
    source: OperationalExceptionSource | null;
    status: string | null;
    includeClosed: boolean;
    limit: number;
  },
) {
  const result = await db.request()
    .input('yardId', sql.Int, params.yardId)
    .input('source', sql.NVarChar(30), params.source)
    .input('status', sql.NVarChar(30), params.status)
    .input('includeClosed', sql.Bit, params.includeClosed ? 1 : 0)
    .input('limit', sql.Int, params.limit)
    .query(`
      SELECT TOP (@limit)
        e.exception_id, e.check_id, e.container_id, e.booking_id, e.yard_id,
        e.customer_id, e.severity, e.status, e.reason, e.recommended_action,
        e.resolution_note, e.assigned_to_user_id, e.created_at, e.updated_at,
        c.container_number, c.size, c.type, c.shipping_line,
        b.booking_number,
        rc.measured_temp_c, rc.set_point_c, rc.photo_url, rc.checked_at,
        DATEDIFF(MINUTE, e.created_at, GETDATE()) AS escalation_age_minutes,
        CASE
          WHEN e.severity = 'critical' AND DATEDIFF(MINUTE, e.created_at, GETDATE()) >= 30 THEN 1
          WHEN e.severity = 'high' AND DATEDIFF(MINUTE, e.created_at, GETDATE()) >= 120 THEN 1
          ELSE 0
        END AS escalation_breached
      FROM ReeferExceptions e
      JOIN Containers c ON c.container_id = e.container_id
      LEFT JOIN Bookings b ON b.booking_id = e.booking_id
      LEFT JOIN ReeferTemperatureChecks rc ON rc.check_id = e.check_id
      WHERE e.yard_id = @yardId
        AND (@source IS NULL OR @source = 'reefer')
        AND (@includeClosed = 1 OR e.status NOT IN ('resolved', 'ignored'))
      ORDER BY
        CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
        e.created_at DESC
    `);

  return (result.recordset as Array<Record<string, unknown>>).map(normalizeReeferException);
}

async function loadApprovalExceptions(
  db: sql.ConnectionPool,
  params: {
    yardId: number;
    source: OperationalExceptionSource | null;
    status: string | null;
    includeClosed: boolean;
    limit: number;
  },
) {
  const result = await db.request()
    .input('yardId', sql.Int, params.yardId)
    .input('source', sql.NVarChar(30), params.source)
    .input('status', sql.NVarChar(30), params.status)
    .input('includeClosed', sql.Bit, params.includeClosed ? 1 : 0)
    .input('limit', sql.Int, params.limit)
    .query(`
      SELECT TOP (@limit)
        ar.review_id, ar.yard_id, ar.permission_code, ar.action, ar.entity_type,
        ar.entity_id, ar.status, ar.requested_by, ar.approved_by, ar.reason,
        ar.details, ar.created_at, ar.reviewed_at,
        CAST('warning' AS NVARCHAR(20)) AS severity,
        requester.full_name AS requested_by_name,
        approver.full_name AS approved_by_name
      FROM ApprovalReviews ar
      LEFT JOIN Users requester ON requester.user_id = ar.requested_by
      LEFT JOIN Users approver ON approver.user_id = ar.approved_by
      WHERE ar.yard_id = @yardId
        AND (@source IS NULL OR @source = 'approval')
        AND (@includeClosed = 1 OR ar.status = 'pending_review')
      ORDER BY ar.created_at DESC
    `);

  return (result.recordset as Array<Record<string, unknown>>).map(normalizeApprovalException);
}

async function loadTransportExceptions(
  db: sql.ConnectionPool,
  params: {
    yardId: number;
    source: OperationalExceptionSource | null;
    status: string | null;
    includeClosed: boolean;
    limit: number;
  },
) {
  const result = await db.request()
    .input('yardId', sql.Int, params.yardId)
    .input('source', sql.NVarChar(30), params.source)
    .input('status', sql.NVarChar(30), params.status)
    .input('includeClosed', sql.Bit, params.includeClosed ? 1 : 0)
    .input('limit', sql.Int, params.limit)
    .query(`
      SELECT TOP (@limit)
        gor.request_id,
        CONCAT('request-', gor.request_id) AS job_id,
        gor.yard_id,
        gor.container_id,
        gor.booking_id,
        gor.booking_ref,
        gor.status,
        gor.requested_at,
        gor.updated_at,
        gor.completed_at,
        gor.driver_name,
        gor.truck_plate,
        gor.eir_number,
        gor.notes,
        c.container_number,
        b.booking_number,
        COALESCE(activity.last_activity_at, gor.updated_at, gor.requested_at) AS last_activity_at,
        CASE
          WHEN gor.status = 'issue_reported' THEN COALESCE(gor.notes, 'Transport issue reported')
          WHEN gor.status = 'pending' THEN 'Transport job is pending'
          WHEN gor.status IN ('requested', 'moving', 'at_gate')
            THEN 'Transport job has been open for more than 12 hours'
          ELSE gor.status
        END AS attention_reason,
        CASE
          WHEN gor.status = 'issue_reported' THEN 'warning'
          ELSE 'info'
        END AS severity
      FROM GateOutRequests gor
      LEFT JOIN Containers c ON c.container_id = gor.container_id
      LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
      OUTER APPLY (
        SELECT TOP 1 ta.created_at AS last_activity_at
        FROM TransportJobActivities ta
        WHERE ta.job_source = 'gate_out_request'
          AND ta.job_id = gor.request_id
        ORDER BY ta.created_at DESC
      ) activity
      WHERE gor.yard_id = @yardId
        AND (@source IS NULL OR @source = 'transport')
        AND (
          gor.status IN ('issue_reported', 'pending')
          OR (gor.status IN ('requested', 'moving', 'at_gate') AND gor.requested_at <= DATEADD(HOUR, -12, GETDATE()))
          OR (@includeClosed = 1 AND gor.status IN ('released', 'completed', 'cancelled', 'rejected'))
        )
      ORDER BY gor.requested_at DESC, gor.request_id DESC
    `);

  return (result.recordset as Array<Record<string, unknown>>).map(normalizeTransportException);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    if (!yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });

    const source = parseSource(searchParams.get('source'));
    const rawSource = cleanText(searchParams.get('source'), 30);
    if (rawSource && !source) return NextResponse.json({ error: 'source ไม่ถูกต้อง' }, { status: 400 });

    const severity = parseSeverity(searchParams.get('severity'));
    const rawSeverity = cleanText(searchParams.get('severity'), 20);
    if (rawSeverity && !severity) return NextResponse.json({ error: 'severity ไม่ถูกต้อง' }, { status: 400 });

    const status = cleanText(searchParams.get('status'), 30);
    const search = cleanText(searchParams.get('search'), 120);
    const includeClosed = parseIncludeClosed(searchParams.get('include_closed'));
    const limit = parseLimit(searchParams.get('limit'));

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requireAnyPermission(request, db, [
      'operations.exceptions.view',
      'operations.exceptions.manage',
      'reports.view',
    ], 'คุณไม่มีสิทธิ์ดูศูนย์รวม exception งานปฏิบัติการ');
    if (actor instanceof NextResponse) return actor;

    const [reconciliationItems, reeferItems, approvalItems, transportItems, operationalActions] = await Promise.all([
      source && source !== 'reconciliation' ? Promise.resolve([]) : loadReconciliationExceptions(db, yardId, limit, includeClosed),
      loadReeferExceptions(db, { yardId, source, status, includeClosed, limit }),
      loadApprovalExceptions(db, { yardId, source, status, includeClosed, limit }),
      loadTransportExceptions(db, { yardId, source, status, includeClosed, limit }),
      loadOperationalActionRecords(db, yardId),
    ]);

    const overlaidItems = applyOperationalOverlays([
      ...reconciliationItems,
      ...reeferItems,
      ...approvalItems,
      ...transportItems,
    ], operationalActions, includeClosed);
    const exceptions = filterItems(overlaidItems, {
      source,
      status,
      severity,
      search,
      includeClosed,
      limit,
    });

    return NextResponse.json({
      yard_id: yardId,
      generated_at: new Date().toISOString(),
      summary: summarizeOperationalExceptions(exceptions),
      exceptions,
    });
  } catch (error) {
    console.error('GET operational exceptions error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดศูนย์รวม exception งานปฏิบัติการได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = requireRequestActor(request);
  if (actor instanceof NextResponse) return actor;

  try {
    const body = await request.json();
    const yardId = positiveInt(body.yard_id);
    const source = parseSource(body.source);
    const code = cleanText(body.code ?? body.issue_code, 80);
    const action = cleanText(body.action, 30) as Exclude<OperationalExceptionAction, 'open_detail'> | null;

    if (!yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    if (!source) return NextResponse.json({ error: 'source ไม่ถูกต้อง' }, { status: 400 });
    if (!code) return NextResponse.json({ error: 'ต้องระบุ code' }, { status: 400 });
    if (!action || !PATCH_ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const permission = await requireAnyPermission(request, db, [
      'operations.exceptions.manage',
    ], 'คุณไม่มีสิทธิ์จัดการ exception งานปฏิบัติการ');
    if (permission instanceof NextResponse) return permission;

    if (source === 'approval') {
      return NextResponse.json(
        { error: 'รายการ approval ต้องจัดการใน Supervisor Review' },
        { status: 409 },
      );
    }

    const issueCode = normalizeIssueCode(source, code);
    const entityId = positiveInt(body.entity_id ?? body.exception_id);
    const entityRef = cleanText(body.entity_ref, 150);
    const note = cleanText(body.note ?? body.reason ?? body.resolution_note, 500);
    const assignedTo = cleanText(body.assigned_to, 100);
    const assignedToUserId = positiveInt(body.assigned_to_user_id);

    if (source === 'reefer' && REEFER_SOURCE_ACTIONS.includes(action as ReeferExceptionAction)) {
      const exceptionId = positiveInt(body.exception_id ?? body.entity_id);
      if (!exceptionId) return NextResponse.json({ error: 'ต้องระบุ exception_id' }, { status: 400 });
      if (action === 'assign' && !assignedToUserId) {
        return NextResponse.json({ error: 'ต้องระบุ assigned_to_user_id' }, { status: 400 });
      }

      const scope = await db.request()
        .input('exceptionId', sql.Int, exceptionId)
        .query('SELECT TOP 1 yard_id FROM ReeferExceptions WHERE exception_id = @exceptionId');
      const current = scope.recordset[0] as { yard_id?: number } | undefined;
      if (!current?.yard_id) return NextResponse.json({ error: 'ไม่พบ exception' }, { status: 404 });
      if (Number(current.yard_id) !== yardId) {
        return NextResponse.json({ error: 'exception ไม่อยู่ในลานที่ระบุ' }, { status: 400 });
      }

      const updateResult = await updateReeferExceptionAction({
        db,
        exceptionId,
        action: action as ReeferExceptionAction,
        note,
        assignedToUserId,
        actor,
      });
      if ('error' in updateResult) {
        if (updateResult.error === 'not_found') return NextResponse.json({ error: 'ไม่พบ exception' }, { status: 404 });
        return NextResponse.json({ error: 'action ไม่ถูกต้องกับสถานะปัจจุบัน' }, { status: 400 });
      }

      const containerGrantRows = await fetchContainerPortalGrantRows(db, {
        container_id: updateResult.exception.container_id,
      });
      await applyPortalGrants(db, buildReeferExceptionGrants(updateResult.exception, containerGrantRows));

      return NextResponse.json({
        success: true,
        source,
        status: updateResult.exception.status,
        exception: updateResult.exception,
      });
    }

    if (!entityId && !entityRef) {
      return NextResponse.json({ error: 'ต้องระบุ entity_id หรือ entity_ref' }, { status: 400 });
    }

    const status = statusByAction[action];
    const actionId = await upsertOperationalAction(db, {
      yardId,
      issueCode,
      entityId,
      entityRef,
      status,
      reason: note,
      assignedTo,
      actor,
    });

    await logAudit({
      userId: actor.userId,
      yardId,
      action: `operational_exception_${action}`,
      entityType: 'operational_exception',
      entityId: actionId,
      details: {
        actorId: actor.userId,
        source,
        code: issueCode,
        entity_id: entityId,
        entity_ref: entityRef,
        status,
        note,
        assigned_to: assignedTo,
      },
    });

    return NextResponse.json({ success: true, action_id: actionId, source, status });
  } catch (error) {
    console.error('PATCH operational exceptions error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต exception งานปฏิบัติการได้' }, { status: 500 });
  }
}
