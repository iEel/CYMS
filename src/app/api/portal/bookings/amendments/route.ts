import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getPortalCustomerId, portalBookingVisibilitySql } from '@/lib/portalAccess';

const amendmentFields = new Set([
  'eta',
  'valid_from',
  'valid_to',
  'vessel_name',
  'voyage_number',
  'container_count',
  'seal_number',
  'notes',
]);

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value: unknown, max = 1000) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function normalizeChanges(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, string | number | null> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!amendmentFields.has(key)) return;
    if (key === 'container_count') {
      output[key] = positiveInt(raw);
      return;
    }
    output[key] = cleanText(raw, 500);
  });
  return Object.fromEntries(Object.entries(output).filter(([, raw]) => raw !== null && raw !== ''));
}

export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const { searchParams } = new URL(request.url);
    const bookingId = positiveInt(searchParams.get('booking_id'));
    const db = await getDb();
    const req = db.request()
      .input('cid', sql.Int, cid)
      .input('customerId', sql.Int, cid);

    const filters = [`a.customer_id = @customerId`, `${portalBookingVisibilitySql('b')}`];
    if (bookingId) {
      req.input('bookingId', sql.Int, bookingId);
      filters.push('a.booking_id = @bookingId');
    }

    const result = await req.query(`
      SELECT TOP 100
        a.amendment_id, a.booking_id, a.booking_number, a.request_type,
        a.requested_changes, a.reason, a.status, a.review_note,
        a.created_at, a.reviewed_at
      FROM PortalBookingAmendments a
      INNER JOIN Bookings b ON b.booking_id = a.booking_id
      WHERE ${filters.join(' AND ')}
      ORDER BY a.created_at DESC, a.amendment_id DESC
    `);

    return NextResponse.json({ amendments: result.recordset });
  } catch (error) {
    console.error('❌ GET portal booking amendments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดคำขอแก้ไข Booking ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const body = await request.json();
    const bookingId = positiveInt(body.booking_id);
    const requestType = body.request_type === 'cancel' ? 'cancel' : body.request_type === 'amend' ? 'amend' : null;
    if (!bookingId || !requestType) {
      return NextResponse.json({ error: 'ข้อมูลคำขอแก้ไข Booking ไม่ถูกต้อง' }, { status: 400 });
    }

    const reason = cleanText(body.reason, 1000);
    const requestedChanges = requestType === 'amend' ? normalizeChanges(body.requested_changes) : {};
    if (requestType === 'amend' && Object.keys(requestedChanges).length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
    }

    const db = await getDb();
    const bookingResult = await db.request()
      .input('cid', sql.Int, cid)
      .input('customerId', sql.Int, cid)
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT TOP 1 b.booking_id, b.booking_number, b.yard_id, b.customer_id
        FROM Bookings b
        WHERE b.booking_id = @bookingId
          AND ${portalBookingVisibilitySql('b')}
      `);
    const booking = bookingResult.recordset[0];
    if (!booking) return NextResponse.json({ error: 'ไม่พบ Booking หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });

    const insert = await db.request()
      .input('bookingId', sql.Int, booking.booking_id)
      .input('bookingNumber', sql.NVarChar(100), booking.booking_number)
      .input('customerId', sql.Int, cid)
      .input('yardId', sql.Int, booking.yard_id)
      .input('requestType', sql.NVarChar(20), requestType)
      .input('requestedChanges', sql.NVarChar(sql.MAX), JSON.stringify(requestedChanges))
      .input('reason', sql.NVarChar(1000), reason)
      .query(`
        INSERT INTO PortalBookingAmendments (
          booking_id, booking_number, customer_id, yard_id, request_type,
          requested_changes, reason, status
        )
        OUTPUT INSERTED.*
        VALUES (
          @bookingId, @bookingNumber, @customerId, @yardId, @requestType,
          @requestedChanges, @reason, 'pending'
        )
      `);

    const amendment = insert.recordset[0];
    await logAudit({
      userId: null,
      yardId: booking.yard_id,
      action: 'portal_booking_amendment_create',
      entityType: 'booking_amendment',
      entityId: amendment.amendment_id,
      details: {
        booking_id: booking.booking_id,
        booking_number: booking.booking_number,
        customer_id: cid,
        request_type: requestType,
        requested_changes: requestedChanges,
        reason,
      },
    });

    return NextResponse.json({ success: true, amendment });
  } catch (error) {
    console.error('❌ POST portal booking amendments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถส่งคำขอแก้ไข Booking ได้' }, { status: 500 });
  }
}
