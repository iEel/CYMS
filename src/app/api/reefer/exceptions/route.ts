import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';
import { deriveReeferEscalation } from '@/lib/reeferEscalation';
import { updateReeferExceptionAction, type ReeferExceptionAction } from '@/lib/reeferExceptions';
import {
  applyPortalGrants,
  buildReeferExceptionGrants,
  fetchContainerPortalGrantRows,
} from '@/lib/portalGrantRules';

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

    const exceptions = result.recordset.map((exception) => {
      const escalation = deriveReeferEscalation(exception);
      return {
        ...exception,
        escalation_level: escalation.level,
        escalation_breached: escalation.breached,
        escalation_due_minutes: escalation.due_minutes,
        escalation_age_minutes: escalation.age_minutes,
        escalation_label: escalation.label,
        escalation_action: escalation.recommended_action,
      };
    });

    return NextResponse.json({ exceptions });
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

    const assignedToUserId = parsePositiveInt(body.assigned_to_user_id);
    if (body.action === 'assign' && !assignedToUserId) {
      return NextResponse.json({ error: 'ต้องระบุ assigned_to_user_id' }, { status: 400 });
    }

    const updateResult = await updateReeferExceptionAction({
      db,
      exceptionId,
      action: body.action as ReeferExceptionAction,
      note: body.resolution_note || body.note || null,
      assignedToUserId,
      actor,
    });
    if ('error' in updateResult) {
      if (updateResult.error === 'not_found') return NextResponse.json({ error: 'ไม่พบ exception' }, { status: 404 });
      return NextResponse.json({ error: 'action ไม่ถูกต้องกับสถานะปัจจุบัน' }, { status: 400 });
    }

    const updated = updateResult.exception;
    const containerGrantRows = await fetchContainerPortalGrantRows(db, {
      container_id: updated.container_id,
    });
    await applyPortalGrants(db, buildReeferExceptionGrants(updated, containerGrantRows));

    return NextResponse.json({ success: true, exception: updated });
  } catch (error) {
    console.error('❌ PATCH reefer exceptions error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต exception ตู้เย็นได้' }, { status: 500 });
  }
}
