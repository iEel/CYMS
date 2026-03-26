import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// POST — Receive an in-transit container at destination yard
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { container_id, yard_id, zone_id } = body;

    if (!container_id || !yard_id) {
      return NextResponse.json({ error: 'กรุณาระบุ container_id และ yard_id' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Check container is in_transit
    const containerResult = await db.request()
      .input('containerId', sql.Int, container_id)
      .query(`
        SELECT c.container_id, c.container_number, c.status, c.size, c.type, c.shipping_line
        FROM Containers c
        WHERE c.container_id = @containerId AND c.status = 'in_transit'
      `);

    if (containerResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบตู้ที่อยู่ระหว่างการขนส่ง (in_transit)' }, { status: 404 });
    }

    const container = containerResult.recordset[0];

    // 2. Find the original transfer transaction to get from_yard
    const transferTx = await db.request()
      .input('containerId', sql.Int, container_id)
      .query(`
        SELECT TOP 1 yard_id as from_yard_id, eir_number, driver_name, truck_plate
        FROM GateTransactions
        WHERE container_id = @containerId AND transaction_type = 'transfer'
        ORDER BY created_at DESC
      `);

    const fromYardId = transferTx.recordset[0]?.from_yard_id || null;
    const transferNumber = transferTx.recordset[0]?.eir_number || '';
    const driverName = transferTx.recordset[0]?.driver_name || '';
    const truckPlate = transferTx.recordset[0]?.truck_plate || '';

    // 3. Smart auto-allocate position (same logic as Gate-In)
    const { autoAllocate } = await import('@/lib/autoAllocate');
    let assignedZone: number | null = zone_id || null;
    let assignedBay: number | null = null;
    let assignedRow: number | null = null;
    let assignedTier: number | null = null;
    let zoneName = '';

    if (!assignedZone) {
      const allocation = await autoAllocate(
        db,
        yard_id,
        container.size || '20',
        container.type || 'GP',
        container.shipping_line || undefined,
        false // laden status unknown for transfer
      );
      if (allocation) {
        assignedZone = allocation.zone_id;
        assignedBay = allocation.bay;
        assignedRow = allocation.row;
        assignedTier = allocation.tier;
        zoneName = allocation.zone_name;
      }
    } else {
      // Zone specified — find next slot in that zone
      const zoneResult = await db.request()
        .input('zoneId', sql.Int, assignedZone)
        .query(`SELECT zone_name FROM YardZones WHERE zone_id = @zoneId`);
      zoneName = zoneResult.recordset[0]?.zone_name || '';

      const slotResult = await db.request()
        .input('zoneId', sql.Int, assignedZone)
        .query(`
          SELECT TOP 1 bay, [row], tier + 1 as next_tier
          FROM Containers
          WHERE zone_id = @zoneId AND status = 'in_yard'
          GROUP BY bay, [row], tier
          ORDER BY bay, [row], tier
        `);

      if (slotResult.recordset.length > 0) {
        assignedBay = slotResult.recordset[0].bay;
        assignedRow = slotResult.recordset[0].row;
        assignedTier = slotResult.recordset[0].next_tier;
      } else {
        assignedBay = 1;
        assignedRow = 1;
        assignedTier = 1;
      }
    }

    // 4. Update container: status → in_yard, set new yard + position
    await db.request()
      .input('containerId', sql.Int, container_id)
      .input('yardId', sql.Int, yard_id)
      .input('zoneId', sql.Int, assignedZone)
      .input('bay', sql.Int, assignedBay)
      .input('row', sql.Int, assignedRow)
      .input('tier', sql.Int, assignedTier)
      .query(`
        UPDATE Containers SET
          status = 'in_yard',
          yard_id = @yardId,
          zone_id = @zoneId,
          bay = @bay,
          [row] = @row,
          tier = @tier,
          updated_at = GETDATE()
        WHERE container_id = @containerId
      `);

    // 5. Generate receive number
    const countResult = await db.request()
      .query("SELECT COUNT(*) as cnt FROM GateTransactions WHERE transaction_type = 'transfer_in'");
    const receiveNum = `TRF-IN-${new Date().getFullYear()}-${String((countResult.recordset[0]?.cnt || 0) + 1).padStart(6, '0')}`;

    // 6. Create gate-in transaction at destination yard
    await db.request()
      .input('containerId', sql.Int, container_id)
      .input('yardId', sql.Int, yard_id)
      .input('transType', sql.NVarChar, 'transfer_in')
      .input('driverName', sql.NVarChar, driverName)
      .input('truckPlate', sql.NVarChar, truckPlate)
      .input('eirNumber', sql.NVarChar, receiveNum)
      .input('notes', sql.NVarChar, `Received from transfer ${transferNumber}`)
      .query(`
        INSERT INTO GateTransactions (container_id, yard_id, transaction_type, driver_name, truck_plate, eir_number, notes)
        VALUES (@containerId, @yardId, @transType, @driverName, @truckPlate, @eirNumber, @notes)
      `);

    // 7. Audit log
    await logAudit({
      userId: null,
      yardId: yard_id,
      action: 'transfer_in',
      entityType: 'container',
      entityId: container_id,
      details: {
        action: 'inter_yard_transfer_receive',
        from_yard: fromYardId,
        to_yard: yard_id,
        container_number: container.container_number,
        transfer_number: transferNumber,
        receive_number: receiveNum,
        assigned_zone: zoneName,
        assigned_position: assignedBay ? `B${assignedBay}-R${assignedRow}-T${assignedTier}` : null,
      },
    });

    return NextResponse.json({
      success: true,
      receive_number: receiveNum,
      container_number: container.container_number,
      assigned_location: assignedZone ? {
        zone_name: zoneName,
        bay: assignedBay,
        row: assignedRow,
        tier: assignedTier,
      } : null,
      message: `✅ รับตู้ ${container.container_number} เข้าลานสำเร็จ — ${zoneName ? `Zone ${zoneName} B${assignedBay}-R${assignedRow}-T${assignedTier}` : 'ยังไม่จัดตำแหน่ง'}`,
    });
  } catch (error) {
    console.error('❌ Transfer receive error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// GET — List in-transit containers heading to a specific yard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');

    const db = await getDb();
    const req = db.request();

    // Filter by destination yard using to_yard_id column
    let yardFilter = '';
    if (yardId) {
      yardFilter = 'AND g.to_yard_id = @toYardId';
      req.input('toYardId', sql.Int, parseInt(yardId));
    }

    const result = await req.query(`
      SELECT c.container_id, c.container_number, c.size, c.type, c.shipping_line,
             g.driver_name, g.truck_plate, g.eir_number as transfer_number,
             g.created_at as transfer_date, g.notes,
             g.yard_id as from_yard_id, g.to_yard_id,
             y.yard_name as from_yard_name
      FROM Containers c
      INNER JOIN GateTransactions g ON c.container_id = g.container_id AND g.transaction_type = 'transfer'
      LEFT JOIN Yards y ON g.yard_id = y.yard_id
      WHERE c.status = 'in_transit'
        AND g.transaction_id = (
          SELECT MAX(g2.transaction_id) FROM GateTransactions g2
          WHERE g2.container_id = c.container_id AND g2.transaction_type = 'transfer'
        )
        ${yardFilter}
      ORDER BY g.created_at DESC
    `);

    return NextResponse.json({ containers: result.recordset });
  } catch (error) {
    console.error('❌ GET transfer receive error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}
