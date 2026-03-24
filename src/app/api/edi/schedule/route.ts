import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — Get scheduler status for all endpoints
export async function GET() {
  try {
    const db = await getDb();
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

    if (!endpoint_id) {
      return NextResponse.json({ error: 'Missing endpoint_id' }, { status: 400 });
    }

    // Validate cron expression
    if (schedule_cron) {
      const nodeCron = await import('node-cron');
      if (!nodeCron.validate(schedule_cron)) {
        return NextResponse.json({ error: `Invalid cron expression: "${schedule_cron}"` }, { status: 400 });
      }
    }

    const db = await getDb();
    await db.request()
      .input('epId', sql.Int, endpoint_id)
      .input('enabled', sql.Bit, schedule_enabled ? 1 : 0)
      .input('cronExpr', sql.NVarChar, schedule_cron || '0 18 * * *')
      .input('yardId', sql.Int, schedule_yard_id || 1)
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
      await reloadEndpointSchedule(endpoint_id);
    } catch { /* scheduler might not be initialized yet */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT schedule error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}

// POST — Reload all schedules (manual trigger)
export async function POST() {
  try {
    const { reloadAllSchedules } = await import('@/lib/ediScheduler');
    await reloadAllSchedules();
    return NextResponse.json({ success: true, message: 'Scheduler reloaded' });
  } catch (error) {
    console.error('❌ POST reload error:', error);
    return NextResponse.json({ error: 'ไม่สามารถ reload ได้' }, { status: 500 });
  }
}
