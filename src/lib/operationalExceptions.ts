import type { ReconciliationActionStatus } from '@/lib/reconciliationActions';

export type OperationalExceptionSource = 'reconciliation' | 'reefer' | 'approval' | 'transport';
export type OperationalExceptionSeverity = 'info' | 'warning' | 'critical';
export type OperationalExceptionStatus = ReconciliationActionStatus | 'in_progress' | 'pending_review' | 'acknowledged';
export type OperationalExceptionAction = 'assign' | 'acknowledge' | 'resolve' | 'ignore' | 'reopen' | 'open_detail';

export interface OperationalExceptionItem {
  exception_id: string;
  source: OperationalExceptionSource;
  issue_code: string;
  title: string;
  message: string;
  severity: OperationalExceptionSeverity;
  status: OperationalExceptionStatus;
  yard_id?: number | null;
  entity_type: string;
  entity_id?: number | string | null;
  entity_ref?: string | null;
  owner_role?: string | null;
  assigned_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  sla_age_days?: number;
  sla_age_minutes?: number;
  sla_breached?: boolean;
  recommended_action?: string | null;
  href: string;
  allowed_actions: OperationalExceptionAction[];
  context: Record<string, unknown>;
}

export interface OperationalExceptionSummary {
  total_open: number;
  critical: number;
  warning: number;
  info: number;
  sla_breached: number;
  by_source: Record<OperationalExceptionSource, number>;
}

interface ReconciliationExceptionIssue {
  code: string;
  title: string;
  message?: string;
  severity: string;
  owner_role?: string;
  recommended_action?: string;
}

const RECONCILIATION_ACTIONS: OperationalExceptionAction[] = ['assign', 'resolve', 'ignore', 'open_detail'];
const APPROVAL_ACTIONS: OperationalExceptionAction[] = ['open_detail'];
const TRANSPORT_ACTIONS: OperationalExceptionAction[] = ['assign', 'acknowledge', 'open_detail'];

export function buildOperationalIssueCode(source: OperationalExceptionSource, code: string) {
  return `${source}.${code}`;
}

