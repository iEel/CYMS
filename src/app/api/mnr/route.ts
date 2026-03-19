import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

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
    const body = await request.json();
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
      .query(`
        INSERT INTO RepairOrders (eor_number, container_id, yard_id, customer_id,
          damage_details, estimated_cost)
        OUTPUT INSERTED.*
        VALUES (@eorNumber, @containerId, @yardId, @customerId,
          @damageDetails, @estimatedCost)
      `);

    // Update container status
    await db.request()
      .input('cid', sql.Int, body.container_id)
      .query("UPDATE Containers SET status = 'under_repair', updated_at = GETDATE() WHERE container_id = @cid");

    return NextResponse.json({ success: true, order: result.recordset[0], eor_number: eorNumber });
  } catch (error) {
    console.error('❌ POST mnr error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง EOR ได้' }, { status: 500 });
  }
}

// PUT — อัปเดตสถานะ EOR
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { eor_id, action, actual_cost } = body;

    const db = await getDb();
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

        // Get container and update status back
        const orderResult = await db.request().input('eid', sql.Int, eor_id).query('SELECT container_id FROM RepairOrders WHERE eor_id = @eid');
        if (orderResult.recordset[0]) {
          await db.request().input('cid2', sql.Int, orderResult.recordset[0].container_id)
            .query("UPDATE Containers SET status = 'in_yard', updated_at = GETDATE() WHERE container_id = @cid2");
        }
        break;
      case 'reject':
        await req.query("UPDATE RepairOrders SET status = 'rejected' WHERE eor_id = @eorId");
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT mnr error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}
