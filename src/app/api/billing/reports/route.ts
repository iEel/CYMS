import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

type DbPool = Awaited<ReturnType<typeof getDb>>;

async function ensureBillingControlSchema(db: DbPool) {
  await db.request().query(`
    IF OBJECT_ID('BillingClearances', 'U') IS NULL
    BEGIN
      CREATE TABLE BillingClearances (
        clearance_id INT PRIMARY KEY IDENTITY(1,1),
        yard_id INT NOT NULL,
        transaction_type NVARCHAR(20) NOT NULL,
        container_id INT NULL,
        container_number NVARCHAR(15) NULL,
        customer_id INT NULL,
        clearance_type NVARCHAR(20) NOT NULL,
        original_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        final_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        reason NVARCHAR(500) NULL,
        invoice_id INT NULL,
        approved_by INT NULL,
        charges NVARCHAR(MAX) NULL,
        created_by INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
      );
    END

    IF COL_LENGTH('GateTransactions', 'billing_clearance_id') IS NULL
      ALTER TABLE GateTransactions ADD billing_clearance_id INT NULL;
    IF COL_LENGTH('Invoices', 'document_type') IS NULL
      ALTER TABLE Invoices ADD document_type NVARCHAR(30) NULL;
    IF COL_LENGTH('Invoices', 'balance_amount') IS NULL
      ALTER TABLE Invoices ADD balance_amount DECIMAL(12,2) NULL;
    IF COL_LENGTH('Invoices', 'ref_invoice_id') IS NULL
      ALTER TABLE Invoices ADD ref_invoice_id INT NULL;
  `);
}

