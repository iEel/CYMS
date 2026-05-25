import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { getPortalCustomerId, portalGateVisibilitySql } from '@/lib/portalAccess';
import { buildEIRPayload, fetchCompanyProfile, fetchEIRLifecycle } from '@/lib/eirPayload';
import { ensureDocumentLifecycle } from '@/lib/documentLifecycle';

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
          z.zone_name
        FROM GateTransactions g
        JOIN Containers c ON g.container_id = c.container_id
        LEFT JOIN Users u ON g.processed_by = u.user_id
        LEFT JOIN Yards y ON g.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE g.eir_number = @eirNumber
          AND ${portalGateVisibilitySql('g', 'c')}
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ EIR หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const row = result.recordset[0];
    const company = await fetchCompanyProfile(db);
    const eir = buildEIRPayload(row, company);
    const lifecycle = await fetchEIRLifecycle(db, Number(row.transaction_id), row.eir_number);

    return NextResponse.json({ eir, lifecycle });
  } catch (error) {
    console.error('❌ Portal EIR detail error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูล EIR ได้' }, { status: 500 });
  }
}
