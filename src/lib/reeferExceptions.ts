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
