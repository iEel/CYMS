import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { applyPortalGrants, buildBookingContainerGrants } from '@/lib/portalGrantRules';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

const BOOKING_CONTAINER_PERMISSIONS = ['booking.manage', 'gate.in', 'gate.out'];

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function loadBookingForAccess(db: Awaited<ReturnType<typeof getDb>>, bookingId: number) {
  const bookingResult = await db.request()
    .input('bookingId', sql.Int, bookingId)
    .query(`
      SELECT booking_id, booking_number, yard_id, customer_id, booking_customer_id, shipping_line_id,
        forwarder_id, shipper_id, consignee_id, trucking_company_id, bill_to_customer_id
      FROM Bookings
      WHERE booking_id = @bookingId
    `);

  return bookingResult.recordset[0] || null;
}

// GET — ดึงรายการตู้ที่ผูกกับ Booking
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = parsePositiveInt(searchParams.get('booking_id'));

    if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 });

    const db = await getDb();
    const permission = await requireAnyPermission(
      request,
      db,
      BOOKING_CONTAINER_PERMISSIONS,
      'คุณไม่มีสิทธิ์ดูตู้ใน Booking'
    );
    if (permission instanceof Response) return permission;

    const booking = await loadBookingForAccess(db, bookingId);
    if (!booking) return NextResponse.json({ error: 'ไม่พบ Booking' }, { status: 404 });

    const yardAccess = await requireYardAccess(request, db, booking.yard_id, 'คุณไม่มีสิทธิ์ดู Booking ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    const result = await db.request()
      .input('bookingId', sql.Int, bookingId)
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
    const bookingId = parsePositiveInt(body.booking_id);
    const containerId = parsePositiveInt(body.container_id);
    const containerNumber = typeof body.container_number === 'string'
      ? body.container_number.trim().toUpperCase()
      : '';

    if (!bookingId || !containerNumber) {
      return NextResponse.json({ error: 'booking_id and container_number required' }, { status: 400 });
    }

    const db = await getDb();
    const permission = await requireAnyPermission(
      request,
      db,
      BOOKING_CONTAINER_PERMISSIONS,
      'คุณไม่มีสิทธิ์เพิ่มตู้เข้า Booking'
    );
    if (permission instanceof Response) return permission;

    const booking = await loadBookingForAccess(db, bookingId);
    if (!booking) return NextResponse.json({ error: 'ไม่พบ Booking' }, { status: 404 });

    const yardAccess = await requireYardAccess(request, db, booking.yard_id, 'คุณไม่มีสิทธิ์เพิ่มตู้เข้า Booking ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    // Check if already linked
    const exists = await db.request()
      .input('bookingId', sql.Int, bookingId)
      .input('containerNumber', sql.NVarChar, containerNumber)
      .query(`SELECT 1 FROM BookingContainers WHERE booking_id = @bookingId AND container_number = @containerNumber`);

    if (exists.recordset.length > 0) {
      return NextResponse.json({ error: 'ตู้นี้ผูกกับ Booking นี้แล้ว' }, { status: 400 });
    }

    const linkResult = await db.request()
      .input('bookingId', sql.Int, bookingId)
      .input('containerId', sql.Int, containerId)
      .input('containerNumber', sql.NVarChar, containerNumber)
      .query(`
        INSERT INTO BookingContainers (booking_id, container_id, container_number)
        OUTPUT INSERTED.id
        VALUES (@bookingId, @containerId, @containerNumber)
      `);

    await applyPortalGrants(db, buildBookingContainerGrants(booking, {
      id: linkResult.recordset[0]?.id || null,
      container_id: containerId,
      container_number: containerNumber,
    }));

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
    const id = parsePositiveInt(searchParams.get('id'));

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = await getDb();
    const permission = await requireAnyPermission(
      request,
      db,
      BOOKING_CONTAINER_PERMISSIONS,
      'คุณไม่มีสิทธิ์ถอดตู้ออกจาก Booking'
    );
    if (permission instanceof Response) return permission;

    const linkResult = await db.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT bc.id, bc.booking_id, bc.container_number, b.yard_id
        FROM BookingContainers bc
        JOIN Bookings b ON b.booking_id = bc.booking_id
        WHERE bc.id = @id
      `);
    const link = linkResult.recordset[0];
    if (!link) return NextResponse.json({ error: 'ไม่พบรายการตู้ใน Booking' }, { status: 404 });

    const yardAccess = await requireYardAccess(request, db, link.yard_id, 'คุณไม่มีสิทธิ์ถอดตู้ออกจาก Booking ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    await db.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM BookingContainers WHERE id = @id`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE booking container error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบได้' }, { status: 500 });
  }
}
