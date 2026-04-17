import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — Customer Portal: Statement / AR summary for current customer
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');
    if (!customerId) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 403 });
    }

    const db = await getDb();
    const cid = parseInt(customerId);

    const summaryResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN status = 'issued' THEN grand_total ELSE 0 END), 0) as outstanding,
          ISNULL(SUM(CASE WHEN status = 'paid' THEN grand_total ELSE 0 END), 0) as paid_total,
          ISNULL(SUM(CASE WHEN status = 'credit_note' OR document_type = 'credit_note' OR invoice_number LIKE 'CN-%' THEN ABS(grand_total) ELSE 0 END), 0) as credit_note_total,
          COUNT(CASE WHEN status = 'issued' THEN 1 END) as open_count,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'credit_note' OR document_type = 'credit_note' OR invoice_number LIKE 'CN-%' THEN 1 END) as credit_note_count,
          ISNULL(SUM(CASE WHEN status = 'issued' AND DATEDIFF(DAY, ISNULL(due_date, created_at), GETDATE()) <= 0 THEN grand_total ELSE 0 END), 0) as not_due,
          ISNULL(SUM(CASE WHEN status = 'issued' AND DATEDIFF(DAY, ISNULL(due_date, created_at), GETDATE()) BETWEEN 1 AND 30 THEN grand_total ELSE 0 END), 0) as due_1_30,
          ISNULL(SUM(CASE WHEN status = 'issued' AND DATEDIFF(DAY, ISNULL(due_date, created_at), GETDATE()) BETWEEN 31 AND 60 THEN grand_total ELSE 0 END), 0) as due_31_60,
          ISNULL(SUM(CASE WHEN status = 'issued' AND DATEDIFF(DAY, ISNULL(due_date, created_at), GETDATE()) > 60 THEN grand_total ELSE 0 END), 0) as due_over_60
        FROM Invoices
        WHERE customer_id = @cid
          AND (
            status IN ('issued', 'paid', 'cancelled', 'credit_note')
            OR document_type = 'credit_note'
            OR invoice_number LIKE 'CN-%'
          )
      `);

    const openResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT TOP 20 invoice_id, invoice_number, charge_type, grand_total, due_date, created_at,
          DATEDIFF(DAY, ISNULL(due_date, created_at), GETDATE()) as overdue_days
        FROM Invoices
        WHERE customer_id = @cid AND status = 'issued'
        ORDER BY ISNULL(due_date, created_at) ASC, created_at ASC
      `);

    return NextResponse.json({
      summary: summaryResult.recordset[0] || {},
      open_items: openResult.recordset,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Portal statement error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด Statement ได้' }, { status: 500 });
  }
}
