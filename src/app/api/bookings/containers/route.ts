import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึงรายการตู้ที่ผูกกับ Booking
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('booking_id');

    if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });

    const db = await getDb();
    const result = await db.request()
      .input('bookingId', sql.Int, parseInt(bookingId))
      .query(`
        SELECT bc.*, c.size, c.type, c.status AS container_status,
               c.shipping_line, c.zone_id, c.bay, c.row, c.tier,
               z.zone_name
        FROM BookingContainers bc
        LEFT JOIN Containers c ON bc.container_id = c.container_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE bc.booking_id = @bookingId
        ORDER BY bc.created_at ASC
      `);

    return NextResponse.json({ containers: result.recordset });
  } catch (error) {
    console.error('❌ GET booking containers error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// POST — เพิ่มตู้เข้า Booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_id, container_number, container_id } = body;

    if (!booking_id || !container_number) {
      return NextResponse.json({ error: 'booking_id and container_number required' }, { status: 400 });
    }

    const db = await getDb();

    // Check if already linked
    const exists = await db.request()
      .input('bookingId', sql.Int, booking_id)
      .input('containerNumber', sql.NVarChar, container_number.toUpperCase())
      .query(`SELECT 1 FROM BookingContainers WHERE booking_id = @bookingId AND container_number = @containerNumber`);

    if (exists.recordset.length > 0) {
      return NextResponse.json({ error: 'ตู้นี้ผูกกับ Booking นี้แล้ว' }, { status: 400 });
    }

    await db.request()
      .input('bookingId', sql.Int, booking_id)
      .input('containerId', sql.Int, container_id || null)
      .input('containerNumber', sql.NVarChar, container_number.toUpperCase())
      .query(`INSERT INTO BookingContainers (booking_id, container_id, container_number) VALUES (@bookingId, @containerId, @containerNumber)`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST booking container error:', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มตู้ได้' }, { status: 500 });
  }
}

// DELETE — ถอดตู้ออกจาก Booking
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = await getDb();
    await db.request()
      .input('id', sql.Int, parseInt(id))
      .query(`DELETE FROM BookingContainers WHERE id = @id`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE booking container error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบได้' }, { status: 500 });
  }
}
