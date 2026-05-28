import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { DATA_QUALITY_RULES } from '@/lib/dataQualityRules';
import { requirePermission } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ดู Data Quality Rules');
  if (actor instanceof NextResponse) return actor;

  return NextResponse.json({ rules: DATA_QUALITY_RULES });
}
