import sql from 'mssql';
import { getDataQualityRule } from '@/lib/dataQualityRules';
import { applyReconciliationActions, type ReconciliationActionRecord, type ReconciliationIssueRow } from '@/lib/reconciliationActions';

export type ReconciliationSeverity = 'info' | 'warning' | 'critical';

export interface ReconciliationIssueDefinition {
  code: string;
  title: string;
  severity: ReconciliationSeverity;
  query: string;
}

export interface ReconciliationIssueResult {
  code: string;
  title: string;
  severity: ReconciliationSeverity;
  owner_role: string;
  recommended_action: string;
  message: string;
  count: number;
  rows: ReconciliationIssueRow[];
  unavailable: boolean;
  error?: string;
  raw_count?: number;
  closed_count?: number;
}

export function decorateReconciliationIssue(code: string, fallbackTitle: string, fallbackSeverity: ReconciliationSeverity) {
  const rule = getDataQualityRule(code);
  return {
    title: rule?.title || fallbackTitle,
    severity: rule?.severity || fallbackSeverity,
    owner_role: rule?.ownerRole || 'Operations',
    recommended_action: rule?.recommendedAction || 'ตรวจสอบรายการนี้',
    message: rule?.message || fallbackTitle,
  };
}

export const RECONCILIATION_ISSUE_DEFINITIONS: ReconciliationIssueDefinition[] = [
  {
    code: 'gate_missing_eir',
    title: 'Gate transaction missing EIR',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        g.gate_id AS entity_id,
        g.transaction_type,
        g.container_number,
        c.container_number AS container_master_number,
        g.created_at,
        'Gate #' + CAST(g.gate_id AS NVARCHAR(20)) AS reference
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      WHERE g.yard_id = @yardId
        AND (g.eir_number IS NULL OR LTRIM(RTRIM(g.eir_number)) = '')
      ORDER BY g.created_at DESC
    `,
  },
  {
    code: 'gate_missing_billing_clearance',
    title: 'Gate transaction missing billing clearance',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        g.gate_id AS entity_id,
        g.transaction_type,
        ISNULL(g.container_number, c.container_number) AS container_number,
        g.eir_number,
        g.created_at,
        'Gate #' + CAST(g.gate_id AS NVARCHAR(20)) AS reference
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      WHERE g.yard_id = @yardId
        AND g.billing_clearance_id IS NULL
      ORDER BY g.created_at DESC
    `,
  },
  {
    code: 'invoice_open_overdue',
    title: 'Open or overdue invoice',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        i.invoice_id AS entity_id,
        i.invoice_number AS reference,
        c.customer_name,
        ct.container_number,
        i.status,
        ISNULL(i.balance_amount, i.grand_total) AS outstanding_amount,
        DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) AS overdue_days,
        i.created_at
      FROM Invoices i
      LEFT JOIN Customers c ON i.customer_id = c.customer_id
      LEFT JOIN Containers ct ON i.container_id = ct.container_id
      WHERE i.yard_id = @yardId
        AND i.status IN ('issued', 'overdue')
        AND ISNULL(i.balance_amount, i.grand_total) > 0
      ORDER BY overdue_days DESC, i.created_at
    `,
  },
  {
    code: 'booking_over_received',
    title: 'Booking over received',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        b.booking_id AS entity_id,
        b.booking_number AS reference,
        b.container_count,
        util.received_count,
        util.released_count,
        b.status,
        b.created_at
      FROM Bookings b
      OUTER APPLY (
        SELECT
          COUNT(CASE WHEN bc.status IN ('received', 'released') THEN 1 END) AS received_count,
          COUNT(CASE WHEN bc.status = 'released' THEN 1 END) AS released_count
        FROM BookingContainers bc
        WHERE bc.booking_id = b.booking_id
      ) util
      WHERE b.yard_id = @yardId
        AND b.status <> 'cancelled'
        AND util.received_count > ISNULL(b.container_count, 0)
      ORDER BY b.created_at DESC
    `,
  },
  {
    code: 'booking_over_released',
    title: 'Booking over released',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        b.booking_id AS entity_id,
        b.booking_number AS reference,
        b.container_count,
        util.received_count,
        util.released_count,
        b.status,
        b.created_at
      FROM Bookings b
      OUTER APPLY (
        SELECT
          COUNT(CASE WHEN bc.status IN ('received', 'released') THEN 1 END) AS received_count,
          COUNT(CASE WHEN bc.status = 'released' THEN 1 END) AS released_count
        FROM BookingContainers bc
        WHERE bc.booking_id = b.booking_id
      ) util
      WHERE b.yard_id = @yardId
        AND b.status <> 'cancelled'
        AND util.released_count > ISNULL(b.container_count, 0)
      ORDER BY b.created_at DESC
    `,
  },
  {
    code: 'mnr_completed_without_invoice',
    title: 'Completed M&R without invoice',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        r.eor_id AS entity_id,
        r.eor_number AS reference,
        c.container_number,
        ISNULL(r.actual_cost, r.estimated_cost) AS amount,
        r.status,
        r.completed_at,
        r.created_at
      FROM RepairOrders r
      LEFT JOIN Containers c ON r.container_id = c.container_id
      WHERE r.yard_id = @yardId
        AND r.status = 'completed'
        AND ISNULL(r.invoice_id, 0) = 0
        AND ISNULL(r.actual_cost, r.estimated_cost) > 0
      ORDER BY ISNULL(r.completed_at, r.created_at) DESC
    `,
  },
  {
    code: 'edi_failed',
    title: 'Failed integration message',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        log_id AS entity_id,
        integration_type AS reference,
        endpoint_name,
        status,
        retry_count,
        error_message,
        created_at
      FROM IntegrationLogs
      WHERE yard_id = @yardId
        AND status IN ('failed', 'retrying')
      ORDER BY created_at DESC
    `,
  },
  {
    code: 'customer_credit_over_limit',
    title: 'Customer credit over limit',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        c.customer_id AS entity_id,
        c.customer_name AS reference,
        ISNULL(c.credit_limit, 0) AS credit_limit,
        ISNULL(SUM(CASE WHEN i.status IN ('issued', 'overdue')
          THEN ISNULL(i.balance_amount, i.grand_total) ELSE 0 END), 0) AS outstanding_amount,
        MAX(CASE WHEN i.status IN ('issued', 'overdue')
          THEN DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) ELSE 0 END) AS oldest_overdue_days
      FROM Customers c
      LEFT JOIN Invoices i ON i.customer_id = c.customer_id AND i.yard_id = @yardId
      WHERE ISNULL(c.credit_limit, 0) > 0
      GROUP BY c.customer_id, c.customer_name, c.credit_limit
      HAVING ISNULL(SUM(CASE WHEN i.status IN ('issued', 'overdue')
        THEN ISNULL(i.balance_amount, i.grand_total) ELSE 0 END), 0) > ISNULL(c.credit_limit, 0)
      ORDER BY outstanding_amount DESC
    `,
  },
];

