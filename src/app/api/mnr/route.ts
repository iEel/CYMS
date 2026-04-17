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
  billing_customer_id: z.number().int().positive().optional().nullable(),
  damage_details: z.any().optional(),
  estimated_cost: z.number().min(0).optional().default(0),
  repair_photos: z.array(z.string()).optional().default([]),
  repair_photo_evidence: z.record(z.string(), z.array(z.string())).optional().default({}),
  source_eir_number: z.string().max(80).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  user_id: z.number().int().positive().optional().nullable(),
});

const updateEORSchema = z.object({
  eor_id: z.number().int().positive(),
  action: z.enum(['submit', 'approve', 'customer_approve', 'start_repair', 'complete', 'reject']),
  actual_cost: z.number().min(0).optional(),
  user_id: z.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  customer_approved_by: z.string().max(200).optional().nullable(),
  customer_approved_at: z.string().optional().nullable(),
  customer_approval_channel: z.string().max(50).optional().nullable(),
  customer_approval_reference: z.string().max(200).optional().nullable(),
  completion_grade: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
  completion_status: z.string().max(30).optional().default('in_yard'),
  release_repair_hold: z.boolean().optional().default(true),
  repair_inspected_by: z.string().max(200).optional().nullable(),
});

async function ensureMnrColumns(db: sql.ConnectionPool) {
  if (process.env.NODE_ENV === 'test') return;
  await db.request().query(`
    IF COL_LENGTH('RepairOrders', 'customer_id') IS NULL
      ALTER TABLE RepairOrders ADD customer_id INT NULL;
    IF COL_LENGTH('RepairOrders', 'source_eir_number') IS NULL
      ALTER TABLE RepairOrders ADD source_eir_number NVARCHAR(80) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_photos') IS NULL
      ALTER TABLE RepairOrders ADD repair_photos NVARCHAR(MAX) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_photo_evidence') IS NULL
      ALTER TABLE RepairOrders ADD repair_photo_evidence NVARCHAR(MAX) NULL;
    IF COL_LENGTH('RepairOrders', 'invoice_id') IS NULL
      ALTER TABLE RepairOrders ADD invoice_id INT NULL;
    IF COL_LENGTH('RepairOrders', 'billing_customer_id') IS NULL
      ALTER TABLE RepairOrders ADD billing_customer_id INT NULL;
    IF COL_LENGTH('RepairOrders', 'completed_at') IS NULL
      ALTER TABLE RepairOrders ADD completed_at DATETIME2 NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approved_by') IS NULL
      ALTER TABLE RepairOrders ADD customer_approved_by NVARCHAR(200) NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approved_at') IS NULL
      ALTER TABLE RepairOrders ADD customer_approved_at DATETIME2 NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approval_channel') IS NULL
      ALTER TABLE RepairOrders ADD customer_approval_channel NVARCHAR(50) NULL;
    IF COL_LENGTH('RepairOrders', 'customer_approval_reference') IS NULL
      ALTER TABLE RepairOrders ADD customer_approval_reference NVARCHAR(200) NULL;
    IF COL_LENGTH('RepairOrders', 'completion_grade') IS NULL
      ALTER TABLE RepairOrders ADD completion_grade NVARCHAR(1) NULL;
    IF COL_LENGTH('RepairOrders', 'completion_status') IS NULL
      ALTER TABLE RepairOrders ADD completion_status NVARCHAR(30) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_inspected_by') IS NULL
      ALTER TABLE RepairOrders ADD repair_inspected_by NVARCHAR(200) NULL;
    IF COL_LENGTH('RepairOrders', 'repair_inspected_at') IS NULL
      ALTER TABLE RepairOrders ADD repair_inspected_at DATETIME2 NULL;
    IF COL_LENGTH('Containers', 'customer_id') IS NULL
      ALTER TABLE Containers ADD customer_id INT NULL;
  `);
}

async function ensureInvoiceDocumentColumns(db: sql.ConnectionPool) {
  if (process.env.NODE_ENV === 'test') return;
  await db.request().query(`
    IF COL_LENGTH('Invoices', 'ref_invoice_id') IS NULL
      ALTER TABLE Invoices ADD ref_invoice_id INT NULL;
    IF COL_LENGTH('Invoices', 'replaces_invoice_id') IS NULL
      ALTER TABLE Invoices ADD replaces_invoice_id INT NULL;
    IF COL_LENGTH('Invoices', 'document_type') IS NULL
      ALTER TABLE Invoices ADD document_type NVARCHAR(30) NULL;
    IF COL_LENGTH('Invoices', 'balance_amount') IS NULL
      ALTER TABLE Invoices ADD balance_amount DECIMAL(12,2) NULL;
  `);
}

function parseDamageDetails(value: unknown) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

