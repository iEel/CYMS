import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { buildGatePartyGrants, defaultPortalPermissionScope } from '@/lib/portalGrantRules';

export async function POST(request: NextRequest) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'gate.in', 'คุณไม่มีสิทธิ์ดู Portal Visibility Preview');
  if (actor instanceof NextResponse) return actor;

  const body = await request.json();
  const grants = buildGatePartyGrants({
    transaction_id: 0,
    eir_number: body.eir_number || 'EIR-PREVIEW',
    container_id: body.container_id || 0,
    container_number: body.container_number,
    container_owner_id: body.container_owner_id,
    booking_customer_id: body.booking_customer_id,
    billing_customer_id: body.billing_customer_id,
    trucking_company_id: body.trucking_company_id,
    driver_user_id: body.driver_user_id,
    validUntil: body.valid_until || null,
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