function toStringValue(value: unknown, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function toNullableString(value: unknown) {
  const normalized = toStringValue(value).trim();
  return normalized ? normalized : null;
}

function firstNullableString(...values: unknown[]) {
  for (const value of values) {
    const normalized = toNullableString(value);
    if (normalized) return normalized;
  }
  return null;
}

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toEntityId(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return toNullableString(value);
}

function toIsoString(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

  const raw = String(value);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function normalizeCodePart(value: unknown, fallback: string) {
  const normalized = toStringValue(value, fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function normalizeSeverity(value: unknown, fallback: OperationalExceptionSeverity = 'warning'): OperationalExceptionSeverity {
  const normalized = toStringValue(value).trim().toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warning' || normalized === 'high' || normalized === 'medium') return 'warning';
  if (normalized === 'info' || normalized === 'low' || normalized === 'normal') return 'info';
  return fallback;
}

function normalizeStatus(value: unknown, fallback: OperationalExceptionStatus = 'open'): OperationalExceptionStatus {
  const normalized = toStringValue(value).trim().toLowerCase();
  if (normalized === 'open') return 'open';
  if (normalized === 'resolved') return 'resolved';
  if (normalized === 'ignored') return 'ignored';
  if (normalized === 'in_progress') return 'in_progress';
  if (normalized === 'pending_review') return 'pending_review';
  if (normalized === 'acknowledged') return 'acknowledged';
  if (normalized === 'approved' || normalized === 'completed' || normalized === 'released') return 'resolved';
  if (normalized === 'rejected' || normalized === 'cancelled') return 'ignored';
  return fallback;
}

function reeferAllowedActions(status: OperationalExceptionStatus): OperationalExceptionAction[] {
  if (status === 'resolved' || status === 'ignored') return ['reopen', 'open_detail'];
  if (status === 'in_progress' || status === 'acknowledged') return ['assign', 'resolve', 'ignore', 'open_detail'];
  return ['assign', 'acknowledge', 'resolve', 'ignore', 'open_detail'];
}

function positiveNumberOrNull(value: unknown) {
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function buildExceptionKey(issueCode: string, entityId: unknown, entityRef?: unknown) {
  return `${issueCode}:${toStringValue(entityId ?? entityRef, 'unknown')}`;
}

function transportRequestId(row: Record<string, unknown>) {
  const explicitId = positiveNumberOrNull(row.request_id);
  if (explicitId) return explicitId;

  const jobId = toNullableString(row.job_id);
  const match = jobId?.match(/^request-([1-9]\d*)$/);
  return match ? Number(match[1]) : null;
}

export function normalizeReconciliationException({
  issue,
  row,
}: {
  issue: ReconciliationExceptionIssue;
  row: Record<string, unknown>;
}): OperationalExceptionItem {
  const entityId = toEntityId(row.entity_id);
  const entityRef = toNullableString(row.reference);
  const issueCode = buildOperationalIssueCode('reconciliation', normalizeCodePart(issue.code, 'issue'));
  const slaAgeDays = toFiniteNumber(row.sla_age_days);

  return {
    exception_id: buildExceptionKey(issueCode, entityId, entityRef),
    source: 'reconciliation',
    issue_code: issueCode,
    title: issue.title,
    message: issue.message || issue.title,
    severity: normalizeSeverity(issue.severity),
    status: normalizeStatus(row.action_status),
    entity_type: 'reconciliation_issue',
    entity_id: entityId,
    entity_ref: entityRef,
    owner_role: issue.owner_role || 'Operations',
    assigned_to: toNullableString(row.action_assigned_to),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.action_updated_at),
    sla_age_days: slaAgeDays ?? 0,
    recommended_action: issue.recommended_action || null,
    href: toStringValue(row.deep_link, '/reports?tab=reconciliation'),
    allowed_actions: RECONCILIATION_ACTIONS,
    context: { ...row },
  };
}

export function normalizeReeferException(row: Record<string, unknown>): OperationalExceptionItem {
  const exceptionId = positiveNumberOrNull(row.exception_id);
  const reason = normalizeCodePart(row.reason, 'exception');
  const issueCode = buildOperationalIssueCode('reefer', reason);
  const recommendedAction = toNullableString(row.recommended_action);
  const ageMinutes = toFiniteNumber(row.escalation_age_minutes);
  const entityRef = firstNullableString(row.container_number, row.check_id);
  const status = normalizeStatus(row.status);

  return {
    exception_id: buildExceptionKey(issueCode, exceptionId, entityRef),
    source: 'reefer',
    issue_code: issueCode,
    title: `Reefer ${reason.replace(/_/g, ' ')}`,
    message: recommendedAction || reason,
    severity: normalizeSeverity(row.severity),
    status,
    yard_id: positiveNumberOrNull(row.yard_id),
    entity_type: 'reefer_exception',
    entity_id: exceptionId,
    entity_ref: entityRef,
    owner_role: 'Reefer',
    assigned_to: toNullableString(row.assigned_to ?? row.assigned_to_user_id),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
    sla_age_minutes: ageMinutes ?? 0,
    sla_breached: toBoolean(row.escalation_breached),
    recommended_action: recommendedAction,
    href: exceptionId ? `/reefer?exception_id=${exceptionId}` : '/reefer',
    allowed_actions: reeferAllowedActions(status),
    context: { ...row },
  };
}

export function normalizeApprovalException(row: Record<string, unknown>): OperationalExceptionItem {
  const reviewId = positiveNumberOrNull(row.review_id);
  const permissionCode = toStringValue(row.permission_code, 'approval');
  const reason = toNullableString(row.reason);
  const sourceEntityType = toNullableString(row.entity_type);
  const sourceEntityId = toNullableString(row.entity_id);
  const entityRef = sourceEntityType && sourceEntityId
    ? `${sourceEntityType}:${sourceEntityId}`
    : toNullableString(row.permission_code);

  return {
    exception_id: buildExceptionKey(buildOperationalIssueCode('approval', 'pending_review'), reviewId, entityRef),
    source: 'approval',
    issue_code: buildOperationalIssueCode('approval', 'pending_review'),
    title: `Pending approval ${permissionCode}`,
    message: reason || 'Supervisor review is pending',
    severity: normalizeSeverity(row.severity, 'warning'),
    status: normalizeStatus(row.status, 'pending_review'),
    yard_id: positiveNumberOrNull(row.yard_id),
    entity_type: 'approval_review',
    entity_id: reviewId,
    entity_ref: entityRef,
    owner_role: 'Supervisor',
    assigned_to: toNullableString(row.approved_by_name),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.reviewed_at),
    recommended_action: 'Open Supervisor Review',
    href: reviewId ? `/supervisor-review?review_id=${reviewId}` : '/supervisor-review',
    allowed_actions: APPROVAL_ACTIONS,
    context: { ...row },
  };
}

export function normalizeTransportException(row: Record<string, unknown>): OperationalExceptionItem {
  const requestId = transportRequestId(row);
  const status = toStringValue(row.status, 'attention');
  const issueReason = normalizeCodePart(status, 'attention');
  const issueCode = buildOperationalIssueCode('transport', issueReason);
  const attentionReason = toNullableString(row.attention_reason) || status;
  const entityRef = requestId
    ? firstNullableString(row.container_number, row.entity_ref, row.job_id)
    : firstNullableString(row.container_number, row.job_id, row.entity_ref);

  return {
    exception_id: buildExceptionKey(issueCode, requestId, entityRef),
    source: 'transport',
    issue_code: issueCode,
    title: 'Transport job needs attention',
    message: attentionReason,
    severity: normalizeSeverity(row.severity, issueReason === 'issue_reported' ? 'warning' : 'info'),
    status: normalizeStatus(row.status, 'open'),
    yard_id: positiveNumberOrNull(row.yard_id),
    entity_type: 'gate_out_request',
    entity_id: requestId,
    entity_ref: entityRef,
    owner_role: 'Transport',
    assigned_to: toNullableString(row.assigned_to),
    created_at: toIsoString(row.requested_at ?? row.created_at),
    updated_at: toIsoString(row.updated_at ?? row.last_activity_at),
    recommended_action: 'Review the transport job or submitted proof',
    href: requestId ? `/transport?job=request-${requestId}` : '/transport',
    allowed_actions: TRANSPORT_ACTIONS,
    context: { ...row },
  };
}

export function summarizeOperationalExceptions(items: OperationalExceptionItem[]): OperationalExceptionSummary {
  const summary: OperationalExceptionSummary = {
    total_open: 0,
    critical: 0,
    warning: 0,
    info: 0,
    sla_breached: 0,
    by_source: {
      reconciliation: 0,
      reefer: 0,
      approval: 0,
      transport: 0,
    },
  };

  for (const item of items) {
    if (item.status === 'resolved' || item.status === 'ignored') continue;

    summary.total_open += 1;
    summary[item.severity] += 1;
    summary.by_source[item.source] += 1;
    if (item.sla_breached) summary.sla_breached += 1;
  }

  return summary;
}
