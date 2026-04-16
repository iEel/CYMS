import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { writeIntegrationLog } from '@/lib/integrationLog';

// GET — Customer Portal Overview
export async function GET(request: NextRequest) {
  try {
    const customerId = request.headers.get('x-customer-id');
    if (!customerId) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 403 });
    }

    const db = await getDb();
    const cid = parseInt(customerId);

    // Customer info
    const custResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`SELECT customer_name, contact_email, ISNULL(is_line,0) as is_line, ISNULL(is_forwarder,0) as is_forwarder, ISNULL(is_trucking,0) as is_trucking FROM Customers WHERE customer_id = @cid`);
    const customer = custResult.recordset[0] || {};

    // Containers in yard
    const contResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN status = 'in_yard' THEN 1 ELSE 0 END) as in_yard,
          SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released
        FROM Containers WHERE customer_id = @cid
      `);
    const containers = contResult.recordset[0] || { total: 0, in_yard: 0, released: 0 };

    // Outstanding invoices
    const invResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT COUNT(*) as count, ISNULL(SUM(grand_total), 0) as total
        FROM Invoices WHERE customer_id = @cid AND status = 'issued'
      `);
    const outstanding = invResult.recordset[0] || { count: 0, total: 0 };

    // Active bookings
    const bkResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT COUNT(*) as count
        FROM Bookings WHERE customer_id = @cid AND status IN ('pending', 'confirmed')
      `);
    const activeBookings = bkResult.recordset[0]?.count || 0;

    // Recent gate activity (last 10)
    const gateResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT TOP 10 g.transaction_type, g.eir_number, g.created_at,
          c.container_number, c.size, c.type
        FROM GateTransactions g
        JOIN Containers c ON g.container_id = c.container_id
        WHERE c.customer_id = @cid
        ORDER BY g.created_at DESC
      `);

    await writeIntegrationLog({
      system: 'PORTAL',
      direction: 'inbound',
      messageType: 'CUSTOMER_OVERVIEW',
      destination: 'customer_portal',
      endpointName: 'Portal Overview',
      referenceType: 'customer',
      referenceId: cid,
      referenceNumber: customer.customer_name || String(cid),
      payloadSummary: {
        containers: containers.total || 0,
        outstanding_count: outstanding.count || 0,
        active_bookings: activeBookings || 0,
      },
      status: 'success',
      recordCount: 1,
    });

    return NextResponse.json({
      customer,
      containers,
      outstanding,
      activeBookings,
      recentGate: gateResult.recordset,
    });
  } catch (error) {
    console.error('❌ Portal overview error:', error);
    try {
      await writeIntegrationLog({
        system: 'PORTAL',
        direction: 'inbound',
        messageType: 'CUSTOMER_OVERVIEW',
        destination: 'customer_portal',
        endpointName: 'Portal Overview',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } catch { /* ignore */ }
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}
