import { NextResponse } from 'next/server';
import { DATA_QUALITY_RULES } from '@/lib/dataQualityRules';

export async function GET() {
  return NextResponse.json({ rules: DATA_QUALITY_RULES });
}