async function createMnrInvoiceIfNeeded({
  db,
  order,
  actualCost,
  userId,
}: {
  db: sql.ConnectionPool;
  order: Record<string, unknown>;
  actualCost: number;
  userId?: number | null;
}) {
  if (actualCost <= 0 || order.invoice_id) return null;
  const customerId = Number(order.billing_customer_id || order.customer_id || order.container_customer_id || 0);
  if (!customerId) return null;

  await ensureInvoiceDocumentColumns(db);
  const countResult = await db.request()
    .input('yardId', sql.Int, Number(order.yard_id))
    .query('SELECT COUNT(*) as cnt FROM Invoices WHERE yard_id = @yardId AND invoice_number LIKE \'INV-%\'');
  const invNumber = `INV-${new Date().getFullYear()}-${String(countResult.recordset[0].cnt + 1).padStart(6, '0')}`;
  const totalAmount = actualCost;
  const vatAmount = totalAmount * 0.07;
  const grandTotal = totalAmount + vatAmount;
  const notes = JSON.stringify({
    document_type: 'invoice',
    source: 'mnr',
    eor_id: order.eor_id,
    eor_number: order.eor_number,
    source_eir_number: order.source_eir_number || null,
    billing_customer_id: customerId,
  });

  const invoiceResult = await db.request()
    .input('invNumber', sql.NVarChar, invNumber)
    .input('yardId', sql.Int, Number(order.yard_id))
    .input('customerId', sql.Int, customerId)
    .input('containerId', sql.Int, Number(order.container_id))
    .input('chargeType', sql.NVarChar, 'mnr')
    .input('description', sql.NVarChar, `ค่าซ่อม M&R ตาม EOR ${order.eor_number}`)
    .input('quantity', sql.Decimal(10, 2), 1)
    .input('unitPrice', sql.Decimal(12, 2), totalAmount)
    .input('totalAmount', sql.Decimal(12, 2), totalAmount)
    .input('vatAmount', sql.Decimal(12, 2), vatAmount)
    .input('grandTotal', sql.Decimal(12, 2), grandTotal)
    .input('notes', sql.NVarChar, notes)
    .input('documentType', sql.NVarChar, 'invoice')
    .input('balanceAmount', sql.Decimal(12, 2), grandTotal)
    .query(`
      INSERT INTO Invoices (invoice_number, yard_id, customer_id, container_id,
        charge_type, description, quantity, unit_price, total_amount, vat_amount,
        grand_total, status, notes, document_type, balance_amount)
      OUTPUT INSERTED.*
      VALUES (@invNumber, @yardId, @customerId, @containerId,
        @chargeType, @description, @quantity, @unitPrice, @totalAmount, @vatAmount,
        @grandTotal, 'issued', @notes, @documentType, @balanceAmount)
    `);

  const invoice = invoiceResult.recordset[0];
  await db.request()
    .input('eorId', sql.Int, Number(order.eor_id))
    .input('invoiceId', sql.Int, invoice.invoice_id)
    .query('UPDATE RepairOrders SET invoice_id = @invoiceId WHERE eor_id = @eorId');

  await logAudit({
    yardId: Number(order.yard_id),
    userId: userId || undefined,
    action: 'invoice_create',
    entityType: 'invoice',
    entityId: invoice.invoice_id,
    details: { invoice_number: invNumber, source: 'mnr', eor_number: order.eor_number, total_amount: totalAmount, grand_total: grandTotal },
  });

  return invoice;
}

