import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// POST — Inter-Yard Transfer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { container_id, from_yard_id, to_yard_id, driver_name, truck_plate, notes } = body;

    if (!container_id || !from_yard_id || !to_yard_id) {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลให้ครบ' }, { status: 400 });
    }

    if (from_yard_id === to_yard_id) {
      return NextResponse.json({ error: 'ลานต้นทางและปลายทางต้องไม่ใช่ลานเดียวกัน' }, { status: 400 });
    }

    const db = await getDb();

    // Check container exists and in yard
    const containerResult = await db.request()
      .input('containerId', sql.Int, container_id)
      .input('fromYard', sql.Int, from_yard_id)
      .query(`
        SELECT c.container_id, c.container_number, c.status, c.yard_id
        FROM Containers c
        WHERE c.container_id = @containerId AND c.yard_id = @fromYard AND c.status = 'in_yard'
      `);

    if (containerResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบตู้ในลานต้นทาง หรือตู้ไม่ได้อยู่สถานะ in_yard' }, { status: 404 });
    }

    const container = containerResult.recordset[0];

    // Generate transfer number with random suffix
    const countResult = await db.request()
      .query("SELECT COUNT(*) as cnt FROM GateTransactions WHERE transaction_type = 'transfer'");
    const randomHex = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
    const transferNum = `TRF-${new Date().getFullYear()}-${String((countResult.recordset[0]?.cnt || 0) + 1).padStart(6, '0')}-${randomHex}`;

    // 1. Update container: status → in_transit, clear position
    await db.request()
      .input('containerId', sql.Int, container_id)
      .input('toYard', sql.Int, to_yard_id)
      .query(`
        UPDATE Containers SET
          status = 'in_transit',
          zone_id = NULL, bay = NULL, [row] = NULL, tier = NULL,
          updated_at = GETDATE()
        WHERE container_id = @containerId
      `);

    // 2. Create gate-out transaction from source yard (store to_yard_id in structured notes)
    const transferMeta = JSON.stringify({
      transfer_to_yard: to_yard_id,
      user_notes: notes || '',
    });

    await db.request()
      .input('containerId', sql.Int, container_id)
      .input('fromYard', sql.Int, from_yard_id)
      .input('toYard', sql.Int, to_yard_id)
      .input('transType', sql.NVarChar, 'transfer')
      .input('driverName', sql.NVarChar, driver_name || '')
      .input('truckPlate', sql.NVarChar, truck_plate || '')
      .input('eirNumber', sql.NVarChar, transferNum)
      .input('notes', sql.NVarChar, transferMeta)
      .query(`
        INSERT INTO GateTransactions (container_id, yard_id, transaction_type, driver_name, truck_plate, eir_number, notes, to_yard_id)
        VALUES (@containerId, @fromYard, @transType, @driverName, @truckPlate, @eirNumber, @notes, @toYard)
      `);

    // 3. Audit log (including user_id)
    await db.request()
      .input('userId', sql.Int, body.user_id || null)
      .input('fromYard', sql.Int, from_yard_id)
      .input('containerId', sql.Int, container_id)
      .input('details', sql.NVarChar, JSON.stringify({
        action: 'inter_yard_transfer',
        from_yard: from_yard_id,
        to_yard: to_yard_id,
        container_number: container.container_number,
        transfer_number: transferNum,
      }))
      .query(`
        INSERT INTO AuditLog (user_id, yard_id, action, entity_type, entity_id, details, created_at)
        VALUES (@userId, @fromYard, 'transfer_out', 'container', @containerId, @details, GETDATE())
      `);

    return NextResponse.json({
      success: true,
      transfer_number: transferNum,
      container_number: container.container_number,
      message: `✅ ย้ายตู้ ${container.container_number} จากลาน ${from_yard_id} → ลาน ${to_yard_id} สำเร็จ — สถานะ: In-Transit`,
    });
  } catch (error) {
    console.error('❌ Transfer error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
