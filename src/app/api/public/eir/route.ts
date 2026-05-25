import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { buildEIRPayload, fetchCompanyProfile } from '@/lib/eirPayload';
import { buildEirViewPayload } from '@/lib/eirVisibility';
import { logEirAccess } from '@/lib/eirAccessLog';

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eirNumber = searchParams.get('eir_number')?.trim();

    if (!eirNumber) {
      return NextResponse.json({ error: 'กรุณาระบุ eir_number' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.request()
      .input('eirNumber', sql.NVarChar(80), eirNumber)
      .query(`
        SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
          c.tare_weight_kg, c.max_gross_weight_kg,
          c.container_grade, c.bay, c.[row], c.tier,
          u.full_name as processed_by_name,
          y.yard_name, y.yard_code,
          z.zone_name
        FROM GateTransactions g
        LEFT JOIN Containers c ON g.container_id = c.container_id
        LEFT JOIN Users u ON g.processed_by = u.user_id
        LEFT JOIN Yards y ON g.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE g.eir_number = @eirNumber
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล EIR' }, { status: 404 });
    }

    const row = result.recordset[0];
    const company = await fetchCompanyProfile(db);
    const master = {
      ...buildEIRPayload(row, company),
      created_at: row.created_at,
      gate_datetime: row.gate_datetime ?? row.created_at,
      yard_name: row.yard_name,
      document_status: row.document_status ?? row.verification_status ?? 'verified',
      verification_status: row.verification_status ?? row.document_status ?? 'verified',
      version_no: row.version_no ?? 1,
    };

    await logEirAccess({
      db,
      action: 'public_verify',
      eirNumber: row.eir_number,
      transactionId: Number(row.transaction_id) || null,
      actorType: 'public',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(buildEirViewPayload(master, { viewType: 'public' }));
  } catch (error) {
    console.error('❌ Public EIR verification error:', error);
    return NextResponse.json({ error: 'ไม่สามารถตรวจสอบ EIR ได้' }, { status: 500 });
  }
}
