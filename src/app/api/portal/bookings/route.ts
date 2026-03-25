import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — Customer's bookings
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

    let whereClause = 'WHERE b.customer_id = @cid';
    if (status) whereClause += ' AND b.status = @status';

    const req = db.request().input('cid', sql.Int, cid);
    if (status) req.input('status', sql.NVarChar, status);

    const countResult = await req.query(`SELECT COUNT(*) as total FROM Bookings b ${whereClause}`);
    const total = countResult.recordset[0].total;

    const req2 = db.request().input('cid', sql.Int, cid)
      .input('offset', sql.Int, offset).input('limit', sql.Int, limit);
    if (status) req2.input('status', sql.NVarChar, status);

    const result = await req2.query(`
      SELECT b.booking_id, b.booking_number, b.booking_type, b.status,
        b.vessel_name, b.voyage_number, b.container_count,
        b.received_count, b.released_count, b.eta,
        b.valid_from, b.valid_to, b.created_at
      FROM Bookings b
      ${whereClause}
      ORDER BY b.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return NextResponse.json({
      bookings: result.recordset,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ Portal bookings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}
