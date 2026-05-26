import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

export type PortalAction =
  | 'portal.container.view'
  | 'portal.booking.view'
  | 'portal.booking.create'
  | 'portal.document.download'
  | 'portal.invoice.view'
  | 'portal.invoice.download'
  | 'portal.dispute.create'
  | 'portal.eir.view'
  | 'portal.eir.download'
  | 'portal.eir.grade.view'
  | 'portal.reefer.view'
  | 'portal.reefer.download'
  | 'portal.reefer.exception.view'
  | 'portal.reefer.exception.dispute'
  | 'portal.trucking.view'
  | 'portal.driver.view';

export type CustomerPortalRole =
  | 'customer_admin'
  | 'operations_user'
  | 'booking_user'
  | 'billing_user'
  | 'document_user'
  | 'trucking_coordinator'
  | 'driver_user'
  | 'read_only_viewer';

export interface CustomerPortalActor {
  userId: number;
  customerPortalRole: CustomerPortalRole;
  actions: Set<PortalAction>;
}

interface PortalPermissionDbRequest {
  input(name: string, type: unknown, value: unknown): PortalPermissionDbRequest;
  query(statement: string): Promise<{ recordset: Array<{ customer_portal_role?: unknown }> }>;
}

interface PortalPermissionDb {
  request(): PortalPermissionDbRequest;
}

const ALL_PORTAL_ACTIONS: readonly PortalAction[] = [
  'portal.container.view',
  'portal.booking.view',
  'portal.booking.create',
  'portal.document.download',
  'portal.invoice.view',
  'portal.invoice.download',
  'portal.dispute.create',
  'portal.eir.view',
  'portal.eir.download',
  'portal.eir.grade.view',
  'portal.reefer.view',
  'portal.reefer.download',
  'portal.reefer.exception.view',
  'portal.reefer.exception.dispute',
  'portal.trucking.view',
  'portal.driver.view',
];

export const ROLE_ACTIONS = {
  customer_admin: ALL_PORTAL_ACTIONS,
  operations_user: [
    'portal.container.view',
    'portal.booking.view',
    'portal.document.download',
    'portal.eir.view',
    'portal.eir.download',
    'portal.trucking.view',
    'portal.reefer.view',
    'portal.reefer.exception.view',
  ],
  booking_user: [
    'portal.container.view',
    'portal.booking.view',
    'portal.booking.create',
    'portal.document.download',
  ],
  billing_user: [
    'portal.container.view',
    'portal.booking.view',
    'portal.document.download',
    'portal.invoice.view',
    'portal.invoice.download',
    'portal.dispute.create',
  ],
  document_user: [
    'portal.container.view',
    'portal.booking.view',
    'portal.document.download',
    'portal.eir.view',
    'portal.eir.download',
    'portal.reefer.view',
    'portal.reefer.download',
  ],
  trucking_coordinator: [
    'portal.container.view',
    'portal.booking.view',
    'portal.trucking.view',
    'portal.driver.view',
  ],
  driver_user: [
    'portal.driver.view',
  ],
  read_only_viewer: [
    'portal.container.view',
    'portal.booking.view',
    'portal.invoice.view',
    'portal.eir.view',
    'portal.trucking.view',
    'portal.driver.view',
    'portal.reefer.view',
    'portal.reefer.exception.view',
  ],
} as const satisfies Record<CustomerPortalRole, readonly PortalAction[]>;

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function normalizeCustomerPortalRole(role: unknown): CustomerPortalRole {
  if (typeof role === 'string' && role in ROLE_ACTIONS) {
    return role as CustomerPortalRole;
  }

  return 'customer_admin';
}

export function getCustomerPortalActions(role: CustomerPortalRole | string | null | undefined): Set<PortalAction> {
  return new Set(ROLE_ACTIONS[normalizeCustomerPortalRole(role)]);
}

export function hasPortalAction(
  role: CustomerPortalRole | string | null | undefined,
  action: PortalAction
): boolean {
  return getCustomerPortalActions(role).has(action);
}

export async function requirePortalAction(
  request: NextRequest,
  db: PortalPermissionDb,
  action: PortalAction
): Promise<CustomerPortalActor | NextResponse> {
  const userId = parsePositiveInt(request.headers.get('x-user-id'));
  if (!userId) {
    return NextResponse.json(
      { error: 'ไม่ได้รับอนุญาต — กรุณาเข้าสู่ระบบ' },
      { status: 401 }
    );
  }

  const result = await db.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT TOP 1 customer_portal_role
      FROM Users
      WHERE user_id = @userId
        AND status = 'active'
        AND customer_id IS NOT NULL
    `);

  if (result.recordset.length === 0) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึง Customer Portal' }, { status: 403 });
  }

  const customerPortalRole = normalizeCustomerPortalRole(result.recordset[0].customer_portal_role);
  const actions = getCustomerPortalActions(customerPortalRole);

  if (!actions.has(action)) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้' }, { status: 403 });
  }

  return {
    userId,
    customerPortalRole,
    actions,
  };
}
