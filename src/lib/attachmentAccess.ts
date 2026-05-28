import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requirePermission } from '@/lib/apiAuth';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export function requireAttachmentView(request: NextRequest, db: DbPool) {
  return requireAnyPermission(
    request,
    db,
    [
      'documents.attachment.view',
      'gate.eir.print',
      'survey.inspect',
      'mnr.eor.create',
      'mnr.eor.update',
      'billing.invoice.create',
      'reports.view',
    ],
    'คุณไม่มีสิทธิ์ดูเอกสารแนบ'
  );
}

export function requireAttachmentUpload(request: NextRequest, db: DbPool) {
  return requirePermission(
    request,
    db,
    'documents.attachment.upload',
    'คุณไม่มีสิทธิ์อัปโหลดเอกสารแนบ'
  );
}

export function isAttachmentAuthResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
