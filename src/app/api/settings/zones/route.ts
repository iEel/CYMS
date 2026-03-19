import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึง zones ตาม yard_id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');

    const db = await getDb();
    let query = 'SELECT * FROM YardZones';
    const req = db.request();

    if (yardId) {
      query += ' WHERE yard_id = @yardId';
      req.input('yardId', sql.Int, parseInt(yardId));
    }

    query += ' ORDER BY zone_name';
    const result = await req.query(query);
    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('❌ GET zones error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลโซนได้' }, { status: 500 });
  }
}

// POST — เพิ่มโซนใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    const result = await db.request()
      .input('yardId', sql.Int, body.yard_id)
      .input('zoneName', sql.NVarChar, body.zone_name)
      .input('zoneType', sql.NVarChar, body.zone_type)
      .input('maxTier', sql.Int, body.max_tier || 5)
      .input('maxBay', sql.Int, body.max_bay || 20)
      .input('maxRow', sql.Int, body.max_row || 10)
      .input('maxWeightKg', sql.Int, body.max_weight_kg || null)
      .input('sizeRestriction', sql.NVarChar, body.size_restriction || 'any')
      .input('hasReeferPlugs', sql.Bit, body.has_reefer_plugs || false)
      .query(`
        INSERT INTO YardZones (yard_id, zone_name, zone_type, max_tier, max_bay, max_row, max_weight_kg, size_restriction, has_reefer_plugs)
        OUTPUT INSERTED.*
        VALUES (@yardId, @zoneName, @zoneType, @maxTier, @maxBay, @maxRow, @maxWeightKg, @sizeRestriction, @hasReeferPlugs)
      `);

    return NextResponse.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('❌ POST zone error:', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มโซนได้' }, { status: 500 });
  }
}

// PUT — แก้ไขโซน
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    await db.request()
      .input('zoneId', sql.Int, body.zone_id)
      .input('zoneName', sql.NVarChar, body.zone_name)
      .input('zoneType', sql.NVarChar, body.zone_type)
      .input('maxTier', sql.Int, body.max_tier || 5)
      .input('maxBay', sql.Int, body.max_bay || 20)
      .input('maxRow', sql.Int, body.max_row || 10)
      .input('maxWeightKg', sql.Int, body.max_weight_kg || null)
      .input('sizeRestriction', sql.NVarChar, body.size_restriction || 'any')
      .input('hasReeferPlugs', sql.Bit, body.has_reefer_plugs || false)
      .input('isActive', sql.Bit, body.is_active ?? true)
      .query(`
        UPDATE YardZones SET
          zone_name = @zoneName, zone_type = @zoneType, max_tier = @maxTier,
          max_bay = @maxBay, max_row = @maxRow, max_weight_kg = @maxWeightKg,
          size_restriction = @sizeRestriction, has_reefer_plugs = @hasReeferPlugs,
          is_active = @isActive
        WHERE zone_id = @zoneId
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT zone error:', error);
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขโซนได้' }, { status: 500 });
  }
}

// DELETE — ลบโซน (ตรวจว่าไม่มีตู้ก่อน)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zone_id');
    if (!zoneId) return NextResponse.json({ error: 'ต้องระบุ zone_id' }, { status: 400 });

    const db = await getDb();

    // ตรวจว่ามีตู้ใน zone นี้ไหม
    const checkResult = await db.request()
      .input('zoneId', sql.Int, parseInt(zoneId))
      .query('SELECT COUNT(*) as cnt FROM Containers WHERE zone_id = @zoneId AND status = \'in_yard\'');

    if (checkResult.recordset[0].cnt > 0) {
      return NextResponse.json({ error: 'ไม่สามารถลบได้ — ยังมีตู้อยู่ในโซนนี้' }, { status: 400 });
    }

    await db.request()
      .input('zoneId', sql.Int, parseInt(zoneId))
      .query('DELETE FROM YardZones WHERE zone_id = @zoneId');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE zone error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบโซนได้' }, { status: 500 });
  }
}
