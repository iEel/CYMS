import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — Customer Portal: read-only booking detail + container drill down
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');
    if (!customerId) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('booking_id');
    if (!bookingId) {
      return NextResponse.json({ error: 'กรุณาระบุ booking_id' }, { status: 400 });
    }

    const db = await getDb();
    const cid = parseInt(customerId);

    const bookingResult = await db.request()
      .input('bookingId', sql.Int, parseInt(bookingId))
      .input('cid', sql.Int, cid)
      .query(`
        SELECT booking_id, booking_number, booking_type, status, vessel_name, voyage_number,
          container_count, received_count, released_count, eta, valid_from, valid_to, created_at
        FROM Bookings
        WHERE booking_id = @bookingId AND customer_id = @cid
      `);

    if (bookingResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Booking หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const containersResult = await db.request()
      .input('bookingId', sql.Int, parseInt(bookingId))
      .query(`
        SELECT bc.id, bc.container_id, bc.container_number, bc.status,
          bc.gate_in_at, bc.gate_out_at, bc.created_at,
          c.size, c.type, c.shipping_line, c.status as container_status,
          gi.eir_number as gate_in_eir_number,
          go.eir_number as gate_out_eir_number
        FROM BookingContainers bc
        LEFT JOIN Containers c ON bc.container_id = c.container_id
        OUTER APPLY (
          SELECT TOP 1 g.eir_number
          FROM GateTransactions g
          WHERE g.container_id = bc.container_id
            AND g.transaction_type = 'gate_in'
            AND (g.booking_ref = (SELECT booking_number FROM Bookings WHERE booking_id = @bookingId) OR bc.gate_in_at IS NOT NULL)
          ORDER BY g.created_at DESC
        ) gi
        OUTER APPLY (
          SELECT TOP 1 g.eir_number
          FROM GateTransactions g
          WHERE g.container_id = bc.container_id
            AND g.transaction_type = 'gate_out'
            AND (g.booking_ref = (SELECT booking_number FROM Bookings WHERE booking_id = @bookingId) OR bc.gate_out_at IS NOT NULL)
          ORDER BY g.created_at DESC
        ) go
        WHERE bc.booking_id = @bookingId
        ORDER BY
          CASE bc.status WHEN 'released' THEN 1 WHEN 'received' THEN 2 ELSE 3 END,
          bc.gate_out_at DESC, bc.gate_in_at DESC, bc.created_at DESC
      `);

    return NextResponse.json({
      booking: bookingResult.recordset[0],
      containers: containersResult.recordset,
    });
  } catch (error) {
    console.error('❌ Portal booking detail error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายละเอียด Booking ได้' }, { status: 500 });
  }
}
