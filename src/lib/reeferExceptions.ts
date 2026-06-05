import sql from 'mssql';

import { logAudit } from '@/lib/audit';
import type { RequestActor } from '@/lib/apiAuth';

export type ReeferExceptionSeverity = 'medium' | 'high' | 'critical';
export type ReeferExceptionStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';
export type ReeferExceptionAction = 'acknowledge' | 'resolve' | 'ignore' | 'reopen';

export interface ReeferExceptionCheck {
  check_id: number;
  container_id: number;
  booking_id?: number | null;
  yard_id: number;
  customer_id?: number | null;
  status: string;
  measured_temp_c?: number | string | null;
  policy_snapshot?: string | null;
}

export interface ReeferExceptionDraft {
  check_id: number;
  container_id: number;
  booking_id: number | null;
  yard_id: number;
  customer_id: number | null;
  severity: ReeferExceptionSeverity;
  status: ReeferExceptionStatus;
  reason: string;
  recommended_action: string;
}

function parsePolicySnapshot(value?: string | null): { min_temp_c?: number | null; max_temp_c?: number | null } {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return {
      min_temp_c: typeof parsed.min_temp_c === 'number' ? parsed.min_temp_c : null,
      max_temp_c: typeof parsed.max_temp_c === 'number' ? parsed.max_temp_c : null,
    };
  } catch {
    return {};
  }
}

export function buildReeferExceptionDraft(check: ReeferExceptionCheck): ReeferExceptionDraft | null {
  if (check.status === 'normal') return null;

  if (check.status === 'out_of_range') {
    const policy = parsePolicySnapshot(check.policy_snapshot);
    const measured = Number(check.measured_temp_c);
    const max = typeof policy.max_temp_c === 'number' ? policy.max_temp_c : null;
    const min = typeof policy.min_temp_c === 'number' ? policy.min_temp_c : null;
    const isCritical = (max !== null && measured > max + 5) || (min !== null && measured < min - 5);

    return {
      check_id: check.check_id,
      container_id: check.container_id,
      booking_id: check.booking_id || null,
      yard_id: check.yard_id,
      customer_id: check.customer_id || null,
      severity: isCritical ? 'critical' : 'high',
      status: 'open',
      reason: 'temperature_out_of_range',
      recommended_action: 'ตรวจปลั๊กไฟ/เครื่อง reefer และแจ้ง supervisor',
    };
  }

  if (check.status === 'power_issue') {
    return {
      check_id: check.check_id,
      container_id: check.container_id,
      booking_id: check.booking_id || null,
      yard_id: check.yard_id,
      customer_id: check.customer_id || null,
      severity: 'critical',
      status: 'open',
      reason: 'power_issue',
      recommended_action: 'ตรวจแหล่งจ่ายไฟ/ปลั๊กทันที และเปิด incident ให้ supervisor',
    };
  }

  if (check.status === 'unreadable') {
    return {
      check_id: check.check_id,
      container_id: check.container_id,
      booking_id: check.booking_id || null,
      yard_id: check.yard_id,
      customer_id: check.customer_id || null,
      severity: 'medium',
      status: 'open',
      reason: 'temperature_unreadable',
      recommended_action: 'ตรวจซ้ำพร้อมรูปหน้าจอให้ชัดเจน',
    };
  }

  return null;
}

export function nextReeferExceptionStatus(
  currentStatus: string,
  action: string,
): ReeferExceptionStatus | null {
  if (action === 'acknowledge' && currentStatus === 'open') return 'in_progress';
  if (action === 'resolve' && ['open', 'in_progress'].includes(currentStatus)) return 'resolved';
  if (action === 'ignore' && ['open', 'in_progress'].includes(currentStatus)) return 'ignored';
  if (action === 'reopen' && ['resolved', 'ignored'].includes(currentStatus)) return 'open';
  return null;
}

export interface ReeferExceptionActionUpdateRow extends Record<string, unknown> {
  exception_id?: number | string | null;
  container_id?: number | string | null;
  container_number?: number | string | null;
  status?: string | null;
}

export type ReeferExceptionActionUpdateResult =
  | { exception: ReeferExceptionActionUpdateRow; yardId: number }
  | { error: 'not_found' | 'invalid_transition'; yardId?: number };

export async function updateReeferExceptionAction({
  db,
  exceptionId,
  action,
  note,
  assignedToUserId,
  actor,
}: {
  db: sql.ConnectionPool;
  exceptionId: number;
  action: ReeferExceptionAction;
  note?: string | null;
  assignedToUserId?: number | null;
  actor: RequestActor;
}): Promise<ReeferExceptionActionUpdateResult> {
  const scope = await db.request()
    .input('exceptionId', sql.Int, exceptionId)
    .query('SELECT TOP 1 yard_id, status FROM ReeferExceptions WHERE exception_id = @exceptionId');
  const current = scope.recordset[0] as { yard_id?: number; status?: string } | undefined;
  if (!current?.yard_id) return { error: 'not_found' };

  const nextStatus = nextReeferExceptionStatus(current.status || '', action);
  if (!nextStatus) return { error: 'invalid_transition', yardId: current.yard_id };

  const result = await db.request()
    .input('exceptionId', sql.Int, exceptionId)
    .input('status', sql.NVarChar(30), nextStatus)
    .input('resolutionNote', sql.NVarChar(1000), note || null)
    .input('assignedToUserId', sql.Int, assignedToUserId ?? null)
    .input('actorUserId', sql.Int, actor.userId)
    .query(`
      UPDATE ReeferExceptions
      SET status = @status,
          resolution_note = COALESCE(@resolutionNote, resolution_note),
          assigned_to_user_id = COALESCE(@assignedToUserId, assigned_to_user_id),
          acknowledged_by_user_id = CASE WHEN @status = 'in_progress' THEN @actorUserId ELSE acknowledged_by_user_id END,
          acknowledged_at = CASE WHEN @status = 'in_progress' THEN GETDATE() ELSE acknowledged_at END,
          resolved_by_user_id = CASE WHEN @status IN ('resolved', 'ignored') THEN @actorUserId ELSE resolved_by_user_id END,
          resolved_at = CASE WHEN @status IN ('resolved', 'ignored') THEN GETDATE() ELSE resolved_at END,
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE exception_id = @exceptionId
    `);

  const exception = result.recordset[0] as ReeferExceptionActionUpdateRow | undefined;
  if (!exception) return { error: 'not_found', yardId: current.yard_id };

  await logAudit({
    userId: actor.userId,
    yardId: current.yard_id,
    action: `reefer_exception_${action}`,
    entityType: 'reefer_exception',
    entityId: exceptionId,
    details: { status: nextStatus, note: note || null },
  });

  return { exception, yardId: current.yard_id };
}
