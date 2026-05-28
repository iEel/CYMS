import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission, requireRequestActor, requireYardAccess, type RequestActor } from '@/lib/apiAuth';
import sql from 'mssql';

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

type AttachmentEntityScopeConfig = {
  table: string;
  idColumn: string;
  refColumn?: string;
  yardColumn: string;
};

export type AttachmentEntityScope = {
  entityType: string;
  entityId: number | null;
  entityNumber: string | null;
  yardId: number | null;
};

const ATTACHMENT_ENTITY_SCOPES: Record<string, AttachmentEntityScopeConfig> = {
  container: { table: 'Containers', idColumn: 'container_id', refColumn: 'container_number', yardColumn: 'yard_id' },
  booking: { table: 'Bookings', idColumn: 'booking_id', refColumn: 'booking_number', yardColumn: 'yard_id' },
  invoice: { table: 'Invoices', idColumn: 'invoice_id', refColumn: 'invoice_number', yardColumn: 'yard_id' },
  statement: { table: 'BillingStatements', idColumn: 'statement_id', refColumn: 'statement_number', yardColumn: 'yard_id' },
  billing_statement: { table: 'BillingStatements', idColumn: 'statement_id', refColumn: 'statement_number', yardColumn: 'yard_id' },
  gate_transaction: { table: 'GateTransactions', idColumn: 'transaction_id', refColumn: 'eir_number', yardColumn: 'yard_id' },
  eir: { table: 'GateTransactions', idColumn: 'transaction_id', refColumn: 'eir_number', yardColumn: 'yard_id' },
  gate_out_request: { table: 'GateOutRequests', idColumn: 'request_id', refColumn: 'eir_number', yardColumn: 'yard_id' },
  repair_order: { table: 'RepairOrders', idColumn: 'eor_id', refColumn: 'eor_number', yardColumn: 'yard_id' },
  eor: { table: 'RepairOrders', idColumn: 'eor_id', refColumn: 'eor_number', yardColumn: 'yard_id' },
  reefer_check: { table: 'ReeferTemperatureChecks', idColumn: 'check_id', yardColumn: 'yard_id' },
  reefer_exception: { table: 'ReeferExceptions', idColumn: 'exception_id', yardColumn: 'yard_id' },
};

export function parseAttachmentEntityId(value: string | number | null | undefined): number | null | NextResponse {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: 'entity_id ไม่ถูกต้อง' }, { status: 400 });
  }
  return parsed;
}

export function normalizeAttachmentEntityType(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
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
  const normalizedType = normalizeAttachmentEntityType(entityType);
  const scope = normalizedType ? ATTACHMENT_ENTITY_SCOPES[normalizedType] : null;

  if (!normalizedType || !scope) {
    return NextResponse.json({ error: 'entity_type นี้ยังไม่รองรับเอกสารแนบ' }, { status: 400 });
  }

  if (!entityId && !entityNumber) {
    return NextResponse.json({ error: 'entity_id หรือ entity_number จำเป็นต้องระบุ' }, { status: 400 });
  }

  const refSelect = scope.refColumn ? `${scope.refColumn} AS entity_number` : 'CAST(NULL AS NVARCHAR(100)) AS entity_number';
  const refCondition = scope.refColumn ? `OR (@entityNumber IS NOT NULL AND ${scope.refColumn} = @entityNumber)` : '';
  const result = await db.request()
    .input('entityId', sql.Int, entityId)
    .input('entityNumber', sql.NVarChar(100), entityNumber)
    .query(`
      SELECT TOP 1
        ${scope.idColumn} AS entity_id,
        ${refSelect},
        ${scope.yardColumn} AS yard_id
      FROM ${scope.table}
      WHERE
        (@entityId IS NOT NULL AND ${scope.idColumn} = @entityId)
        ${refCondition}
    `);

  const row = result.recordset[0] as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการแนบเอกสาร' }, { status: 404 });
  }

  return {
    entityType: normalizedType,
    entityId: Number(row.entity_id) || null,
    entityNumber: typeof row.entity_number === 'string' ? row.entity_number : entityNumber,
    yardId: Number.isInteger(Number(row.yard_id)) && Number(row.yard_id) > 0 ? Number(row.yard_id) : null,
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
  if (scope.yardId) {
    return requireYardAccess(request, db, scope.yardId, 'คุณไม่มีสิทธิ์เข้าถึงเอกสารแนบของลานนี้');
  }

  const requestActor = requireRequestActor(request);
  if (requestActor instanceof NextResponse) return requestActor;
  if (actor.role === 'yard_manager') return actor;

  return NextResponse.json({ error: 'รายการนี้ไม่มีข้อมูลลานสำหรับตรวจสิทธิ์' }, { status: 403 });
}
