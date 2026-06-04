import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { requireTransportPortalActor } from '@/lib/transportPortalAccess';

export async function GET(request: NextRequest) {
  const db = await getDb();
  const actor = await requireTransportPortalActor(request, db, 'transport.jobs.view');
  if (actor instanceof NextResponse) return actor;

  return NextResponse.json({
    transport: {
      enabled: true,
      mode: actor.mode,
    },
  });
}
