import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission, type RequestActor } from '@/lib/apiAuth';
import {
  isEntityAccessResponse,
  normalizeEntityType,
  parseEntityId,
  requireResolvedEntityYardAccess,
  resolveEntityScope,
  type EntityType,
} from '@/lib/entityAccessResolver';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export function requireAttachmentView(request: NextRequest, db: DbPool) {
  return requirePermission(
    request,
    db,
    'documents.attachment.view',
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

export type AttachmentEntityScope = {
  entityType: string;
  entityId: number | null;
  entityNumber: string | null;
  yardId: number | null;
};

export function parseAttachmentEntityId(value: string | number | null | undefined): number | null | NextResponse {
  return parseEntityId(value);
}

export function normalizeAttachmentEntityType(value: string | null | undefined): string | null {
  return normalizeEntityType(value);
}

export async function resolveAttachmentEntityScope({
  db,
  entityType,
  entityId,
  entityNumber,
}: {
  db: DbPool;
  entityType: string;
  entityId: number | null;
  entityNumber: string | null;
}): Promise<AttachmentEntityScope | NextResponse> {
  const scope = await resolveEntityScope({ db, entityType, entityId, entityRef: entityNumber });
  if (isEntityAccessResponse(scope)) {
    if (scope.status === 400) {
      const body = await scope.json();
      const message = String(body.error || '');
      if (message.includes('entity_type')) {
        return NextResponse.json({ error: 'entity_type นี้ยังไม่รองรับเอกสารแนบ' }, { status: 400 });
      }
      if (message.includes('entity_id') || message.includes('entity_ref')) {
        return NextResponse.json({ error: 'entity_id หรือ entity_number จำเป็นต้องระบุ' }, { status: 400 });
      }
    }
    if (scope.status === 404) {
      return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการแนบเอกสาร' }, { status: 404 });
    }
    return scope;
  }

  if (!scope.entityType) {
    return NextResponse.json({ error: 'entity_type นี้ยังไม่รองรับเอกสารแนบ' }, { status: 400 });
  }

  return {
    entityType: scope.entityType,
    entityId: scope.entityId,
    entityNumber: scope.entityRef,
    yardId: scope.yardId,
  };
}

export async function requireAttachmentEntityAccess({
  request,
  db,
  actor,
  scope,
}: {
  request: NextRequest;
  db: DbPool;
  actor: RequestActor;
  scope: AttachmentEntityScope;
}): Promise<RequestActor | NextResponse> {
  return requireResolvedEntityYardAccess({
    request,
    db,
    actor,
    scope: {
      entityType: scope.entityType as EntityType,
      entityId: scope.entityId,
      entityRef: scope.entityNumber,
      yardId: scope.yardId,
      customerId: null,
    },
    message: 'คุณไม่มีสิทธิ์เข้าถึงเอกสารแนบของลานนี้',
  });
}
