import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import { runPhotoRetentionCleanup } from '@/lib/photoRetentionCleanup';

// POST — Run cleanup (delete files past retention period)
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(
      request,
      db,
      'settings.manage',
      'คุณไม่มีสิทธิ์สั่งลบไฟล์ตาม retention policy'
    );
    if (actor instanceof Response) return actor;

    const result = await runPhotoRetentionCleanup(db);

    await logAudit({
      userId: actor.userId,
      action: 'photo_retention_cleanup',
      entityType: 'system_setting',
      details: { deleted: result.deleted, freed_mb: result.freed_mb },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json({ error: 'Cleanup ล้มเหลว' }, { status: 500 });
  }
}
