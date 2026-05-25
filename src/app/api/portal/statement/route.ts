import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { getPortalCustomerId, portalInvoiceVisibilitySql } from '@/lib/portalAccess';
import { requirePortalAction } from '@/lib/customerPortalPermissions';

// GET — Customer Portal: Statement / AR summary for current customer
export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.invoice.view');
    if (portalActor instanceof NextResponse) return portalActor;

    const summaryResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN i.status = 'issued' THEN i.grand_total ELSE 0 END), 0) as outstanding,
          ISNULL(SUM(CASE WHEN i.status = 'paid' THEN i.grand_total ELSE 0 END), 0) as paid_total,
          ISNULL(SUM(CASE WHEN i.status = 'credit_note' OR i.document_type = 'credit_note' OR i.invoice_number LIKE 'CN-%' THEN ABS(i.grand_total) ELSE 0 END), 0) as credit_note_total,
          COUNT(CASE WHEN i.status = 'issued' THEN 1 END) as open_count,
          COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN i.status = 'credit_note' OR i.document_type = 'credit_note' OR i.invoice_number LIKE 'CN-%' THEN 1 END) as credit_note_count,
          ISNULL(SUM(CASE WHEN i.status = 'issued' AND DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) <= 0 THEN i.grand_total ELSE 0 END), 0) as not_due,
          ISNULL(SUM(CASE WHEN i.status = 'issued' AND DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) BETWEEN 1 AND 30 THEN i.grand_total ELSE 0 END), 0) as due_1_30,
          ISNULL(SUM(CASE WHEN i.status = 'issued' AND DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) BETWEEN 31 AND 60 THEN i.grand_total ELSE 0 END), 0) as due_31_60,
          ISNULL(SUM(CASE WHEN i.status = 'issued' AND DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) > 60 THEN i.grand_total ELSE 0 END), 0) as due_over_60
        FROM Invoices i
        WHERE ${portalInvoiceVisibilitySql('i')}
          AND (
            i.status IN ('issued', 'paid', 'cancelled', 'credit_note')
            OR i.document_type = 'credit_note'
            OR i.invoice_number LIKE 'CN-%'
          )
      `);

    const openResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT TOP 20 invoice_id, invoice_number, charge_type, grand_total, due_date, created_at,
          DATEDIFF(DAY, ISNULL(due_date, created_at), GETDATE()) as overdue_days
        FROM Invoices i
        WHERE ${portalInvoiceVisibilitySql('i')} AND i.status = 'issued'
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
