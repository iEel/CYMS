import sql from 'mssql';
import type { PortalEntityType } from './portalAccess';
import {
  upsertPortalEntityAccess,
  type PortalEntityAccessDb,
  type PortalEntityAccessGrant,
} from './portalEntityAccess';

export type PortalAccessRole =
  | 'owner'
  | 'booking_customer'
  | 'shipping_line'
  | 'forwarder'
  | 'shipper'
  | 'consignee'
  | 'trucking'
  | 'driver'
  | 'billing'
  | 'invoice_customer'
  | 'document_viewer'
  | 'internal'
  | 'auditor'
  | string;

export interface PortalPermissionScope extends Record<string, unknown> {
  view: boolean;
  download: boolean;
  billing: {
    view: boolean;
    dispute: boolean;
  };
  eir: {
    fields: {
      container_grade: boolean;
    };
    damage_summary: boolean;
    damage_photos: boolean;
  };
  maskSensitiveFields: boolean;
}

export type PortalGrantRule = Omit<PortalEntityAccessGrant, 'db'>;

type IdValue = number | string | null | undefined;

interface BookingGrantSource {
  booking_id?: IdValue;
  booking_number?: IdValue;
  customer_id?: IdValue;
  booking_customer_id?: IdValue;
  shipping_line_id?: IdValue;
  forwarder_id?: IdValue;
  shipper_id?: IdValue;
  consignee_id?: IdValue;
  trucking_company_id?: IdValue;
  bill_to_customer_id?: IdValue;
}

interface BookingContainerGrantSource {
  id?: IdValue;
  container_id?: IdValue;
  container_number?: IdValue;
}

interface GateGrantSource {
  transaction_id?: IdValue;
  eir_number?: IdValue;
  container_id?: IdValue;
  container_number?: IdValue;
  container_owner_id?: IdValue;
  booking_customer_id?: IdValue;
  billing_customer_id?: IdValue;
  trucking_company_id?: IdValue;
  driver_user_id?: IdValue;
  valid_until?: Date | string | null;
  validUntil?: Date | string | null;
}

interface InvoiceGrantSource {
  invoice_id?: IdValue;
  invoice_number?: IdValue;
  customer_id?: IdValue;
  bill_to_customer_id?: IdValue;
  invoice_customer_id?: IdValue;
  container_id?: IdValue;
  container_owner_id?: IdValue;
  trucking_company_id?: IdValue;
  driver_user_id?: IdValue;
}

interface ReeferGrantSource {
  check_id?: IdValue;
  exception_id?: IdValue;
  container_id?: IdValue;
  container_number?: IdValue;
}

interface ExistingContainerGrant {
  customer_id?: IdValue;
  entity_id?: IdValue;
  entity_ref?: IdValue;
  access_role?: IdValue;
  permission_scope?: Record<string, unknown> | string | null;
  valid_from?: Date | string | null;
  valid_until?: Date | string | null;
}

