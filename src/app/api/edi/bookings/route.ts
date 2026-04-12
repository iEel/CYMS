import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

function bookingSummarySelect() {
  return `
    b.booking_number, b.booking_id, b.vessel_name, b.voyage_number,
    b.booking_type, b.status, b.customer_id, c.customer_name,
    b.container_count, b.container_size, b.container_type,
    ISNULL(b.received_count, 0) as received_count,
    ISNULL(b.released_count, 0) as released_count,
    (SELECT COUNT(*) FROM BookingContainers bc2 WHERE bc2.booking_id = b.booking_id) AS linked_containers,
    (SELECT COUNT(*) FROM BookingContainers bc3 WHERE bc3.booking_id = b.booking_id AND bc3.status = 'received') AS received_containers,
    (SELECT COUNT(*) FROM BookingContainers bc4 WHERE bc4.booking_id = b.booking_id AND bc4.status = 'released') AS released_containers
  `;
}

// GET — ดึง Bookings (with progress counts)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lookup = searchParams.get('lookup');

    // === Lookup mode: find booking by container_number or container_id ===
    if (lookup === '1') {
      const db = await getDb();
      const containerNumber = searchParams.get('container_number');
      const containerId = searchParams.get('container_id');
      const bookingNumber = searchParams.get('booking_number');
      const yardId = searchParams.get('yard_id');

      if (bookingNumber) {
        const req = db.request().input('bkRef', sql.NVarChar, bookingNumber.trim());
        if (yardId) req.input('yardId', sql.Int, parseInt(yardId));
        const result = await req.query(`
          SELECT TOP 1 ${bookingSummarySelect()}
          FROM Bookings b
          LEFT JOIN Customers c ON b.customer_id = c.customer_id
          WHERE b.booking_number = @bkRef
          ${yardId ? 'AND b.yard_id = @yardId' : ''}
          ORDER BY b.created_at DESC
        `);
        return NextResponse.json({ booking: result.recordset[0] || null });
      }

      if (containerNumber) {
        // Find booking that expects or already owns this container number.
        const req = db.request().input('cNum', sql.NVarChar, containerNumber.toUpperCase());
        if (yardId) req.input('yardId', sql.Int, parseInt(yardId));
        const result = await req.query(`
          SELECT TOP 1 ${bookingSummarySelect()}
          FROM BookingContainers bc
          JOIN Bookings b ON bc.booking_id = b.booking_id
          LEFT JOIN Customers c ON b.customer_id = c.customer_id
          WHERE bc.container_number = @cNum AND b.status IN ('pending', 'confirmed')
          ${yardId ? 'AND b.yard_id = @yardId' : ''}
          ORDER BY b.created_at DESC
        `);
        return NextResponse.json({ booking: result.recordset[0] || null });
      }

      if (containerId) {
        // Gate-Out: find booking linked to this container. Try container_id first, then container_number.
        const req = db.request().input('cId', sql.Int, parseInt(containerId));
        if (yardId) req.input('yardId', sql.Int, parseInt(yardId));
        const result = await req.query(`
          WITH CandidateBookings AS (
            SELECT b.booking_id, 0 AS match_priority
            FROM BookingContainers bc
            JOIN Bookings b ON bc.booking_id = b.booking_id
            WHERE bc.container_id = @cId AND bc.status = 'received'
            ${yardId ? 'AND b.yard_id = @yardId' : ''}

            UNION ALL

            SELECT b.booking_id, 1 AS match_priority
            FROM BookingContainers bc
            JOIN Bookings b ON bc.booking_id = b.booking_id
            JOIN Containers ct ON ct.container_id = @cId
            WHERE bc.container_id IS NULL
              AND bc.container_number = ct.container_number
              AND bc.status = 'received'
            ${yardId ? 'AND b.yard_id = @yardId' : ''}
          )
          SELECT TOP 1 ${bookingSummarySelect()}
          FROM CandidateBookings cb
          JOIN Bookings b ON cb.booking_id = b.booking_id
          LEFT JOIN Customers c ON b.customer_id = c.customer_id
          ORDER BY cb.match_priority, b.created_at DESC
        `);
        return NextResponse.json({ booking: result.recordset[0] || null });
      }

      return NextResponse.json({ booking: null });
    }

    // === Normal listing mode ===
    const yardId = searchParams.get('yard_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const db = await getDb();
    const conditions: string[] = [];

    // Build conditions (shared between count + data queries)
    const reqCount = db.request();
    const reqData = db.request();

    if (yardId) {
      conditions.push('b.yard_id = @yardId');
      reqCount.input('yardId', sql.Int, parseInt(yardId));
      reqData.input('yardId', sql.Int, parseInt(yardId));
    }
    if (status) {
      conditions.push('b.status = @status');
      reqCount.input('status', sql.NVarChar, status);
      reqData.input('status', sql.NVarChar, status);
    }
    if (search) {
      conditions.push('(b.booking_number LIKE @search OR b.vessel_name LIKE @search)');
      reqCount.input('search', sql.NVarChar, `%${search}%`);
      reqData.input('search', sql.NVarChar, `%${search}%`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await reqCount.query(`SELECT COUNT(*) AS total FROM Bookings b ${where}`);
    const total = countResult.recordset[0].total;
    const totalPages = Math.ceil(total / limit);

    // Fetch page
    reqData.input('offset', sql.Int, offset);
    reqData.input('limit', sql.Int, limit);

    const result = await reqData.query(`
      SELECT b.*, c.customer_name,
        (SELECT COUNT(*) FROM BookingContainers bc WHERE bc.booking_id = b.booking_id) AS linked_containers
      FROM Bookings b
      LEFT JOIN Customers c ON b.customer_id = c.customer_id
      ${where}
      ORDER BY b.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return NextResponse.json({ bookings: result.recordset, total, totalPages, page, limit });
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
      .input('validFrom', sql.DateTime2, body.valid_from || null)
      .input('validTo', sql.DateTime2, body.valid_to || null)
      .input('sealNumber', sql.NVarChar, body.seal_number || null)
      .input('notes', sql.NVarChar, body.notes || null)
      .query(`
        INSERT INTO Bookings (booking_number, yard_id, customer_id, booking_type,
          vessel_name, voyage_number, container_count, container_size, container_type,
          eta, valid_from, valid_to, seal_number, notes)
        OUTPUT INSERTED.*
        VALUES (@bookingNumber, @yardId, @customerId, @bookingType,
          @vesselName, @voyageNumber, @containerCount, @containerSize, @containerType,
          @eta, @validFrom, @validTo, @sealNumber, @notes)
      `);

    const booking = result.recordset[0];

    // Auto-create BookingContainers if container_numbers provided
    if (body.container_numbers && Array.isArray(body.container_numbers)) {
      for (const cn of body.container_numbers) {
        if (cn && cn.trim()) {
          await db.request()
            .input('bookingId', sql.Int, booking.booking_id)
            .input('containerNumber', sql.NVarChar, cn.trim().toUpperCase())
            .query(`INSERT INTO BookingContainers (booking_id, container_number) VALUES (@bookingId, @containerNumber)`);
        }
      }
    }

    await logAudit({ yardId: body.yard_id, action: 'booking_create', entityType: 'booking', entityId: booking.booking_id, details: { booking_number: body.booking_number, booking_type: body.booking_type, container_count: body.container_count } });

    return NextResponse.json({ success: true, booking });
  } catch (error: unknown) {
    console.error('❌ POST booking error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'เลข Booking นี้มีอยู่แล้ว' : 'ไม่สามารถสร้าง booking ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — อัปเดต Booking (supports multiple fields)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    const sets: string[] = [];
    const req = db.request().input('bookingId', sql.Int, body.booking_id);

    if (body.status !== undefined) { sets.push('status = @status'); req.input('status', sql.NVarChar, body.status); }
    if (body.vessel_name !== undefined) { sets.push('vessel_name = @vesselName'); req.input('vesselName', sql.NVarChar, body.vessel_name); }
    if (body.voyage_number !== undefined) { sets.push('voyage_number = @voyageNumber'); req.input('voyageNumber', sql.NVarChar, body.voyage_number); }
    if (body.container_count !== undefined) { sets.push('container_count = @containerCount'); req.input('containerCount', sql.Int, body.container_count); }
    if (body.container_size !== undefined) { sets.push('container_size = @containerSize'); req.input('containerSize', sql.NVarChar, body.container_size); }
    if (body.container_type !== undefined) { sets.push('container_type = @containerType'); req.input('containerType', sql.NVarChar, body.container_type); }
    if (body.eta !== undefined) { sets.push('eta = @eta'); req.input('eta', sql.DateTime2, body.eta || null); }
    if (body.valid_from !== undefined) { sets.push('valid_from = @validFrom'); req.input('validFrom', sql.DateTime2, body.valid_from || null); }
    if (body.valid_to !== undefined) { sets.push('valid_to = @validTo'); req.input('validTo', sql.DateTime2, body.valid_to || null); }
    if (body.customer_id !== undefined) { sets.push('customer_id = @customerId'); req.input('customerId', sql.Int, body.customer_id || null); }
    if (body.seal_number !== undefined) { sets.push('seal_number = @sealNumber'); req.input('sealNumber', sql.NVarChar, body.seal_number); }
    if (body.notes !== undefined) { sets.push('notes = @notes'); req.input('notes', sql.NVarChar, body.notes); }

    if (sets.length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องอัปเดต' }, { status: 400 });

    await req.query(`UPDATE Bookings SET ${sets.join(', ')} WHERE booking_id = @bookingId`);

    await logAudit({ action: 'booking_update', entityType: 'booking', entityId: body.booking_id, details: { status: body.status, vessel_name: body.vessel_name } });

    // Send email notification if status changed
    if (body.status && ['confirmed', 'completed', 'cancelled'].includes(body.status)) {
      try {
        const { getEmailConfig, sendEmail, bookingStatusEmail } = await import('@/lib/emailService');
        const emailConfig = await getEmailConfig();
        if (emailConfig.enabled) {
          // Check if booking notifications are enabled
          const settingsRes = await db.request().query(`
            SELECT setting_value FROM SystemSettings WHERE setting_key = 'email_notify_booking'
          `);
          const notifyBooking = settingsRes.recordset[0]?.setting_value === 'true';

          if (notifyBooking) {
            // Fetch booking + customer details
            const bkRes = await db.request()
              .input('bkId', sql.Int, body.booking_id)
              .query(`
                SELECT b.*, c.customer_name, c.contact_email
                FROM Bookings b
                LEFT JOIN Customers c ON b.customer_id = c.customer_id
                WHERE b.booking_id = @bkId
              `);
            const bk = bkRes.recordset[0];
            if (bk?.contact_email) {
              const emailData = bookingStatusEmail({
                bookingNumber: bk.booking_number,
                status: body.status,
                customerName: bk.customer_name || '',
                vesselName: bk.vessel_name,
                voyageNumber: bk.voyage_number,
                containerCount: bk.container_count || 0,
                receivedCount: bk.received_count || 0,
                releasedCount: bk.released_count || 0,
                eventType: 'status_change',
              });
              await sendEmail({ to: bk.contact_email, ...emailData });
            }
          }
        }
      } catch (emailErr) {
        console.error('⚠️ Booking status email error (non-blocking):', emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT booking error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต booking ได้' }, { status: 500 });
  }
}
