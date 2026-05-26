import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

function positiveInt(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeQuery(value: string | null) {
  return (value || '').trim();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const query = normalizeQuery(searchParams.get('q'));

    if (!yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    if (query.length < 2) {
      return NextResponse.json({ query, results: [] });
    }

    const db = await getDb();
    const actor = await requireAnyPermission(request, db, ['gate.out'], 'คุณไม่มีสิทธิ์ค้นหาตู้ Gate Out');
    if (actor instanceof NextResponse) return actor;

    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;

    const search = `%${query}%`;
    const containerResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('search', sql.NVarChar, search)
      .query(`
        SELECT TOP 20 c.*, y.yard_name, z.zone_name, z.zone_type
        FROM Containers c
        LEFT JOIN Yards y ON c.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE c.yard_id = @yardId
          AND c.status <> 'gated_out'
          AND c.container_number LIKE @search
        ORDER BY c.updated_at DESC
      `);

    const bookingResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('search', sql.NVarChar, search)
      .query(`
        SELECT TOP 10 b.booking_id, b.booking_number, b.booking_type, b.status,
          b.customer_id, b.booking_customer_id, b.shipping_line_id, b.forwarder_id,
          b.shipper_id, b.consignee_id, b.trucking_company_id, b.bill_to_customer_id,
          b.vessel_name, b.voyage_number, b.container_count, b.container_size,
          b.container_type, b.received_count, b.released_count,
          c.customer_name,
          bookingCustomer.customer_name AS booking_customer_name,
          shippingLine.customer_name AS shipping_line_name,
          trucking.customer_name AS trucking_company_name,
          billTo.customer_name AS bill_to_customer_name
        FROM Bookings b
        LEFT JOIN Customers c ON b.customer_id = c.customer_id
        LEFT JOIN Customers bookingCustomer ON bookingCustomer.customer_id = COALESCE(b.booking_customer_id, b.customer_id)
        LEFT JOIN Customers shippingLine ON shippingLine.customer_id = b.shipping_line_id
        LEFT JOIN Customers trucking ON trucking.customer_id = b.trucking_company_id
        LEFT JOIN Customers billTo ON billTo.customer_id = b.bill_to_customer_id
        WHERE b.yard_id = @yardId
          AND b.booking_number LIKE @search
        ORDER BY b.created_at DESC
      `);

    const bookingIds = bookingResult.recordset
      .map(row => Number(row.booking_id))
      .filter(bookingId => Number.isInteger(bookingId) && bookingId > 0);
    const bookingContainers = new Map<number, Record<string, unknown>[]>();

    if (bookingIds.length > 0) {
      const containerReq = db.request().input('yardId', sql.Int, yardId);
      const idParams = bookingIds.map((bookingId, index) => {
        const paramName = `bookingId${index}`;
        containerReq.input(paramName, sql.Int, bookingId);
        return `@${paramName}`;
      });

      const linkedResult = await containerReq.query(`
        SELECT bc.booking_id, bc.status AS booking_container_status,
          c.*, y.yard_name, z.zone_name, z.zone_type
        FROM BookingContainers bc
        JOIN Containers c
          ON (bc.container_id = c.container_id OR (bc.container_id IS NULL AND bc.container_number = c.container_number))
        LEFT JOIN Yards y ON c.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE bc.booking_id IN (${idParams.join(', ')})
          AND c.yard_id = @yardId
          AND c.status <> 'gated_out'
          AND (bc.status IS NULL OR bc.status <> 'released')
        ORDER BY c.updated_at DESC
      `);

      for (const row of linkedResult.recordset) {
        const bookingId = Number(row.booking_id);
        bookingContainers.set(bookingId, [...(bookingContainers.get(bookingId) || []), row]);
      }
    }

    const results = [
      ...containerResult.recordset.map(container => ({
        result_type: 'container' as const,
        selectable: true,
        container,
        booking: null,
        containers: [],
      })),
      ...bookingResult.recordset.map(booking => {
        const containers = bookingContainers.get(Number(booking.booking_id)) || [];
        const bookingClosed = ['cancelled', 'completed'].includes(String(booking.status));
        return {
          result_type: 'booking' as const,
          selectable: !bookingClosed && containers.length > 0,
          booking,
          container: null,
          containers,
          message: bookingClosed
            ? 'Booking นี้ปิดหรือยกเลิกแล้ว'
            : containers.length === 0
              ? 'พบ Booking แต่ยังไม่มีตู้ในลานสำหรับปล่อยออก'
              : null,
        };
      }),
    ];

    return NextResponse.json({ query, results });
  } catch (error) {
    console.error('Gate Out search error:', error);
    return NextResponse.json({ error: 'ไม่สามารถค้นหา Gate Out ได้' }, { status: 500 });
  }
}
