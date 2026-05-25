import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { getPortalCustomerId, portalEirVisibilitySql } from '@/lib/portalAccess';
import { buildEIRPayload, fetchCompanyProfile, fetchEIRLifecycle } from '@/lib/eirPayload';
import { buildEirViewPayload, resolveEirViewType, type PortalScope } from '@/lib/eirVisibility';
import { ensureDocumentLifecycle } from '@/lib/documentLifecycle';
import { requirePortalAction } from '@/lib/customerPortalPermissions';
import { logEirAccess } from '@/lib/eirAccessLog';

function parsePermissionScope(value: unknown): PortalScope | null {
  if (!value) return null;
  if (typeof value === 'object') return value as PortalScope;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed as PortalScope : null;
  } catch {
    return null;
  }
}

// GET — Customer Portal EIR detail for modal/inspection view
export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const { searchParams } = new URL(request.url);
    const eirNumber = searchParams.get('eir_number');
    if (!eirNumber) {
      return NextResponse.json({ error: 'กรุณาระบุ eir_number' }, { status: 400 });
    }

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.eir.view');
    if (portalActor instanceof NextResponse) return portalActor;

    await ensureDocumentLifecycle(db);

    const result = await db.request()
      .input('eirNumber', sql.NVarChar, eirNumber)
      .input('cid', sql.Int, cid)
      .query(`
        SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
          c.tare_weight_kg, c.max_gross_weight_kg,
          c.container_grade, c.bay, c.[row], c.tier,
          u.full_name as processed_by_name,
          y.yard_name, y.yard_code,
          z.zone_name,
          portal_access.access_role,
          portal_access.permission_scope
        FROM GateTransactions g
        JOIN Containers c ON g.container_id = c.container_id
        LEFT JOIN Users u ON g.processed_by = u.user_id
        LEFT JOIN Yards y ON g.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        OUTER APPLY (
          SELECT TOP 1 pea.access_role, pea.permission_scope
          FROM PortalEntityAccess pea
          WHERE pea.customer_id = @cid
            AND pea.is_active = 1
            AND (pea.valid_from IS NULL OR pea.valid_from <= GETDATE())
            AND (pea.valid_until IS NULL OR pea.valid_until >= GETDATE())
            AND (
              (pea.entity_type = 'eir'
                AND (pea.entity_id = g.transaction_id OR (pea.entity_ref IS NOT NULL AND pea.entity_ref = g.eir_number)))
              OR (pea.entity_type = 'gate_transaction'
                AND (pea.entity_id = g.transaction_id OR (pea.entity_ref IS NOT NULL AND pea.entity_ref = g.eir_number)))
              OR (pea.entity_type = 'container'
                AND (pea.entity_id = c.container_id OR (pea.entity_ref IS NOT NULL AND pea.entity_ref = c.container_number)))
            )
          ORDER BY CASE pea.entity_type
            WHEN 'eir' THEN 1
            WHEN 'gate_transaction' THEN 2
            WHEN 'container' THEN 3
            ELSE 9
          END
        ) portal_access
        WHERE g.eir_number = @eirNumber
          AND ${portalEirVisibilitySql('g', 'c')}
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ EIR หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const row = result.recordset[0];
    const company = await fetchCompanyProfile(db);
    const master = {
      ...buildEIRPayload(row, company),
      created_at: row.created_at,
      gate_datetime: row.gate_datetime ?? row.created_at,
      document_status: row.document_status ?? row.verification_status ?? 'verified',
      verification_status: row.verification_status ?? row.document_status ?? 'verified',
      version_no: row.version_no ?? 1,
    };
    const accessGrant = {
      access_role: row.access_role,
      permissions: Array.from(portalActor.actions),
      permission_scope: parsePermissionScope(row.permission_scope),
    };
    const viewType = resolveEirViewType(portalActor, master, accessGrant);
    const sanitizedPayload = buildEirViewPayload(master, {
      viewType,
      permissions: Array.from(portalActor.actions),
      permission_scope: accessGrant.permission_scope,
      accessGrant,
    });
    const lifecycle = await fetchEIRLifecycle(db, Number(row.transaction_id), row.eir_number);

    await logEirAccess({
      db,
      request,
      eirNumber: row.eir_number,
      gateTransactionId: Number(row.transaction_id) || null,
      userId: portalActor.userId,
      customerId: cid,
      viewType,
      action: 'view',
    });

    return NextResponse.json({ ...sanitizedPayload, lifecycle });
  } catch (error) {
    console.error('❌ Portal EIR detail error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูล EIR ได้' }, { status: 500 });
  }
}
