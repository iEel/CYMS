import { NextRequest, NextResponse } from 'next/server';

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

export function portalContainerVisibilitySql(containerAlias = 'c') {
  return `(
    ${containerAlias}.container_owner_id = @cid
    OR EXISTS (
      SELECT 1
      FROM GateTransactions gt
      WHERE gt.container_id = ${containerAlias}.container_id
        AND (gt.container_owner_id = @cid OR gt.billing_customer_id = @cid)
    )
    OR EXISTS (
      SELECT 1
      FROM Invoices inv
      WHERE inv.container_id = ${containerAlias}.container_id
        AND inv.customer_id = @cid
    )
    OR EXISTS (
      SELECT 1
      FROM BookingContainers bc
      JOIN Bookings b ON b.booking_id = bc.booking_id
      WHERE b.customer_id = @cid
        AND (
          bc.container_id = ${containerAlias}.container_id
          OR (bc.container_id IS NULL AND bc.container_number = ${containerAlias}.container_number)
        )
    )
  )`;
}

export function portalGateVisibilitySql(gateAlias = 'g', containerAlias = 'c') {
  return `(
    ${gateAlias}.container_owner_id = @cid
    OR ${gateAlias}.billing_customer_id = @cid
    OR ${portalContainerVisibilitySql(containerAlias)}
  )`;
}
