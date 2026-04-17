import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { ensureCustomerCreditColumns } from '@/lib/customerCredit';
import { getDataQualityRule } from '@/lib/dataQualityRules';

type Severity = 'info' | 'warning' | 'critical';

interface IssueDefinition {
  code: string;
  title: string;
  severity: Severity;
  query: string;
}

function decorateIssue(code: string, fallbackTitle: string, fallbackSeverity: Severity) {
  const rule = getDataQualityRule(code);
  return {
    title: rule?.title || fallbackTitle,
    severity: rule?.severity || fallbackSeverity,
    owner_role: rule?.ownerRole || 'Operations',
    recommended_action: rule?.recommendedAction || 'ตรวจสอบรายการนี้',
    message: rule?.message || fallbackTitle,
  };
}

async function runIssue(db: sql.ConnectionPool, yardId: number, limit: number, definition: IssueDefinition) {
  const meta = decorateIssue(definition.code, definition.title, definition.severity);
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

const ISSUE_DEFINITIONS: IssueDefinition[] = [
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
        AND COL_LENGTH('GateTransactions', 'billing_clearance_id') IS NOT NULL
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = Number(searchParams.get('yard_id') || 1);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200);
    const db = await getDb();
    await ensureCustomerCreditColumns(db);

    const issues = [];
    for (const definition of ISSUE_DEFINITIONS) {
      issues.push(await runIssue(db, yardId, limit, definition));
    }

    const availableIssues = issues.filter((issue) => !issue.unavailable);
    const summary = {
      total_open: availableIssues.reduce((sum, issue) => sum + issue.count, 0),
      critical: availableIssues.filter((issue) => issue.severity === 'critical').reduce((sum, issue) => sum + issue.count, 0),
      warning: availableIssues.filter((issue) => issue.severity === 'warning').reduce((sum, issue) => sum + issue.count, 0),
      info: availableIssues.filter((issue) => issue.severity === 'info').reduce((sum, issue) => sum + issue.count, 0),
      unavailable_checks: issues.filter((issue) => issue.unavailable).length,
    };

    return NextResponse.json({
      yard_id: yardId,
      generated_at: new Date().toISOString(),
      summary,
      issues,
    });
  } catch (error) {
    console.error('GET reconciliation report error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายงาน reconciliation ได้' }, { status: 500 });
  }
}
