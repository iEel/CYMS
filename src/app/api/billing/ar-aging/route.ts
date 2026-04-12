import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — AR Aging Report (ยอดค้างชำระแยกตามอายุหนี้)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');

    const db = await getDb();

    // Get all outstanding invoices (issued or overdue) with age calculation
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT 
          i.invoice_id, i.invoice_number, i.customer_id, i.grand_total,
          i.status, i.created_at, i.due_date,
          c.customer_name,
          ISNULL(c.is_line, 0) as is_line,
          ISNULL(c.is_forwarder, 0) as is_forwarder,
          ISNULL(c.is_trucking, 0) as is_trucking,
          DATEDIFF(DAY, i.created_at, GETDATE()) as age_days
        FROM Invoices i
        LEFT JOIN Customers c ON i.customer_id = c.customer_id
        WHERE i.yard_id = @yardId 
          AND i.status IN ('issued', 'overdue')
          AND i.grand_total > 0
        ORDER BY c.customer_name, i.created_at
      `);

    const invoices = result.recordset;

    // Bucket invoices by age
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0 };
    const customerMap: Record<number, {
      customer_id: number;
      customer_name: string;
      is_line: boolean;
      is_forwarder: boolean;
      is_trucking: boolean;
      current: number;
      d30: number;
      d60: number;
      d90: number;
      d90plus: number;
      total: number;
      invoice_count: number;
      oldest_days: number;
    }> = {};

    invoices.forEach((inv: {
      customer_id: number;
      customer_name: string;
      is_line: boolean;
      is_forwarder: boolean;
      is_trucking: boolean;
      grand_total: number;
      age_days: number;
    }) => {
      const age = inv.age_days;
      const amt = inv.grand_total;

      // Summary buckets
      if (age <= 0) { buckets.current += amt; }
      else if (age <= 30) { buckets.d30 += amt; }
      else if (age <= 60) { buckets.d60 += amt; }
      else if (age <= 90) { buckets.d90 += amt; }
      else { buckets.d90plus += amt; }
      buckets.total += amt;

      // Per customer
      const cid = inv.customer_id;
      if (!customerMap[cid]) {
        customerMap[cid] = {
          customer_id: cid,
          customer_name: inv.customer_name || 'ไม่ระบุ',
          is_line: inv.is_line,
          is_forwarder: inv.is_forwarder,
          is_trucking: inv.is_trucking,
          current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0,
          total: 0, invoice_count: 0, oldest_days: 0,
        };
      }
      const c = customerMap[cid];
      if (age <= 0) { c.current += amt; }
      else if (age <= 30) { c.d30 += amt; }
      else if (age <= 60) { c.d60 += amt; }
      else if (age <= 90) { c.d90 += amt; }
      else { c.d90plus += amt; }
      c.total += amt;
      c.invoice_count++;
      c.oldest_days = Math.max(c.oldest_days, age);
    });

    // Sort customers by total outstanding (desc)
    const customers = Object.values(customerMap).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      summary: buckets,
      customers,
      total_invoices: invoices.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ GET ar-aging error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล AR Aging ได้' }, { status: 500 });
  }
}