export async function runReconciliationIssue(
  db: sql.ConnectionPool,
  yardId: number,
  limit: number,
  definition: ReconciliationIssueDefinition,
): Promise<ReconciliationIssueResult> {
  const meta = decorateReconciliationIssue(definition.code, definition.title, definition.severity);
  try {
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('limit', sql.Int, limit)
      .query(definition.query);

    return {
      code: definition.code,
      ...meta,
      count: result.recordset.length,
      rows: result.recordset,
      unavailable: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      code: definition.code,
      ...meta,
      count: 0,
      rows: [],
      unavailable: true,
      error: message,
    };
  }
}

export async function loadReconciliationActionRecords(db: sql.ConnectionPool, yardId: number): Promise<ReconciliationActionRecord[]> {
  try {
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT
          action_id,
          issue_code,
          entity_id,
          entity_ref,
          status,
          reason,
          assigned_to,
          updated_at
        FROM ReconciliationActions
        WHERE yard_id = @yardId
      `);

    return result.recordset as ReconciliationActionRecord[];
  } catch {
    return [];
  }
}

export function buildReconciliationIssueResponse({
  issue,
  actions,
  includeClosed,
  now = new Date(),
}: {
  issue: ReconciliationIssueResult;
  actions: ReconciliationActionRecord[];
  includeClosed: boolean;
  now?: Date;
}): ReconciliationIssueResult {
  if (issue.unavailable) return issue;

  const rawRows = issue.rows as ReconciliationIssueRow[];
  const rows = applyReconciliationActions({
    issueCode: issue.code,
    rows: rawRows,
    actions,
    includeClosed,
    now,
  });

  return {
    ...issue,
    raw_count: rawRows.length,
    closed_count: rawRows.length - rows.length,
    count: rows.length,
    rows,
  };
}
