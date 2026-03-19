import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึงข้อมูล EIR สำหรับแสดง/พิมพ์
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transaction_id');
    const eirNumber = searchParams.get('eir_number');

    if (!transactionId && !eirNumber) {
      return NextResponse.json({ error: 'ต้องระบุ transaction_id หรือ eir_number' }, { status: 400 });
    }

    const db = await getDb();
    const req = db.request();

    if (transactionId) {
      req.input('txId', sql.Int, parseInt(transactionId));
    }
    if (eirNumber) {
      req.input('eirNumber', sql.NVarChar, eirNumber);
    }

    const result = await req.query(`
      SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
        c.bay, c.[row], c.tier,
        u.full_name as processed_by_name,
        y.yard_name, y.yard_code,
        z.zone_name
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      LEFT JOIN Users u ON g.processed_by = u.user_id
      LEFT JOIN Yards y ON g.yard_id = y.yard_id
      LEFT JOIN YardZones z ON c.zone_id = z.zone_id
      WHERE ${transactionId ? 'g.transaction_id = @txId' : 'g.eir_number = @eirNumber'}
    `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล EIR' }, { status: 404 });
    }

    const row = result.recordset[0];

    const eirData = {
      eir_number: row.eir_number,
      transaction_type: row.transaction_type,
      date: row.created_at,
      container_number: row.container_number,
      size: row.size,
      type: row.type,
      shipping_line: row.shipping_line,
      seal_number: row.seal_number,
      is_laden: row.is_laden,
      driver_name: row.driver_name,
      driver_license: row.driver_license,
      truck_plate: row.truck_plate,
      booking_ref: row.booking_ref,
      yard_name: row.yard_name,
      yard_code: row.yard_code,
      zone_name: row.zone_name,
      bay: row.bay,
      row: row.row,
      tier: row.tier,
      processed_by: row.processed_by_name || 'ระบบ',
      damage_report: row.damage_report ? JSON.parse(row.damage_report) : null,
      notes: row.notes,
    };

    return NextResponse.json({ eir: eirData });
  } catch (error) {
    console.error('❌ GET EIR error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล EIR ได้' }, { status: 500 });
  }
}
