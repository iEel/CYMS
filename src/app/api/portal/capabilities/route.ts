import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { getPortalCustomerId, portalContainerVisibilitySql } from '@/lib/portalAccess';
import { requirePortalAction } from '@/lib/customerPortalPermissions';
import { parsePortalScope, resolveReeferCapability } from '@/lib/portalCapabilities';

export async function GET(request: NextRequest) {
  const cid = getPortalCustomerId(request);
  if (cid instanceof NextResponse) return cid;

  const db = await getDb();
  const actor = await requirePortalAction(request, db, 'portal.container.view');
  if (actor instanceof NextResponse) return actor;

  const customer = await db.request()
    .input('cid', sql.Int, cid)
    .query(`
      SELECT ISNULL(portal_enabled, 1) AS portal_enabled, portal_default_permission_scope
      FROM Customers
      WHERE customer_id = @cid
    `);

  const customerRow = customer.recordset[0];
  const scope = parsePortalScope(customerRow?.portal_default_permission_scope);

  const counts = await db.request()
    .input('cid', sql.Int, cid)
    .query(`
      SELECT
        SUM(CASE WHEN c.container_id IS NOT NULL THEN 1 ELSE 0 END) AS rf_count,
        (
          SELECT COUNT(1)
          FROM PortalEntityAccess pea
          WHERE pea.customer_id = @cid
            AND pea.entity_type IN ('reefer_check', 'reefer_exception')
            AND pea.is_active = 1
            AND (pea.valid_from IS NULL OR pea.valid_from <= GETDATE())
            AND (pea.valid_until IS NULL OR pea.valid_until >= GETDATE())
        ) AS reefer_grant_count
      FROM Containers c
      WHERE c.type = 'RF'
        AND ${portalContainerVisibilitySql('c')}
    `);

  const countRow = counts.recordset[0] || {};
  const reefer = resolveReeferCapability({
    portalEnabled: customerRow?.portal_enabled !== false && customerRow?.portal_enabled !== 0,
    scope,
    role: actor.customerPortalRole,
    counts: {
      rfCount: Number(countRow.rf_count || 0),
      reeferGrantCount: Number(countRow.reefer_grant_count || 0),
    },
  });

  return NextResponse.json({
    modules: {
      reefer,
    },
    settings: {
      reefer: scope.reefer || {},
    },
  });
}
