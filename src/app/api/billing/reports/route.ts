import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const type = searchParams.get('type') || 'daily'; // 'daily' | 'monthly'
    const date = searchParams.get('date'); // YYYY-MM-DD for daily, YYYY-MM for monthly

    const db = await getDb();

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
