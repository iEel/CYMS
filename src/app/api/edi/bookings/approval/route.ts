import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanNote(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, 1000) : null;
}

function statusForAction(action: unknown) {
  if (action === 'approve') return 'confirmed';
  if (action === 'reject') return 'cancelled';
  if (action === 'request_info') return 'pending';
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const limit = Math.min(positiveInt(searchParams.get('limit')) || 50, 100);
    const db = await getDb();

    const actor = await requirePermission(request, db, 'booking.manage', 'คุณไม่มีสิทธิ์อนุมัติ Booking');
    if (actor instanceof NextResponse) return actor;
    if (yardId) {
      const yardAccess = await requireYardAccess(request, db, yardId);
      if (yardAccess instanceof NextResponse) return yardAccess;
    }

    const summaryReq = db.request();
    const listReq = db.request().input('limit', sql.Int, limit);
    const filters = ["b.status = 'pending'"];
    if (yardId) {
      summaryReq.input('yardId', sql.Int, yardId);
      listReq.input('yardId', sql.Int, yardId);
      filters.push('b.yard_id = @yardId');
    }
    const where = filters.join(' AND ');

    const summary = await summaryReq.query(`
      SELECT
        COUNT(*) AS total_pending,
        COUNT(CASE WHEN b.container_type = 'RF' THEN 1 END) AS rf_pending
      FROM Bookings b
      WHERE ${where}
    `);

    const result = await listReq.query(`
      SELECT TOP (@limit)
        b.booking_id, b.booking_number, b.booking_type, b.status, b.yard_id,
        b.customer_id, c.customer_name, b.container_count, b.container_size, b.container_type,
        b.vessel_name, b.voyage_number, b.eta, b.valid_from, b.valid_to,
        b.seal_number, b.notes, b.created_at,
        (SELECT COUNT(*) FROM BookingContainers bc WHERE bc.booking_id = b.booking_id) AS preadvised_containers
      FROM Bookings b
      LEFT JOIN Customers c ON c.customer_id = b.customer_id
      WHERE ${where}
      ORDER BY b.created_at ASC, b.booking_id ASC
    `);

    return NextResponse.json({
      bookings: result.recordset,
      summary: summary.recordset[0] || { total_pending: 0, rf_pending: 0 },
    });
  } catch (error) {
    console.error('❌ GET booking approval inbox error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายการรออนุมัติ Booking ได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const bookingId = positiveInt(body.booking_id);
    const nextStatus = statusForAction(body.action);
    if (!bookingId || !nextStatus) {
      return NextResponse.json({ error: 'ข้อมูลอนุมัติ Booking ไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requirePermission(request, db, 'booking.manage', 'คุณไม่มีสิทธิ์อนุมัติ Booking');
    if (actor instanceof NextResponse) return actor;

    const currentResult = await db.request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT TOP 1 booking_id, booking_number, yard_id, status
        FROM Bookings
        WHERE booking_id = @bookingId
      `);
    const current = currentResult.recordset[0];
    if (!current) return NextResponse.json({ error: 'ไม่พบ Booking' }, { status: 404 });
    if (current.status !== 'pending') {
      return NextResponse.json({ error: 'Booking นี้ไม่อยู่ในสถานะรออนุมัติ' }, { status: 409 });
    }

    const yardAccess = await requireYardAccess(request, db, current.yard_id);
    if (yardAccess instanceof NextResponse) return yardAccess;

    const note = cleanNote(body.note);
    const update = await db.request()
      .input('bookingId', sql.Int, bookingId)
      .input('status', sql.NVarChar(30), nextStatus)
      .input('note', sql.NVarChar(1000), note)
      .input('actorUserId', sql.Int, actor.userId)
      .query(`
        UPDATE Bookings
        SET status = @status,
            notes = CASE
              WHEN @note IS NULL THEN notes
              WHEN notes IS NULL OR notes = '' THEN CONCAT('[Approval] ', @note)
              ELSE CONCAT(notes, CHAR(10), '[Approval] ', @note)
            END
        OUTPUT INSERTED.booking_id, INSERTED.booking_number, INSERTED.status
        WHERE booking_id = @bookingId
      `);

    await logAudit({
      userId: actor.userId,
      yardId: current.yard_id,
      action: `booking_approval_${body.action}`,
      entityType: 'booking',
      entityId: bookingId,
      details: {
        booking_number: current.booking_number,
        previous_status: current.status,
        next_status: nextStatus,
        note,
      },
    });

    return NextResponse.json({ success: true, booking: update.recordset[0] });
  } catch (error) {
    console.error('❌ PATCH booking approval inbox error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสถานะ Booking ได้' }, { status: 500 });
  }
}
