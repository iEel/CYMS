import { NextResponse } from 'next/server';
import { INTEGRATION_MAPPING } from '@/lib/integrationMapping';

export async function GET() {
  return NextResponse.json({ mappings: INTEGRATION_MAPPING });
}
