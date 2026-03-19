import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึง Bookings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const db = await getDb();
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) { conditions.push('b.yard_id = @yardId'); req.input('yardId', sql.Int, parseInt(yardId)); }
    if (status) { conditions.push('b.status = @status'); req.input('status', sql.NVarChar, status); }
    if (search) { conditions.push('(b.booking_number LIKE @search OR b.vessel_name LIKE @search)'); req.input('search', sql.NVarChar, `%${search}%`); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT b.*, c.customer_name
      FROM Bookings b
      LEFT JOIN Customers c ON b.customer_id = c.customer_id
      ${where}
      ORDER BY b.created_at DESC
    `);

    return NextResponse.json({ bookings: result.recordset });
  } catch (error) {
    console.error('❌ GET bookings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล booking ได้' }, { status: 500 });
  }
}

// POST — สร้าง Booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    const result = await db.request()
      .input('bookingNumber', sql.NVarChar, body.booking_number)
      .input('yardId', sql.Int, body.yard_id)
      .input('customerId', sql.Int, body.customer_id || null)
      .input('bookingType', sql.NVarChar, body.booking_type)
      .input('vesselName', sql.NVarChar, body.vessel_name || null)
      .input('voyageNumber', sql.NVarChar, body.voyage_number || null)
      .input('containerCount', sql.Int, body.container_count || 1)
      .input('containerSize', sql.NVarChar, body.container_size || null)
      .input('containerType', sql.NVarChar, body.container_type || null)
      .input('eta', sql.DateTime2, body.eta || null)
      .input('sealNumber', sql.NVarChar, body.seal_number || null)
      .input('notes', sql.NVarChar, body.notes || null)
      .query(`
        INSERT INTO Bookings (booking_number, yard_id, customer_id, booking_type,
          vessel_name, voyage_number, container_count, container_size, container_type,
          eta, seal_number, notes)
        OUTPUT INSERTED.*
        VALUES (@bookingNumber, @yardId, @customerId, @bookingType,
          @vesselName, @voyageNumber, @containerCount, @containerSize, @containerType,
          @eta, @sealNumber, @notes)
      `);

    return NextResponse.json({ success: true, booking: result.recordset[0] });
  } catch (error: unknown) {
    console.error('❌ POST booking error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'เลข Booking นี้มีอยู่แล้ว' : 'ไม่สามารถสร้าง booking ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — อัปเดต Booking
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    await db.request()
      .input('bookingId', sql.Int, body.booking_id)
      .input('status', sql.NVarChar, body.status)
      .query('UPDATE Bookings SET status = @status WHERE booking_id = @bookingId');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT booking error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต booking ได้' }, { status: 500 });
  }
}
