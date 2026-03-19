import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// POST — ตรวจนับตู้ (Yard Audit)
// Body: { zone_id, yard_id, audited_containers: [{ container_number, bay, row, tier, found: boolean }] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zone_id, yard_id, audited_containers } = body;

    const db = await getDb();
    const results = { matched: 0, misplaced: 0, missing: 0, corrected: 0 };

    // ดึงตู้จริงตาม zone (ในระบบ)
    const systemResult = await db.request()
      .input('zoneId', sql.Int, zone_id)
      .input('yardId', sql.Int, yard_id)
      .query(`
        SELECT container_id, container_number, bay, [row], tier
        FROM Containers
        WHERE zone_id = @zoneId AND yard_id = @yardId AND status = 'in_yard'
      `);
    const systemContainers = systemResult.recordset;
    const systemMap = new Map(systemContainers.map(c => [c.container_number, c]));

    // ตรวจสอบแต่ละตู้ที่ตรวจนับ
    for (const audit of (audited_containers || [])) {
      const sys = systemMap.get(audit.container_number);

      if (!sys) {
        // ตู้ไม่อยู่ในระบบ → missing
        results.missing++;
        continue;
      }

      if (sys.bay === audit.bay && sys.row === audit.row && sys.tier === audit.tier) {
        results.matched++;
      } else {
        results.misplaced++;
        // แก้ไขพิกัดในระบบ
        if (audit.correct_position) {
          await db.request()
            .input('containerId', sql.Int, sys.container_id)
            .input('newBay', sql.Int, audit.bay)
            .input('newRow', sql.Int, audit.row)
            .input('newTier', sql.Int, audit.tier)
            .query(`
              UPDATE Containers SET bay = @newBay, [row] = @newRow, tier = @newTier, updated_at = GETDATE()
              WHERE container_id = @containerId
            `);
          results.corrected++;
        }
      }
      systemMap.delete(audit.container_number);
    }

    // ตู้ที่อยู่ในระบบแต่ไม่พบในการตรวจนับ
    const notFound = Array.from(systemMap.values()).map(c => c.container_number);

    return NextResponse.json({
      success: true,
      results,
      not_found_in_audit: notFound,
      not_found_count: notFound.length,
    });
  } catch (error) {
    console.error('❌ Yard audit error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจนับ' }, { status: 500 });
  }
}

// GET — ดึงข้อมูลตู้ตามโซนสำหรับตรวจนับ
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zone_id');
    const yardId = searchParams.get('yard_id');

    const db = await getDb();
    const result = await db.request()
      .input('zoneId', sql.Int, parseInt(zoneId || '0'))
      .input('yardId', sql.Int, parseInt(yardId || '1'))
      .query(`
        SELECT c.container_id, c.container_number, c.size, c.type, c.bay, c.[row], c.tier,
          c.shipping_line, c.status, z.zone_name
        FROM Containers c
        JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE c.zone_id = @zoneId AND c.yard_id = @yardId AND c.status = 'in_yard'
        ORDER BY c.bay, c.[row], c.tier
      `);

    return NextResponse.json({
      containers: result.recordset,
      total: result.recordset.length,
    });
  } catch (error) {
    console.error('❌ GET audit data error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}
