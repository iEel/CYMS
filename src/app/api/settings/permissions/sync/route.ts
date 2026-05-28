import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { requireRole } from '@/lib/apiAuth';
import { getDb } from '@/lib/db';
import { PERMISSION_SEEDS, ROLE_SEEDS, syncGranularRbac } from '@/lib/rbacSeeds';

export async function POST(request: NextRequest) {
  const auth = requireRole(request, ['yard_manager'], 'เฉพาะ Yard Manager เท่านั้นที่ sync สิทธิ์ได้');
  if (auth instanceof NextResponse) return auth;

  try {
    const db = await getDb();
    await syncGranularRbac(db);
    await logAudit({
      userId: auth.userId,
      action: 'permissions_seed_sync',
      entityType: 'permission',
      details: {
        roles: ROLE_SEEDS.length,
        permissions: PERMISSION_SEEDS.length,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST permissions sync error:', error);
    return NextResponse.json({ error: 'ไม่สามารถ sync สิทธิ์ได้' }, { status: 500 });
  }
}
