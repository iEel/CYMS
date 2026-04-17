import { NextResponse } from 'next/server';
import { CONTAINER_STATUS_MODEL } from '@/lib/containerStatus';

export async function GET() {
  return NextResponse.json({
    container_statuses: Object.entries(CONTAINER_STATUS_MODEL).map(([status, config]) => ({
      status,
      ...config,
    })),
  });
}
