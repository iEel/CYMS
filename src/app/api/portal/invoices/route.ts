import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — Customer's invoices
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');
    if (!customerId) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 403 });
    }

    const db = await getDb();
    const cid = parseInt(customerId);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE i.customer_id = @cid';
    if (status) whereClause += ' AND i.status = @status';

    const req = db.request().input('cid', sql.Int, cid);
    if (status) req.input('status', sql.NVarChar, status);

    const countResult = await req.query(`SELECT COUNT(*) as total FROM Invoices i ${whereClause}`);
    const total = countResult.recordset[0].total;

    // Summary
    const sumReq = db.request().input('cid', sql.Int, cid);
    const sumResult = await sumReq.query(`
      SELECT
        ISNULL(SUM(CASE WHEN status = 'issued' THEN grand_total ELSE 0 END), 0) as outstanding,
        ISNULL(SUM(CASE WHEN status = 'paid' THEN grand_total ELSE 0 END), 0) as paid_total,
        COUNT(CASE WHEN status = 'issued' THEN 1 END) as issued_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
      FROM Invoices WHERE customer_id = @cid
    `);

    const req2 = db.request().input('cid', sql.Int, cid)
      .input('offset', sql.Int, offset).input('limit', sql.Int, limit);
    if (status) req2.input('status', sql.NVarChar, status);

    const result = await req2.query(`
      SELECT i.invoice_id, i.invoice_number, i.charge_type, i.total_before_vat,
        i.vat_amount, i.grand_total, i.status, i.created_at, i.paid_at,
        c.container_number
      FROM Invoices i
      LEFT JOIN Containers c ON i.container_id = c.container_id
      ${whereClause}
      ORDER BY i.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return NextResponse.json({
      invoices: result.recordset,
      summary: sumResult.recordset[0],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ Portal invoices error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}
