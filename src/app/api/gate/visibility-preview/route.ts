import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAnyPermission } from '@/lib/apiAuth';
import sql from 'mssql';
import { buildBookingPartyGrants, buildGatePartyGrants, defaultPortalPermissionScope, type PortalGrantRule } from '@/lib/portalGrantRules';

function positiveIntOrNull(value: unknown) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  const db = await getDb();
  const actor = await requireAnyPermission(request, db, ['gate.in', 'gate.out'], 'คุณไม่มีสิทธิ์ดู Portal Visibility Preview');
  if (actor instanceof NextResponse) return actor;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'invalid_request', message: 'Request body must be an object' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Request body must be valid JSON' }, { status: 400 });
  }

  const containerNumber = cleanString(body.container_number);
  if (!containerNumber) {
    return NextResponse.json({ error: 'container_number_required', message: 'container_number is required' }, { status: 400 });
  }

  const bookingId = positiveIntOrNull(body.booking_id);
  const bookingGrants: PortalGrantRule[] = [];

  if (bookingId) {
    const bookingResult = await db.request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT booking_id, booking_number, customer_id, booking_customer_id, shipping_line_id,
          forwarder_id, shipper_id, consignee_id, trucking_company_id, bill_to_customer_id
        FROM Bookings
        WHERE booking_id = @bookingId
      `);
    const booking = bookingResult.recordset[0];
    if (booking) {
      bookingGrants.push(...buildBookingPartyGrants(booking));
    }
  }

  const grants = buildGatePartyGrants({
    transaction_id: 0,
    eir_number: cleanString(body.eir_number) || null,
    container_id: positiveIntOrNull(body.container_id),
    container_number: containerNumber,
    container_owner_id: positiveIntOrNull(body.container_owner_id),
    booking_customer_id: positiveIntOrNull(body.booking_customer_id),
    billing_customer_id: positiveIntOrNull(body.billing_customer_id),
    trucking_company_id: positiveIntOrNull(body.trucking_company_id),
    driver_user_id: positiveIntOrNull(body.driver_user_id),
    validUntil: cleanString(body.valid_until) || null,
  });

  const allGrants = [...grants, ...bookingGrants];
  const customerIds = Array.from(new Set(
    allGrants
      .map(grant => positiveIntOrNull(grant.customerId))
      .filter((customerId): customerId is number => Boolean(customerId))
  ));
  const customerNames = new Map<number, string>();

  if (customerIds.length > 0) {
    const customerRequest = db.request();
    const customerParams = customerIds.map((customerId, index) => {
      const name = `customerId${index}`;
      customerRequest.input(name, sql.Int, customerId);
      return `@${name}`;
    });
    const customersResult = await customerRequest.query(`
      SELECT customer_id, customer_name
      FROM Customers
      WHERE customer_id IN (${customerParams.join(', ')})
    `);
    for (const customer of customersResult.recordset) {
      const customerId = positiveIntOrNull(customer.customer_id);
      if (customerId && customer.customer_name) {
        customerNames.set(customerId, String(customer.customer_name));
      }
    }
  }

  const preview = allGrants.map(grant => {
    const customerId = positiveIntOrNull(grant.customerId);
    return {
      customerId: grant.customerId,
      customerName: customerId ? customerNames.get(customerId) || null : null,
      entityType: grant.entityType,
      entityRef: grant.entityRef,
      accessRole: grant.accessRole,
      sourceTable: grant.sourceTable,
      validUntil: grant.validUntil || null,
      permissionScope: grant.permissionScope || defaultPortalPermissionScope(grant.accessRole),
    };
  });

  return NextResponse.json({ preview });
}
