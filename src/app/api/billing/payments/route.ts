import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { nextDocumentNumber } from '@/lib/documentNumber';
import { requireAnyPermission, requirePermission, requireYardAccess } from '@/lib/apiAuth';

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function positiveMoney(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

function cleanText(value: unknown, max = 255) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function responseFrom(value: unknown): Response | null {
  return value instanceof Response ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const customerId = positiveInt(searchParams.get('customer_id'));
    if (!yardId) return NextResponse.json({ error: 'yard_id จำเป็นต้องระบุ' }, { status: 400 });

    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      ['billing.payment.receive', 'billing.invoice.create', 'reports.view'],
      'คุณไม่มีสิทธิ์ดูข้อมูลรับชำระเงิน'
    );
    const actorResponse = responseFrom(actor);
    if (actorResponse) return actorResponse;
    const yardAccess = await requireYardAccess(request, db, yardId);
    const yardResponse = responseFrom(yardAccess);
    if (yardResponse) return yardResponse;

    const req = db.request().input('yardId', sql.Int, yardId);
    const filters = ['bp.yard_id = @yardId'];
    if (customerId) {
      req.input('customerId', sql.Int, customerId);
      filters.push('bp.customer_id = @customerId');
    }
    const rows = await req.query(`
      SELECT TOP 100 bp.*, c.customer_name,
        COUNT(bpa.allocation_id) AS allocation_count
      FROM BillingPayments bp
      LEFT JOIN Customers c ON c.customer_id = bp.customer_id
      LEFT JOIN BillingPaymentAllocations bpa ON bpa.payment_id = bp.payment_id
      WHERE ${filters.join(' AND ')}
      GROUP BY bp.payment_id, bp.payment_number, bp.receipt_number, bp.yard_id,
        bp.customer_id, bp.amount, bp.payment_method, bp.payment_ref, bp.status,
        bp.received_by_user_id, bp.received_at, bp.notes, bp.created_at, c.customer_name
      ORDER BY bp.created_at DESC, bp.payment_id DESC
    `);
    return NextResponse.json({ payments: rows.recordset });
  } catch (error) {
    console.error('❌ GET billing payments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลรับชำระเงินได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = positiveInt(body.yard_id);
    const amount = positiveMoney(body.amount);
    const allocations = Array.isArray(body.allocations) ? body.allocations : [];
    if (!yardId || !amount || allocations.length === 0) {
      return NextResponse.json({ error: 'yard_id, amount และ allocations จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    const yardResponse = responseFrom(yardAccess);
    if (yardResponse) return yardResponse;
    const actor = await requirePermission(request, db, 'billing.payment.receive', 'คุณไม่มีสิทธิ์รับชำระเงิน');
    const actorResponse = responseFrom(actor);
    if (actorResponse) return actorResponse;

    const invoiceSnapshots = [];
    let allocatedTotal = 0;
    for (const rawAllocation of allocations) {
      const invoiceId = positiveInt(rawAllocation?.invoice_id);
      const allocationAmount = positiveMoney(rawAllocation?.amount);
      if (!invoiceId || !allocationAmount) {
        return NextResponse.json({ error: 'allocation ต้องมี invoice_id และ amount มากกว่า 0' }, { status: 400 });
      }

      const invoiceResult = await db.request()
        .input('invoiceId', sql.Int, invoiceId)
        .query(`
          SELECT TOP 1 invoice_id, invoice_number, yard_id, customer_id,
            status, ISNULL(balance_amount, grand_total) AS balance_amount, grand_total
          FROM Invoices
          WHERE invoice_id = @invoiceId
        `);
      const invoice = invoiceResult.recordset[0];
      if (!invoice) return NextResponse.json({ error: `ไม่พบ invoice #${invoiceId}` }, { status: 404 });
      if (Number(invoice.yard_id) !== yardId) return NextResponse.json({ error: 'invoice อยู่คนละ yard' }, { status: 409 });
      const currentBalance = Number(invoice.balance_amount || invoice.grand_total || 0);
      if (allocationAmount - currentBalance > 0.01) {
        return NextResponse.json({ error: `ยอดรับชำระเกินยอดคงเหลือของ ${invoice.invoice_number}` }, { status: 400 });
      }
      allocatedTotal += allocationAmount;
      invoiceSnapshots.push({ invoice, allocationAmount, currentBalance });
    }

    if (Math.abs(allocatedTotal - amount) > 0.01) {
      return NextResponse.json({ error: 'ยอดรวม allocations ต้องเท่ากับยอดรับชำระ' }, { status: 400 });
    }

    const customerId = positiveInt(body.customer_id) || Number(invoiceSnapshots[0].invoice.customer_id || 0) || null;
    const paymentNumber = await nextDocumentNumber({ db, yardId, documentType: 'billing_payment', prefix: 'PAY' });
    const receiptNumber = await nextDocumentNumber({ db, yardId, documentType: 'receipt', prefix: 'RCPT' });
    const actorUserId = (actor as { userId: number }).userId;

    const paymentResult = await db.request()
      .input('paymentNumber', sql.NVarChar(80), paymentNumber)
      .input('receiptNumber', sql.NVarChar(80), receiptNumber)
      .input('yardId', sql.Int, yardId)
      .input('customerId', sql.Int, customerId)
      .input('amount', sql.Decimal(12, 2), amount)
      .input('paymentMethod', sql.NVarChar(30), cleanText(body.payment_method, 30) || 'transfer')
      .input('paymentRef', sql.NVarChar(120), cleanText(body.payment_ref, 120))
      .input('status', sql.NVarChar(30), 'posted')
      .input('actorUserId', sql.Int, actorUserId)
      .input('notes', sql.NVarChar(1000), cleanText(body.notes, 1000))
      .query(`
        INSERT INTO BillingPayments (
          payment_number, receipt_number, yard_id, customer_id, amount,
          payment_method, payment_ref, status, received_by_user_id,
          received_at, notes
        )
        OUTPUT INSERTED.*
        VALUES (
          @paymentNumber, @receiptNumber, @yardId, @customerId, @amount,
          @paymentMethod, @paymentRef, @status, @actorUserId,
          GETDATE(), @notes
        )
      `);
    const payment = paymentResult.recordset[0];
    const allocationRows = [];

    for (let index = 0; index < invoiceSnapshots.length; index += 1) {
      const { invoice, allocationAmount, currentBalance } = invoiceSnapshots[index];
      const newBalance = Number(Math.max(currentBalance - allocationAmount, 0).toFixed(2));
      const nextStatus = newBalance <= 0.01 ? 'paid' : invoice.status === 'overdue' ? 'overdue' : 'issued';
      const allocationResult = await db.request()
        .input('paymentId', sql.Int, payment.payment_id)
        .input('invoiceId', sql.Int, invoice.invoice_id)
        .input('allocatedAmount', sql.Decimal(12, 2), allocationAmount)
        .input(`newBalance${index}`, sql.Decimal(12, 2), newBalance)
        .input(`nextStatus${index}`, sql.NVarChar(30), nextStatus)
        .query(`
          INSERT INTO BillingPaymentAllocations (payment_id, invoice_id, allocated_amount, balance_after)
          OUTPUT INSERTED.*
          VALUES (@paymentId, @invoiceId, @allocatedAmount, @newBalance${index})
        `);
      await db.request()
        .input('invoiceId', sql.Int, invoice.invoice_id)
        .input(`newBalance${index}`, sql.Decimal(12, 2), newBalance)
        .input(`nextStatus${index}`, sql.NVarChar(30), nextStatus)
        .input('receiptNumber', sql.NVarChar(80), nextStatus === 'paid' ? receiptNumber : null)
        .query(`
          UPDATE Invoices
          SET balance_amount = @newBalance${index},
              status = @nextStatus${index},
              paid_at = CASE WHEN @nextStatus${index} = 'paid' THEN GETDATE() ELSE paid_at END,
              receipt_number = CASE WHEN @nextStatus${index} = 'paid' THEN @receiptNumber ELSE receipt_number END
          OUTPUT INSERTED.invoice_id, INSERTED.status, INSERTED.balance_amount
          WHERE invoice_id = @invoiceId
        `);
      allocationRows.push({ ...allocationResult.recordset[0], invoice_id: invoice.invoice_id, balance_after: newBalance });
    }

    await logAudit({
      userId: actorUserId,
      yardId,
      action: 'billing_payment_allocate',
      entityType: 'billing_payment',
      entityId: payment.payment_id,
      details: { payment_number: paymentNumber, receipt_number: receiptNumber, amount, allocation_count: allocationRows.length },
    });

    return NextResponse.json({ success: true, payment, allocations: allocationRows });
  } catch (error) {
    console.error('❌ POST billing payment error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกรับชำระเงินได้' }, { status: 500 });
  }
}
