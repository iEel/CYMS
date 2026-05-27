import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireRequestActor, requireYardAccess } from '@/lib/apiAuth';

function normalizePlugCapacity(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// GET — ดึง zones ตาม yard_id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawYardId = searchParams.get('yard_id');
    const yardId = parsePositiveInt(rawYardId);
    if (rawYardId && !yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    if (yardId) {
      const yardAccess = await requireYardAccess(request, db, yardId, 'คุณไม่มีสิทธิ์ดูโซนของลานนี้');
      if (yardAccess instanceof Response) return yardAccess;
    } else {
      const requestActor = requireRequestActor(request);
      if (requestActor instanceof Response) return requestActor;
    }

    let query = 'SELECT * FROM YardZones';
    const req = db.request();

    if (yardId) {
      query += ' WHERE yard_id = @yardId';
      req.input('yardId', sql.Int, yardId);
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
    const yardId = parsePositiveInt(body.yard_id);
    if (!yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์เพิ่มโซน');
    if (actor instanceof Response) return actor;

    const yardAccess = await requireYardAccess(request, db, yardId, 'คุณไม่มีสิทธิ์เพิ่มโซนในลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    const plugCapacity = normalizePlugCapacity(body.plug_capacity);

    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('zoneName', sql.NVarChar, body.zone_name)
      .input('zoneType', sql.NVarChar, body.zone_type)
      .input('maxTier', sql.Int, body.max_tier || 5)
      .input('maxBay', sql.Int, body.max_bay || 20)
      .input('maxRow', sql.Int, body.max_row || 10)
      .input('maxWeightKg', sql.Int, body.max_weight_kg || null)
      .input('sizeRestriction', sql.NVarChar, body.size_restriction || 'any')
      .input('hasReeferPlugs', sql.Bit, body.has_reefer_plugs || false)
      .input('plugCapacity', sql.Int, plugCapacity)
      .query(`
        INSERT INTO YardZones (yard_id, zone_name, zone_type, max_tier, max_bay, max_row, max_weight_kg, size_restriction, has_reefer_plugs, plug_capacity)
        OUTPUT INSERTED.*
        VALUES (@yardId, @zoneName, @zoneType, @maxTier, @maxBay, @maxRow, @maxWeightKg, @sizeRestriction, @hasReeferPlugs, @plugCapacity)
      `);

    const created = result.recordset[0];
    await logAudit({ userId: actor.userId, yardId, action: 'zone_create', entityType: 'zone', entityId: created.zone_id, details: { zone_name: body.zone_name, zone_type: body.zone_type } });
    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('❌ POST zone error:', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มโซนได้' }, { status: 500 });
  }
}

// PUT — แก้ไขโซน
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const zoneId = parsePositiveInt(body.zone_id);
    if (!zoneId) {
      return NextResponse.json({ error: 'ต้องระบุ zone_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์แก้ไขโซน');
    if (actor instanceof Response) return actor;

    const zoneResult = await db.request()
      .input('zoneId', sql.Int, zoneId)
      .query('SELECT TOP 1 zone_id, yard_id FROM YardZones WHERE zone_id = @zoneId');
    const zone = zoneResult.recordset[0];
    if (!zone) {
      return NextResponse.json({ error: 'ไม่พบโซน' }, { status: 404 });
    }

    const yardAccess = await requireYardAccess(request, db, zone.yard_id, 'คุณไม่มีสิทธิ์แก้ไขโซนของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    const plugCapacity = normalizePlugCapacity(body.plug_capacity);

    await db.request()
      .input('zoneId', sql.Int, zoneId)
      .input('zoneName', sql.NVarChar, body.zone_name)
      .input('zoneType', sql.NVarChar, body.zone_type)
      .input('maxTier', sql.Int, body.max_tier || 5)
      .input('maxBay', sql.Int, body.max_bay || 20)
      .input('maxRow', sql.Int, body.max_row || 10)
      .input('maxWeightKg', sql.Int, body.max_weight_kg || null)
      .input('sizeRestriction', sql.NVarChar, body.size_restriction || 'any')
      .input('hasReeferPlugs', sql.Bit, body.has_reefer_plugs || false)
      .input('plugCapacity', sql.Int, plugCapacity)
      .input('isActive', sql.Bit, body.is_active ?? true)
      .query(`
        UPDATE YardZones SET
          zone_name = @zoneName, zone_type = @zoneType, max_tier = @maxTier,
          max_bay = @maxBay, max_row = @maxRow, max_weight_kg = @maxWeightKg,
          size_restriction = @sizeRestriction, has_reefer_plugs = @hasReeferPlugs,
          plug_capacity = @plugCapacity,
          is_active = @isActive
        WHERE zone_id = @zoneId
      `);
    await logAudit({ userId: actor.userId, yardId: zone.yard_id, action: 'zone_update', entityType: 'zone', entityId: zoneId, details: { zone_name: body.zone_name, zone_type: body.zone_type } });
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
    const zoneId = parsePositiveInt(searchParams.get('zone_id'));
    if (!zoneId) return NextResponse.json({ error: 'ต้องระบุ zone_id' }, { status: 400 });

    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ลบโซน');
    if (actor instanceof Response) return actor;

    const zoneResult = await db.request()
      .input('zoneId', sql.Int, zoneId)
      .query('SELECT TOP 1 zone_id, yard_id FROM YardZones WHERE zone_id = @zoneId');
    const zone = zoneResult.recordset[0];
    if (!zone) {
      return NextResponse.json({ error: 'ไม่พบโซน' }, { status: 404 });
    }

    const yardAccess = await requireYardAccess(request, db, zone.yard_id, 'คุณไม่มีสิทธิ์ลบโซนของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    // ตรวจว่ามีตู้ใน zone นี้ไหม
    const checkResult = await db.request()
      .input('zoneId', sql.Int, zoneId)
      .query('SELECT COUNT(*) as cnt FROM Containers WHERE zone_id = @zoneId AND status = \'in_yard\'');

    if (checkResult.recordset[0].cnt > 0) {
      return NextResponse.json({ error: 'ไม่สามารถลบได้ — ยังมีตู้อยู่ในโซนนี้' }, { status: 400 });
    }

    await db.request()
      .input('zoneId', sql.Int, zoneId)
      .query('DELETE FROM YardZones WHERE zone_id = @zoneId');
    await logAudit({ userId: actor.userId, yardId: zone.yard_id, action: 'zone_delete', entityType: 'zone', entityId: zoneId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE zone error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบโซนได้' }, { status: 500 });
  }
}
