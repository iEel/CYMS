import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { buildGatePartyGrants, defaultPortalPermissionScope } from '@/lib/portalGrantRules';

function positiveIntOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'gate.in', 'คุณไม่มีสิทธิ์ดู Portal Visibility Preview');
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

  const preview = grants.map(grant => ({
    customerId: grant.customerId,
    entityType: grant.entityType,
    entityRef: grant.entityRef,
    accessRole: grant.accessRole,
    sourceTable: grant.sourceTable,
    validUntil: grant.validUntil || null,
    permissionScope: grant.permissionScope || defaultPortalPermissionScope(grant.accessRole),
  }));

  return NextResponse.json({ preview });
}
