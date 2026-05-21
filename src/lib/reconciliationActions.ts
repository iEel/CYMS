export type ReconciliationActionStatus = 'open' | 'resolved' | 'ignored';

export interface ReconciliationIssueRow {
  entity_id?: number | string | null;
  reference?: string | null;
  created_at?: string | Date | null;
  [key: string]: unknown;
}

export interface ReconciliationActionRecord {
  action_id?: number;
  issue_code: string;
  entity_id?: number | string | null;
  entity_ref?: string | null;
  status: ReconciliationActionStatus;
  reason?: string | null;
  assigned_to?: string | null;
  updated_at?: string | Date | null;
}

export interface ReconciliationActionRow extends ReconciliationIssueRow {
  action_id?: number;
  action_status: ReconciliationActionStatus;
  action_reason?: string | null;
  action_assigned_to?: string | null;
  action_updated_at?: string | Date | null;
  sla_age_days: number;
  deep_link: string;
}

export function getReconciliationEntityKey(issueCode: string, row: ReconciliationIssueRow) {
  const rawId = row.entity_id ?? row.reference ?? 'unknown';
  return `${issueCode}:${String(rawId)}`;
}

function entityId(row: ReconciliationIssueRow) {
  const id = row.entity_id;
  if (id === null || id === undefined || id === '') return null;
  return encodeURIComponent(String(id));
}

export function buildReconciliationDeepLink(issueCode: string, row: ReconciliationIssueRow) {
  const id = entityId(row);
  const reference = row.reference ? encodeURIComponent(String(row.reference)) : '';

  if (issueCode.startsWith('invoice_') || issueCode === 'gate_missing_billing_clearance' || issueCode === 'customer_credit_over_limit') {
    return id ? `/billing?invoice_id=${id}` : '/billing';
  }
  if (issueCode.startsWith('booking_')) {
    return id ? `/booking?booking_id=${id}` : '/booking';
  }
  if (issueCode.startsWith('gate_')) {
    return id ? `/gate?transaction_id=${id}` : '/gate';
  }
  if (issueCode.startsWith('mnr_')) {
    return id ? `/mnr?eor_id=${id}` : '/mnr';
  }
  if (issueCode.startsWith('edi_')) {
    return reference ? `/edi?reference=${reference}` : '/edi';
  }
  return '/reports';
}

function calcSlaAgeDays(row: ReconciliationIssueRow, now: Date) {
  const rawDate = row.created_at;
  if (!rawDate) return 0;
  const createdAt = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(createdAt.getTime())) return 0;
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function actionKey(action: ReconciliationActionRecord) {
  const rawId = action.entity_id ?? action.entity_ref ?? 'unknown';
  return `${action.issue_code}:${String(rawId)}`;
}

export function applyReconciliationActions({
  issueCode,
  rows,
  actions,
  includeClosed = false,
  now = new Date(),
}: {
  issueCode: string;
  rows: ReconciliationIssueRow[];
  actions: ReconciliationActionRecord[];
  includeClosed?: boolean;
  now?: Date;
}): ReconciliationActionRow[] {
  const actionMap = new Map(actions.map(action => [actionKey(action), action]));

  return rows
    .map((row) => {
      const action = actionMap.get(getReconciliationEntityKey(issueCode, row));
      const status = action?.status || 'open';
      return {
        ...row,
        action_id: action?.action_id,
        action_status: status,
        action_reason: action?.reason,
        action_assigned_to: action?.assigned_to,
        action_updated_at: action?.updated_at,
        sla_age_days: calcSlaAgeDays(row, now),
        deep_link: buildReconciliationDeepLink(issueCode, row),
      };
    })
    .filter(row => includeClosed || row.action_status === 'open');
}
