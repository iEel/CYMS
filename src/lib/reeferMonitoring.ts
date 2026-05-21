export type ReeferPolicyScope = 'default' | 'yard' | 'customer' | 'booking' | 'container';
export type ReeferCheckStatus = 'normal' | 'out_of_range' | 'unreadable' | 'power_issue';
export type ReeferDueStatus = 'not_checked' | 'ok' | 'due' | 'overdue';

export interface ReeferPolicyInput {
  policy_id?: number | null;
  yard_id?: number | null;
  customer_id?: number | null;
  booking_id?: number | null;
  container_id?: number | null;
  scope_type?: string | null;
  cargo_profile?: string | null;
  interval_hours?: number | string | null;
  warning_grace_minutes?: number | string | null;
  min_temp_c?: number | string | null;
  max_temp_c?: number | string | null;
  is_active?: boolean | number | null;
}

export interface ReeferPolicy {
  policy_id: number | null;
  yard_id: number | null;
  customer_id: number | null;
  booking_id: number | null;
  container_id: number | null;
  scope_type: ReeferPolicyScope;
  cargo_profile: string | null;
  interval_hours: number;
  warning_grace_minutes: number;
  min_temp_c: number | null;
  max_temp_c: number | null;
  is_active: boolean;
}

interface CheckStatusInput {
  measured_temp_c: number | string | null | undefined;
  manual_status?: string | null;
  policy: ReeferPolicy;
}

interface DueStatusInput {
  last_checked_at?: string | Date | null;
  policy: ReeferPolicy;
  now?: Date;
}

const DEFAULT_INTERVAL_HOURS = 4;
const DEFAULT_GRACE_MINUTES = 30;

const SCOPE_PRIORITY: Record<ReeferPolicyScope, number> = {
  default: 1,
  yard: 2,
  customer: 3,
  booking: 4,
  container: 5,
};

function parseNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInt(value: number | string | null | undefined, fallback: number, max = 24 * 30) {
  const parsed = parseNumber(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeScope(scope?: string | null): ReeferPolicyScope {
  if (scope === 'yard' || scope === 'customer' || scope === 'booking' || scope === 'container') return scope;
  return 'default';
}

export function normalizeReeferPolicy(input: ReeferPolicyInput = {}): ReeferPolicy {
  return {
    policy_id: parseNumber(input.policy_id),
    yard_id: parseNumber(input.yard_id),
    customer_id: parseNumber(input.customer_id),
    booking_id: parseNumber(input.booking_id),
    container_id: parseNumber(input.container_id),
    scope_type: normalizeScope(input.scope_type),
    cargo_profile: input.cargo_profile || null,
    interval_hours: parsePositiveInt(input.interval_hours, DEFAULT_INTERVAL_HOURS),
    warning_grace_minutes: parsePositiveInt(input.warning_grace_minutes, DEFAULT_GRACE_MINUTES, 24 * 60),
    min_temp_c: parseNumber(input.min_temp_c),
    max_temp_c: parseNumber(input.max_temp_c),
    is_active: input.is_active === undefined || input.is_active === null ? true : Boolean(input.is_active),
  };
}

export function chooseEffectiveReeferPolicy(candidates: ReeferPolicyInput[]) {
  const active = candidates
    .map(normalizeReeferPolicy)
    .filter(policy => policy.is_active)
    .sort((a, b) => SCOPE_PRIORITY[b.scope_type] - SCOPE_PRIORITY[a.scope_type]);

  return active[0] || normalizeReeferPolicy({ scope_type: 'default' });
}

export function deriveReeferCheckStatus({ measured_temp_c, manual_status, policy }: CheckStatusInput): ReeferCheckStatus {
  if (manual_status === 'unreadable' || manual_status === 'power_issue') return manual_status;

  const measured = parseNumber(measured_temp_c);
  if (measured === null) return 'unreadable';
  if (policy.min_temp_c !== null && measured < policy.min_temp_c) return 'out_of_range';
  if (policy.max_temp_c !== null && measured > policy.max_temp_c) return 'out_of_range';
  return 'normal';
}

export function deriveReeferDueStatus({ last_checked_at, policy, now = new Date() }: DueStatusInput): ReeferDueStatus {
  if (!last_checked_at) return 'not_checked';
  const checkedAt = last_checked_at instanceof Date ? last_checked_at : new Date(last_checked_at);
  const checkedMs = checkedAt.getTime();
  if (!Number.isFinite(checkedMs)) return 'not_checked';

  const elapsedMinutes = (now.getTime() - checkedMs) / 60000;
  const dueMinutes = policy.interval_hours * 60;
  const overdueMinutes = dueMinutes + policy.warning_grace_minutes;
  if (elapsedMinutes > overdueMinutes) return 'overdue';
  if (elapsedMinutes >= dueMinutes) return 'due';
  return 'ok';
}

export function filterApplicableReeferPolicies(
  policies: ReeferPolicyInput[],
  context: { yard_id?: number | null; customer_id?: number | null; booking_id?: number | null; container_id?: number | null },
) {
  return policies.filter((policy) => {
    const normalized = normalizeReeferPolicy(policy);
    if (!normalized.is_active) return false;
    if (normalized.scope_type === 'default') return true;
    if (normalized.scope_type === 'yard') return normalized.yard_id === context.yard_id;
    if (normalized.scope_type === 'customer') return normalized.customer_id === context.customer_id;
    if (normalized.scope_type === 'booking') return normalized.booking_id === context.booking_id;
    if (normalized.scope_type === 'container') return normalized.container_id === context.container_id;
    return false;
  });
}
