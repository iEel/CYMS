export type ApprovalInboxStatus = 'pending_review' | 'approved' | 'rejected';
export type ApprovalInboxSlaStatus = 'within_sla' | 'due_today' | 'breached';
export type ApprovalInboxSeverity = 'normal' | 'warning' | 'critical';

export interface ApprovalInboxReview {
  review_id: number;
  permission_code: string;
  action: string;
  entity_type: string;
  status: ApprovalInboxStatus;
  requested_by_name?: string | null;
  details?: string | null;
  created_at: string;
}

export interface ApprovalInboxItem {
  review_id: number;
  permission_code: string;
  action: string;
  entity_type: string;
  group: string;
  label: string;
  requester: string;
  age_hours: number;
  age_days: number;
  sla_hours: number;
  sla_status: ApprovalInboxSlaStatus;
  severity: ApprovalInboxSeverity;
  financial_amount: number;
  priority: number;
}

const GROUP_SLA_HOURS: Record<string, number> = {
  Gate: 4,
  Yard: 4,
  Billing: 24,
  Survey: 48,
};

const RISK_WEIGHT = {
  standard: 100,
  high: 500,
  critical: 900,
};

const FINANCIAL_KEYS = [
  'original_amount',
  'final_amount',
  'waived_amount',
  'credit_amount',
  'remaining_amount',
  'grand_total',
  'amount',
];

export const APPROVAL_ACTION_INFO: Record<string, { label: string; group: string; risk: keyof typeof RISK_WEIGHT }> = {
  container_grade_change_after_save: { label: 'เปลี่ยนเกรดตู้หลังบันทึก', group: 'Survey', risk: 'standard' },
  container_billing_hold_override: { label: 'เปลี่ยนสถานะตู้ที่ติด Billing Hold', group: 'Yard', risk: 'high' },
  gate_out_with_billing_hold: { label: 'Gate Out ทั้งที่ติด Billing Hold', group: 'Gate', risk: 'high' },
  billing_no_charge_recorded: { label: 'No Charge', group: 'Billing', risk: 'standard' },
  billing_waive_recorded: { label: 'Waived / ลดค่าบริการ', group: 'Billing', risk: 'high' },
  credit_note_created: { label: 'ออกใบลดหนี้', group: 'Billing', risk: 'high' },
  invoice_cancel_after_issue: { label: 'ยกเลิก Invoice', group: 'Billing', risk: 'high' },
  billing_hold_released: { label: 'ปลด Billing Hold', group: 'Billing', risk: 'high' },
};

function parseDetails(value?: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getFinancialAmount(details: Record<string, unknown>) {
  return FINANCIAL_KEYS.reduce((max, key) => {
    const value = details[key];
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) ? Math.max(max, Math.abs(amount)) : max;
  }, 0);
}

function hoursSince(createdAt: string, now: Date) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((now.getTime() - created) / 3_600_000));
}

function getSlaStatus(ageHours: number, slaHours: number): ApprovalInboxSlaStatus {
  if (ageHours > slaHours) return 'breached';
  if (ageHours >= Math.floor(slaHours * 0.75)) return 'due_today';
  return 'within_sla';
}

function getSeverity(
  slaStatus: ApprovalInboxSlaStatus,
  risk: keyof typeof RISK_WEIGHT,
  financialAmount: number,
): ApprovalInboxSeverity {
  if (slaStatus === 'breached' && (risk !== 'standard' || financialAmount >= 50000)) return 'critical';
  if (slaStatus === 'breached' || slaStatus === 'due_today' || financialAmount >= 50000) return 'warning';
  return 'normal';
}

export function buildApprovalInbox(reviews: ApprovalInboxReview[], now = new Date()) {
  const items = reviews
    .filter(review => review.status === 'pending_review')
    .map(review => {
      const info = APPROVAL_ACTION_INFO[review.action] || {
        label: review.action,
        group: review.permission_code,
        risk: 'standard' as const,
      };
      const details = parseDetails(review.details);
      const ageHours = hoursSince(review.created_at, now);
      const slaHours = GROUP_SLA_HOURS[info.group] || 24;
      const slaStatus = getSlaStatus(ageHours, slaHours);
      const financialAmount = getFinancialAmount(details);
      const severity = getSeverity(slaStatus, info.risk, financialAmount);

      return {
        review_id: review.review_id,
        permission_code: review.permission_code,
        action: review.action,
        entity_type: review.entity_type,
        group: info.group,
        label: info.label,
        requester: review.requested_by_name || 'ระบบ',
        age_hours: ageHours,
        age_days: Math.floor(ageHours / 24),
        sla_hours: slaHours,
        sla_status: slaStatus,
        severity,
        financial_amount: financialAmount,
        priority:
          (slaStatus === 'breached' ? 10000 : slaStatus === 'due_today' ? 5000 : 0) +
          RISK_WEIGHT[info.risk] +
          Math.min(financialAmount / 1000, 500) +
          ageHours,
      } satisfies ApprovalInboxItem;
    })
    .sort((a, b) => b.priority - a.priority || b.financial_amount - a.financial_amount || b.age_hours - a.age_hours);

  return {
    items,
    summary: {
      pending_total: items.length,
      breached_sla: items.filter(item => item.sla_status === 'breached').length,
      critical_total: items.filter(item => item.severity === 'critical').length,
      financial_exposure: items.reduce((sum, item) => sum + item.financial_amount, 0),
      oldest_hours: items.reduce((max, item) => Math.max(max, item.age_hours), 0),
      group_counts: items.reduce<Record<string, number>>((counts, item) => {
        counts[item.group] = (counts[item.group] || 0) + 1;
        return counts;
      }, {}),
    },
  };
}
