import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// POST — คำนวณ Shifting Plan (LIFO)
// ดึงตู้ล่าง → ต้องยกตู้บนออกก่อน
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { container_id, yard_id } = body;

    const db = await getDb();

    // Get target container position
    const target = await db.request()
      .input('containerId', sql.Int, container_id)
      .query(`
        SELECT c.*, z.zone_name
        FROM Containers c
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE c.container_id = @containerId
      `);

    if (target.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบตู้' }, { status: 404 });
    }

    const targetContainer = target.recordset[0];

    if (!targetContainer.zone_id || !targetContainer.bay || !targetContainer.row) {
      return NextResponse.json({
        shifting_needed: false,
        target: targetContainer,
        containers_above: [],
        message: 'ตู้ไม่มีพิกัด ไม่ต้องหลบตู้',
      });
    }

    // Find all containers stacked above this one (same zone, bay, row, higher tier)
    // Include ALL statuses (except gated_out) — physically present containers must be moved regardless of status
    const above = await db.request()
      .input('zoneId', sql.Int, targetContainer.zone_id)
      .input('bay', sql.Int, targetContainer.bay)
      .input('row', sql.Int, targetContainer.row)
      .input('tier', sql.Int, targetContainer.tier)
      .query(`
        SELECT c.*, z.zone_name
        FROM Containers c
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE c.zone_id = @zoneId
          AND c.bay = @bay
          AND c.[row] = @row
          AND c.tier > @tier
          AND c.status != 'gated_out'
        ORDER BY c.tier DESC
      `);

    const containersAbove = above.recordset;

    // Find empty spots to temporarily place shifted containers
    const emptySpots = await db.request()
      .input('yardId', sql.Int, yard_id)
      .input('zoneId', sql.Int, targetContainer.zone_id)
      .query(`
        SELECT z.zone_id, z.zone_name, z.max_bay, z.max_row, z.max_tier
        FROM YardZones z
        WHERE z.yard_id = @yardId AND z.zone_id = @zoneId
      `);

    // Suggest temporary positions (find unused bay/row/tier=1 in same zone)
    const usedPositions = await db.request()
      .input('zoneId2', sql.Int, targetContainer.zone_id)
      .query(`
        SELECT bay, [row], tier
        FROM Containers
        WHERE zone_id = @zoneId2 AND status = 'in_yard'
      `);

    const usedSet = new Set(
      usedPositions.recordset.map((r: { bay: number; row: number; tier: number }) => `${r.bay}-${r.row}-${r.tier}`)
    );

    const tempPositions: { bay: number; row: number; tier: number }[] = [];
    if (emptySpots.recordset.length > 0) {
      const zone = emptySpots.recordset[0];
      for (let b = 1; b <= zone.max_bay && tempPositions.length < containersAbove.length; b++) {
        for (let r = 1; r <= zone.max_row && tempPositions.length < containersAbove.length; r++) {
          if (!usedSet.has(`${b}-${r}-1`)) {
            tempPositions.push({ bay: b, row: r, tier: 1 });
          }
        }
      }
    }

    return NextResponse.json({
      shifting_needed: containersAbove.length > 0,
      target: targetContainer,
      containers_above: containersAbove,
      temp_positions: tempPositions,
      total_moves: containersAbove.length > 0 ? containersAbove.length * 2 + 1 : 1,
      message: containersAbove.length > 0
        ? `ต้องยกตู้หลบ ${containersAbove.length} ตู้ก่อนดึงตู้เป้าหมายออก (${containersAbove.length * 2 + 1} moves)`
        : 'ตู้อยู่ชั้นบนสุด สามารถดึงออกได้เลย',
    });

  } catch (error) {
    console.error('❌ POST shift error:', error);
    return NextResponse.json({ error: 'ไม่สามารถคำนวณ shifting plan ได้' }, { status: 500 });
  }
}
