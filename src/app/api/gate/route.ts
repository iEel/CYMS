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
    const search = searchParams.get('search');

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
    if (search) {
      conditions.push('(c.container_number LIKE @search OR g.driver_name LIKE @search OR g.truck_plate LIKE @search OR g.eir_number LIKE @search)');
      req.input('search', sql.NVarChar, `%${search}%`);
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

// === Auto-Allocation Logic ===
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoAllocate(db: any, yardId: number, size: string, containerType: string, shippingLine?: string) {
  // 1. ดึงโซนทั้งหมดในลาน
  const zonesResult = await db.request()
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT z.zone_id, z.zone_name, z.zone_type, z.max_bay, z.max_row, z.max_tier,
        z.has_reefer_plugs, z.size_restriction
      FROM YardZones z
      WHERE z.yard_id = @yardId AND z.is_active = 1
      ORDER BY z.zone_name
    `);
  const zones = zonesResult.recordset;
  if (zones.length === 0) return null;

  // 2. ดึงตู้ปัจจุบันในลาน
  const containersResult = await db.request()
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT zone_id, bay, [row], tier, shipping_line, size, type
      FROM Containers
      WHERE yard_id = @yardId AND status = 'in_yard'
    `);
  const containers = containersResult.recordset;

  // 3. กฎวางตู้ (Allocation Rules)
  let bestSlot: { zone_id: number; zone_name: string; bay: number; row: number; tier: number; reason: string; score: number } | null = null;

  for (const zone of zones) {
    if (zone.size_restriction && zone.size_restriction !== 'any' && zone.size_restriction !== size) continue;
    if (containerType === 'RF' && zone.zone_type !== 'reefer') continue;
    if (containerType !== 'RF' && zone.zone_type === 'reefer') continue;
    if (containerType === 'DG' && zone.zone_type !== 'hazmat') continue;
    if (containerType !== 'DG' && zone.zone_type === 'hazmat') continue;
    if (zone.zone_type === 'repair') continue;

    const zoneContainers = containers.filter((c: Record<string, unknown>) => c.zone_id === zone.zone_id);
    const stackMap: Record<string, number> = {};
    for (const c of zoneContainers) {
      const key = `${c.bay}-${c.row}`;
      stackMap[key] = Math.max(stackMap[key] || 0, c.tier as number);
    }

    // สายเรือเดียวกัน → Bay เดียวกัน
    const sameLineBays = new Set<number>();
    if (shippingLine) {
      zoneContainers.filter((c: Record<string, unknown>) => c.shipping_line === shippingLine)
        .forEach((c: Record<string, unknown>) => sameLineBays.add(c.bay as number));
    }

    for (let bay = 1; bay <= zone.max_bay; bay++) {
      for (let row = 1; row <= zone.max_row; row++) {
        const key = `${bay}-${row}`;
        const currentHeight = stackMap[key] || 0;
        const nextTier = currentHeight + 1;
        if (nextTier > zone.max_tier) continue;

        let score = 100;
        const reasons: string[] = [];

        if (shippingLine && sameLineBays.has(bay)) {
          score += 30;
          reasons.push(`สายเรือ ${shippingLine} อยู่ Bay นี้`);
        }
        score += (zone.max_tier - nextTier) * 5;
        if (nextTier === 1) reasons.push('วางบนพื้น (หยิบง่าย)');

        const zoneLoad = zoneContainers.length / (zone.max_bay * zone.max_row * zone.max_tier);
        if (zoneLoad < 0.5) {
          score += 15;
          reasons.push(`โซนว่าง ${((1 - zoneLoad) * 100).toFixed(0)}%`);
        }
        if (nextTier > 3) score -= (nextTier - 3) * 10;

        if (!bestSlot || score > bestSlot.score) {
          bestSlot = {
            zone_id: zone.zone_id, zone_name: zone.zone_name,
            bay, row, tier: nextTier,
            reason: reasons.length > 0 ? reasons.join(' • ') : `โซน ${zone.zone_name} ว่าง`,
            score,
          };
        }
      }
    }
  }

  return bestSlot;
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
      user_id, // processed_by user
    } = body;

    const db = await getDb();

    // Generate EIR number
    const eirPrefix = transaction_type === 'gate_in' ? 'EIR-IN' : 'EIR-OUT';
    const countResult = await db.request()
      .input('yardId', sql.Int, yard_id)
      .query(`SELECT COUNT(*) as cnt FROM GateTransactions WHERE yard_id = @yardId`);
    const eirNumber = `${eirPrefix}-${new Date().getFullYear()}-${String(countResult.recordset[0].cnt + 1).padStart(6, '0')}`;

    let finalContainerId = container_id;
    let assignedLocation: { zone_name: string; zone_id: number; bay: number; row: number; tier: number; reason: string } | null = null;

    if (transaction_type === 'gate_in') {
      // === GATE-IN ===

      // Auto-allocate if no zone specified
      let finalZoneId = zone_id || null;
      let finalBay = bay || null;
      let finalRow = row || null;
      let finalTier = tier || null;

      if (!zone_id) {
        const allocation = await autoAllocate(db, yard_id, size, containerType, shipping_line);
        if (allocation) {
          finalZoneId = allocation.zone_id;
          finalBay = allocation.bay;
          finalRow = allocation.row;
          finalTier = allocation.tier;
          assignedLocation = {
            zone_name: allocation.zone_name,
            zone_id: allocation.zone_id,
            bay: allocation.bay,
            row: allocation.row,
            tier: allocation.tier,
            reason: allocation.reason,
          };
        }
      }

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
          .input('zoneId', sql.Int, finalZoneId)
          .input('bay', sql.Int, finalBay)
          .input('row', sql.Int, finalRow)
          .input('tier', sql.Int, finalTier)
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
          .input('zoneId', sql.Int, finalZoneId)
          .input('bay', sql.Int, finalBay)
          .input('row', sql.Int, finalRow)
          .input('tier', sql.Int, finalTier)
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
      .input('processedBy', sql.Int, user_id || null)
      .query(`
        INSERT INTO GateTransactions (container_id, yard_id, transaction_type,
          driver_name, driver_license, truck_plate, seal_number, booking_ref,
          eir_number, notes, damage_report, processed_by)
        OUTPUT INSERTED.*
        VALUES (@containerId, @yardId, @transactionType,
          @driverName, @driverLicense, @truckPlate, @sealNumber, @bookingRef,
          @eirNumber, @notes, @damageReport, @processedBy)
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
        ...(assignedLocation ? { assigned_location: assignedLocation } : {}),
      }))
      .query(`
        INSERT INTO AuditLog (yard_id, action, entity_type, entity_id, details, created_at)
        VALUES (@yardId, @action, @entityType, @entityId, @details, GETDATE())
      `);

    // === Auto-create Work Order for forklift driver ===
    if (transaction_type === 'gate_in' && assignedLocation) {
      try {
        await db.request()
          .input('woYardId', sql.Int, yard_id)
          .input('woOrderType', sql.NVarChar, 'move')
          .input('woContainerId', sql.Int, finalContainerId)
          .input('woToZoneId', sql.Int, assignedLocation.zone_id)
          .input('woToBay', sql.Int, assignedLocation.bay)
          .input('woToRow', sql.Int, assignedLocation.row)
          .input('woToTier', sql.Int, assignedLocation.tier)
          .input('woNotes', sql.NVarChar, `Gate-In → ย้ายตู้ ${container_number} ไปวางที่ Zone ${assignedLocation.zone_name} B${assignedLocation.bay}-R${assignedLocation.row}-T${assignedLocation.tier} (${assignedLocation.reason})`)
          .input('woPriority', sql.Int, 2) // ด่วน
          .query(`
            INSERT INTO WorkOrders (yard_id, order_type, container_id,
              to_zone_id, to_bay, to_row, to_tier,
              priority, notes, status)
            VALUES (@woYardId, @woOrderType, @woContainerId,
              @woToZoneId, @woToBay, @woToRow, @woToTier,
              @woPriority, @woNotes, 'pending')
          `);
      } catch (woErr) {
        console.error('⚠️ Auto work order creation failed:', woErr);
        // Don't fail the gate-in if work order creation fails
      }
    }
    // Note: gate_out work order is created by the frontend (Phase 1 of 2-phase gate-out)

    return NextResponse.json({
      success: true,
      transaction: txResult.recordset[0],
      eir_number: eirNumber,
      container_id: finalContainerId,
      ...(assignedLocation ? { assigned_location: assignedLocation } : {}),
    });

  } catch (error: unknown) {
    console.error('❌ POST gate error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'หมายเลขตู้นี้มีอยู่ในระบบแล้ว' : 'ไม่สามารถบันทึก gate transaction ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
