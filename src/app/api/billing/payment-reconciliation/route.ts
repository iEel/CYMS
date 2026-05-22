import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

function cleanText(value: unknown, max = 255) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function parseDate(value: unknown) {
  const text = cleanText(value, 50);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function authorize(request: NextRequest, yardId: number | null) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'billing.payment.receive', 'คุณไม่มีสิทธิ์ทำ Payment Reconciliation');
  if (actor instanceof NextResponse) return { db, actor: null, response: actor };
  if (yardId) {
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return { db, actor: null, response: yardAccess };
  }
  return { db, actor, response: null };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const status = cleanText(searchParams.get('status'), 30);
    const { db, response } = await authorize(request, yardId);
    if (response) return response;

    const req = db.request();
    const filters: string[] = [];
    if (yardId) {
      req.input('yardId', sql.Int, yardId);
      filters.push('pr.yard_id = @yardId');
    }
    if (status && ['pending', 'matched', 'ignored'].includes(status)) {
      req.input('status', sql.NVarChar(30), status);
      filters.push('pr.status = @status');
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const rows = await req.query(`
      SELECT TOP 200
        pr.reconciliation_id, pr.yard_id, pr.statement_ref, pr.paid_at,
        pr.payer_name, pr.amount, pr.invoice_number_hint, pr.status, pr.note,
        pr.invoice_id, i.invoice_number, i.status AS invoice_status,
        c.customer_name, pr.created_at, pr.matched_at
      FROM PaymentReconciliationRows pr
      LEFT JOIN Invoices i ON i.invoice_id = pr.invoice_id
      LEFT JOIN Customers c ON c.customer_id = i.customer_id
      ${where}
      ORDER BY pr.created_at DESC, pr.reconciliation_id DESC
    `);

    const summary = await db.request()
      .input('yardId', sql.Int, yardId || 0)
      .query(`
        SELECT
          COUNT(*) AS total_rows,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
          COUNT(CASE WHEN status = 'matched' THEN 1 END) AS matched_count,
          ISNULL(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_amount,
          ISNULL(SUM(CASE WHEN status = 'matched' THEN amount ELSE 0 END), 0) AS matched_amount
        FROM PaymentReconciliationRows
        WHERE (@yardId = 0 OR yard_id = @yardId)
      `);

    return NextResponse.json({ rows: rows.recordset, summary: summary.recordset[0] || {} });
  } catch (error) {
    console.error('❌ GET payment reconciliation error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด payment reconciliation ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = positiveInt(body.yard_id);
    if (!yardId || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'yard_id และ rows จำเป็นต้องระบุ' }, { status: 400 });
    }

    const { db, actor, response } = await authorize(request, yardId);
    if (response) return response;

    let imported = 0;
    for (const raw of body.rows.slice(0, 200)) {
      const amount = money(raw?.amount);
      const statementRef = cleanText(raw?.statement_ref, 120);
      if (!amount || !statementRef) continue;
      const insert = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('statementRef', sql.NVarChar(120), statementRef)
        .input('paidAt', sql.DateTime2, parseDate(raw?.paid_at))
        .input('payerName', sql.NVarChar(255), cleanText(raw?.payer_name, 255))
        .input('amount', sql.Decimal(12, 2), amount)
        .input('invoiceNumberHint', sql.NVarChar(80), cleanText(raw?.invoice_number, 80))
        .input('sourceFile', sql.NVarChar(255), cleanText(body.source_file, 255))
        .query(`
          INSERT INTO PaymentReconciliationRows (
            yard_id, statement_ref, paid_at, payer_name, amount,
            invoice_number_hint, source_file, status
          )
          OUTPUT INSERTED.*
          VALUES (
            @yardId, @statementRef, @paidAt, @payerName, @amount,
            @invoiceNumberHint, @sourceFile, 'pending'
          )
        `);
      if (insert.recordset[0]) imported += 1;
    }

    await logAudit({
      userId: actor?.userId || null,
      yardId,
      action: 'payment_reconciliation_import',
      entityType: 'payment_reconciliation',
      details: { imported, source_file: cleanText(body.source_file, 255) },
    });

    return NextResponse.json({ success: true, imported });
  } catch (error) {
    console.error('❌ POST payment reconciliation error:', error);
    return NextResponse.json({ error: 'ไม่สามารถนำเข้า Payment Reconciliation ได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const reconciliationId = positiveInt(body.reconciliation_id);
    const action = body.action === 'match' ? 'match' : body.action === 'ignore' ? 'ignore' : null;
    if (!reconciliationId || !action) {
      return NextResponse.json({ error: 'ข้อมูล action ไม่ถูกต้อง' }, { status: 400 });
    }

    const { db, actor, response } = await authorize(request, null);
    if (response) return response;

    const rowResult = await db.request()
      .input('reconciliationId', sql.BigInt, reconciliationId)
      .query(`
        SELECT TOP 1 reconciliation_id, yard_id, amount, status, statement_ref
        FROM PaymentReconciliationRows
        WHERE reconciliation_id = @reconciliationId
      `);
    const row = rowResult.recordset[0];
    if (!row) return NextResponse.json({ error: 'ไม่พบรายการรับเงิน' }, { status: 404 });
    if (row.status !== 'pending') return NextResponse.json({ error: 'รายการนี้ดำเนินการแล้ว' }, { status: 409 });

    const yardAccess = await requireYardAccess(request, db, row.yard_id);
    if (yardAccess instanceof NextResponse) return yardAccess;

    let invoice = null;
    if (action === 'match') {
      const invoiceId = positiveInt(body.invoice_id);
      if (!invoiceId) return NextResponse.json({ error: 'invoice_id จำเป็นสำหรับการ match' }, { status: 400 });
      const invoiceResult = await db.request()
        .input('invoiceId', sql.Int, invoiceId)
        .query(`
          SELECT TOP 1 invoice_id, invoice_number, yard_id, status,
            ISNULL(balance_amount, grand_total) AS balance_amount, grand_total
          FROM Invoices
          WHERE invoice_id = @invoiceId
        `);
      invoice = invoiceResult.recordset[0];
      if (!invoice) return NextResponse.json({ error: 'ไม่พบ invoice' }, { status: 404 });
      if (Number(invoice.yard_id) !== Number(row.yard_id)) {
        return NextResponse.json({ error: 'invoice อยู่คนละ yard' }, { status: 409 });
      }

      await db.request()
        .input('invoiceId', sql.Int, invoiceId)
        .input('invoiceStatus', sql.NVarChar(30), 'paid')
        .input('paidAmount', sql.Decimal(12, 2), row.amount)
        .query(`
          UPDATE Invoices
          SET status = @invoiceStatus,
              paid_at = GETDATE(),
              balance_amount = 0,
              notes = CASE
                WHEN notes IS NULL OR notes = '' THEN CONCAT('[Payment reconciliation] ', @paidAmount)
                ELSE CONCAT(notes, CHAR(10), '[Payment reconciliation] ', @paidAmount)
              END
          OUTPUT INSERTED.invoice_id, INSERTED.invoice_number, INSERTED.status
          WHERE invoice_id = @invoiceId
        `);
    }

    const nextStatus = action === 'match' ? 'matched' : 'ignored';
    const update = await db.request()
      .input('reconciliationId', sql.BigInt, reconciliationId)
      .input('status', sql.NVarChar(30), nextStatus)
      .input('invoiceId', sql.Int, action === 'match' ? positiveInt(body.invoice_id) : null)
      .input('note', sql.NVarChar(1000), cleanText(body.note, 1000))
      .input('actorUserId', sql.Int, actor?.userId || null)
      .query(`
        UPDATE PaymentReconciliationRows
        SET status = @status,
            invoice_id = @invoiceId,
            note = @note,
            matched_by_user_id = @actorUserId,
            matched_at = GETDATE(),
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE reconciliation_id = @reconciliationId
      `);

    await logAudit({
      userId: actor?.userId || null,
      yardId: row.yard_id,
      action: `payment_reconciliation_${action}`,
      entityType: 'payment_reconciliation',
      entityId: reconciliationId,
      details: {
        invoice_id: action === 'match' ? positiveInt(body.invoice_id) : null,
        amount: Number(row.amount || 0),
        statement_ref: row.statement_ref,
        note: cleanText(body.note, 1000),
      },
    });

    return NextResponse.json({ success: true, row: update.recordset[0], invoice });
  } catch (error) {
    console.error('❌ PATCH payment reconciliation error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต Payment Reconciliation ได้' }, { status: 500 });
  }
}
