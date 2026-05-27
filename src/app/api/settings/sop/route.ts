import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { OPERATIONAL_SOP_HINTS } from '@/lib/operationalSop';
import { requirePermission } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ดู SOP');
  if (actor instanceof NextResponse) return actor;

  return NextResponse.json({ hints: OPERATIONAL_SOP_HINTS });
}
