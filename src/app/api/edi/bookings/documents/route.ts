import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const bookingId = positiveInt(searchParams.get('booking_id'));
    const limit = Math.min(positiveInt(searchParams.get('limit')) || 100, 200);
    const db = await getDb();

    const actor = await requirePermission(request, db, 'booking.manage', 'คุณไม่มีสิทธิ์ดูเอกสาร Booking จากลูกค้า');
    if (actor instanceof NextResponse) return actor;
    if (yardId) {
      const yardAccess = await requireYardAccess(request, db, yardId);
      if (yardAccess instanceof NextResponse) return yardAccess;
    }

    const req = db.request().input('limit', sql.Int, limit);
    const filters = ["ea.entity_type = 'booking'", "ea.source = 'portal'"];
    if (yardId) {
      req.input('yardId', sql.Int, yardId);
      filters.push('b.yard_id = @yardId');
    }
    if (bookingId) {
      req.input('bookingId', sql.Int, bookingId);
      filters.push('b.booking_id = @bookingId');
    }

    const result = await req.query(`
      SELECT TOP (@limit)
        ea.attachment_id, ea.entity_id, ea.entity_number, ea.category,
        ea.file_url, ea.file_name, ea.mime_type, ea.created_at,
        b.booking_id, b.booking_number, b.status AS booking_status,
        c.customer_name
      FROM EntityAttachments ea
      INNER JOIN Bookings b ON b.booking_id = ea.entity_id
      LEFT JOIN Customers c ON c.customer_id = b.customer_id
      WHERE ${filters.join(' AND ')}
      ORDER BY ea.created_at DESC, ea.attachment_id DESC
    `);

    return NextResponse.json({ documents: result.recordset });
  } catch (error) {
    console.error('❌ GET booking customer documents error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดเอกสาร Booking จากลูกค้าได้' }, { status: 500 });
  }
}
