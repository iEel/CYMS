import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { runBookingSummaryJob } from '@/lib/bookingSummaryJob';

// GET — Manually trigger daily booking summary email
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(
      request,
      db,
      'settings.manage',
      'คุณไม่มีสิทธิ์ส่งสรุป Booking'
    );
    if (actor instanceof Response) return actor;

    return NextResponse.json(await runBookingSummaryJob(db));
  } catch (error) {
    console.error('❌ Booking summary email error:', error);
    return NextResponse.json({ error: 'Failed to send booking summary' }, { status: 500 });
  }
}
