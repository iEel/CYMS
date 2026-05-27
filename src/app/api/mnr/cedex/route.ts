import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission } from '@/lib/apiAuth';
import sql from 'mssql';

const CEDEX_READ_PERMISSIONS = [
  'mnr.cedex.manage',
  'mnr.eor.create',
  'mnr.eor.update',
  'mnr.eor.approve',
  'survey.inspect',
  'reports.view',
];

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// GET — ดึง CEDEX codes ทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false'; // default: only active

    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      CEDEX_READ_PERMISSIONS,
      'คุณไม่มีสิทธิ์ดูรหัส CEDEX'
    );
    if (actor instanceof Response) return actor;

    const result = await db.request().query(`
      SELECT * FROM CEDEXCodes
      ${activeOnly ? "WHERE is_active = 1" : ""}
      ORDER BY code
    `);

    return NextResponse.json({ codes: result.recordset });
  } catch (error) {
    console.error('❌ GET cedex error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล CEDEX ได้' }, { status: 500 });
  }
}

// POST — สร้าง CEDEX code ใหม่
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      ['mnr.cedex.manage'],
      'คุณไม่มีสิทธิ์จัดการรหัส CEDEX'
    );
    if (actor instanceof Response) return actor;

    const body = await request.json();
    const { code, component, damage, repair, labor_hours, material_cost } = body;

    if (!code || !component || !damage || !repair) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const result = await db.request()
      .input('code', sql.NVarChar, code.toUpperCase())
      .input('component', sql.NVarChar, component)
      .input('damage', sql.NVarChar, damage)
      .input('repair', sql.NVarChar, repair)
      .input('laborHours', sql.Decimal(5, 2), labor_hours || 0)
      .input('materialCost', sql.Decimal(10, 2), material_cost || 0)
      .query(`
        INSERT INTO CEDEXCodes (code, component, damage, repair, labor_hours, material_cost, rate_version, updated_at)
        OUTPUT INSERTED.*
        VALUES (@code, @component, @damage, @repair, @laborHours, @materialCost, 1, GETDATE())
      `);

    await logAudit({
      userId: actor.userId,
      action: 'cedex_create',
      entityType: 'cedex_code',
      entityId: result.recordset[0]?.cedex_id || null,
      details: { code: code.toUpperCase(), component, damage, repair },
    });

    return NextResponse.json({ success: true, data: result.recordset[0] });
  } catch (error: unknown) {
    console.error('❌ POST cedex error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'รหัส CEDEX นี้มีอยู่แล้ว' : 'ไม่สามารถสร้าง CEDEX ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — อัปเดต CEDEX code
export async function PUT(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      ['mnr.cedex.manage'],
      'คุณไม่มีสิทธิ์จัดการรหัส CEDEX'
    );
    if (actor instanceof Response) return actor;

    const body = await request.json();
    const { cedex_id, code, component, damage, repair, labor_hours, material_cost, is_active } = body;
    const cedexId = parsePositiveInt(cedex_id);

    if (!cedexId) {
      return NextResponse.json({ error: 'ต้องระบุ cedex_id' }, { status: 400 });
    }

    await db.request()
      .input('cedexId', sql.Int, cedexId)
      .input('code', sql.NVarChar, code?.toUpperCase())
      .input('component', sql.NVarChar, component)
      .input('damage', sql.NVarChar, damage)
      .input('repair', sql.NVarChar, repair)
      .input('laborHours', sql.Decimal(5, 2), labor_hours || 0)
      .input('materialCost', sql.Decimal(10, 2), material_cost || 0)
      .input('isActive', sql.Bit, is_active !== undefined ? is_active : 1)
      .query(`
        UPDATE CEDEXCodes SET
          code = @code, component = @component, damage = @damage,
          repair = @repair, labor_hours = @laborHours, material_cost = @materialCost,
          is_active = @isActive,
          rate_version = ISNULL(rate_version, 1) + CASE
            WHEN labor_hours <> @laborHours OR material_cost <> @materialCost THEN 1
            ELSE 0
          END,
          updated_at = GETDATE()
        WHERE cedex_id = @cedexId
      `);

    await logAudit({
      userId: actor.userId,
      action: 'cedex_update',
      entityType: 'cedex_code',
      entityId: cedexId,
      details: { code: code?.toUpperCase(), component, damage, repair, is_active },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('❌ PUT cedex error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'รหัส CEDEX ซ้ำ' : 'ไม่สามารถอัปเดต CEDEX ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — ลบ CEDEX code (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      ['mnr.cedex.manage'],
      'คุณไม่มีสิทธิ์จัดการรหัส CEDEX'
    );
    if (actor instanceof Response) return actor;

    const { searchParams } = new URL(request.url);
    const cedexId = parsePositiveInt(searchParams.get('id'));

    if (!cedexId) {
      return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });
    }

    await db.request()
      .input('cedexId', sql.Int, cedexId)
      .query('UPDATE CEDEXCodes SET is_active = 0, updated_at = GETDATE() WHERE cedex_id = @cedexId');

    await logAudit({
      userId: actor.userId,
      action: 'cedex_delete',
      entityType: 'cedex_code',
      entityId: cedexId,
      details: { is_active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE cedex error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบ CEDEX ได้' }, { status: 500 });
  }
}
