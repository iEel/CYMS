import cron, { ScheduledTask } from 'node-cron';

// Active cron jobs keyed by endpoint_id
const activeJobs = new Map<number, ScheduledTask>();

interface ScheduledEndpoint {
  endpoint_id: number;
  name: string;
  schedule_enabled: boolean;
  schedule_cron: string;
  schedule_yard_id: number;
  type: string;
  shipping_line: string;
}

// Send CODECO for a single endpoint
async function executeEdiSend(ep: ScheduledEndpoint): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  console.log(`⏰ [EDI Scheduler] Sending CODECO for "${ep.name}" (endpoint_id=${ep.endpoint_id})...`);

  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();

    // Call the same logic as the CODECO send API — build body and use internal fetch
    const baseUrl = `http://localhost:${process.env.PORT || 3005}`;
    const res = await fetch(`${baseUrl}/api/edi/codeco/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint_id: ep.endpoint_id,
        yard_id: ep.schedule_yard_id || 1,
        date_from: today,
        date_to: today,
        type: 'all',
        shipping_line: ep.shipping_line || undefined,
      }),
    });

    const data = await res.json();

    // Update last run time
    const sql = (await import('mssql')).default;
    await db.request()
      .input('epId', sql.Int, ep.endpoint_id)
      .query('UPDATE EDIEndpoints SET schedule_last_run = GETDATE() WHERE endpoint_id = @epId');

    // Audit trail for auto-schedule send
    const { logAudit } = await import('@/lib/audit');
    await logAudit({
      userId: null,
      yardId: ep.schedule_yard_id || 1,
      action: data.success ? 'edi_auto_send_success' : 'edi_auto_send_failed',
      entityType: 'edi_endpoint',
      entityId: ep.endpoint_id,
      details: {
        source: 'auto-schedule',
        endpoint_name: ep.name,
        delivery_type: ep.type,
        shipping_line: ep.shipping_line || 'ALL',
        cron: ep.schedule_cron,
        record_count: data.record_count || 0,
        filename: data.filename || null,
        error: data.error || null,
      },
    });

    if (data.success) {
      console.log(`  ✅ [EDI Scheduler] ${ep.name}: sent ${data.record_count} records`);
    } else {
      console.log(`  ⚠️ [EDI Scheduler] ${ep.name}: ${data.error || 'no records'}`);
    }
  } catch (error) {
    console.error(`  ❌ [EDI Scheduler] ${ep.name} error:`, error);

    // Audit trail for scheduler error
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit({
        userId: null,
        yardId: ep.schedule_yard_id || 1,
        action: 'edi_auto_send_error',
        entityType: 'edi_endpoint',
        entityId: ep.endpoint_id,
        details: {
          source: 'auto-schedule',
          endpoint_name: ep.name,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } catch { /* audit shouldn't block */ }
  }
}

// Start/update a cron job for an endpoint
function startJob(ep: ScheduledEndpoint): void {
  // Stop existing job if any
  stopJob(ep.endpoint_id);

  if (!ep.schedule_enabled || !ep.schedule_cron) return;

  if (!cron.validate(ep.schedule_cron)) {
    console.error(`  ❌ [EDI Scheduler] Invalid cron: "${ep.schedule_cron}" for ${ep.name}`);
    return;
  }

  const task = cron.schedule(ep.schedule_cron, () => {
    executeEdiSend(ep);
  }, { timezone: 'Asia/Bangkok' });

  activeJobs.set(ep.endpoint_id, task);
  console.log(`  ✅ [EDI Scheduler] Scheduled "${ep.name}" → ${ep.schedule_cron}`);
}

// Stop a cron job
function stopJob(endpointId: number): void {
  const existing = activeJobs.get(endpointId);
  if (existing) {
    existing.stop();
    activeJobs.delete(endpointId);
  }
}

// Load all scheduled endpoints from DB and start cron jobs
export async function initScheduler(): Promise<void> {
  console.log('⏰ [EDI Scheduler] Initializing...');

  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();

    const result = await db.request().query(`
      SELECT endpoint_id, name, schedule_enabled, schedule_cron, schedule_yard_id, type, shipping_line
      FROM EDIEndpoints
      WHERE is_active = 1 AND schedule_enabled = 1
    `);

    const endpoints: ScheduledEndpoint[] = result.recordset;

    if (endpoints.length === 0) {
      console.log('  ℹ️ [EDI Scheduler] No scheduled endpoints found');
      return;
    }

    for (const ep of endpoints) {
      startJob(ep);
    }

    console.log(`⏰ [EDI Scheduler] ${activeJobs.size} job(s) active`);
  } catch (error) {
    console.error('❌ [EDI Scheduler] Init error:', error);
  }
}

// Reload a single endpoint's schedule (called when settings change)
export async function reloadEndpointSchedule(endpointId: number): Promise<void> {
  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const sql = (await import('mssql')).default;

    const result = await db.request()
      .input('epId', sql.Int, endpointId)
      .query('SELECT endpoint_id, name, schedule_enabled, schedule_cron, schedule_yard_id, type, shipping_line FROM EDIEndpoints WHERE endpoint_id = @epId');

    if (result.recordset.length === 0) {
      stopJob(endpointId);
      return;
    }

    const ep = result.recordset[0] as ScheduledEndpoint;

    if (ep.schedule_enabled) {
      startJob(ep);
    } else {
      stopJob(endpointId);
    }
  } catch (error) {
    console.error(`❌ [EDI Scheduler] Reload error for endpoint ${endpointId}:`, error);
  }
}

// Reload ALL schedules (called when bulk save)
export async function reloadAllSchedules(): Promise<void> {
  // Stop all existing
  for (const [id] of activeJobs) {
    stopJob(id);
  }
  // Re-init
  await initScheduler();
}

// Get status of all scheduled jobs
export function getSchedulerStatus(): { endpoint_id: number; active: boolean }[] {
  return Array.from(activeJobs.entries()).map(([id]) => ({
    endpoint_id: id,
    active: true,
  }));
}
