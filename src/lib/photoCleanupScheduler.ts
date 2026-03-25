import cron, { ScheduledTask } from 'node-cron';

// Photo Cleanup Scheduler
let cleanupJob: ScheduledTask | null = null;
let currentCronExpr: string | null = null;

async function executeCleanup(): Promise<void> {
  console.log('🧹 [Photo Cleanup] Starting cleanup...');
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3005}`;
    const res = await fetch(`${baseUrl}/api/settings/photo-retention/cleanup`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      console.log(`  ✅ [Photo Cleanup] Deleted ${data.deleted} files, freed ${data.freed_mb} MB`);
    } else {
      console.log(`  ⚠️ [Photo Cleanup] Error: ${data.error || 'unknown'}`);
    }
  } catch (error) {
    console.error('  ❌ [Photo Cleanup] Error:', error);
  }
}

// Convert "HH:MM" time string to cron expression "MM HH * * *"
function timeToCron(time: string): string {
  const [hh, mm] = (time || '03:00').split(':').map(Number);
  return `${isNaN(mm) ? 0 : mm} ${isNaN(hh) ? 3 : hh} * * *`;
}

export async function initPhotoCleanupScheduler(): Promise<void> {
  console.log('🧹 [Photo Cleanup] Initializing...');

  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();

    const result = await db.request().query(`
      SELECT setting_key, setting_value FROM SystemSettings
      WHERE setting_key IN ('photo_retention_auto_cleanup_enabled', 'photo_retention_auto_cleanup_time')
    `);

    const s: Record<string, string> = {};
    for (const row of result.recordset) s[row.setting_key] = row.setting_value;

    if (s.photo_retention_auto_cleanup_enabled !== 'true') {
      console.log('  ℹ️ [Photo Cleanup] Disabled — skipping');
      stopPhotoCleanupScheduler();
      return;
    }

    const time = s.photo_retention_auto_cleanup_time || '03:00';
    const cronExpr = timeToCron(time);

    if (!cron.validate(cronExpr)) {
      console.error(`  ❌ [Photo Cleanup] Invalid cron: "${cronExpr}"`);
      return;
    }

    // Only restart if cron changed
    if (currentCronExpr === cronExpr && cleanupJob) {
      console.log(`  ℹ️ [Photo Cleanup] Already running at ${time} — no change`);
      return;
    }

    stopPhotoCleanupScheduler();

    cleanupJob = cron.schedule(cronExpr, () => {
      executeCleanup();
    }, { timezone: 'Asia/Bangkok' });

    currentCronExpr = cronExpr;
    console.log(`  ✅ [Photo Cleanup] Scheduled daily cleanup at ${time} (${cronExpr})`);
  } catch (error) {
    console.error('❌ [Photo Cleanup] Init error:', error);
  }
}

export function stopPhotoCleanupScheduler(): void {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    currentCronExpr = null;
  }
}

export async function reloadPhotoCleanupScheduler(): Promise<void> {
  stopPhotoCleanupScheduler();
  await initPhotoCleanupScheduler();
}

export function getPhotoCleanupStatus(): { active: boolean; cron: string | null } {
  return { active: !!cleanupJob, cron: currentCronExpr };
}
