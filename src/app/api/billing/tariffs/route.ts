import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// GET — ดึง Tariffs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');

    const db = await getDb();
    const req = db.request();
    if (yardId) req.input('yardId', sql.Int, parseInt(yardId));

    const result = await req.query(`
      SELECT t.*, c.customer_name
      FROM Tariffs t
      LEFT JOIN Customers c ON t.customer_id = c.customer_id
      ${yardId ? 'WHERE t.yard_id = @yardId' : ''}
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
    const db = await getDb();

    const result = await db.request()
      .input('yardId', sql.Int, body.yard_id)
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

    await logAudit({ yardId: body.yard_id, action: 'tariff_create', entityType: 'tariff', entityId: tariff.tariff_id, details: { charge_type: body.charge_type, rate: body.rate, description: body.description } });

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
    const db = await getDb();

    if (body.action === 'delete') {
      await db.request()
        .input('tariffId', sql.Int, body.tariff_id)
        .query('UPDATE Tariffs SET is_active = 0 WHERE tariff_id = @tariffId');
    } else {
      await db.request()
        .input('tariffId', sql.Int, body.tariff_id)
        .input('rate', sql.Decimal(12, 2), body.rate)
        .input('freeDays', sql.Int, body.free_days || 0)
        .input('description', sql.NVarChar, body.description)
        .query('UPDATE Tariffs SET rate = @rate, free_days = @freeDays, description = @description WHERE tariff_id = @tariffId');
    }

    await logAudit({ action: body.action === 'delete' ? 'tariff_delete' : 'tariff_update', entityType: 'tariff', entityId: body.tariff_id, details: { rate: body.rate, free_days: body.free_days, action: body.action } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT tariff error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}