function getPeriod(date: string | null, type: string) {
  if (type === 'monthly') {
    const targetMonth = date || new Date().toISOString().slice(0, 7);
    const [year, month] = targetMonth.split('-').map(Number);
    const from = `${targetMonth}-01`;
    const to = new Date(year, month, 0).toISOString().slice(0, 10);
    return { label: targetMonth, from, to };
  }

  const targetDate = date || new Date().toISOString().slice(0, 10);
  return { label: targetDate, from: targetDate, to: targetDate };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const type = searchParams.get('type') || 'daily'; // 'daily' | 'monthly' | 'control'
    const date = searchParams.get('date'); // YYYY-MM-DD for daily, YYYY-MM for monthly

    const db = await getDb();
    await ensureBillingControlSchema(db);

    if (type === 'control') {
      const periodType = searchParams.get('period') || (date?.length === 7 ? 'monthly' : 'daily');
      const period = getPeriod(date, periodType);

      const summary = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('dateFrom', sql.NVarChar, period.from)
        .input('dateTo', sql.NVarChar, period.to)
        .query(`
          SELECT
            COUNT(CASE WHEN bc.clearance_type = 'paid' THEN 1 END) AS paid_count,
            COUNT(CASE WHEN bc.clearance_type = 'credit' THEN 1 END) AS credit_count,
            COUNT(CASE WHEN bc.clearance_type = 'no_charge' THEN 1 END) AS no_charge_count,
            COUNT(CASE WHEN bc.clearance_type = 'waived' THEN 1 END) AS waived_count,
            ISNULL(SUM(CASE WHEN bc.clearance_type = 'paid' THEN bc.final_amount ELSE 0 END), 0) AS paid_amount,
            ISNULL(SUM(CASE WHEN bc.clearance_type = 'credit' THEN bc.final_amount ELSE 0 END), 0) AS credit_amount,
            ISNULL(SUM(CASE WHEN bc.clearance_type = 'waived' THEN bc.original_amount - bc.final_amount ELSE 0 END), 0) AS waived_amount,
            ISNULL(SUM(CASE WHEN bc.clearance_type = 'no_charge' THEN bc.original_amount ELSE 0 END), 0) AS no_charge_amount
          FROM BillingClearances bc
          WHERE bc.yard_id = @yardId
            AND CAST(bc.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
        `);

      const exceptions = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('dateFrom', sql.NVarChar, period.from)
        .input('dateTo', sql.NVarChar, period.to)
        .query(`
          SELECT
            (SELECT COUNT(*)
             FROM GateTransactions gt
             WHERE gt.yard_id = @yardId
               AND CAST(gt.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
               AND gt.transaction_type IN ('gate_in', 'gate_out')
               AND gt.billing_clearance_id IS NULL) AS missing_clearance_count,
            (SELECT COUNT(*)
             FROM Invoices i
             WHERE i.yard_id = @yardId
               AND CAST(i.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
               AND i.status IN ('issued', 'overdue')) AS outstanding_invoice_count,
            (SELECT ISNULL(SUM(ISNULL(i.balance_amount, i.grand_total)), 0)
             FROM Invoices i
             WHERE i.yard_id = @yardId
               AND CAST(i.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
               AND i.status IN ('issued', 'overdue')) AS outstanding_amount,
            (SELECT COUNT(*)
             FROM Invoices i
             WHERE i.yard_id = @yardId
               AND CAST(i.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
               AND (i.status = 'credit_note' OR i.document_type = 'credit_note' OR i.invoice_number LIKE 'CN-%')) AS credit_note_count,
            (SELECT ISNULL(SUM(ABS(i.grand_total)), 0)
             FROM Invoices i
             WHERE i.yard_id = @yardId
               AND CAST(i.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
               AND (i.status = 'credit_note' OR i.document_type = 'credit_note' OR i.invoice_number LIKE 'CN-%')) AS credit_note_amount
        `);

      const rows = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('dateFrom', sql.NVarChar, period.from)
        .input('dateTo', sql.NVarChar, period.to)
        .query(`
          SELECT TOP 500 *
          FROM (
            SELECT
              'clearance' AS row_type,
              CASE
                WHEN bc.clearance_type = 'paid' THEN 'ok'
                WHEN bc.clearance_type = 'credit' THEN 'watch'
                ELSE 'review'
              END AS severity,
              bc.created_at AS event_at,
              bc.transaction_type,
              bc.container_number,
              c.customer_name,
              gt.eir_number,
              gt.booking_ref,
              i.invoice_id,
              i.invoice_number,
              i.status AS invoice_status,
              bc.clearance_type AS control_type,
              bc.original_amount,
              bc.final_amount,
              CASE WHEN bc.clearance_type = 'waived' THEN bc.original_amount - bc.final_amount ELSE 0 END AS impact_amount,
              bc.reason,
              u.full_name AS actor_name,
              'ผ่าน Billing Clearance แล้ว' AS title
            FROM BillingClearances bc
            LEFT JOIN Customers c ON bc.customer_id = c.customer_id
            LEFT JOIN Invoices i ON bc.invoice_id = i.invoice_id
            OUTER APPLY (
              SELECT TOP 1 eir_number, booking_ref
              FROM GateTransactions
              WHERE billing_clearance_id = bc.clearance_id
              ORDER BY created_at DESC
            ) gt
            LEFT JOIN Users u ON COALESCE(bc.approved_by, bc.created_by) = u.user_id
            WHERE bc.yard_id = @yardId
              AND CAST(bc.created_at AS DATE) BETWEEN @dateFrom AND @dateTo

            UNION ALL

            SELECT
              'missing_clearance' AS row_type,
              'danger' AS severity,
              gt.created_at AS event_at,
              gt.transaction_type,
              ct.container_number,
              COALESCE(bcst.customer_name, own.customer_name) AS customer_name,
              gt.eir_number,
              gt.booking_ref,
              NULL AS invoice_id,
              NULL AS invoice_number,
              NULL AS invoice_status,
              'missing_clearance' AS control_type,
              0 AS original_amount,
              0 AS final_amount,
              0 AS impact_amount,
              'Gate transaction ไม่มี billing_clearance_id' AS reason,
              u.full_name AS actor_name,
              'Gate แล้วแต่ไม่มี Billing Clearance' AS title
            FROM GateTransactions gt
            LEFT JOIN Containers ct ON gt.container_id = ct.container_id
            LEFT JOIN Customers bcst ON gt.billing_customer_id = bcst.customer_id
            LEFT JOIN Customers own ON gt.container_owner_id = own.customer_id
            LEFT JOIN Users u ON gt.processed_by = u.user_id
            WHERE gt.yard_id = @yardId
              AND CAST(gt.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
              AND gt.transaction_type IN ('gate_in', 'gate_out')
              AND gt.billing_clearance_id IS NULL

            UNION ALL

            SELECT
              'outstanding_invoice' AS row_type,
              CASE WHEN i.status = 'overdue' OR (i.due_date IS NOT NULL AND i.due_date < GETDATE()) THEN 'danger' ELSE 'watch' END AS severity,
              i.created_at AS event_at,
              NULL AS transaction_type,
              ct.container_number,
              c.customer_name,
              NULL AS eir_number,
              ct.booking_ref,
              i.invoice_id,
              i.invoice_number,
              i.status AS invoice_status,
              'outstanding' AS control_type,
              i.grand_total AS original_amount,
              ISNULL(i.balance_amount, i.grand_total) AS final_amount,
              ISNULL(i.balance_amount, i.grand_total) AS impact_amount,
              CASE WHEN i.due_date IS NOT NULL THEN CONCAT('Due ', CONVERT(varchar(10), i.due_date, 120)) ELSE 'ยังไม่ชำระ' END AS reason,
              NULL AS actor_name,
              'บิลค้างชำระ' AS title
            FROM Invoices i
            LEFT JOIN Customers c ON i.customer_id = c.customer_id
            LEFT JOIN Containers ct ON i.container_id = ct.container_id
            WHERE i.yard_id = @yardId
              AND CAST(i.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
              AND i.status IN ('issued', 'overdue')

            UNION ALL

            SELECT
              'credit_note' AS row_type,
              'review' AS severity,
              i.created_at AS event_at,
              NULL AS transaction_type,
              ct.container_number,
              c.customer_name,
              NULL AS eir_number,
              ct.booking_ref,
              i.invoice_id,
              i.invoice_number,
              i.status AS invoice_status,
              'credit_note' AS control_type,
              ABS(i.grand_total) AS original_amount,
              0 AS final_amount,
              ABS(i.grand_total) AS impact_amount,
              i.notes AS reason,
              NULL AS actor_name,
              'ใบลดหนี้' AS title
            FROM Invoices i
            LEFT JOIN Customers c ON i.customer_id = c.customer_id
            LEFT JOIN Containers ct ON i.container_id = ct.container_id
            WHERE i.yard_id = @yardId
              AND CAST(i.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
              AND (i.status = 'credit_note' OR i.document_type = 'credit_note' OR i.invoice_number LIKE 'CN-%')
          ) report
          ORDER BY
            CASE severity WHEN 'danger' THEN 0 WHEN 'review' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END,
            event_at DESC
        `);

      return NextResponse.json({
        type: 'control',
        period_type: periodType,
        date_from: period.from,
        date_to: period.to,
        summary: {
          ...summary.recordset[0],
          ...exceptions.recordset[0],
        },
        rows: rows.recordset,
      });
    }

    if (type === 'daily') {
      const targetDate = date || new Date().toISOString().slice(0, 10);

      // Daily invoices
      const invoices = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('targetDate', sql.NVarChar, targetDate)
        .query(`
          SELECT i.invoice_id, i.invoice_number, i.charge_type, i.description,
            i.quantity, i.unit_price, i.total_amount, i.vat_amount, i.grand_total,
            i.status, i.created_at, i.paid_at,
            c.customer_name, ct.container_number
          FROM Invoices i
          LEFT JOIN Customers c ON i.customer_id = c.customer_id
          LEFT JOIN Containers ct ON i.container_id = ct.container_id
          WHERE i.yard_id = @yardId AND CAST(i.created_at AS DATE) = @targetDate
          ORDER BY i.created_at DESC
        `);

      // Daily summary
      const summary = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('targetDate', sql.NVarChar, targetDate)
        .query(`
          SELECT
            COUNT(*) as total_invoices,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_count,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
            ISNULL(SUM(CASE WHEN status != 'cancelled' THEN grand_total END), 0) as total_billed,
            ISNULL(SUM(CASE WHEN status = 'paid' THEN grand_total END), 0) as total_collected,
            ISNULL(SUM(CASE WHEN status = 'issued' THEN grand_total END), 0) as total_outstanding
          FROM Invoices
          WHERE yard_id = @yardId AND CAST(created_at AS DATE) = @targetDate
        `);

      // Breakdown by charge type
      const byChargeType = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('targetDate', sql.NVarChar, targetDate)
        .query(`
          SELECT charge_type,
            COUNT(*) as count,
            ISNULL(SUM(grand_total), 0) as total
          FROM Invoices
          WHERE yard_id = @yardId AND CAST(created_at AS DATE) = @targetDate AND status != 'cancelled'
          GROUP BY charge_type ORDER BY total DESC
        `);

      // Gate activity on this day
      const gateActivity = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('targetDate', sql.NVarChar, targetDate)
        .query(`
          SELECT
            COUNT(CASE WHEN transaction_type = 'gate_in' THEN 1 END) as gate_in,
            COUNT(CASE WHEN transaction_type = 'gate_out' THEN 1 END) as gate_out
          FROM GateTransactions
          WHERE yard_id = @yardId AND CAST(created_at AS DATE) = @targetDate
        `);

      return NextResponse.json({
        type: 'daily',
        date: targetDate,
        invoices: invoices.recordset,
        summary: summary.recordset[0],
        byChargeType: byChargeType.recordset,
        gateActivity: gateActivity.recordset[0],
      });

    } else {
      // Monthly report
      const targetMonth = date || new Date().toISOString().slice(0, 7); // YYYY-MM
      const [year, month] = targetMonth.split('-').map(Number);

      // Monthly summary
      const summary = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('year', sql.Int, year)
        .input('month', sql.Int, month)
        .query(`
          SELECT
            COUNT(*) as total_invoices,
            COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
            COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_count,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
            ISNULL(SUM(CASE WHEN status != 'cancelled' THEN grand_total END), 0) as total_billed,
            ISNULL(SUM(CASE WHEN status = 'paid' THEN grand_total END), 0) as total_collected,
            ISNULL(SUM(CASE WHEN status = 'issued' THEN grand_total END), 0) as total_outstanding,
            ISNULL(SUM(CASE WHEN status != 'cancelled' THEN vat_amount END), 0) as total_vat
          FROM Invoices
          WHERE yard_id = @yardId AND YEAR(created_at) = @year AND MONTH(created_at) = @month
        `);

      // Daily breakdown for the month
      const dailyBreakdown = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('year', sql.Int, year)
        .input('month', sql.Int, month)
        .query(`
          SELECT
            CAST(created_at AS DATE) as date,
            COUNT(*) as count,
            ISNULL(SUM(CASE WHEN status != 'cancelled' THEN grand_total END), 0) as total,
            ISNULL(SUM(CASE WHEN status = 'paid' THEN grand_total END), 0) as collected
          FROM Invoices
          WHERE yard_id = @yardId AND YEAR(created_at) = @year AND MONTH(created_at) = @month
          GROUP BY CAST(created_at AS DATE)
          ORDER BY CAST(created_at AS DATE)
        `);

      // By charge type
      const byChargeType = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('year', sql.Int, year)
        .input('month', sql.Int, month)
        .query(`
          SELECT charge_type,
            COUNT(*) as count,
            ISNULL(SUM(grand_total), 0) as total
          FROM Invoices
          WHERE yard_id = @yardId AND YEAR(created_at) = @year AND MONTH(created_at) = @month AND status != 'cancelled'
          GROUP BY charge_type ORDER BY total DESC
        `);

      // Top customers
      const topCustomers = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('year', sql.Int, year)
        .input('month', sql.Int, month)
        .query(`
          SELECT TOP 10 c.customer_name,
            COUNT(*) as invoice_count,
            ISNULL(SUM(i.grand_total), 0) as total
          FROM Invoices i
          LEFT JOIN Customers c ON i.customer_id = c.customer_id
          WHERE i.yard_id = @yardId AND YEAR(i.created_at) = @year AND MONTH(i.created_at) = @month AND i.status != 'cancelled'
          GROUP BY c.customer_name ORDER BY total DESC
        `);

      // Gate activity
      const gateActivity = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('year', sql.Int, year)
        .input('month', sql.Int, month)
        .query(`
          SELECT
            COUNT(CASE WHEN transaction_type = 'gate_in' THEN 1 END) as gate_in,
            COUNT(CASE WHEN transaction_type = 'gate_out' THEN 1 END) as gate_out
          FROM GateTransactions
          WHERE yard_id = @yardId AND YEAR(created_at) = @year AND MONTH(created_at) = @month
        `);

      return NextResponse.json({
        type: 'monthly',
        month: targetMonth,
        summary: summary.recordset[0],
        dailyBreakdown: dailyBreakdown.recordset,
        byChargeType: byChargeType.recordset,
        topCustomers: topCustomers.recordset,
        gateActivity: gateActivity.recordset[0],
      });
    }
  } catch (error) {
    console.error('❌ GET billing report error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายงานได้' }, { status: 500 });
  }
}
