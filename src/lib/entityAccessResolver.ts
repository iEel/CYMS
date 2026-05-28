import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { requireYardAccess, type RequestActor } from '@/lib/apiAuth';

interface EntityDbRequest {
  input(name: string, type: unknown, value: unknown): EntityDbRequest;
  query(statement: string): Promise<{ recordset: unknown[] }>;
}

export interface EntityDb {
  request(): EntityDbRequest;
}

export type EntityType =
  | 'container'
  | 'booking'
  | 'invoice'
  | 'statement'
  | 'billing_statement'
  | 'gate_transaction'
  | 'eir'
  | 'gate_out_request'
  | 'repair_order'
  | 'eor'
  | 'reefer_check'
  | 'reefer_exception';

type EntityScopeConfig = {
  table: string;
  idColumn: string;
  refColumn?: string;
  yardColumn: string;
  customerExpression?: string;
};

export type EntityScope = {
  entityType: EntityType;
  entityId: number | null;
  entityRef: string | null;
  yardId: number | null;
  customerId: number | null;
};

export const ENTITY_SCOPE_CONFIGS: Record<EntityType, EntityScopeConfig> = {
  container: {
    table: 'Containers',
    idColumn: 'container_id',
    refColumn: 'container_number',
    yardColumn: 'yard_id',
    customerExpression: 'customer_id',
  },
  booking: {
    table: 'Bookings',
    idColumn: 'booking_id',
    refColumn: 'booking_number',
    yardColumn: 'yard_id',
    customerExpression: 'COALESCE(booking_customer_id, customer_id)',
  },
  invoice: {
    table: 'Invoices',
    idColumn: 'invoice_id',
    refColumn: 'invoice_number',
    yardColumn: 'yard_id',
    customerExpression: 'customer_id',
  },
  statement: {
    table: 'BillingStatements',
    idColumn: 'statement_id',
    refColumn: 'statement_number',
    yardColumn: 'yard_id',
    customerExpression: 'customer_id',
  },
  billing_statement: {
    table: 'BillingStatements',
    idColumn: 'statement_id',
    refColumn: 'statement_number',
    yardColumn: 'yard_id',
    customerExpression: 'customer_id',
  },
  gate_transaction: {
    table: 'GateTransactions',
    idColumn: 'transaction_id',
    refColumn: 'eir_number',
    yardColumn: 'yard_id',
    customerExpression: 'COALESCE(billing_customer_id, booking_customer_id, container_owner_id, trucking_company_id)',
  },
  eir: {
    table: 'GateTransactions',
    idColumn: 'transaction_id',
    refColumn: 'eir_number',
    yardColumn: 'yard_id',
    customerExpression: 'COALESCE(billing_customer_id, booking_customer_id, container_owner_id, trucking_company_id)',
  },
  gate_out_request: {
    table: 'GateOutRequests',
    idColumn: 'request_id',
    refColumn: 'eir_number',
    yardColumn: 'yard_id',
    customerExpression: 'customer_id',
  },
  repair_order: {
    table: 'RepairOrders',
    idColumn: 'eor_id',
    refColumn: 'eor_number',
    yardColumn: 'yard_id',
    customerExpression: 'billing_customer_id',
  },
  eor: {
    table: 'RepairOrders',
    idColumn: 'eor_id',
    refColumn: 'eor_number',
    yardColumn: 'yard_id',
    customerExpression: 'billing_customer_id',
  },
  reefer_check: {
    table: 'ReeferTemperatureChecks',
    idColumn: 'check_id',
    yardColumn: 'yard_id',
    customerExpression: 'customer_id',
  },
  reefer_exception: {
    table: 'ReeferExceptions',
    idColumn: 'exception_id',
    yardColumn: 'yard_id',
    customerExpression: 'customer_id',
  },
};

export function isEntityAccessResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export function normalizeEntityType(value: string | null | undefined): EntityType | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return normalized in ENTITY_SCOPE_CONFIGS ? normalized as EntityType : null;
}

export function parseEntityId(value: string | number | null | undefined): number | null | NextResponse {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NextResponse.json({ error: 'entity_id ไม่ถูกต้อง' }, { status: 400 });
  }
  return parsed;
}

function normalizeEntityRef(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function resolveEntityScope({
  db,
  entityType,
  entityId,
  entityRef,
}: {
  db: EntityDb;
  entityType: string;
  entityId: number | null;
  entityRef: string | null;
}): Promise<EntityScope | NextResponse> {
  const normalizedType = normalizeEntityType(entityType);
  const scope = normalizedType ? ENTITY_SCOPE_CONFIGS[normalizedType] : null;
  const normalizedRef = normalizeEntityRef(entityRef);

  if (!normalizedType || !scope) {
    return NextResponse.json({ error: 'entity_type นี้ยังไม่รองรับ' }, { status: 400 });
  }
  if (!entityId && !normalizedRef) {
    return NextResponse.json({ error: 'entity_id หรือ entity_ref จำเป็นต้องระบุ' }, { status: 400 });
  }

  const refSelect = scope.refColumn ? `${scope.refColumn} AS entity_ref` : 'CAST(NULL AS NVARCHAR(100)) AS entity_ref';
  const refCondition = scope.refColumn ? `OR (@entityRef IS NOT NULL AND ${scope.refColumn} = @entityRef)` : '';
  const customerSelect = scope.customerExpression ? `${scope.customerExpression} AS customer_id` : 'CAST(NULL AS INT) AS customer_id';
  const result = await db.request()
    .input('entityId', sql.Int, entityId)
    .input('entityRef', sql.NVarChar(100), normalizedRef)
    .query(`
      SELECT TOP 1
        ${scope.idColumn} AS entity_id,
        ${refSelect},
        ${scope.yardColumn} AS yard_id,
        ${customerSelect}
      FROM ${scope.table}
      WHERE
        (@entityId IS NOT NULL AND ${scope.idColumn} = @entityId)
        ${refCondition}
    `);

  const row = result.recordset[0] as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบรายการที่ต้องการตรวจสิทธิ์' }, { status: 404 });
  }

  return {
    entityType: normalizedType,
    entityId: normalizePositiveInt(row.entity_id),
    entityRef: typeof row.entity_ref === 'string'
      ? row.entity_ref
      : typeof row.entity_number === 'string'
        ? row.entity_number
        : normalizedRef,
    yardId: normalizePositiveInt(row.yard_id),
    customerId: normalizePositiveInt(row.customer_id),
  };
}

export async function requireResolvedEntityYardAccess({
  request,
  db,
  actor,
  scope,
  message = 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของลานนี้',
}: {
  request: NextRequest;
  db: EntityDb;
  actor: RequestActor;
  scope: EntityScope;
  message?: string;
}): Promise<RequestActor | NextResponse> {
  if (scope.yardId) {
    return requireYardAccess(request, db, scope.yardId, message);
  }

  if (actor.role === 'yard_manager') return actor;

  return NextResponse.json({ error: 'รายการนี้ไม่มีข้อมูลลานสำหรับตรวจสิทธิ์' }, { status: 403 });
}
