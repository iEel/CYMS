import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — Customer's containers
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

    let whereClause = 'WHERE c.customer_id = @cid';
    if (status) whereClause += ' AND c.status = @status';

    const req = db.request().input('cid', sql.Int, cid);
    if (status) req.input('status', sql.NVarChar, status);

    // Count
    const countResult = await req.query(`SELECT COUNT(*) as total FROM Containers c ${whereClause}`);
    const total = countResult.recordset[0].total;

    // Data
    const req2 = db.request().input('cid', sql.Int, cid)
      .input('offset', sql.Int, offset).input('limit', sql.Int, limit);
    if (status) req2.input('status', sql.NVarChar, status);

    const result = await req2.query(`
      SELECT c.container_id, c.container_number, c.size, c.type, c.shipping_line,
        c.status, c.is_laden, c.bay, c.[row], c.tier,
        c.gate_in_date, c.gate_out_date,
        z.zone_name, y.yard_name
      FROM Containers c
      LEFT JOIN YardZones z ON c.zone_id = z.zone_id
      LEFT JOIN Yards y ON c.yard_id = y.yard_id
      ${whereClause}
      ORDER BY c.gate_in_date DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return NextResponse.json({
      containers: result.recordset,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ Portal containers error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}
