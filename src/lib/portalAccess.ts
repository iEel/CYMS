import { NextRequest, NextResponse } from 'next/server';

export type PortalEntityType = 'booking' | 'container' | 'gate_transaction' | 'invoice';

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function getPortalCustomerId(request: NextRequest): number | NextResponse {
  const customerId = parsePositiveInt(request.headers.get('x-customer-id'));
  if (!customerId) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 403 });
  }
  return customerId;
}

export function portalEntityAccessSql(
  entityType: PortalEntityType,
  entityIdExpression: string,
  entityRefExpression?: string,
) {
  const clauses = [`pea.entity_id = ${entityIdExpression}`];
  if (entityRefExpression) {
    clauses.push(`(pea.entity_ref IS NOT NULL AND pea.entity_ref = ${entityRefExpression})`);
  }

  return `EXISTS (
    SELECT 1
    FROM PortalEntityAccess pea
    WHERE pea.customer_id = @cid
      AND pea.entity_type = '${entityType}'
      AND pea.is_active = 1
      AND (${clauses.join(' OR ')})
  )`;
}

export function portalBookingVisibilitySql(bookingAlias = 'b') {
  return portalEntityAccessSql('booking', `${bookingAlias}.booking_id`, `${bookingAlias}.booking_number`);
}

export function portalInvoiceVisibilitySql(invoiceAlias = 'i') {
  return portalEntityAccessSql('invoice', `${invoiceAlias}.invoice_id`, `${invoiceAlias}.invoice_number`);
}

export function portalContainerVisibilitySql(containerAlias = 'c') {
  return portalEntityAccessSql('container', `${containerAlias}.container_id`, `${containerAlias}.container_number`);
}

export function portalGateVisibilitySql(gateAlias = 'g', containerAlias = 'c') {
  return `(
    ${portalEntityAccessSql('gate_transaction', `${gateAlias}.transaction_id`, `${gateAlias}.eir_number`)}
    OR ${portalContainerVisibilitySql(containerAlias)}
  )`;
}
