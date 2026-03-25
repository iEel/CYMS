// Instrumentation — runs once on server startup (Next.js 14+)
export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Wait a bit for DB to be ready before initializing schedulers
    setTimeout(async () => {
      try {
        const { initScheduler } = await import('@/lib/ediScheduler');
        await initScheduler();
      } catch (error) {
        console.error('❌ [Instrumentation] EDI Scheduler init failed:', error);
      }
      try {
        const { initBookingScheduler } = await import('@/lib/bookingScheduler');
        await initBookingScheduler();
      } catch (error) {
        console.error('❌ [Instrumentation] Booking Scheduler init failed:', error);
      }
      try {
        const { initPhotoCleanupScheduler } = await import('@/lib/photoCleanupScheduler');
        await initPhotoCleanupScheduler();
      } catch (error) {
        console.error('❌ [Instrumentation] Photo Cleanup Scheduler init failed:', error);
      }
    }, 5000); // 5 second delay to ensure DB is connected
  }
}
