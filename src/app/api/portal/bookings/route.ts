import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { decoratePortalBooking, decoratePortalBookings } from '@/lib/portalBooking';
import { getPortalCustomerId, portalBookingVisibilitySql, portalVisibilityReasonSql } from '@/lib/portalAccess';
import { applyPortalGrants, buildBookingContainerGrants, buildBookingPartyGrants } from '@/lib/portalGrantRules';
import { ensureReeferBookingPolicy } from '@/lib/reeferBookingPolicy';
import { requirePortalAction } from '@/lib/customerPortalPermissions';

const BOOKING_TYPES = new Set(['import', 'export', 'empty_pickup', 'empty_return']);

function cleanText(value: unknown, maxLength = 200) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeContainerNumbers(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : [];

  const seen = new Set<string>();
  return rawItems
    .map(item => cleanText(item, 20)?.toUpperCase())
    .filter((item): item is string => Boolean(item))
    .filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 100);
}

// GET — Customer's bookings
export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.booking.view');
    if (portalActor instanceof NextResponse) return portalActor;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let whereClause = `WHERE ${portalBookingVisibilitySql('b')}`;
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
        b.valid_from, b.valid_to, b.created_at,
        ${portalVisibilityReasonSql('booking', 'b.booking_id', 'b.booking_number')} AS visibility_role
      FROM Bookings b
      ${whereClause}
      ORDER BY b.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return NextResponse.json({
      bookings: decoratePortalBookings(result.recordset),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('❌ Portal bookings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}

// POST — Customer Portal: create a pending booking request for the logged-in customer
export async function POST(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.booking.create');
    if (portalActor instanceof NextResponse) return portalActor;

    const body = await request.json();
    const bookingNumber = cleanText(body.booking_number, 100);
    const bookingType = cleanText(body.booking_type, 30);
    const yardId = positiveInt(body.yard_id);
    const containerCount = positiveInt(body.container_count ?? 1);

    if (!bookingNumber) {
      return NextResponse.json({ error: 'กรุณาระบุเลข Booking' }, { status: 400 });
    }
    if (!bookingType || !BOOKING_TYPES.has(bookingType)) {
      return NextResponse.json({ error: 'ประเภท Booking ไม่ถูกต้อง' }, { status: 400 });
    }
    if (!yardId) {
      return NextResponse.json({ error: 'กรุณาระบุลานที่ต้องการทำ Booking' }, { status: 400 });
    }
    if (!containerCount || containerCount > 999) {
      return NextResponse.json({ error: 'จำนวนตู้ต้องอยู่ระหว่าง 1-999' }, { status: 400 });
    }

    const containerNumbers = normalizeContainerNumbers(body.container_numbers);

    const result = await db.request()
      .input('bookingNumber', sql.NVarChar, bookingNumber)
      .input('yardId', sql.Int, yardId)
      .input('customerId', sql.Int, cid)
      .input('bookingCustomerId', sql.Int, cid)
      .input('createdByCustomerUserId', sql.Int, portalActor.userId)
      .input('bookingType', sql.NVarChar, bookingType)
      .input('status', sql.NVarChar, 'pending')
      .input('vesselName', sql.NVarChar, cleanText(body.vessel_name, 120))
      .input('voyageNumber', sql.NVarChar, cleanText(body.voyage_number, 60))
      .input('containerCount', sql.Int, containerCount)
      .input('containerSize', sql.NVarChar, cleanText(body.container_size, 10))
      .input('containerType', sql.NVarChar, cleanText(body.container_type, 20))
      .input('eta', sql.DateTime2, cleanText(body.eta, 40))
      .input('validFrom', sql.DateTime2, cleanText(body.valid_from, 40))
      .input('validTo', sql.DateTime2, cleanText(body.valid_to, 40))
      .input('sealNumber', sql.NVarChar, cleanText(body.seal_number, 80))
      .input('notes', sql.NVarChar, cleanText(body.notes, 1000))
      .query(`
        INSERT INTO Bookings (booking_number, yard_id, customer_id,
          booking_customer_id, created_by_customer_user_id,
          booking_type, status,
          vessel_name, voyage_number, container_count, container_size, container_type,
          eta, valid_from, valid_to, seal_number, notes)
        OUTPUT INSERTED.*
        VALUES (@bookingNumber, @yardId, @customerId,
          @bookingCustomerId, @createdByCustomerUserId,
          @bookingType, @status,
          @vesselName, @voyageNumber, @containerCount, @containerSize, @containerType,
          @eta, @validFrom, @validTo, @sealNumber, @notes)
      `);

    const booking = result.recordset[0];
    const reeferPolicy = await ensureReeferBookingPolicy(db, {
      booking_id: booking.booking_id,
      yard_id: booking.yard_id || yardId,
      customer_id: cid,
      container_type: booking.container_type || body.container_type,
    }, {
      intervalHours: body.reefer_interval_hours,
      warningGraceMinutes: body.reefer_warning_grace_minutes,
      cargoProfile: cleanText(body.reefer_cargo_profile, 40),
      minTempC: body.reefer_min_temp_c,
      maxTempC: body.reefer_max_temp_c,
    });

    await applyPortalGrants(db, buildBookingPartyGrants({
      ...booking,
      booking_customer_id: cid,
      customer_id: cid,
    }));

    for (const containerNumber of containerNumbers) {
      const linkResult = await db.request()
        .input('bookingId', sql.Int, booking.booking_id)
        .input('containerNumber', sql.NVarChar, containerNumber)
        .query(`
          INSERT INTO BookingContainers (booking_id, container_number)
          OUTPUT INSERTED.id, INSERTED.container_id, INSERTED.container_number
          VALUES (@bookingId, @containerNumber)
        `);

      await applyPortalGrants(db, buildBookingContainerGrants(
        { ...booking, booking_customer_id: cid, customer_id: cid },
        linkResult.recordset[0] || { container_number: containerNumber },
      ));
    }

    await logAudit({
      yardId,
      action: 'portal_booking_create',
      entityType: 'booking',
      entityId: booking.booking_id,
      details: {
        booking_number: booking.booking_number,
        booking_type: booking.booking_type,
        container_count: booking.container_count,
        preadvised_containers: containerNumbers.length,
      },
    });

    return NextResponse.json({
      success: true,
      booking: decoratePortalBooking(booking),
      reefer_policy: reeferPolicy,
    });
  } catch (error: unknown) {
    console.error('❌ Portal create booking error:', error);
    const message = error instanceof Error && /unique|duplicate/i.test(error.message)
      ? 'เลข Booking นี้มีอยู่แล้ว'
      : 'ไม่สามารถสร้าง Booking ได้';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
