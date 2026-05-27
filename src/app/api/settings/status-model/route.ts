import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { CONTAINER_STATUS_MODEL } from '@/lib/containerStatus';
import { requirePermission } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ดู Status Model');
  if (actor instanceof NextResponse) return actor;

  return NextResponse.json({
    container_statuses: Object.entries(CONTAINER_STATUS_MODEL).map(([status, config]) => ({
      status,
      ...config,
    })),
  });
}
