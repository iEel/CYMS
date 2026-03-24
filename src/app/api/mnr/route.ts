import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';

// === Zod Schemas ===
const createEORSchema = z.object({
  container_id: z.number().int().positive(),
  yard_id: z.number().int().positive(),
  customer_id: z.number().int().positive().optional().nullable(),
  damage_details: z.any().optional(),
  estimated_cost: z.number().min(0).optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
  user_id: z.number().int().positive().optional().nullable(),
});

const updateEORSchema = z.object({
  eor_id: z.number().int().positive(),
  action: z.enum(['submit', 'approve', 'start_repair', 'complete', 'reject']),
  actual_cost: z.number().min(0).optional(),
  user_id: z.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// GET — ดึง Repair Orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const status = searchParams.get('status');

    const db = await getDb();
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) { conditions.push('r.yard_id = @yardId'); req.input('yardId', sql.Int, parseInt(yardId)); }
    if (status) { conditions.push('r.status = @status'); req.input('status', sql.NVarChar, status); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT r.*, c.container_number, c.size, c.type,
        cu.customer_name, u.full_name as created_name
      FROM RepairOrders r
      LEFT JOIN Containers c ON r.container_id = c.container_id
      LEFT JOIN Customers cu ON r.customer_id = cu.customer_id
      LEFT JOIN Users u ON r.created_by = u.user_id
      ${where}
      ORDER BY r.created_at DESC
    `);

    return NextResponse.json({ orders: result.recordset });
  } catch (error) {
    console.error('❌ GET mnr error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// POST — สร้าง EOR
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = createEORSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', details: parsed.error.issues }, { status: 400 });
    }
    const body = parsed.data;
    const db = await getDb();

    // Generate EOR number
    const countResult = await db.request()
      .input('yardId', sql.Int, body.yard_id)
      .query('SELECT COUNT(*) as cnt FROM RepairOrders WHERE yard_id = @yardId');
    const eorNumber = `EOR-${new Date().getFullYear()}-${String(countResult.recordset[0].cnt + 1).padStart(6, '0')}`;

    const result = await db.request()
      .input('eorNumber', sql.NVarChar, eorNumber)
      .input('containerId', sql.Int, body.container_id)
      .input('yardId', sql.Int, body.yard_id)
      .input('customerId', sql.Int, body.customer_id || null)
      .input('damageDetails', sql.NVarChar, body.damage_details ? JSON.stringify(body.damage_details) : null)
      .input('estimatedCost', sql.Decimal(12, 2), body.estimated_cost || 0)
      .input('notes', sql.NVarChar, body.notes || null)
      .input('createdBy', sql.Int, body.user_id || null)
      .query(`
        INSERT INTO RepairOrders (eor_number, container_id, yard_id, customer_id,
          damage_details, estimated_cost, notes, created_by)
        OUTPUT INSERTED.*
        VALUES (@eorNumber, @containerId, @yardId, @customerId,
          @damageDetails, @estimatedCost, @notes, @createdBy)
      `);

    // Update container status
    await db.request()
      .input('cid', sql.Int, body.container_id)
      .query("UPDATE Containers SET status = 'under_repair', updated_at = GETDATE() WHERE container_id = @cid");

    // Audit trail
    await logAudit({
      yardId: body.yard_id,
      userId: body.user_id || undefined,
      action: 'eor_create',
      entityType: 'repair_order',
      entityId: result.recordset[0].eor_id,
      details: { eor_number: eorNumber, container_id: body.container_id, estimated_cost: body.estimated_cost },
    });

    return NextResponse.json({ success: true, order: result.recordset[0], eor_number: eorNumber });
  } catch (error) {
    console.error('❌ POST mnr error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง EOR ได้' }, { status: 500 });
  }
}

// PUT — อัปเดตสถานะ EOR
export async function PUT(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = updateEORSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', details: parsed.error.issues }, { status: 400 });
    }
    const { eor_id, action, actual_cost, user_id } = parsed.data;

    const db = await getDb();

    // Get order info for audit + container status
    const orderInfo = await db.request()
      .input('eid', sql.Int, eor_id)
      .query('SELECT eor_number, container_id, yard_id FROM RepairOrders WHERE eor_id = @eid');
    const order = orderInfo.recordset[0];
    if (!order) {
      return NextResponse.json({ error: 'ไม่พบ EOR' }, { status: 404 });
    }

    const req = db.request().input('eorId', sql.Int, eor_id);

    switch (action) {
      case 'submit':
        await req.query("UPDATE RepairOrders SET status = 'pending_approval' WHERE eor_id = @eorId");
        break;
      case 'approve':
        await req.query("UPDATE RepairOrders SET status = 'approved', approved_at = GETDATE() WHERE eor_id = @eorId");
        break;
      case 'start_repair':
        await req.query("UPDATE RepairOrders SET status = 'in_repair' WHERE eor_id = @eorId");
        break;
      case 'complete':
        req.input('actualCost', sql.Decimal(12, 2), actual_cost || 0);
        await req.query("UPDATE RepairOrders SET status = 'completed', actual_cost = @actualCost WHERE eor_id = @eorId");
        // Revert container status back to in_yard
        await db.request().input('cid', sql.Int, order.container_id)
          .query("UPDATE Containers SET status = 'in_yard', updated_at = GETDATE() WHERE container_id = @cid");
        break;
      case 'reject':
        await req.query("UPDATE RepairOrders SET status = 'rejected' WHERE eor_id = @eorId");
        // Revert container status back to in_yard (fix #3)
        await db.request().input('cid', sql.Int, order.container_id)
          .query("UPDATE Containers SET status = 'in_yard', updated_at = GETDATE() WHERE container_id = @cid");
        break;
    }

    // Audit trail for every action
    await logAudit({
      yardId: order.yard_id,
      userId: user_id || undefined,
      action: `eor_${action}`,
      entityType: 'repair_order',
      entityId: eor_id,
      details: {
        eor_number: order.eor_number,
        container_id: order.container_id,
        ...(action === 'complete' ? { actual_cost } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT mnr error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}
