import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission, requirePermission, requireYardAccess } from '@/lib/apiAuth';

const TARIFF_READ_PERMISSIONS = [
  'settings.manage',
  'billing.invoice.create',
  'billing.payment.receive',
  'reports.view',
];

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// GET — ดึง Tariffs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parsePositiveInt(searchParams.get('yard_id'));
    if (!yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const permission = await requireAnyPermission(
      request,
      db,
      TARIFF_READ_PERMISSIONS,
      'คุณไม่มีสิทธิ์ดูข้อมูล Tariff'
    );
    if (permission instanceof Response) return permission;

    const yardAccess = await requireYardAccess(request, db, yardId, 'คุณไม่มีสิทธิ์ดู Tariff ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    const req = db.request();
    req.input('yardId', sql.Int, yardId);

    const result = await req.query(`
      SELECT t.*, c.customer_name
      FROM Tariffs t
      LEFT JOIN Customers c ON t.customer_id = c.customer_id
      WHERE t.yard_id = @yardId
      ORDER BY t.charge_type, t.created_at DESC
    `);

    return NextResponse.json({ tariffs: result.recordset });
  } catch (error) {
    console.error('❌ GET tariffs error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}
// POST — สร้าง Tariff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = parsePositiveInt(body.yard_id);
    if (!yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const permission = await requirePermission(
      request,
      db,
      'settings.manage',
      'คุณไม่มีสิทธิ์จัดการ Tariff'
    );
    if (permission instanceof Response) return permission;

    const yardAccess = await requireYardAccess(request, db, yardId, 'คุณไม่มีสิทธิ์จัดการ Tariff ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('chargeType', sql.NVarChar, body.charge_type)
      .input('description', sql.NVarChar, body.description)
      .input('rate', sql.Decimal(12, 2), body.rate)
      .input('unit', sql.NVarChar, body.unit)
      .input('freeDays', sql.Int, body.free_days || 0)
      .input('customerId', sql.Int, body.customer_id || null)
      .query(`
        INSERT INTO Tariffs (yard_id, charge_type, description, rate, unit, free_days, customer_id)
        OUTPUT INSERTED.*
        VALUES (@yardId, @chargeType, @description, @rate, @unit, @freeDays, @customerId)
      `);

    const tariff = result.recordset[0];

    await logAudit({ yardId, action: 'tariff_create', entityType: 'tariff', entityId: tariff.tariff_id, details: { charge_type: body.charge_type, rate: body.rate, description: body.description } });

    return NextResponse.json({ success: true, tariff });
  } catch (error) {
    console.error('❌ POST tariff error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง Tariff ได้' }, { status: 500 });
  }
}

// PUT — อัปเดต/ลบ Tariff
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const tariffId = parsePositiveInt(body.tariff_id);
    if (!tariffId) {
      return NextResponse.json({ error: 'ต้องระบุ tariff_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const permission = await requirePermission(
      request,
      db,
      'settings.manage',
      'คุณไม่มีสิทธิ์จัดการ Tariff'
    );
    if (permission instanceof Response) return permission;

    const tariffResult = await db.request()
      .input('tariffId', sql.Int, tariffId)
      .query('SELECT TOP 1 tariff_id, yard_id FROM Tariffs WHERE tariff_id = @tariffId');

    const tariff = tariffResult.recordset[0];
    if (!tariff) {
      return NextResponse.json({ error: 'ไม่พบ Tariff' }, { status: 404 });
    }

    const yardAccess = await requireYardAccess(request, db, tariff.yard_id, 'คุณไม่มีสิทธิ์จัดการ Tariff ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    if (body.action === 'delete') {
      await db.request()
        .input('tariffId', sql.Int, tariffId)
        .query('UPDATE Tariffs SET is_active = 0 WHERE tariff_id = @tariffId');
    } else {
      await db.request()
        .input('tariffId', sql.Int, tariffId)
        .input('rate', sql.Decimal(12, 2), body.rate)
        .input('freeDays', sql.Int, body.free_days || 0)
        .input('description', sql.NVarChar, body.description)
        .query('UPDATE Tariffs SET rate = @rate, free_days = @freeDays, description = @description WHERE tariff_id = @tariffId');
    }

    await logAudit({ yardId: tariff.yard_id, action: body.action === 'delete' ? 'tariff_delete' : 'tariff_update', entityType: 'tariff', entityId: tariffId, details: { rate: body.rate, free_days: body.free_days, action: body.action } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT tariff error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}
