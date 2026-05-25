import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/apiAuth';
import {
  previewPortalEntityAccessGrants,
  repairPortalEntityAccessGrants,
} from '@/lib/portalGrantReconciler';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function parseLimit(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get('limit');
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const actor = requireRole(
      request,
      ['admin', 'yard_manager'],
      'เฉพาะผู้ดูแลระบบเท่านั้นที่ตรวจสอบสิทธิ์ Customer Portal ได้'
    );
    if (actor instanceof NextResponse) return actor;

    const db = await getDb();
    const preview = await previewPortalEntityAccessGrants(db, { limit: parseLimit(request) });

    return NextResponse.json({ success: true, ...preview });
  } catch (error) {
    console.error('❌ Portal grant preview error:', error);
    return NextResponse.json({ error: 'ไม่สามารถตรวจสอบ portal grants ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = requireRole(
      request,
      ['admin', 'yard_manager'],
      'เฉพาะผู้ดูแลระบบเท่านั้นที่ซ่อมแซมสิทธิ์ Customer Portal ได้'
    );
    if (actor instanceof NextResponse) return actor;

    const db = await getDb();
    const repair = await repairPortalEntityAccessGrants(db, { limit: parseLimit(request) });

    await logAudit({
      userId: actor.userId,
      action: 'portal_grants_reconcile_repair',
      entityType: 'portal_entity_access',
      details: {
        repaired_missing: repair.repaired_missing,
        deactivated_stale: repair.deactivated_stale,
        before: repair.before.summary,
        after: repair.after.summary,
      },
    });

    return NextResponse.json({ success: true, ...repair });
  } catch (error) {
    console.error('❌ Portal grant repair error:', error);
    return NextResponse.json({ error: 'ไม่สามารถซ่อมแซม portal grants ได้' }, { status: 500 });
  }
}
