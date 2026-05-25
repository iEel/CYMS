import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { generateEIRPDF } from '@/lib/eirPdfGenerator';
import { getPortalCustomerId, portalGateVisibilitySql } from '@/lib/portalAccess';
import { buildEIRPayload, fetchCompanyProfile } from '@/lib/eirPayload';

// GET — Customer Portal: Download EIR PDF
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

    // Fetch EIR data only if it matches the fixed customer portal visibility policy.
    const result = await db.request()
      .input('eirNumber', sql.NVarChar, eirNumber)
      .input('cid', sql.Int, cid)
      .query(`
        SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
          c.tare_weight_kg, c.max_gross_weight_kg,
          c.bay, c.[row], c.tier,
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
    const eirData = buildEIRPayload(row, company);
    const pdfBuffer = generateEIRPDF({
      ...eirData,
      date: new Date(row.created_at).toLocaleString('th-TH'),
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="EIR-${eirNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('❌ Portal EIR PDF error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง EIR PDF ได้' }, { status: 500 });
  }
}
