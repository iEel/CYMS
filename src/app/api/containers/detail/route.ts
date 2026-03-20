import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึงรายละเอียดตู้ + Gate Transactions + damage_report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get('container_id');

    if (!containerId) {
      return NextResponse.json({ error: 'ต้องระบุ container_id' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Container info
    const containerResult = await db.request()
      .input('cid', sql.Int, parseInt(containerId))
      .query(`
        SELECT c.*, y.yard_name, y.yard_code, z.zone_name, z.zone_type
        FROM Containers c
        LEFT JOIN Yards y ON c.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE c.container_id = @cid
      `);

    if (containerResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลตู้' }, { status: 404 });
    }

    const container = containerResult.recordset[0];

    // 2. Gate-In transaction (ล่าสุด)
    const gateInResult = await db.request()
      .input('cid', sql.Int, parseInt(containerId))
      .query(`
        SELECT TOP 1 g.*, u.full_name as processed_by_name
        FROM GateTransactions g
        LEFT JOIN Users u ON g.processed_by = u.user_id
        WHERE g.container_id = @cid AND g.transaction_type = 'gate_in'
        ORDER BY g.created_at DESC
      `);

    // 3. Gate-Out transaction (ล่าสุด — ถ้ามี)
    const gateOutResult = await db.request()
      .input('cid', sql.Int, parseInt(containerId))
      .query(`
        SELECT TOP 1 g.*, u.full_name as processed_by_name
        FROM GateTransactions g
        LEFT JOIN Users u ON g.processed_by = u.user_id
        WHERE g.container_id = @cid AND g.transaction_type = 'gate_out'
        ORDER BY g.created_at DESC
      `);

    // Parse damage reports
    const parseDamageReport = (raw: string | null) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };

    const gateIn = gateInResult.recordset[0] || null;
    const gateOut = gateOutResult.recordset[0] || null;

    // Calculate dwell days
    const gateInDate = gateIn?.created_at ? new Date(gateIn.created_at) : null;
    const dwellDays = gateInDate
      ? Math.ceil((Date.now() - gateInDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return NextResponse.json({
      container: {
        container_id: container.container_id,
        container_number: container.container_number,
        size: container.size,
        type: container.type,
        status: container.status,
        shipping_line: container.shipping_line,
        is_laden: container.is_laden,
        yard_name: container.yard_name,
        zone_name: container.zone_name,
        zone_type: container.zone_type,
        bay: container.bay,
        row: container.row,
        tier: container.tier,
        booking_ref: container.booking_ref,
        seal_number: container.seal_number,
        dwell_days: dwellDays,
      },
      gate_in: gateIn ? {
        eir_number: gateIn.eir_number,
        date: gateIn.created_at,
        driver_name: gateIn.driver_name,
        driver_license: gateIn.driver_license,
        truck_plate: gateIn.truck_plate,
        seal_number: gateIn.seal_number,
        booking_ref: gateIn.booking_ref,
        notes: gateIn.notes,
        processed_by: gateIn.processed_by_name || 'ระบบ',
        damage_report: parseDamageReport(gateIn.damage_report),
      } : null,
      gate_out: gateOut ? {
        eir_number: gateOut.eir_number,
        date: gateOut.created_at,
        driver_name: gateOut.driver_name,
        truck_plate: gateOut.truck_plate,
        processed_by: gateOut.processed_by_name || 'ระบบ',
        damage_report: parseDamageReport(gateOut.damage_report),
      } : null,
    });
  } catch (error) {
    console.error('❌ GET container detail error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}
