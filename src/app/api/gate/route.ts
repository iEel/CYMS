import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึง gate transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const type = searchParams.get('type');
    const date = searchParams.get('date'); // 'today' or 'YYYY-MM-DD'

    const db = await getDb();
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) {
      conditions.push('g.yard_id = @yardId');
      req.input('yardId', sql.Int, parseInt(yardId));
    }
    if (type) {
      conditions.push('g.transaction_type = @type');
      req.input('type', sql.NVarChar, type);
    }
    if (date === 'today') {
      conditions.push('CAST(g.created_at AS DATE) = CAST(GETDATE() AS DATE)');
    } else if (date) {
      conditions.push('CAST(g.created_at AS DATE) = @date');
      req.input('date', sql.Date, date);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
        u.full_name, y.yard_name
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      LEFT JOIN Users u ON g.processed_by = u.user_id
      LEFT JOIN Yards y ON g.yard_id = y.yard_id
      ${where}
      ORDER BY g.created_at DESC
    `);

    return NextResponse.json({ transactions: result.recordset });
  } catch (error) {
    console.error('❌ GET gate error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล gate ได้' }, { status: 500 });
  }
}

// POST — บันทึก Gate-In หรือ Gate-Out
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transaction_type, // 'gate_in' | 'gate_out'
      container_number, size, type: containerType, shipping_line, is_laden,
      yard_id, zone_id, bay, row, tier,
      driver_name, driver_license, truck_plate, seal_number, booking_ref, notes,
      damage_report,
      container_id, // for gate_out (existing container)
    } = body;

    const db = await getDb();

    // Generate EIR number
    const eirPrefix = transaction_type === 'gate_in' ? 'EIR-IN' : 'EIR-OUT';
    const countResult = await db.request()
      .input('yardId', sql.Int, yard_id)
      .query(`SELECT COUNT(*) as cnt FROM GateTransactions WHERE yard_id = @yardId`);
    const eirNumber = `${eirPrefix}-${new Date().getFullYear()}-${String(countResult.recordset[0].cnt + 1).padStart(6, '0')}`;

    let finalContainerId = container_id;

    if (transaction_type === 'gate_in') {
      // === GATE-IN ===
      // Check if container already exists
      const existingCheck = await db.request()
        .input('containerNumber', sql.NVarChar, container_number)
        .query('SELECT container_id, status FROM Containers WHERE container_number = @containerNumber');

      if (existingCheck.recordset.length > 0) {
        const existing = existingCheck.recordset[0];
        if (existing.status === 'in_yard') {
          return NextResponse.json({ error: `ตู้ ${container_number} อยู่ในลานแล้ว` }, { status: 400 });
        }
        // Re-enter: update existing container
        finalContainerId = existing.container_id;
        await db.request()
          .input('containerId', sql.Int, finalContainerId)
          .input('status', sql.NVarChar, 'in_yard')
          .input('yardId', sql.Int, yard_id)
          .input('zoneId', sql.Int, zone_id || null)
          .input('bay', sql.Int, bay || null)
          .input('row', sql.Int, row || null)
          .input('tier', sql.Int, tier || null)
          .input('shippingLine', sql.NVarChar, shipping_line || null)
          .input('isLaden', sql.Bit, is_laden || false)
          .input('sealNumber', sql.NVarChar, seal_number || null)
          .input('gateInDate', sql.DateTime2, new Date())
          .query(`
            UPDATE Containers SET
              status = @status, yard_id = @yardId, zone_id = @zoneId,
              bay = @bay, [row] = @row, tier = @tier,
              shipping_line = @shippingLine, is_laden = @isLaden,
              seal_number = @sealNumber, gate_in_date = @gateInDate,
              gate_out_date = NULL, updated_at = GETDATE()
            WHERE container_id = @containerId
          `);
      } else {
        // New container
        const insertResult = await db.request()
          .input('containerNumber', sql.NVarChar, container_number)
          .input('size', sql.NVarChar, size)
          .input('type', sql.NVarChar, containerType)
          .input('status', sql.NVarChar, 'in_yard')
          .input('yardId', sql.Int, yard_id)
          .input('zoneId', sql.Int, zone_id || null)
          .input('bay', sql.Int, bay || null)
          .input('row', sql.Int, row || null)
          .input('tier', sql.Int, tier || null)
          .input('shippingLine', sql.NVarChar, shipping_line || null)
          .input('isLaden', sql.Bit, is_laden || false)
          .input('sealNumber', sql.NVarChar, seal_number || null)
          .input('gateInDate', sql.DateTime2, new Date())
          .query(`
            INSERT INTO Containers (container_number, size, type, status, yard_id, zone_id,
              bay, [row], tier, shipping_line, is_laden, seal_number, gate_in_date)
            OUTPUT INSERTED.container_id
            VALUES (@containerNumber, @size, @type, @status, @yardId, @zoneId,
              @bay, @row, @tier, @shippingLine, @isLaden, @sealNumber, @gateInDate)
          `);
        finalContainerId = insertResult.recordset[0].container_id;
      }

    } else {
      // === GATE-OUT ===
      if (!finalContainerId) {
        return NextResponse.json({ error: 'ต้องระบุ container_id สำหรับ Gate-Out' }, { status: 400 });
      }
      await db.request()
        .input('containerId', sql.Int, finalContainerId)
        .input('sealNumber', sql.NVarChar, seal_number || null)
        .query(`
          UPDATE Containers SET
            status = 'gated_out', gate_out_date = GETDATE(),
            seal_number = @sealNumber, bay = NULL, [row] = NULL, tier = NULL,
            updated_at = GETDATE()
          WHERE container_id = @containerId
        `);
    }

    // Create GateTransaction record
    const txResult = await db.request()
      .input('containerId', sql.Int, finalContainerId)
      .input('yardId', sql.Int, yard_id)
      .input('transactionType', sql.NVarChar, transaction_type)
      .input('driverName', sql.NVarChar, driver_name || null)
      .input('driverLicense', sql.NVarChar, driver_license || null)
      .input('truckPlate', sql.NVarChar, truck_plate || null)
      .input('sealNumber', sql.NVarChar, seal_number || null)
      .input('bookingRef', sql.NVarChar, booking_ref || null)
      .input('eirNumber', sql.NVarChar, eirNumber)
      .input('notes', sql.NVarChar, notes || null)
      .input('damageReport', sql.NVarChar, damage_report ? JSON.stringify(damage_report) : null)
      .query(`
        INSERT INTO GateTransactions (container_id, yard_id, transaction_type,
          driver_name, driver_license, truck_plate, seal_number, booking_ref,
          eir_number, notes, damage_report)
        OUTPUT INSERTED.*
        VALUES (@containerId, @yardId, @transactionType,
          @driverName, @driverLicense, @truckPlate, @sealNumber, @bookingRef,
          @eirNumber, @notes, @damageReport)
      `);

    // Audit log
    await db.request()
      .input('yardId', sql.Int, yard_id)
      .input('action', sql.NVarChar, transaction_type)
      .input('entityType', sql.NVarChar, 'container')
      .input('entityId', sql.Int, finalContainerId)
      .input('details', sql.NVarChar, JSON.stringify({
        eir_number: eirNumber, container_number, transaction_type,
        driver_name, truck_plate,
      }))
      .query(`
        INSERT INTO AuditLog (yard_id, action, entity_type, entity_id, details, created_at)
        VALUES (@yardId, @action, @entityType, @entityId, @details, GETDATE())
      `);

    return NextResponse.json({
      success: true,
      transaction: txResult.recordset[0],
      eir_number: eirNumber,
      container_id: finalContainerId,
    });

  } catch (error: unknown) {
    console.error('❌ POST gate error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'หมายเลขตู้นี้มีอยู่ในระบบแล้ว' : 'ไม่สามารถบันทึก gate transaction ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
