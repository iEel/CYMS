import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

import { getDb } from '@/lib/db';
import { ensureDocumentLifecycle } from '@/lib/documentLifecycle';
import { logEirAccess } from '@/lib/eirAccessLog';
import { buildEIRPayload, fetchCompanyProfile, fetchEIRLifecycle } from '@/lib/eirPayload';
import { buildEirViewPayload, sanitizeEirLifecycle } from '@/lib/eirVisibility';
import {
  buildTransportEirAccessSql,
  requireTransportPortalActor,
} from '@/lib/transportPortalAccess';

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eirNumber = searchParams.get('eir_number');
    const transactionId = parsePositiveInt(searchParams.get('gate_transaction_id'));

    if (!eirNumber && !transactionId) {
      return NextResponse.json({ error: 'กรุณาระบุ eir_number หรือ gate_transaction_id' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requireTransportPortalActor(request, db, 'transport.eir.view');
    if (actor instanceof NextResponse) return actor;

    await ensureDocumentLifecycle(db);
    const accessSql = buildTransportEirAccessSql(actor);
    const req = db.request()
      .input('transportUserId', sql.Int, actor.userId)
      .input('transportCustomerId', sql.Int, actor.customerId);

    if (eirNumber) {
      req.input('eirNumber', sql.NVarChar(80), eirNumber);
    }
    if (transactionId) {
      req.input('gateTransactionId', sql.Int, transactionId);
    }

    const result = await req.query(`
      SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
        c.tare_weight_kg, c.max_gross_weight_kg,
        c.container_grade, c.bay, c.[row], c.tier,
        u.full_name as processed_by_name,
        du.phone AS driver_phone,
        y.yard_name, y.yard_code,
        z.zone_name
      FROM GateTransactions g
      LEFT JOIN GateOutRequests gor ON gor.gate_transaction_id = g.transaction_id
      LEFT JOIN Containers c ON g.container_id = c.container_id
      LEFT JOIN Bookings b ON b.booking_number = g.booking_ref AND b.yard_id = g.yard_id
      LEFT JOIN Users u ON g.processed_by = u.user_id
      LEFT JOIN Users du ON du.user_id = COALESCE(g.driver_user_id, gor.driver_user_id)
      LEFT JOIN Yards y ON g.yard_id = y.yard_id
      LEFT JOIN YardZones z ON c.zone_id = z.zone_id
      WHERE ${eirNumber ? 'g.eir_number = @eirNumber' : 'g.transaction_id = @gateTransactionId'}
        AND ${accessSql}
    `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ EIR หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const row = result.recordset[0];
    const company = await fetchCompanyProfile(db);
    const master = {
      ...buildEIRPayload(row, company),
      driver_phone: row.driver_phone,
      created_at: row.created_at,
      gate_datetime: row.gate_datetime ?? row.created_at,
      document_status: row.document_status ?? row.verification_status ?? 'verified',
      verification_status: row.verification_status ?? row.document_status ?? 'verified',
      version_no: row.version_no ?? 1,
    };
    const viewType = actor.mode === 'driver' ? 'driver' : 'trucking';
    const lifecycle = await fetchEIRLifecycle(db, Number(row.transaction_id), row.eir_number);

    await logEirAccess({
      db,
      request,
      eirNumber: row.eir_number,
      gateTransactionId: Number(row.transaction_id) || null,
      userId: actor.userId,
      customerId: actor.customerId,
      viewType,
      action: 'view',
    });

    return NextResponse.json({
      ...buildEirViewPayload(master, { viewType }),
      lifecycle: sanitizeEirLifecycle(lifecycle),
    });
  } catch (error) {
    console.error('Transport EIR API error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด EIR สำหรับงานขนส่งได้' }, { status: 500 });
  }
}