function positiveInt(value: IdValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanRef(value: IdValue) {
  if (value == null) return null;
  const ref = String(value).trim();
  return ref || null;
}

function addGrant(grants: PortalGrantRule[], grant: PortalGrantRule) {
  const customerId = positiveInt(grant.customerId);
  const entityId = positiveInt(grant.entityId);
  const entityRef = cleanRef(grant.entityRef);
  if (!customerId || (!entityId && !entityRef)) return;

  const normalizedGrant = {
    ...grant,
    customerId,
    entityId,
    entityRef,
    permissionScope: grant.permissionScope ?? defaultPortalPermissionScope(grant.accessRole),
  };
  const key = [
    normalizedGrant.customerId,
    normalizedGrant.entityType,
    normalizedGrant.entityId ?? '',
    normalizedGrant.entityRef ?? '',
    normalizedGrant.accessRole,
  ].join('|');

  if (grants.some((item) => [
    item.customerId,
    item.entityType,
    item.entityId ?? '',
    item.entityRef ?? '',
    item.accessRole,
  ].join('|') === key)) {
    return;
  }

  grants.push(normalizedGrant);
}

function bookingParties(booking: BookingGrantSource) {
  return [
    { customerId: positiveInt(booking.booking_customer_id) ?? positiveInt(booking.customer_id), accessRole: 'booking_customer' },
    { customerId: positiveInt(booking.shipping_line_id), accessRole: 'shipping_line' },
    { customerId: positiveInt(booking.forwarder_id), accessRole: 'forwarder' },
    { customerId: positiveInt(booking.shipper_id), accessRole: 'shipper' },
    { customerId: positiveInt(booking.consignee_id), accessRole: 'consignee' },
    { customerId: positiveInt(booking.trucking_company_id), accessRole: 'trucking' },
    { customerId: positiveInt(booking.bill_to_customer_id), accessRole: 'billing' },
  ];
}

export function defaultPortalPermissionScope(accessRole: PortalAccessRole): PortalPermissionScope {
  const role = String(accessRole || '').toLowerCase();
  const billingRole = role === 'billing' || role === 'invoice_customer';
  const limitedTransportRole = role === 'driver' || role === 'trucking';
  const internalRole = role === 'internal' || role === 'auditor';
  const downloadRoles = new Set([
    'owner',
    'booking_customer',
    'shipping_line',
    'billing',
    'invoice_customer',
    'document_viewer',
    'forwarder',
    'shipper',
    'consignee',
  ]);

  return {
    view: true,
    download: downloadRoles.has(role),
    billing: {
      view: billingRole,
      dispute: billingRole,
    },
    eir: {
      fields: {
        container_grade: false,
      },
      damage_summary: true,
      damage_photos: !limitedTransportRole,
    },
    maskSensitiveFields: !internalRole,
  };
}

export function buildBookingPartyGrants(booking: BookingGrantSource): PortalGrantRule[] {
  const grants: PortalGrantRule[] = [];
  const entityId = positiveInt(booking.booking_id);
  const entityRef = cleanRef(booking.booking_number);

  for (const party of bookingParties(booking)) {
    addGrant(grants, {
      customerId: party.customerId,
      entityType: 'booking',
      entityId,
      entityRef,
      accessRole: party.accessRole,
      sourceTable: 'Bookings',
      sourceId: entityId,
    });
  }

  return grants;
}

export function buildBookingContainerGrants(
  booking: BookingGrantSource,
  container: BookingContainerGrantSource,
): PortalGrantRule[] {
  const grants: PortalGrantRule[] = [];
  const entityId = positiveInt(container.container_id);
  const entityRef = cleanRef(container.container_number);
  const sourceId = positiveInt(container.id);

  for (const party of bookingParties(booking)) {
    addGrant(grants, {
      customerId: party.customerId,
      entityType: 'container',
      entityId,
      entityRef,
      accessRole: party.accessRole,
      sourceTable: 'BookingContainers',
      sourceId,
    });
  }

  return grants;
}

export function buildGatePartyGrants(gate: GateGrantSource): PortalGrantRule[] {
  const grants: PortalGrantRule[] = [];
  const transactionId = positiveInt(gate.transaction_id);
  const eirNumber = cleanRef(gate.eir_number);
  const containerId = positiveInt(gate.container_id);
  const containerNumber = cleanRef(gate.container_number);
  const validUntil = gate.validUntil ?? gate.valid_until ?? null;
  const parties = [
    { customerId: positiveInt(gate.container_owner_id), accessRole: 'owner' },
    { customerId: positiveInt(gate.booking_customer_id), accessRole: 'booking_customer' },
    { customerId: positiveInt(gate.billing_customer_id), accessRole: 'billing' },
    { customerId: positiveInt(gate.trucking_company_id), accessRole: 'trucking' },
    { customerId: positiveInt(gate.driver_user_id), accessRole: 'driver' },
  ];
  const targets: Array<{ entityType: PortalEntityType; entityId: number | null; entityRef: string | null }> = [
    { entityType: 'gate_transaction', entityId: transactionId, entityRef: eirNumber },
    { entityType: 'eir', entityId: transactionId, entityRef: eirNumber },
    { entityType: 'container', entityId: containerId, entityRef: containerNumber },
  ];

  for (const target of targets) {
    for (const party of parties) {
      const temporaryGrant = party.accessRole === 'driver' || party.accessRole === 'trucking';
      addGrant(grants, {
        customerId: party.customerId,
        entityType: target.entityType,
        entityId: target.entityId,
        entityRef: target.entityRef,
        accessRole: party.accessRole,
        sourceTable: 'GateTransactions',
        sourceId: transactionId,
        validUntil: temporaryGrant ? validUntil : null,
      });
    }
  }

  return grants;
}

export function buildInvoicePartyGrants(invoice: InvoiceGrantSource): PortalGrantRule[] {
  const grants: PortalGrantRule[] = [];
  const invoiceId = positiveInt(invoice.invoice_id);
  const invoiceCustomerId = positiveInt(invoice.bill_to_customer_id)
    ?? positiveInt(invoice.invoice_customer_id)
    ?? positiveInt(invoice.customer_id);

  addGrant(grants, {
    customerId: invoiceCustomerId,
    entityType: 'invoice',
    entityId: invoiceId,
    entityRef: cleanRef(invoice.invoice_number),
    accessRole: 'invoice_customer',
    sourceTable: 'Invoices',
    sourceId: invoiceId,
  });

  return grants;
}

function buildReeferGrants(
  entityType: 'reefer_check' | 'reefer_exception',
  sourceTable: 'ReeferTemperatureChecks' | 'ReeferExceptions',
  sourceId: number | null,
  containerGrants: ExistingContainerGrant[],
): PortalGrantRule[] {
  const grants: PortalGrantRule[] = [];

  for (const containerGrant of containerGrants) {
    addGrant(grants, {
      customerId: positiveInt(containerGrant.customer_id),
      entityType,
      entityId: sourceId,
      entityRef: null,
      accessRole: cleanRef(containerGrant.access_role) || 'viewer',
      sourceTable,
      sourceId,
      permissionScope: containerGrant.permission_scope ?? undefined,
      validFrom: containerGrant.valid_from ?? null,
      validUntil: containerGrant.valid_until ?? null,
    });
  }

  return grants;
}

export function buildReeferCheckGrants(
  check: ReeferGrantSource,
  containerGrants: ExistingContainerGrant[],
): PortalGrantRule[] {
  return buildReeferGrants(
    'reefer_check',
    'ReeferTemperatureChecks',
    positiveInt(check.check_id),
    containerGrants,
  );
}

export function buildReeferExceptionGrants(
  exception: ReeferGrantSource,
  containerGrants: ExistingContainerGrant[],
): PortalGrantRule[] {
  return buildReeferGrants(
    'reefer_exception',
    'ReeferExceptions',
    positiveInt(exception.exception_id),
    containerGrants,
  );
}

export async function applyPortalGrants(db: PortalEntityAccessDb, grants: PortalGrantRule[] | null | undefined) {
  if (!grants?.length) return;

  for (const grant of grants) {
    await upsertPortalEntityAccess({
      ...grant,
      db,
      permissionScope: grant.permissionScope ?? defaultPortalPermissionScope(grant.accessRole),
    });
  }
}

export async function fetchContainerPortalGrantRows(
  db: PortalEntityAccessDb,
  container: Pick<ReeferGrantSource, 'container_id' | 'container_number'>,
): Promise<ExistingContainerGrant[]> {
  const containerId = positiveInt(container.container_id);
  const containerNumber = cleanRef(container.container_number);
  if (!containerId && !containerNumber) return [];

  const result = await db.request()
    .input('containerId', sql.Int, containerId)
    .input('containerNumber', sql.NVarChar, containerNumber)
    .query(`
      SELECT customer_id, entity_id, entity_ref, access_role, permission_scope, valid_from, valid_until
      FROM PortalEntityAccess
      WHERE entity_type = 'container'
        AND is_active = 1
        AND (valid_from IS NULL OR valid_from <= GETDATE())
        AND (valid_until IS NULL OR valid_until >= GETDATE())
        AND (
          (@containerId IS NOT NULL AND entity_id = @containerId)
          OR (@containerNumber IS NOT NULL AND entity_ref = @containerNumber)
        )
    `) as { recordset?: ExistingContainerGrant[] };

  return result.recordset || [];
}
