import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { INTEGRATION_MAPPING } from '@/lib/integrationMapping';
import { requireAnyPermission } from '@/lib/apiAuth';

const INTEGRATION_MAPPING_READ_PERMISSIONS = [
  'integration.logs.view',
  'settings.manage',
];

export async function GET(request: NextRequest) {
  const db = await getDb();
  const actor = await requireAnyPermission(request, db, INTEGRATION_MAPPING_READ_PERMISSIONS, 'คุณไม่มีสิทธิ์ดู Integration Mapping');
  if (actor instanceof NextResponse) return actor;

  return NextResponse.json({ mappings: INTEGRATION_MAPPING });
}
