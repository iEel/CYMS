import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// POST — แนะนำพิกัดวางตู้อัตโนมัติ
// Body: { yard_id, size, type, shipping_line? }
// Returns: { zone_name, bay, row, tier, reason }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yard_id, size, type, shipping_line } = body;

    const db = await getDb();

    // 1. ดึงโซนทั้งหมดในลาน
    const zonesResult = await db.request()
      .input('yardId', sql.Int, yard_id || 1)
      .query(`
        SELECT z.zone_id, z.zone_name, z.zone_type, z.max_bay, z.max_row, z.max_tier,
          z.has_reefer_plugs, z.size_restriction
        FROM YardZones z
        WHERE z.yard_id = @yardId
        ORDER BY z.zone_name
      `);
    const zones = zonesResult.recordset;

    // 2. ดึงตู้ปัจจุบันในลาน (เฉพาะ in_yard)
    const containersResult = await db.request()
      .input('yardId', sql.Int, yard_id || 1)
      .query(`
        SELECT zone_id, bay, [row], tier, shipping_line, size, type
        FROM Containers
        WHERE yard_id = @yardId AND status = 'in_yard'
      `);
    const containers = containersResult.recordset;

    // 3. กฎวางตู้ (Allocation Rules)
    const suggestions: Array<{
      zone_name: string; zone_id: number;
      bay: number; row: number; tier: number;
      reason: string; score: number;
    }> = [];

    for (const zone of zones) {
      // === Rule 0: ขนาดตู้ต้องตรงกับ size_restriction ของ zone ===
      if (zone.size_restriction && zone.size_restriction !== 'any' && zone.size_restriction !== size) continue;

      // === Rule 1: ตู้เย็น → Zone reefer เท่านั้น ===
      if (type === 'RF' && zone.zone_type !== 'reefer') continue;
      if (type !== 'RF' && zone.zone_type === 'reefer') continue;

      // === Rule 2: ตู้ Hazmat → Zone hazmat เท่านั้น ===
      if (type === 'DG' && zone.zone_type !== 'hazmat') continue;
      if (type !== 'DG' && zone.zone_type === 'hazmat') continue;

      // === Rule 3: ตู้ซ่อม → Zone repair ===
      if (zone.zone_type === 'repair') continue; // ไม่วางตู้ใหม่ใน repair zone

      // สร้าง stack map สำหรับโซนนี้
      const zoneContainers = containers.filter(c => c.zone_id === zone.zone_id);
      const stackMap: Record<string, number> = {};
      for (const c of zoneContainers) {
        const key = `${c.bay}-${c.row}`;
        stackMap[key] = Math.max(stackMap[key] || 0, c.tier);
      }

      // === Rule 4: สายเรือเดียวกัน → Bay เดียวกัน (grouping) ===
      // หา bay ที่สายเรือเดียวกันวางอยู่
      const sameLineBays = new Set<number>();
      if (shipping_line) {
        const sameLineContainers = zoneContainers.filter(c => c.shipping_line === shipping_line);
        sameLineContainers.forEach(c => sameLineBays.add(c.bay));
      }

      // หาตำแหน่งว่าง
      for (let bay = 1; bay <= zone.max_bay; bay++) {
        for (let row = 1; row <= zone.max_row; row++) {
          const key = `${bay}-${row}`;
          const currentHeight = stackMap[key] || 0;
          const nextTier = currentHeight + 1;

          if (nextTier > zone.max_tier) continue; // เต็มแล้ว

          // คำนวณคะแนน
          let score = 100;
          let reasons: string[] = [];

          // Bonus: สายเรือเดียวกัน
          if (shipping_line && sameLineBays.has(bay)) {
            score += 30;
            reasons.push(`สายเรือ ${shipping_line} อยู่ Bay นี้`);
          }

          // Bonus: วาง tier ต่ำ (ง่ายต่อการหยิบ)
          score += (zone.max_tier - nextTier) * 5;
          if (nextTier === 1) reasons.push('วางบนพื้น (หยิบง่าย)');

          // Bonus: โซนว่างเยอะ (กระจายตู้)
          const zoneLoad = zoneContainers.length / (zone.max_bay * zone.max_row * zone.max_tier);
          if (zoneLoad < 0.5) {
            score += 15;
            reasons.push(`โซนว่าง ${((1 - zoneLoad) * 100).toFixed(0)}%`);
          }

          // Penalty: stack สูงเกินไป
          if (nextTier > 3) score -= (nextTier - 3) * 10;

          // เพิ่มเป็นตัวเลือก
          suggestions.push({
            zone_name: zone.zone_name,
            zone_id: zone.zone_id,
            bay, row, tier: nextTier,
            reason: reasons.length > 0 ? reasons.join(' • ') : `โซน ${zone.zone_name} ว่าง`,
            score,
          });
        }
      }
    }

    // เรียงตามคะแนนสูงสุด → ส่งกลับ top 5
    suggestions.sort((a, b) => b.score - a.score);
    const top5 = suggestions.slice(0, 5);

    return NextResponse.json({
      suggestions: top5,
      total_options: suggestions.length,
      best: top5[0] || null,
    });
  } catch (error) {
    console.error('❌ Auto-allocation error:', error);
    return NextResponse.json({ error: 'ไม่สามารถแนะนำพิกัดได้' }, { status: 500 });
  }
}
