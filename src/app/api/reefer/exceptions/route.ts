import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';
import { nextReeferExceptionStatus } from '@/lib/reeferExceptions';

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parsePositiveInt(searchParams.get('yard_id'));
    if (!yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id' }, { status: 400 });

    const status = searchParams.get('status')?.trim();
    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requirePermission(request, db, 'reefer.exception.manage', 'คุณไม่มีสิทธิ์จัดการ exception ตู้เย็น');
    if (actor instanceof NextResponse) return actor;

    const req = db.request().input('yardId', sql.Int, yardId);
    const filters = ['e.yard_id = @yardId'];
    if (status) {
      req.input('status', sql.NVarChar(30), status);
      filters.push('e.status = @status');
    }

    const result = await req.query(`
      SELECT TOP 200
        e.exception_id, e.check_id, e.container_id, e.booking_id, e.yard_id,
        e.customer_id, e.severity, e.status, e.reason, e.recommended_action,
        e.resolution_note, e.assigned_to_user_id, e.created_at, e.updated_at,
        c.container_number, c.size, c.type, c.shipping_line,
        b.booking_number,
        rc.measured_temp_c, rc.set_point_c, rc.photo_url, rc.checked_at
      FROM ReeferExceptions e
      JOIN Containers c ON c.container_id = e.container_id
      LEFT JOIN Bookings b ON b.booking_id = e.booking_id
      LEFT JOIN ReeferTemperatureChecks rc ON rc.check_id = e.check_id
      WHERE ${filters.join(' AND ')}
      ORDER BY
        CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
        e.created_at DESC
    `);

    return NextResponse.json({ exceptions: result.recordset });
  } catch (error) {
    console.error('❌ GET reefer exceptions error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด exception ตู้เย็นได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const exceptionId = parsePositiveInt(body.exception_id);
    if (!exceptionId) return NextResponse.json({ error: 'ต้องระบุ exception_id' }, { status: 400 });

    const db = await getDb();
    const scope = await db.request()
      .input('exceptionId', sql.Int, exceptionId)
      .query('SELECT TOP 1 yard_id, status FROM ReeferExceptions WHERE exception_id = @exceptionId');
    const current = scope.recordset[0];
    if (!current) return NextResponse.json({ error: 'ไม่พบ exception' }, { status: 404 });

    const yardAccess = await requireYardAccess(request, db, current.yard_id);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requirePermission(request, db, 'reefer.exception.manage', 'คุณไม่มีสิทธิ์จัดการ exception ตู้เย็น');
    if (actor instanceof NextResponse) return actor;

    const nextStatus = nextReeferExceptionStatus(current.status, body.action);
    if (!nextStatus) return NextResponse.json({ error: 'action ไม่ถูกต้องกับสถานะปัจจุบัน' }, { status: 400 });

    const result = await db.request()
      .input('exceptionId', sql.Int, exceptionId)
      .input('status', sql.NVarChar(30), nextStatus)
      .input('resolutionNote', sql.NVarChar(1000), body.resolution_note || body.note || null)
      .input('assignedToUserId', sql.Int, parsePositiveInt(body.assigned_to_user_id))
      .input('actorUserId', sql.Int, actor.userId)
      .query(`
        UPDATE ReeferExceptions
        SET status = @status,
            resolution_note = COALESCE(@resolutionNote, resolution_note),
            assigned_to_user_id = COALESCE(@assignedToUserId, assigned_to_user_id),
            acknowledged_by_user_id = CASE WHEN @status = 'in_progress' THEN @actorUserId ELSE acknowledged_by_user_id END,
            acknowledged_at = CASE WHEN @status = 'in_progress' THEN GETDATE() ELSE acknowledged_at END,
            resolved_by_user_id = CASE WHEN @status IN ('resolved', 'ignored') THEN @actorUserId ELSE resolved_by_user_id END,
            resolved_at = CASE WHEN @status IN ('resolved', 'ignored') THEN GETDATE() ELSE resolved_at END,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE exception_id = @exceptionId
      `);

    const updated = result.recordset[0];
    await logAudit({
      userId: actor.userId,
      yardId: current.yard_id,
      action: `reefer_exception_${body.action}`,
      entityType: 'reefer_exception',
      entityId: exceptionId,
      details: { status: nextStatus, note: body.resolution_note || body.note || null },
    });

    return NextResponse.json({ success: true, exception: updated });
  } catch (error) {
    console.error('❌ PATCH reefer exceptions error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต exception ตู้เย็นได้' }, { status: 500 });
  }
}
