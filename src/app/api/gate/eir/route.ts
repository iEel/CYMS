import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireAnyPermission } from '@/lib/apiAuth';
import { ensureDocumentLifecycle } from '@/lib/documentLifecycle';
import { buildEIRPayload, fetchCompanyProfile, fetchEIRLifecycle } from '@/lib/eirPayload';
import { buildEirViewPayload } from '@/lib/eirVisibility';

// GET — ดึงข้อมูล EIR สำหรับแสดง/พิมพ์ภายในระบบ
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transaction_id');
    const eirNumber = searchParams.get('eir_number');

    if (!transactionId && !eirNumber) {
      return NextResponse.json({ error: 'ต้องระบุ transaction_id หรือ eir_number' }, { status: 400 });
    }

    let parsedTransactionId: number | null = null;
    if (transactionId) {
      const candidateTransactionId = Number(transactionId);
      if (!Number.isInteger(candidateTransactionId) || candidateTransactionId <= 0) {
        return NextResponse.json({ error: 'transaction_id ไม่ถูกต้อง' }, { status: 400 });
      }
      parsedTransactionId = candidateTransactionId;
    }

    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      ['gate.eir.print', 'gate.in', 'gate.out'],
      'คุณไม่มีสิทธิ์ดูเอกสาร EIR ภายในระบบ',
    );
    if (actor instanceof NextResponse) return actor;

    await ensureDocumentLifecycle(db);
    const req = db.request();

    if (parsedTransactionId !== null) {
      req.input('txId', sql.Int, parsedTransactionId);
    }
    if (eirNumber) {
      req.input('eirNumber', sql.NVarChar(80), eirNumber);
    }

    const result = await req.query(`
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
      WHERE ${parsedTransactionId !== null ? 'g.transaction_id = @txId' : 'g.eir_number = @eirNumber'}
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
      document_status: row.document_status ?? row.verification_status ?? 'verified',
      verification_status: row.verification_status ?? row.document_status ?? 'verified',
    };
    const lifecycle = await fetchEIRLifecycle(db, Number(row.transaction_id), row.eir_number);

    return NextResponse.json({
      ...buildEirViewPayload(master, { viewType: 'internal' }),
      lifecycle,
    });
  } catch (error) {
    console.error('❌ GET EIR error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล EIR ได้' }, { status: 500 });
  }
}
