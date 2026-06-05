import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

import type { CustomerPortalRole } from './customerPortalPermissions';
import { hasPortalAction, normalizeCustomerPortalRole } from './customerPortalPermissions';

export type TransportPortalAction =
  | 'transport.jobs.view'
  | 'transport.eir.view'
  | 'transport.jobs.action'
  | 'transport.activity.view';

export type TransportJobSource = 'gate_out_request' | 'gate_transaction';

export type TransportPortalActor = {
  userId: number;
  customerId: number;
  customerPortalRole: 'trucking_coordinator' | 'driver_user';
  mode: 'trucking' | 'driver';
};

interface TransportPortalDbRequest {
  input(name: string, type: unknown, value: unknown): TransportPortalDbRequest;
  query(statement: string): Promise<{
    recordset: Array<{
      user_id?: unknown;
      customer_id?: unknown;
      role_code?: unknown;
      customer_portal_role?: unknown;
    }>;
  }>;
}

interface TransportPortalDb {
  request(): TransportPortalDbRequest;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function asPositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function toTransportMode(role: CustomerPortalRole) {
  if (role === 'trucking_coordinator') return 'trucking' as const;
  if (role === 'driver_user') return 'driver' as const;
  return null;
}

function isTransportCustomerPortalRole(
  role: CustomerPortalRole,
): role is TransportPortalActor['customerPortalRole'] {
  return role === 'trucking_coordinator' || role === 'driver_user';
}

export function isDriverTransportActor(actor: unknown): actor is TransportPortalActor & { mode: 'driver' } {
  return Boolean(actor && typeof actor === 'object' && (actor as { mode?: unknown }).mode === 'driver');
}

export function isTruckingTransportActor(actor: unknown): actor is TransportPortalActor & { mode: 'trucking' } {
  return Boolean(actor && typeof actor === 'object' && (actor as { mode?: unknown }).mode === 'trucking');
}

export function resolveTransportJobId(value: unknown): { source: TransportJobSource; id: number } | null {
  if (typeof value !== 'string') return null;

  const match = /^(request|gate)-([1-9]\d*)$/.exec(value);
  if (!match) return null;

  return {
    source: match[1] === 'request' ? 'gate_out_request' : 'gate_transaction',
    id: Number(match[2]),
  };
}

export function assertTransportJobSource(
  job: { source: TransportJobSource; id: number },
  allowed: TransportJobSource[],
): boolean {
  return allowed.includes(job.source);
}

export async function requireTransportPortalActor(
  request: NextRequest,
  db: TransportPortalDb,
  action: TransportPortalAction,
): Promise<TransportPortalActor | NextResponse> {
  const userId = parsePositiveInt(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json(
      { error: 'ไม่ได้รับอนุญาต — กรุณาเข้าสู่ระบบ' },
      { status: 401 },
    );
  }

  const result = await db.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT TOP 1 u.user_id, u.customer_id, u.customer_portal_role, r.role_code
      FROM Users u
      JOIN Roles r ON r.role_id = u.role_id
      WHERE u.user_id = @userId
        AND u.status = 'active'
        AND u.customer_id IS NOT NULL
    `);

  const row = result.recordset[0];
  const customerId = asPositiveInt(row?.customer_id);
  const roleCode = typeof row?.role_code === 'string' ? row.role_code : null;
  const customerPortalRole = normalizeCustomerPortalRole(row?.customer_portal_role);
  const mode = toTransportMode(customerPortalRole);

  if (!row || roleCode !== 'customer' || !customerId || !mode || !isTransportCustomerPortalRole(customerPortalRole)) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึง Transport Portal' }, { status: 403 });
  }

  const transportActionAllowed =
    action === 'transport.jobs.view' ||
    action === 'transport.eir.view' ||
    action === 'transport.jobs.action' ||
    action === 'transport.activity.view';
  if (!transportActionAllowed) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้' }, { status: 403 });
  }

  const requiredAction = mode === 'driver' ? 'portal.driver.view' : 'portal.trucking.view';
  if (!hasPortalAction(customerPortalRole, requiredAction)) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้' }, { status: 403 });
  }

  return {
    userId,
    customerId,
    customerPortalRole,
    mode,
  };
}

export function buildTransportJobAccessSql(
  actor: TransportPortalActor,
  aliases: {
    gateAlias?: string;
    gateOutRequestAlias?: string;
    bookingAlias?: string;
  } = {},
) {
  const gateAlias = aliases.gateAlias ?? 'g';
  const gateOutRequestAlias = aliases.gateOutRequestAlias ?? 'gor';
  const bookingAlias = aliases.bookingAlias ?? 'b';

  if (actor.mode === 'driver') {
    return `(
      ${gateAlias}.driver_user_id = @transportUserId
      OR ${gateOutRequestAlias}.driver_user_id = @transportUserId
    )`;
  }

  return `(
    ${gateAlias}.trucking_company_id = @transportCustomerId
    OR ${gateOutRequestAlias}.trucking_company_id = @transportCustomerId
    OR ${bookingAlias}.trucking_company_id = @transportCustomerId
    OR EXISTS (
      SELECT 1
      FROM PortalEntityAccess pea
      WHERE pea.customer_id = @transportCustomerId
        AND pea.access_role = 'trucking'
        AND pea.is_active = 1
        AND (pea.valid_from IS NULL OR pea.valid_from <= GETDATE())
        AND (pea.valid_until IS NULL OR pea.valid_until >= GETDATE())
        AND (
          (pea.entity_type = 'gate_transaction' AND (pea.entity_id = ${gateAlias}.transaction_id OR pea.entity_ref = ${gateAlias}.eir_number))
          OR (pea.entity_type = 'booking' AND (pea.entity_id = ${bookingAlias}.booking_id OR pea.entity_ref = ${bookingAlias}.booking_number))
        )
    )
  )`;
}

export function buildTransportEirAccessSql(
  actor: TransportPortalActor,
  aliases: {
    gateAlias?: string;
    gateOutRequestAlias?: string;
    bookingAlias?: string;
  } = {},
) {
  const gateAlias = aliases.gateAlias ?? 'g';
  const gateOutRequestAlias = aliases.gateOutRequestAlias ?? 'gor';
  const bookingAlias = aliases.bookingAlias ?? 'b';

  if (actor.mode === 'driver') {
    return `(
      ${gateAlias}.driver_user_id = @transportUserId
      OR ${gateOutRequestAlias}.driver_user_id = @transportUserId
    )`;
  }

  return `(
    ${gateAlias}.trucking_company_id = @transportCustomerId
    OR ${gateOutRequestAlias}.trucking_company_id = @transportCustomerId
    OR ${bookingAlias}.trucking_company_id = @transportCustomerId
    OR EXISTS (
      SELECT 1
      FROM PortalEntityAccess pea
      WHERE pea.customer_id = @transportCustomerId
        AND pea.access_role = 'trucking'
        AND pea.is_active = 1
        AND (pea.valid_from IS NULL OR pea.valid_from <= GETDATE())
        AND (pea.valid_until IS NULL OR pea.valid_until >= GETDATE())
        AND (
          (pea.entity_type = 'eir' AND (pea.entity_id = ${gateAlias}.transaction_id OR pea.entity_ref = ${gateAlias}.eir_number))
          OR (pea.entity_type = 'gate_transaction' AND (pea.entity_id = ${gateAlias}.transaction_id OR pea.entity_ref = ${gateAlias}.eir_number))
          OR (pea.entity_type = 'booking' AND (pea.entity_id = ${bookingAlias}.booking_id OR pea.entity_ref = ${bookingAlias}.booking_number))
        )
    )
  )`;
}
