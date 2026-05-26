import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';
import sql from 'mssql';

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value: unknown, max = 500) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function phaseSqlWhere(status: string | null) {
  if (status === 'all') return '';
  if (status === 'released') return "AND gor.status = 'released'";
  if (status === 'cancelled') return "AND gor.status = 'cancelled'";
  return "AND gor.status IN ('requested', 'moving', 'at_gate')";
}

async function fetchGateOutRequests(
  db: sql.ConnectionPool,
  params: { yardId: number; requestId?: number | null; containerId?: number | null; status?: string | null }
) {
  const req = db.request()
    .input('yardId', sql.Int, params.yardId);
  const filters = ['gor.yard_id = @yardId'];

  if (params.requestId) {
    req.input('requestId', sql.Int, params.requestId);
    filters.push('gor.request_id = @requestId');
  }
  if (params.containerId) {
    req.input('containerId', sql.Int, params.containerId);
    filters.push('gor.container_id = @containerId');
  }

  const phaseFilter = phaseSqlWhere(params.status || null);
  const extraFilter = phaseFilter ? ` ${phaseFilter}` : '';

  return req.query(`
    WITH RequestRows AS (
      SELECT TOP 100
        gor.*,
        wo.status AS work_order_status,
        wo.created_at AS work_order_created_at,
        wo.started_at AS work_order_started_at,
        wo.completed_at AS work_order_completed_at,
        c.container_number,
        c.size,
        c.type,
        c.shipping_line,
        c.status AS container_status,
        c.zone_id,
        c.bay,
        c.[row],
        c.tier,
        c.gate_in_date,
        c.container_owner_id,
        yz.zone_name,
        b.booking_number,
        b.status AS booking_status,
        b.customer_id,
        b.booking_customer_id,
        b.shipping_line_id,
        b.forwarder_id,
        b.shipper_id,
        b.consignee_id,
        b.trucking_company_id,
        b.bill_to_customer_id,
        b.container_count,
        b.container_size,
        b.container_type,
        b.received_count,
        b.released_count,
        bookingCustomer.customer_name AS booking_customer_name,
        shippingLine.customer_name AS shipping_line_name,
        forwarder.customer_name AS forwarder_name,
        shipper.customer_name AS shipper_name,
        consignee.customer_name AS consignee_name,
        trucking.customer_name AS trucking_company_name,
        billTo.customer_name AS bill_to_customer_name,
        bc.clearance_type,
        bc.invoice_id AS clearance_invoice_id
      FROM GateOutRequests gor
      LEFT JOIN WorkOrders wo ON wo.order_id = gor.work_order_id
      LEFT JOIN Containers c ON c.container_id = gor.container_id
      LEFT JOIN YardZones yz ON yz.zone_id = c.zone_id
      LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
      LEFT JOIN Customers bookingCustomer ON bookingCustomer.customer_id = COALESCE(b.booking_customer_id, b.customer_id)
      LEFT JOIN Customers shippingLine ON shippingLine.customer_id = b.shipping_line_id
      LEFT JOIN Customers forwarder ON forwarder.customer_id = b.forwarder_id
      LEFT JOIN Customers shipper ON shipper.customer_id = b.shipper_id
      LEFT JOIN Customers consignee ON consignee.customer_id = b.consignee_id
      LEFT JOIN Customers trucking ON trucking.customer_id = b.trucking_company_id
      LEFT JOIN Customers billTo ON billTo.customer_id = b.bill_to_customer_id
      LEFT JOIN BillingClearances bc ON bc.clearance_id = gor.billing_clearance_id
      WHERE ${filters.join(' AND ')}
        ${extraFilter}
      ORDER BY gor.requested_at DESC, gor.request_id DESC
    )
    SELECT *,
      CASE
        WHEN status = 'released' THEN 'released'
        WHEN status = 'cancelled' THEN 'cancelled'
        WHEN status = 'at_gate' THEN 'at_gate'
        WHEN work_order_status = 'completed' THEN 'at_gate'
        WHEN work_order_status IN ('pending', 'assigned', 'in_progress') THEN 'moving'
        ELSE status
      END AS display_status
    FROM RequestRows
  `);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    if (!yardId) return NextResponse.json({ error: 'yard_id required' }, { status: 400 });

    const db = await getDb();
    const actor = await requireAnyPermission(request, db, ['gate.out', 'yard.slot.move', 'yard.location.assign'], 'คุณไม่มีสิทธิ์ดูงาน Gate Out');
    if (actor instanceof NextResponse) return actor;
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;

    const result = await fetchGateOutRequests(db, {
      yardId,
      requestId: positiveInt(searchParams.get('request_id')),
      containerId: positiveInt(searchParams.get('container_id')),
      status: cleanText(searchParams.get('status'), 20),
    });

    return NextResponse.json({ requests: result.recordset });
  } catch (error) {
    console.error('❌ GET gate out requests error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดงาน Gate Out ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = positiveInt(body.yard_id);
    const containerId = positiveInt(body.container_id);
    if (!yardId || !containerId) {
      return NextResponse.json({ error: 'yard_id and container_id required' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requireAnyPermission(request, db, ['yard.slot.move', 'yard.location.assign'], 'คุณไม่มีสิทธิ์สร้างคำสั่งงานลาน');
    if (actor instanceof NextResponse) return actor;

    const containerResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('containerId', sql.Int, containerId)
      .query(`
        SELECT TOP 1 container_id, container_number, zone_id, bay, [row], tier
        FROM Containers
        WHERE container_id = @containerId
          AND yard_id = @yardId
          AND status <> 'gated_out'
      `);
    const container = containerResult.recordset[0];
    if (!container) return NextResponse.json({ error: 'ไม่พบตู้ที่สามารถปล่อยออกได้' }, { status: 404 });

    const existing = await fetchGateOutRequests(db, { yardId, containerId });
    if (existing.recordset.length > 0) {
      const current = existing.recordset[0];
      await db.request()
        .input('requestId', sql.Int, current.request_id)
        .input('bookingId', sql.Int, positiveInt(body.booking_id))
        .input('bookingRef', sql.NVarChar, cleanText(body.booking_ref, 100))
        .input('billingCustomerId', sql.Int, positiveInt(body.billing_customer_id))
        .input('billingClearanceId', sql.Int, positiveInt(body.billing_clearance_id))
        .input('driverName', sql.NVarChar, cleanText(body.driver_name, 100))
        .input('driverLicense', sql.NVarChar, cleanText(body.driver_license, 50))
        .input('truckPlate', sql.NVarChar, cleanText(body.truck_plate, 20))
        .input('sealNumber', sql.NVarChar, cleanText(body.seal_number, 50))
        .input('notes', sql.NVarChar, cleanText(body.notes, 500))
        .query(`
          UPDATE GateOutRequests
          SET booking_id = COALESCE(@bookingId, booking_id),
              booking_ref = COALESCE(@bookingRef, booking_ref),
              billing_customer_id = COALESCE(@billingCustomerId, billing_customer_id),
              billing_clearance_id = COALESCE(@billingClearanceId, billing_clearance_id),
              driver_name = COALESCE(@driverName, driver_name),
              driver_license = COALESCE(@driverLicense, driver_license),
              truck_plate = COALESCE(@truckPlate, truck_plate),
              seal_number = COALESCE(@sealNumber, seal_number),
              notes = COALESCE(@notes, notes),
              updated_at = GETDATE()
          WHERE request_id = @requestId
        `);
      const refreshed = await fetchGateOutRequests(db, { yardId, requestId: current.request_id, status: 'all' });
      return NextResponse.json({ success: true, reused: true, request: refreshed.recordset[0] });
    }

    const notes = cleanText(body.notes, 500);
    const workOrderResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('containerId', sql.Int, containerId)
      .input('fromZoneId', sql.Int, positiveInt(body.from_zone_id) || container.zone_id || null)
      .input('fromBay', sql.Int, positiveInt(body.from_bay) || container.bay || null)
      .input('fromRow', sql.Int, positiveInt(body.from_row) || container.row || null)
      .input('fromTier', sql.Int, positiveInt(body.from_tier) || container.tier || null)
      .input('priority', sql.Int, positiveInt(body.priority) || 3)
      .input('notes', sql.NVarChar, notes || `Gate-Out request ${container.container_number}`)
      .input('createdBy', sql.Int, actor.userId)
      .query(`
        INSERT INTO WorkOrders (yard_id, order_type, container_id,
          from_zone_id, from_bay, from_row, from_tier,
          priority, notes, created_by, status)
        OUTPUT INSERTED.*
        VALUES (@yardId, 'move', @containerId,
          @fromZoneId, @fromBay, @fromRow, @fromTier,
          @priority, @notes, @createdBy, 'pending')
      `);
    const workOrder = workOrderResult.recordset[0];

    const requestResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('containerId', sql.Int, containerId)
      .input('bookingId', sql.Int, positiveInt(body.booking_id))
      .input('bookingRef', sql.NVarChar, cleanText(body.booking_ref, 100))
      .input('billingCustomerId', sql.Int, positiveInt(body.billing_customer_id))
      .input('billingClearanceId', sql.Int, positiveInt(body.billing_clearance_id))
      .input('workOrderId', sql.Int, workOrder.order_id)
      .input('driverName', sql.NVarChar, cleanText(body.driver_name, 100))
      .input('driverLicense', sql.NVarChar, cleanText(body.driver_license, 50))
      .input('truckPlate', sql.NVarChar, cleanText(body.truck_plate, 20))
      .input('sealNumber', sql.NVarChar, cleanText(body.seal_number, 50))
      .input('notes', sql.NVarChar, notes)
      .input('requestedBy', sql.Int, actor.userId)
      .query(`
        INSERT INTO GateOutRequests (yard_id, container_id, booking_id, booking_ref,
          billing_customer_id, billing_clearance_id, work_order_id,
          driver_name, driver_license, truck_plate, seal_number, notes,
          status, requested_by)
        OUTPUT INSERTED.*
        VALUES (@yardId, @containerId, @bookingId, @bookingRef,
          @billingCustomerId, @billingClearanceId, @workOrderId,
          @driverName, @driverLicense, @truckPlate, @sealNumber, @notes,
          'requested', @requestedBy)
      `);
    const gateOutRequest = requestResult.recordset[0];

    await logAudit({
      userId: actor.userId,
      yardId,
      action: 'gate_out_request_create',
      entityType: 'gate_out_request',
      entityId: gateOutRequest.request_id,
      details: { container_id: containerId, work_order_id: workOrder.order_id, booking_ref: body.booking_ref || null },
    });

    const refreshed = await fetchGateOutRequests(db, { yardId, requestId: gateOutRequest.request_id, status: 'all' });
    return NextResponse.json({ success: true, request: refreshed.recordset[0] || gateOutRequest, work_order: workOrder });
  } catch (error) {
    console.error('❌ POST gate out requests error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างงาน Gate Out ได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const requestId = positiveInt(body.request_id);
    const action = cleanText(body.action, 30) || 'update_context';
    if (!requestId) return NextResponse.json({ error: 'request_id required' }, { status: 400 });

    const db = await getDb();
    const scope = await db.request()
      .input('requestId', sql.Int, requestId)
      .query('SELECT request_id, yard_id, work_order_id FROM GateOutRequests WHERE request_id = @requestId');
    const current = scope.recordset[0];
    if (!current) return NextResponse.json({ error: 'ไม่พบงาน Gate Out' }, { status: 404 });

    const actor = await requireAnyPermission(request, db, ['gate.out', 'yard.slot.move', 'yard.location.assign'], 'คุณไม่มีสิทธิ์อัปเดตงาน Gate Out');
    if (actor instanceof NextResponse) return actor;
    const yardAccess = await requireYardAccess(request, db, current.yard_id);
    if (yardAccess instanceof NextResponse) return yardAccess;

    if (action === 'mark_at_gate') {
      await db.request()
        .input('requestId', sql.Int, requestId)
        .query("UPDATE GateOutRequests SET status = 'at_gate', updated_at = GETDATE() WHERE request_id = @requestId AND status IN ('requested', 'moving', 'at_gate')");
    } else if (action === 'cancel') {
      await db.request()
        .input('requestId', sql.Int, requestId)
        .query("UPDATE GateOutRequests SET status = 'cancelled', updated_at = GETDATE() WHERE request_id = @requestId AND status <> 'released'");
      if (current.work_order_id) {
        await db.request()
          .input('workOrderId', sql.Int, current.work_order_id)
          .query("UPDATE WorkOrders SET status = 'cancelled' WHERE order_id = @workOrderId AND status <> 'completed'");
      }
    } else {
      await db.request()
        .input('requestId', sql.Int, requestId)
        .input('bookingId', sql.Int, positiveInt(body.booking_id))
        .input('bookingRef', sql.NVarChar, cleanText(body.booking_ref, 100))
        .input('billingCustomerId', sql.Int, positiveInt(body.billing_customer_id))
        .input('billingClearanceId', sql.Int, positiveInt(body.billing_clearance_id))
        .input('driverName', sql.NVarChar, cleanText(body.driver_name, 100))
        .input('driverLicense', sql.NVarChar, cleanText(body.driver_license, 50))
        .input('truckPlate', sql.NVarChar, cleanText(body.truck_plate, 20))
        .input('sealNumber', sql.NVarChar, cleanText(body.seal_number, 50))
        .input('notes', sql.NVarChar, cleanText(body.notes, 500))
        .query(`
          UPDATE GateOutRequests
          SET booking_id = COALESCE(@bookingId, booking_id),
              booking_ref = COALESCE(@bookingRef, booking_ref),
              billing_customer_id = COALESCE(@billingCustomerId, billing_customer_id),
              billing_clearance_id = COALESCE(@billingClearanceId, billing_clearance_id),
              driver_name = COALESCE(@driverName, driver_name),
              driver_license = COALESCE(@driverLicense, driver_license),
              truck_plate = COALESCE(@truckPlate, truck_plate),
              seal_number = COALESCE(@sealNumber, seal_number),
              notes = COALESCE(@notes, notes),
              updated_at = GETDATE()
          WHERE request_id = @requestId
        `);
    }

    await logAudit({
      userId: actor.userId,
      yardId: current.yard_id,
      action: `gate_out_request_${action}`,
      entityType: 'gate_out_request',
      entityId: requestId,
      details: { action },
    });

    const refreshed = await fetchGateOutRequests(db, { yardId: current.yard_id, requestId, status: 'all' });
    return NextResponse.json({ success: true, request: refreshed.recordset[0] });
  } catch (error) {
    console.error('❌ PATCH gate out requests error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตงาน Gate Out ได้' }, { status: 500 });
  }
}
