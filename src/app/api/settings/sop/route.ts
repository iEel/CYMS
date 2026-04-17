import { NextResponse } from 'next/server';
import { OPERATIONAL_SOP_HINTS } from '@/lib/operationalSop';

export async function GET() {
  return NextResponse.json({ hints: OPERATIONAL_SOP_HINTS });
}
