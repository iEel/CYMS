import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { requireYardAccess } from '@/lib/apiAuth';

// GET — สถิติลานสำหรับ Dashboard + Yard Overview
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardIdParam = searchParams.get('yard_id');
    const yardId = Number(yardIdParam);
    if (!Number.isInteger(yardId) || yardId <= 0) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;

    const req = db.request()
      .input('yardId', sql.Int, yardId);

    // Total containers in yard
    const totalResult = await req.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN c.status = 'in_yard' THEN 1 ELSE 0 END) as in_yard,
        SUM(CASE WHEN c.status = 'released' THEN 1 ELSE 0 END) as released,
        SUM(CASE WHEN c.status = 'hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN c.status = 'repair' THEN 1 ELSE 0 END) as in_repair,
        SUM(CASE WHEN c.is_laden = 1 THEN 1 ELSE 0 END) as laden,
        SUM(CASE WHEN c.is_laden = 0 THEN 1 ELSE 0 END) as empty,
        SUM(CASE WHEN c.size = '20' THEN 1 ELSE 0 END) as size_20,
        SUM(CASE WHEN c.size = '40' THEN 1 ELSE 0 END) as size_40,
        SUM(CASE WHEN c.size = '45' THEN 1 ELSE 0 END) as size_45
      FROM Containers c
      WHERE c.yard_id = @yardId
    `);

    // Zone occupancy
    const zoneReq = db.request()
      .input('yardId', sql.Int, yardId);

    const zoneResult = await zoneReq.query(`
      SELECT z.zone_id, z.zone_name, z.zone_type, z.max_bay, z.max_row, z.max_tier,
        COUNT(c.container_id) as container_count,
        (z.max_bay * z.max_row * z.max_tier) as capacity,
        CAST(COUNT(c.container_id) AS FLOAT) / NULLIF(z.max_bay * z.max_row * z.max_tier, 0) * 100 as occupancy_pct
      FROM YardZones z
      LEFT JOIN Containers c ON z.zone_id = c.zone_id AND c.status = 'in_yard'
      WHERE z.yard_id = @yardId
      GROUP BY z.zone_id, z.zone_name, z.zone_type, z.max_bay, z.max_row, z.max_tier
      ORDER BY z.zone_name
    `);

    return NextResponse.json({
      summary: totalResult.recordset[0],
      zones: zoneResult.recordset,
    });
  } catch (error) {
    console.error('❌ GET yard stats error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงสถิติลานได้' }, { status: 500 });
  }
}
