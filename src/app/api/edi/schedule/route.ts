import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { requireAnyPermission, requirePermission, requireYardAccess } from '@/lib/apiAuth';

const EDI_SCHEDULE_READ_PERMISSIONS = ['settings.manage', 'integration.send', 'integration.logs.view'];

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// GET — Get scheduler status for all endpoints
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      EDI_SCHEDULE_READ_PERMISSIONS,
      'คุณไม่มีสิทธิ์ดูตารางส่ง EDI'
    );
    if (actor instanceof Response) return actor;

    const result = await db.request().query(`
      SELECT endpoint_id, name, schedule_enabled, schedule_cron, schedule_yard_id, schedule_last_run
      FROM EDIEndpoints
      ORDER BY endpoint_id
    `);
    return NextResponse.json({ schedules: result.recordset });
  } catch (error) {
    console.error('❌ GET schedule error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// PUT — Update schedule settings for an endpoint + reload cron
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint_id, schedule_enabled, schedule_cron, schedule_yard_id } = body;
    const endpointId = parsePositiveInt(endpoint_id);
    const scheduleYardId = parsePositiveInt(schedule_yard_id);

    if (!endpointId) {
      return NextResponse.json({ error: 'Missing endpoint_id' }, { status: 400 });
    }
    if (!scheduleYardId) {
      return NextResponse.json({ error: 'ต้องระบุ schedule_yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    // Validate cron expression
    if (schedule_cron) {
      const nodeCron = await import('node-cron');
      if (!nodeCron.validate(schedule_cron)) {
        return NextResponse.json({ error: `Invalid cron expression: "${schedule_cron}"` }, { status: 400 });
      }
    }

    const db = await getDb();
    const actor = await requirePermission(
      request,
      db,
      'settings.manage',
      'คุณไม่มีสิทธิ์จัดการตารางส่ง EDI'
    );
    if (actor instanceof Response) return actor;

    const yardAccess = await requireYardAccess(request, db, scheduleYardId, 'คุณไม่มีสิทธิ์จัดการตารางส่ง EDI ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;
    await db.request()
      .input('epId', sql.Int, endpointId)
      .input('enabled', sql.Bit, schedule_enabled ? 1 : 0)
      .input('cronExpr', sql.NVarChar, schedule_cron || '0 18 * * *')
      .input('yardId', sql.Int, scheduleYardId)
      .query(`
        UPDATE EDIEndpoints SET
          schedule_enabled = @enabled,
          schedule_cron = @cronExpr,
          schedule_yard_id = @yardId,
          updated_at = GETDATE()
        WHERE endpoint_id = @epId
      `);

    // Reload this endpoint's cron job
    try {
      const { reloadEndpointSchedule } = await import('@/lib/ediScheduler');
      await reloadEndpointSchedule(endpointId);
    } catch { /* scheduler might not be initialized yet */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT schedule error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}

// POST — Reload all schedules (manual trigger)
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(
      request,
      db,
      'settings.manage',
      'คุณไม่มีสิทธิ์ reload ตารางส่ง EDI'
    );
    if (actor instanceof Response) return actor;

    const { reloadAllSchedules } = await import('@/lib/ediScheduler');
    await reloadAllSchedules();
    return NextResponse.json({ success: true, message: 'Scheduler reloaded' });
  } catch (error) {
    console.error('❌ POST reload error:', error);
    return NextResponse.json({ error: 'ไม่สามารถ reload ได้' }, { status: 500 });
  }
}
