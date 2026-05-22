import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

type AmendmentChanges = Record<string, string | number | null | undefined>;

const allowedFields = new Set([
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

function parseChanges(value: unknown): AmendmentChanges {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as AmendmentChanges;
  } catch {
    return {};
  }
}

function buildUpdate(changes: AmendmentChanges) {
  const setters: string[] = [];
  const values: Array<[string, unknown, unknown]> = [];

  Object.entries(changes).forEach(([key, value]) => {
    if (!allowedFields.has(key)) return;
    if (key === 'container_count') {
      const count = positiveInt(value);
      if (!count) return;
      setters.push('container_count = @containerCount');
      values.push(['containerCount', sql.Int, count]);
      return;
    }
    const cleaned = cleanText(value, 500);
    if (!cleaned) return;
    setters.push(`${key} = @${key}`);
    values.push([key, sql.NVarChar(500), cleaned]);
  });

  return { setters, values };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const limit = Math.min(positiveInt(searchParams.get('limit')) || 50, 100);
    const db = await getDb();

    const actor = await requirePermission(request, db, 'booking.manage', 'คุณไม่มีสิทธิ์จัดการคำขอแก้ไข Booking');
    if (actor instanceof NextResponse) return actor;
    if (yardId) {
      const yardAccess = await requireYardAccess(request, db, yardId);
      if (yardAccess instanceof NextResponse) return yardAccess;
    }

    const req = db.request().input('limit', sql.Int, limit);
    const filters = ["a.status = 'pending'"];
    if (yardId) {
      req.input('yardId', sql.Int, yardId);
      filters.push('a.yard_id = @yardId');
    }

    const result = await req.query(`
      SELECT TOP (@limit)
        a.amendment_id, a.booking_id, a.booking_number, a.customer_id,
        a.yard_id, a.request_type, a.requested_changes, a.reason, a.status,
        a.review_note, a.created_at, a.reviewed_at,
        b.booking_type, b.container_count, b.status AS booking_status,
        c.customer_name
      FROM PortalBookingAmendments a
      INNER JOIN Bookings b ON b.booking_id = a.booking_id
      LEFT JOIN Customers c ON c.customer_id = a.customer_id
      WHERE ${filters.join(' AND ')}
      ORDER BY a.created_at ASC, a.amendment_id ASC
    `);

    return NextResponse.json({ amendments: result.recordset });
  } catch (error) {
    console.error('❌ GET booking amendments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดคำขอแก้ไข Booking ได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const amendmentId = positiveInt(body.amendment_id);
    const action = body.action === 'approve' ? 'approve' : body.action === 'reject' ? 'reject' : null;
    if (!amendmentId || !action) {
      return NextResponse.json({ error: 'ข้อมูลอนุมัติคำขอแก้ไขไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requirePermission(request, db, 'booking.manage', 'คุณไม่มีสิทธิ์จัดการคำขอแก้ไข Booking');
    if (actor instanceof NextResponse) return actor;

    const currentResult = await db.request()
      .input('amendmentId', sql.BigInt, amendmentId)
      .query(`
        SELECT TOP 1
          a.amendment_id, a.booking_id, a.booking_number, a.customer_id, a.yard_id,
          a.request_type, a.requested_changes, a.reason, a.status,
          b.status AS booking_status
        FROM PortalBookingAmendments a
        INNER JOIN Bookings b ON b.booking_id = a.booking_id
        WHERE a.amendment_id = @amendmentId
      `);
    const amendment = currentResult.recordset[0];
    if (!amendment) return NextResponse.json({ error: 'ไม่พบคำขอแก้ไข Booking' }, { status: 404 });
    if (amendment.status !== 'pending') {
      return NextResponse.json({ error: 'คำขอนี้ถูกดำเนินการแล้ว' }, { status: 409 });
    }

    const yardAccess = await requireYardAccess(request, db, amendment.yard_id);
    if (yardAccess instanceof NextResponse) return yardAccess;

    const note = cleanText(body.note, 1000);
    let booking = null;

    if (action === 'approve') {
      if (amendment.request_type === 'cancel') {
        const update = await db.request()
          .input('bookingId', sql.Int, amendment.booking_id)
          .input('bookingStatus', sql.NVarChar(30), 'cancelled')
          .input('note', sql.NVarChar(1000), note)
          .query(`
            UPDATE Bookings
            SET status = @bookingStatus,
                notes = CASE
                  WHEN @note IS NULL THEN notes
                  WHEN notes IS NULL OR notes = '' THEN CONCAT('[Portal cancel] ', @note)
                  ELSE CONCAT(notes, CHAR(10), '[Portal cancel] ', @note)
                END
            OUTPUT INSERTED.booking_id, INSERTED.booking_number, INSERTED.status
            WHERE booking_id = @bookingId
          `);
        booking = update.recordset[0] || null;
      } else {
        const changes = parseChanges(amendment.requested_changes);
        const updateSpec = buildUpdate(changes);
        if (updateSpec.setters.length > 0) {
          const updateReq = db.request()
            .input('bookingId', sql.Int, amendment.booking_id);
          updateSpec.values.forEach(([name, type, value]) => updateReq.input(name, type, value));
          const update = await updateReq.query(`
            UPDATE Bookings
            SET ${updateSpec.setters.join(', ')}
            OUTPUT INSERTED.booking_id, INSERTED.booking_number, INSERTED.status
            WHERE booking_id = @bookingId
          `);
          booking = update.recordset[0] || null;
        }
      }
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    const updateAmendment = await db.request()
      .input('amendmentId', sql.BigInt, amendmentId)
      .input('status', sql.NVarChar(30), nextStatus)
      .input('note', sql.NVarChar(1000), note)
      .input('actorUserId', sql.Int, actor.userId)
      .query(`
        UPDATE PortalBookingAmendments
        SET status = @status,
            review_note = @note,
            reviewed_by_user_id = @actorUserId,
            reviewed_at = GETDATE(),
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE amendment_id = @amendmentId
      `);

    await logAudit({
      userId: actor.userId,
      yardId: amendment.yard_id,
      action: `booking_amendment_${action}`,
      entityType: 'booking_amendment',
      entityId: amendmentId,
      details: {
        booking_id: amendment.booking_id,
        booking_number: amendment.booking_number,
        request_type: amendment.request_type,
        previous_booking_status: amendment.booking_status,
        amendment_status: nextStatus,
        note,
      },
    });

    return NextResponse.json({ success: true, amendment: updateAmendment.recordset[0], booking });
  } catch (error) {
    console.error('❌ PATCH booking amendments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตคำขอแก้ไข Booking ได้' }, { status: 500 });
  }
}
