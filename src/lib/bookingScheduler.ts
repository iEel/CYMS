import cron, { ScheduledTask } from 'node-cron';

// Booking Daily Summary Scheduler
let summaryJob: ScheduledTask | null = null;
let currentCronExpr: string | null = null;

async function executeDailySummary(): Promise<void> {
  console.log('⏰ [Booking Scheduler] Sending daily summary...');
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3005}`;
    const res = await fetch(`${baseUrl}/api/cron/booking-summary`);
    const data = await res.json();

    if (data.success) {
      console.log(`  ✅ [Booking Scheduler] Summary sent to ${data.recipients} recipient(s)`);
    } else if (data.skipped) {
      console.log(`  ℹ️ [Booking Scheduler] Skipped: ${data.reason}`);
    } else {
      console.log(`  ⚠️ [Booking Scheduler] Error: ${data.error || 'unknown'}`);
    }
  } catch (error) {
    console.error('  ❌ [Booking Scheduler] Error:', error);
  }
}

// Convert "HH:MM" time string to cron expression "MM HH * * *"
function timeToCron(time: string): string {
  const [hh, mm] = (time || '18:00').split(':').map(Number);
  return `${isNaN(mm) ? 0 : mm} ${isNaN(hh) ? 18 : hh} * * *`;
}

export async function initBookingScheduler(): Promise<void> {
  console.log('⏰ [Booking Scheduler] Initializing...');

  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();

    const result = await db.request().query(`
      SELECT setting_key, setting_value FROM SystemSettings
      WHERE setting_key IN ('email_notify_booking_summary', 'email_booking_summary_time')
    `);

    const s: Record<string, string> = {};
    for (const row of result.recordset) s[row.setting_key] = row.setting_value;

    if (s.email_notify_booking_summary !== 'true') {
      console.log('  ℹ️ [Booking Scheduler] Disabled — skipping');
      stopBookingScheduler();
      return;
    }

    const time = s.email_booking_summary_time || '18:00';
    const cronExpr = timeToCron(time);

    if (!cron.validate(cronExpr)) {
      console.error(`  ❌ [Booking Scheduler] Invalid cron: "${cronExpr}"`);
      return;
    }

    // Only restart if cron changed
    if (currentCronExpr === cronExpr && summaryJob) {
      console.log(`  ℹ️ [Booking Scheduler] Already running at ${time} — no change`);
      return;
    }

    stopBookingScheduler();

    summaryJob = cron.schedule(cronExpr, () => {
      executeDailySummary();
    }, { timezone: 'Asia/Bangkok' });

    currentCronExpr = cronExpr;
    console.log(`  ✅ [Booking Scheduler] Scheduled daily summary at ${time} (${cronExpr})`);
  } catch (error) {
    console.error('❌ [Booking Scheduler] Init error:', error);
  }
}

export function stopBookingScheduler(): void {
  if (summaryJob) {
    summaryJob.stop();
    summaryJob = null;
    currentCronExpr = null;
  }
}

export async function reloadBookingScheduler(): Promise<void> {
  stopBookingScheduler();
  await initBookingScheduler();
}

export function getBookingSchedulerStatus(): { active: boolean; cron: string | null } {
  return { active: !!summaryJob, cron: currentCronExpr };
}