// GET — ดึง Repair Orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const status = searchParams.get('status');

    const db = await getDb();
    await ensureMnrColumns(db);
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) { conditions.push('r.yard_id = @yardId'); req.input('yardId', sql.Int, parseInt(yardId)); }
    if (status) { conditions.push('r.status = @status'); req.input('status', sql.NVarChar, status); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT r.*, c.container_number, c.size, c.type,
        c.container_grade, c.hold_status,
        cu.customer_name, bill.customer_name as billing_customer_name,
        inv.invoice_number, u.full_name as created_name
      FROM RepairOrders r
      LEFT JOIN Containers c ON r.container_id = c.container_id
      LEFT JOIN Customers cu ON ISNULL(r.customer_id, c.customer_id) = cu.customer_id
      LEFT JOIN Customers bill ON ISNULL(r.billing_customer_id, ISNULL(r.customer_id, c.customer_id)) = bill.customer_id
      LEFT JOIN Invoices inv ON r.invoice_id = inv.invoice_id
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
    await ensureMnrColumns(db);

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
      .input('billingCustomerId', sql.Int, body.billing_customer_id || body.customer_id || null)
      .input('damageDetails', sql.NVarChar, body.damage_details ? JSON.stringify(body.damage_details) : null)
      .input('estimatedCost', sql.Decimal(12, 2), body.estimated_cost || 0)
      .input('repairPhotos', sql.NVarChar, body.repair_photos.length ? JSON.stringify(body.repair_photos) : null)
      .input('repairPhotoEvidence', sql.NVarChar, Object.keys(body.repair_photo_evidence).length ? JSON.stringify(body.repair_photo_evidence) : null)
      .input('sourceEirNumber', sql.NVarChar, body.source_eir_number || null)
      .input('notes', sql.NVarChar, body.notes || null)
      .input('createdBy', sql.Int, body.user_id || null)
      .query(`
        INSERT INTO RepairOrders (eor_number, container_id, yard_id, customer_id, billing_customer_id,
          damage_details, estimated_cost, repair_photos, repair_photo_evidence, source_eir_number, notes, created_by)
        OUTPUT INSERTED.*
        VALUES (@eorNumber, @containerId, @yardId, @customerId, @billingCustomerId,
          @damageDetails, @estimatedCost, @repairPhotos, @repairPhotoEvidence, @sourceEirNumber, @notes, @createdBy)
      `);

    // Update container status
    await db.request()
      .input('cid', sql.Int, body.container_id)
      .query("UPDATE Containers SET status = 'repair', updated_at = GETDATE() WHERE container_id = @cid");

    // Audit trail
    await logAudit({
      yardId: body.yard_id,
      userId: body.user_id || undefined,
      action: 'eor_create',
      entityType: 'repair_order',
      entityId: result.recordset[0].eor_id,
      details: {
        eor_number: eorNumber,
        container_id: body.container_id,
        estimated_cost: body.estimated_cost,
        source_eir_number: body.source_eir_number,
        billing_customer_id: body.billing_customer_id || body.customer_id || null,
      },
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
    const {
      eor_id,
      action,
      actual_cost,
      user_id,
      customer_approved_by,
      customer_approved_at,
      customer_approval_channel,
      customer_approval_reference,
      completion_grade,
      completion_status,
      release_repair_hold,
      repair_inspected_by,
      notes,
    } = parsed.data;

    const db = await getDb();
    await ensureMnrColumns(db);

    // Get order info for audit + container status
    const orderInfo = await db.request()
      .input('eid', sql.Int, eor_id)
      .query(`
        SELECT r.*, c.customer_id as container_customer_id
        FROM RepairOrders r
        LEFT JOIN Containers c ON r.container_id = c.container_id
        WHERE r.eor_id = @eid
      `);
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
      case 'customer_approve':
        req.input('customerApprovedBy', sql.NVarChar, customer_approved_by || null)
          .input('customerApprovedAt', sql.DateTime2, customer_approved_at ? new Date(customer_approved_at) : new Date())
          .input('customerApprovalChannel', sql.NVarChar, customer_approval_channel || null)
          .input('customerApprovalReference', sql.NVarChar, customer_approval_reference || null)
          .input('notes', sql.NVarChar, notes || null);
        await req.query(`
          UPDATE RepairOrders SET
            status = 'approved',
            approved_at = ISNULL(approved_at, GETDATE()),
            customer_approved_by = @customerApprovedBy,
            customer_approved_at = @customerApprovedAt,
            customer_approval_channel = @customerApprovalChannel,
            customer_approval_reference = @customerApprovalReference,
            notes = COALESCE(@notes, notes)
          WHERE eor_id = @eorId
        `);
        break;
      case 'start_repair':
        await req.query("UPDATE RepairOrders SET status = 'in_repair' WHERE eor_id = @eorId");
        break;
      case 'complete':
        req.input('actualCost', sql.Decimal(12, 2), actual_cost || 0)
          .input('completionGrade', sql.NVarChar, completion_grade || null)
          .input('completionStatus', sql.NVarChar, completion_status || 'in_yard')
          .input('repairInspectedBy', sql.NVarChar, repair_inspected_by || null);
        await req.query(`
          UPDATE RepairOrders SET
            status = 'completed',
            actual_cost = @actualCost,
            completed_at = GETDATE(),
            completion_grade = @completionGrade,
            completion_status = @completionStatus,
            repair_inspected_by = @repairInspectedBy,
            repair_inspected_at = GETDATE()
          WHERE eor_id = @eorId
        `);
        await db.request()
          .input('cid', sql.Int, order.container_id)
          .input('completionStatus', sql.NVarChar, completion_status || 'in_yard')
          .input('completionGrade', sql.NVarChar, completion_grade || null)
          .query(`
            UPDATE Containers SET
              status = @completionStatus,
              container_grade = COALESCE(@completionGrade, container_grade),
              hold_status = CASE WHEN ${release_repair_hold ? '1' : '0'} = 1 AND hold_status IN ('repair_hold', 'mnr_hold') THEN NULL ELSE hold_status END,
              updated_at = GETDATE()
            WHERE container_id = @cid
          `);
        await createMnrInvoiceIfNeeded({ db, order, actualCost: actual_cost || 0, userId: user_id });
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
        ...(action === 'customer_approve' ? { customer_approved_by, customer_approval_channel, customer_approval_reference } : {}),
        ...(action === 'complete' ? { actual_cost, completion_grade, completion_status, release_repair_hold, repair_inspected_by } : {}),
      },
    });

    return NextResponse.json({ success: true, damage_details: parseDamageDetails(order.damage_details) });
  } catch (error) {
    console.error('❌ PUT mnr error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}
