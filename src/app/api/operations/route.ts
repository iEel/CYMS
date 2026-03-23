import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// GET — ดึง Work Orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assigned_to');
    const orderType = searchParams.get('order_type');

    const db = await getDb();
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) {
      conditions.push('w.yard_id = @yardId');
      req.input('yardId', sql.Int, parseInt(yardId));
    }
    if (status) {
      conditions.push('w.status = @status');
      req.input('status', sql.NVarChar, status);
    }
    if (assignedTo) {
      conditions.push('w.assigned_to = @assignedTo');
      req.input('assignedTo', sql.Int, parseInt(assignedTo));
    }
    if (orderType) {
      conditions.push('w.order_type = @orderType');
      req.input('orderType', sql.NVarChar, orderType);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT w.*,
        c.container_number, c.size, c.type, c.shipping_line,
        fz.zone_name as from_zone_name,
        tz.zone_name as to_zone_name,
        ua.full_name as assigned_name,
        uc.full_name as created_name
      FROM WorkOrders w
      LEFT JOIN Containers c ON w.container_id = c.container_id
      LEFT JOIN YardZones fz ON w.from_zone_id = fz.zone_id
      LEFT JOIN YardZones tz ON w.to_zone_id = tz.zone_id
      LEFT JOIN Users ua ON w.assigned_to = ua.user_id
      LEFT JOIN Users uc ON w.created_by = uc.user_id
      ${where}
      ORDER BY
        CASE w.status WHEN 'in_progress' THEN 0 WHEN 'assigned' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
        w.priority ASC,
        w.created_at DESC
    `);

    return NextResponse.json({ orders: result.recordset });
  } catch (error) {
    console.error('❌ GET operations error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลงานได้' }, { status: 500 });
  }
}

// POST — สร้าง Work Order ใหม่
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    const result = await db.request()
      .input('yardId', sql.Int, body.yard_id)
      .input('orderType', sql.NVarChar, body.order_type)
      .input('containerId', sql.Int, body.container_id)
      .input('fromZoneId', sql.Int, body.from_zone_id || null)
      .input('fromBay', sql.Int, body.from_bay || null)
      .input('fromRow', sql.Int, body.from_row || null)
      .input('fromTier', sql.Int, body.from_tier || null)
      .input('toZoneId', sql.Int, body.to_zone_id || null)
      .input('toBay', sql.Int, body.to_bay || null)
      .input('toRow', sql.Int, body.to_row || null)
      .input('toTier', sql.Int, body.to_tier || null)
      .input('priority', sql.Int, body.priority || 3)
      .input('notes', sql.NVarChar, body.notes || null)
      .input('assignedTo', sql.Int, body.assigned_to || null)
      .query(`
        INSERT INTO WorkOrders (yard_id, order_type, container_id,
          from_zone_id, from_bay, from_row, from_tier,
          to_zone_id, to_bay, to_row, to_tier,
          priority, notes, assigned_to, status)
        OUTPUT INSERTED.*
        VALUES (@yardId, @orderType, @containerId,
          @fromZoneId, @fromBay, @fromRow, @fromTier,
          @toZoneId, @toBay, @toRow, @toTier,
          @priority, @notes, @assignedTo,
          CASE WHEN @assignedTo IS NOT NULL THEN 'assigned' ELSE 'pending' END)
      `);

    // Audit log
    const created = result.recordset[0];
    await logAudit({
      userId: body.user_id, yardId: body.yard_id,
      action: 'wo_create', entityType: 'work_order', entityId: created.order_id,
      details: { order_type: body.order_type, container_id: body.container_id, to_zone_id: body.to_zone_id, priority: body.priority, notes: body.notes }
    });

    return NextResponse.json({ success: true, order: created });
  } catch (error) {
    console.error('❌ POST operations error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างงานได้' }, { status: 500 });
  }
}

// PUT — อัปเดตสถานะงาน
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, action, assigned_to } = body;
    // action: 'assign', 'start', 'complete', 'cancel'

    const db = await getDb();

    let updateQuery = '';
    const req = db.request().input('orderId', sql.Int, order_id);

    switch (action) {
      case 'accept':
        // 2-button workflow: pending → in_progress (skip assigned)
        updateQuery = `UPDATE WorkOrders SET status = 'in_progress', started_at = GETDATE() WHERE order_id = @orderId AND status IN ('pending', 'assigned')`;
        break;
      case 'assign':
        req.input('assignedTo', sql.Int, assigned_to);
        updateQuery = `UPDATE WorkOrders SET status = 'assigned', assigned_to = @assignedTo WHERE order_id = @orderId`;
        break;
      case 'start':
        updateQuery = `UPDATE WorkOrders SET status = 'in_progress', started_at = GETDATE() WHERE order_id = @orderId`;
        break;
      case 'complete':
        updateQuery = `UPDATE WorkOrders SET status = 'completed', completed_at = GETDATE() WHERE order_id = @orderId`;

        // If driver provided a new destination, update the work order first
        if (body.to_zone_id) {
          await db.request()
            .input('oid2', sql.Int, order_id)
            .input('newZone', sql.Int, body.to_zone_id)
            .input('newBay', sql.Int, body.to_bay || null)
            .input('newRow', sql.Int, body.to_row || null)
            .input('newTier', sql.Int, body.to_tier || null)
            .query(`UPDATE WorkOrders SET to_zone_id = @newZone, to_bay = @newBay, to_row = @newRow, to_tier = @newTier WHERE order_id = @oid2`);
        }

        // Also move container if it's a move/shift order
        const orderCheck = await db.request()
          .input('oid', sql.Int, order_id)
          .query('SELECT * FROM WorkOrders WHERE order_id = @oid');

        if (orderCheck.recordset.length > 0) {
          const order = orderCheck.recordset[0];
          if (['move', 'shift', 'restack'].includes(order.order_type) && order.to_zone_id) {
            await db.request()
              .input('cid', sql.Int, order.container_id)
              .input('tz', sql.Int, order.to_zone_id)
              .input('tb', sql.Int, order.to_bay)
              .input('tr', sql.Int, order.to_row)
              .input('tt', sql.Int, order.to_tier)
              .query(`
                UPDATE Containers SET
                  zone_id = @tz, bay = @tb, [row] = @tr, tier = @tt, updated_at = GETDATE()
                WHERE container_id = @cid
              `);
          } else if (order.order_type === 'move' && !order.to_zone_id) {
            // Gate-Out work order: container moved to gate area — clear position
            await db.request()
              .input('cid2', sql.Int, order.container_id)
              .query(`
                UPDATE Containers SET bay = NULL, [row] = NULL, tier = NULL, updated_at = GETDATE()
                WHERE container_id = @cid2
              `);
          }
        }
        break;
      case 'cancel':
        updateQuery = `UPDATE WorkOrders SET status = 'cancelled' WHERE order_id = @orderId`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (updateQuery) {
      await req.query(updateQuery);
    }

    // Audit log
    const auditAction = action === 'accept' ? 'wo_accept' : action === 'complete' ? 'wo_complete' : action === 'cancel' ? 'wo_cancel' : `wo_${action}`;
    await logAudit({
      userId: body.user_id, yardId: body.yard_id,
      action: auditAction, entityType: 'work_order', entityId: order_id,
      details: { action, order_id, ...(body.to_zone_id ? { to_zone_id: body.to_zone_id, to_bay: body.to_bay, to_row: body.to_row, to_tier: body.to_tier } : {}) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT operations error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตงานได้' }, { status: 500 });
  }
}
