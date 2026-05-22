export type ReeferEscalationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReeferEscalationStatus = 'open' | 'in_progress' | 'resolved' | 'ignored' | string;
export type ReeferEscalationLevel = 'none' | 'supervisor' | 'critical';

export interface ReeferEscalationInput {
  severity?: ReeferEscalationSeverity | string | null;
  status?: ReeferEscalationStatus | null;
  created_at?: Date | string | null;
}

export interface ReeferEscalationResult {
  level: ReeferEscalationLevel;
  breached: boolean;
  due_minutes: number;
  age_minutes: number;
  label: string;
  recommended_action: string;
}

const DUE_MINUTES_BY_SEVERITY: Record<ReeferEscalationSeverity, number> = {
  critical: 30,
  high: 120,
  medium: 240,
  low: 480,
};

function normalizeSeverity(value?: string | null): ReeferEscalationSeverity {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function ageInMinutes(createdAt: Date | string | null | undefined, now: Date) {
  if (!createdAt) return 0;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const timestamp = created.getTime();
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 60000));
}

export function deriveReeferEscalation(input: ReeferEscalationInput, now = new Date()): ReeferEscalationResult {
  const severity = normalizeSeverity(input.severity);
  const dueMinutes = DUE_MINUTES_BY_SEVERITY[severity];
  const ageMinutes = ageInMinutes(input.created_at, now);
  const status = input.status || 'open';

  if (status === 'resolved' || status === 'ignored') {
    return {
      level: 'none',
      breached: false,
      due_minutes: dueMinutes,
      age_minutes: ageMinutes,
      label: 'Closed',
      recommended_action: 'ไม่ต้อง escalation เพิ่ม',
    };
  }

  const breached = ageMinutes >= dueMinutes;
  const level: ReeferEscalationLevel = !breached ? 'none' : severity === 'critical' ? 'critical' : 'supervisor';

  return {
    level,
    breached,
    due_minutes: dueMinutes,
    age_minutes: ageMinutes,
    label: level === 'critical' ? 'Critical escalation' : level === 'supervisor' ? 'Supervisor escalation' : 'Within SLA',
    recommended_action: level === 'none'
      ? 'ติดตามตามรอบ SLA'
      : severity === 'critical'
        ? 'แจ้ง supervisor และช่าง reefer ทันที'
        : 'แจ้ง supervisor เพื่อติดตามก่อนเกิน SLA เพิ่ม',
  };
}
