import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAttachment } from '@/lib/attachmentCenter';
import { getPortalCustomerId, portalBookingVisibilitySql } from '@/lib/portalAccess';

const allowedCategories = new Set([
  'shipping_instruction',
  'invoice_support',
  'delivery_order',
  'power_of_attorney',
  'other',
]);

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value: unknown, max = 255) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

async function getScopedBooking(bookingId: number, customerId: number) {
  const db = await getDb();
  const result = await db.request()
    .input('cid', sql.Int, customerId)
    .input('customerId', sql.Int, customerId)
    .input('bookingId', sql.Int, bookingId)
    .query(`
      SELECT TOP 1 b.booking_id, b.booking_number, b.yard_id, b.customer_id
      FROM Bookings b
      WHERE b.booking_id = @bookingId
        AND ${portalBookingVisibilitySql('b')}
    `);
  return { db, booking: result.recordset[0] };
}

export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const { searchParams } = new URL(request.url);
    const bookingId = positiveInt(searchParams.get('booking_id'));
    if (!bookingId) return NextResponse.json({ error: 'booking_id ไม่ถูกต้อง' }, { status: 400 });

    const { db, booking } = await getScopedBooking(bookingId, cid);
    if (!booking) return NextResponse.json({ error: 'ไม่พบ Booking หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });

    const result = await db.request()
      .input('bookingId', sql.Int, booking.booking_id)
      .query(`
        SELECT
          ea.attachment_id, ea.entity_type, ea.entity_id, ea.entity_number,
          ea.category, ea.file_url, ea.file_name, ea.mime_type,
          ea.source, ea.created_at
        FROM EntityAttachments ea
        WHERE ea.entity_type = 'booking'
          AND ea.entity_id = @bookingId
          AND (ea.source = 'portal' OR ea.source IS NULL)
        ORDER BY ea.created_at DESC, ea.attachment_id DESC
      `);

    return NextResponse.json({ documents: result.recordset });
  } catch (error) {
    console.error('❌ GET portal booking documents error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดเอกสาร Booking ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const body = await request.json();
    const bookingId = positiveInt(body.booking_id);
    const fileUrl = cleanText(body.file_url, 1000);
    if (!bookingId || !fileUrl) {
      return NextResponse.json({ error: 'booking_id และ file_url จำเป็นต้องระบุ' }, { status: 400 });
    }

    const { db, booking } = await getScopedBooking(bookingId, cid);
    if (!booking) return NextResponse.json({ error: 'ไม่พบ Booking หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });

    const rawCategory = cleanText(body.category, 50) || 'other';
    const category = allowedCategories.has(rawCategory) ? rawCategory : 'other';
    const attachment = await logAttachment({
      db,
      entityType: 'booking',
      entityId: booking.booking_id,
      entityNumber: booking.booking_number,
      category,
      fileUrl,
      fileName: cleanText(body.file_name, 255),
      mimeType: cleanText(body.mime_type, 100),
      source: 'portal',
      uploadedBy: null,
      yardId: booking.yard_id,
      metadata: {
        customer_id: cid,
        booking_id: booking.booking_id,
        booking_number: booking.booking_number,
      },
    });

    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    console.error('❌ POST portal booking documents error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกเอกสาร Booking ได้' }, { status: 500 });
  }
}
