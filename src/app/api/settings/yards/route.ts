import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// Auto-migrate: add branch columns if missing
async function ensureBranchColumns(db: Awaited<ReturnType<typeof getDb>>) {
  try {
    await db.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Yards') AND name = 'branch_type')
        ALTER TABLE Yards ADD branch_type NVARCHAR(20) DEFAULT 'head_office';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Yards') AND name = 'branch_number')
        ALTER TABLE Yards ADD branch_number NVARCHAR(10) DEFAULT '00000';
    `);
  } catch { /* columns may already exist */ }
}

// GET — ดึงรายชื่อลานทั้งหมด
export async function GET() {
  try {
    const db = await getDb();
    await ensureBranchColumns(db);
    const result = await db.request().query(`
      SELECT y.yard_id, y.yard_name, y.yard_code, y.address,
             y.latitude, y.longitude, y.geofence_radius, y.is_active,
             y.created_at, y.updated_at,
        ISNULL(y.branch_type, 'head_office') as branch_type,
        ISNULL(y.branch_number, '00000') as branch_number,
        (SELECT COUNT(*) FROM YardZones z WHERE z.yard_id = y.yard_id) as zone_count
      FROM Yards y
      ORDER BY y.yard_id
    `);
    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('❌ GET yards error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลลานได้' }, { status: 500 });
  }
}

// POST — เพิ่มลานใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();
    await ensureBranchColumns(db);

    const result = await db.request()
      .input('yardName', sql.NVarChar, body.yard_name)
      .input('yardCode', sql.NVarChar, body.yard_code)
      .input('address', sql.NVarChar, body.address || null)
      .input('latitude', sql.Decimal(10, 7), body.latitude || null)
      .input('longitude', sql.Decimal(10, 7), body.longitude || null)
      .input('geofenceRadius', sql.Int, body.geofence_radius || 500)
      .input('branchType', sql.NVarChar, body.branch_type || 'head_office')
      .input('branchNumber', sql.NVarChar, body.branch_number || '00000')
      .query(`
        INSERT INTO Yards (yard_name, yard_code, address, latitude, longitude, geofence_radius, branch_type, branch_number)
        OUTPUT INSERTED.*
        VALUES (@yardName, @yardCode, @address, @latitude, @longitude, @geofenceRadius, @branchType, @branchNumber)
      `);

    return NextResponse.json({ success: true, data: result.recordset[0] });
  } catch (error: unknown) {
    console.error('❌ POST yard error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'รหัสลานซ้ำ กรุณาใช้รหัสอื่น' : 'ไม่สามารถเพิ่มลานได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — แก้ไขลาน
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    await db.request()
      .input('yardId', sql.Int, body.yard_id)
      .input('yardName', sql.NVarChar, body.yard_name)
      .input('yardCode', sql.NVarChar, body.yard_code)
      .input('address', sql.NVarChar, body.address || null)
      .input('latitude', sql.Decimal(10, 7), body.latitude || null)
      .input('longitude', sql.Decimal(10, 7), body.longitude || null)
      .input('geofenceRadius', sql.Int, body.geofence_radius || 500)
      .input('branchType', sql.NVarChar, body.branch_type || 'head_office')
      .input('branchNumber', sql.NVarChar, body.branch_number || '00000')
      .input('isActive', sql.Bit, body.is_active ?? true)
      .query(`
        UPDATE Yards SET
          yard_name = @yardName, yard_code = @yardCode, address = @address,
          latitude = @latitude, longitude = @longitude, geofence_radius = @geofenceRadius,
          branch_type = @branchType, branch_number = @branchNumber,
          is_active = @isActive, updated_at = GETDATE()
        WHERE yard_id = @yardId
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT yard error:', error);
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขลานได้' }, { status: 500 });
  }
}

// DELETE — ลบลาน (ตรวจว่าไม่มีตู้ก่อน)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    if (!yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id' }, { status: 400 });

    const db = await getDb();

    // ตรวจว่ามีตู้ในลานนี้ไหม
    const checkResult = await db.request()
      .input('yardId', sql.Int, parseInt(yardId))
      .query('SELECT COUNT(*) as cnt FROM Containers WHERE yard_id = @yardId AND status = \'in_yard\'');

    if (checkResult.recordset[0].cnt > 0) {
      return NextResponse.json({ error: 'ไม่สามารถลบได้ — ยังมีตู้อยู่ในลานนี้' }, { status: 400 });
    }

    // ลบ zones ก่อน
    await db.request()
      .input('yardId', sql.Int, parseInt(yardId))
      .query('DELETE FROM YardZones WHERE yard_id = @yardId');

    // ลบ yard
    await db.request()
      .input('yardId', sql.Int, parseInt(yardId))
      .query('DELETE FROM Yards WHERE yard_id = @yardId');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE yard error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบลานได้' }, { status: 500 });
  }
}
