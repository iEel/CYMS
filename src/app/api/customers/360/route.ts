import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { ensureCustomerCreditColumns, getCustomerCreditSnapshot } from '@/lib/customerCredit';

async function ensureCustomer360Columns(db: Awaited<ReturnType<typeof getDb>>) {
  await ensureCustomerCreditColumns(db);
  await db.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CustomerBranches')
    BEGIN
      CREATE TABLE CustomerBranches (
        branch_id INT PRIMARY KEY IDENTITY(1,1),
        customer_id INT NOT NULL REFERENCES Customers(customer_id),
        branch_code VARCHAR(10) NOT NULL DEFAULT '00000',
        branch_name NVARCHAR(200) NULL,
        billing_address NVARCHAR(MAX) NULL,
        contact_name NVARCHAR(100) NULL,
        contact_phone NVARCHAR(50) NULL,
        contact_email NVARCHAR(100) NULL,
        is_default BIT DEFAULT 0,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE()
      );
    END;
    IF COL_LENGTH('Containers', 'customer_id') IS NULL
      ALTER TABLE Containers ADD customer_id INT NULL;
    IF COL_LENGTH('GateTransactions', 'billing_customer_id') IS NULL
      ALTER TABLE GateTransactions ADD billing_customer_id INT NULL;
    IF COL_LENGTH('GateTransactions', 'container_owner_id') IS NULL
      ALTER TABLE GateTransactions ADD container_owner_id INT NULL;
    IF COL_LENGTH('RepairOrders', 'customer_id') IS NULL
      ALTER TABLE RepairOrders ADD customer_id INT NULL;
    IF COL_LENGTH('RepairOrders', 'billing_customer_id') IS NULL
      ALTER TABLE RepairOrders ADD billing_customer_id INT NULL;
  `);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = Number(searchParams.get('customer_id'));
    const yardId = searchParams.get('yard_id') ? Number(searchParams.get('yard_id')) : null;

    if (!customerId) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 });
    }

    const db = await getDb();
    await ensureCustomer360Columns(db);

    const customerResult = await db.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        SELECT TOP 1 customer_id, customer_code, customer_name, tax_id, address,
          billing_address, contact_name, contact_phone, contact_email,
          ISNULL(default_payment_type, 'CASH') as default_payment_type,
          ISNULL(credit_term, 0) as credit_term,
          ISNULL(credit_limit, 0) as credit_limit,
          ISNULL(credit_hold, 0) as credit_hold,
          credit_hold_reason,
          ISNULL(is_line, 0) as is_line, ISNULL(is_forwarder, 0) as is_forwarder,
          ISNULL(is_trucking, 0) as is_trucking, ISNULL(is_shipper, 0) as is_shipper,
          ISNULL(is_consignee, 0) as is_consignee
        FROM Customers
        WHERE customer_id = @customerId
      `);

    if (!customerResult.recordset.length) {
      return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
    }

    const [
      branchesResult,
      creditSnapshot,
      containerStatusResult,
      invoiceSummaryResult,
      invoiceRecentResult,
      bookingResult,
      gateResult,
      repairResult,
      prefixResult,
    ] = await Promise.all([
      db.request().input('customerId', sql.Int, customerId).query(`
        SELECT branch_id, branch_code, branch_name, billing_address, contact_name,
          contact_phone, contact_email, is_default, is_active
        FROM CustomerBranches
        WHERE customer_id = @customerId
        ORDER BY is_default DESC, branch_code
      `),
      getCustomerCreditSnapshot(db, customerId, yardId),
      db.request().input('customerId', sql.Int, customerId).input('yardId', sql.Int, yardId).query(`
        SELECT c.status, COUNT(*) as count
        FROM Containers c
        WHERE (@yardId IS NULL OR c.yard_id = @yardId)
          AND (c.container_owner_id = @customerId OR c.customer_id = @customerId)
        GROUP BY c.status
        ORDER BY c.status
      `),
      db.request().input('customerId', sql.Int, customerId).input('yardId', sql.Int, yardId).query(`
        SELECT
          COUNT(*) as invoice_count,
          SUM(CASE WHEN status IN ('issued', 'overdue') THEN ISNULL(balance_amount, grand_total) ELSE 0 END) as outstanding_amount,
          SUM(CASE WHEN status = 'paid' THEN grand_total ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status = 'draft' THEN grand_total ELSE 0 END) as draft_amount,
          SUM(CASE WHEN status = 'credit_note' THEN grand_total ELSE 0 END) as credit_note_amount
        FROM Invoices
        WHERE customer_id = @customerId
          AND (@yardId IS NULL OR yard_id = @yardId)
      `),
      db.request().input('customerId', sql.Int, customerId).input('yardId', sql.Int, yardId).query(`
        SELECT TOP 10 invoice_id, invoice_number, status, grand_total, balance_amount, due_date, created_at
        FROM Invoices
        WHERE customer_id = @customerId
          AND (@yardId IS NULL OR yard_id = @yardId)
        ORDER BY created_at DESC, invoice_id DESC
      `),
      db.request().input('customerId', sql.Int, customerId).input('yardId', sql.Int, yardId).query(`
        SELECT TOP 10 booking_id, booking_number, status, total_containers, received_count, released_count, created_at
        FROM Bookings
        WHERE customer_id = @customerId
          AND (@yardId IS NULL OR yard_id = @yardId)
        ORDER BY created_at DESC, booking_id DESC
      `),
      db.request().input('customerId', sql.Int, customerId).input('yardId', sql.Int, yardId).query(`
        SELECT TOP 10 g.transaction_id, g.eir_number, g.transaction_type, g.container_number,
          g.booking_ref, g.created_at
        FROM GateTransactions g
        WHERE (@yardId IS NULL OR g.yard_id = @yardId)
          AND (g.container_owner_id = @customerId OR g.billing_customer_id = @customerId)
        ORDER BY g.created_at DESC, g.transaction_id DESC
      `),
      db.request().input('customerId', sql.Int, customerId).input('yardId', sql.Int, yardId).query(`
        SELECT TOP 10 ro.repair_order_id, ro.eor_number, ro.status, ro.estimated_cost,
          ro.actual_cost, ro.created_at, c.container_number
        FROM RepairOrders ro
        LEFT JOIN Containers c ON ro.container_id = c.container_id
        WHERE (@yardId IS NULL OR ro.yard_id = @yardId)
          AND (ro.customer_id = @customerId OR ro.billing_customer_id = @customerId)
        ORDER BY ro.created_at DESC, ro.repair_order_id DESC
      `),
      db.request().input('customerId', sql.Int, customerId).query(`
        SELECT prefix_code, shipping_line_code, is_primary, is_active, created_at
        FROM PrefixMapping
        WHERE customer_id = @customerId
        ORDER BY is_primary DESC, prefix_code
      `),
    ]);

    return NextResponse.json({
      customer: customerResult.recordset[0],
      branches: branchesResult.recordset,
      credit: creditSnapshot,
      containers_by_status: containerStatusResult.recordset,
      invoices: {
        summary: invoiceSummaryResult.recordset[0] || {},
        recent: invoiceRecentResult.recordset,
      },
      bookings: bookingResult.recordset,
      gate_transactions: gateResult.recordset,
      repair_orders: repairResult.recordset,
      prefixes: prefixResult.recordset,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ GET customer 360 error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง Customer 360 ได้' }, { status: 500 });
  }
}
