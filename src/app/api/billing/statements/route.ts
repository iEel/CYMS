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

function cleanText(value: unknown, max = 255) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 40);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function responseFrom(value: unknown): Response | null {
  return value instanceof Response ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const statementId = positiveInt(searchParams.get('statement_id'));
    const customerId = positiveInt(searchParams.get('customer_id'));
    if (!yardId) return NextResponse.json({ error: 'yard_id จำเป็นต้องระบุ' }, { status: 400 });

    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      ['billing.invoice.create', 'billing.payment.receive', 'reports.view'],
      'คุณไม่มีสิทธิ์ดูเอกสารวางบิล'
    );
    const actorResponse = responseFrom(actor);
    if (actorResponse) return actorResponse;
    const yardAccess = await requireYardAccess(request, db, yardId);
    const yardResponse = responseFrom(yardAccess);
    if (yardResponse) return yardResponse;

    if (statementId) {
      const statementResult = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('statementId', sql.Int, statementId)
        .query(`
          SELECT TOP 1 bs.*, c.customer_name, c.tax_id AS customer_tax_id,
            c.billing_address, c.address AS customer_address, y.yard_name, y.yard_code
          FROM BillingStatements bs
          LEFT JOIN Customers c ON c.customer_id = bs.customer_id
          LEFT JOIN Yards y ON y.yard_id = bs.yard_id
          WHERE bs.yard_id = @yardId AND bs.statement_id = @statementId
        `);
      const statement = statementResult.recordset[0];
      if (!statement) return NextResponse.json({ error: 'ไม่พบเอกสารวางบิล' }, { status: 404 });

      const linesResult = await db.request()
        .input('statementId', sql.Int, statementId)
        .query(`
          SELECT bsl.*, i.invoice_number, i.description, i.charge_type,
            i.due_date, i.created_at, ct.container_number
          FROM BillingStatementLines bsl
          LEFT JOIN Invoices i ON i.invoice_id = bsl.invoice_id
          LEFT JOIN Containers ct ON ct.container_id = i.container_id
          WHERE bsl.statement_id = @statementId
          ORDER BY bsl.line_id ASC
        `);
      return NextResponse.json({ statement, lines: linesResult.recordset });
    }

    const req = db.request().input('yardId', sql.Int, yardId);
    const conditions = ['bs.yard_id = @yardId'];
    if (customerId) {
      req.input('customerId', sql.Int, customerId);
      conditions.push('bs.customer_id = @customerId');
    }

    const list = await req.query(`
      SELECT TOP 100 bs.*, c.customer_name,
        COUNT(bsl.line_id) AS line_count
      FROM BillingStatements bs
      LEFT JOIN Customers c ON c.customer_id = bs.customer_id
      LEFT JOIN BillingStatementLines bsl ON bsl.statement_id = bs.statement_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY bs.statement_id, bs.statement_number, bs.yard_id, bs.customer_id,
        bs.period_from, bs.period_to, bs.due_date, bs.total_amount, bs.vat_amount,
        bs.grand_total, bs.status, bs.notes, bs.issued_by_user_id, bs.issued_at,
        bs.created_at, bs.updated_at, c.customer_name
      ORDER BY bs.created_at DESC, bs.statement_id DESC
    `);

    return NextResponse.json({ statements: list.recordset });
  } catch (error) {
    console.error('❌ GET billing statements error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดเอกสารวางบิลได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = positiveInt(body.yard_id);
    const customerId = positiveInt(body.customer_id);
    if (!yardId || !customerId) {
      return NextResponse.json({ error: 'yard_id และ customer_id จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    const yardResponse = responseFrom(yardAccess);
    if (yardResponse) return yardResponse;
    const actor = await requirePermission(request, db, 'billing.invoice.create', 'คุณไม่มีสิทธิ์ออกเอกสารวางบิล');
    const actorResponse = responseFrom(actor);
    if (actorResponse) return actorResponse;

    const invoiceIds = Array.isArray(body.invoice_ids)
      ? body.invoice_ids.map((id: unknown) => positiveInt(id)).filter((id: number | null): id is number => Boolean(id))
      : [];
    const invoiceReq = db.request()
      .input('yardId', sql.Int, yardId)
      .input('customerId', sql.Int, customerId)
      .input('periodFrom', sql.DateTime2, cleanDate(body.period_from))
      .input('periodTo', sql.DateTime2, cleanDate(body.period_to));
    const invoiceFilters = [
      'i.yard_id = @yardId',
      'i.customer_id = @customerId',
      "i.status IN ('issued', 'overdue')",
      'ISNULL(i.balance_amount, i.grand_total) > 0',
      `NOT EXISTS (
        SELECT 1
        FROM BillingStatementLines bsl
        INNER JOIN BillingStatements bs ON bs.statement_id = bsl.statement_id
        WHERE bsl.invoice_id = i.invoice_id
          AND bs.status <> 'cancelled'
      )`,
    ];
    if (body.period_from) invoiceFilters.push('i.created_at >= @periodFrom');
    if (body.period_to) invoiceFilters.push('i.created_at < DATEADD(DAY, 1, @periodTo)');
    if (invoiceIds.length > 0) {
      const params = invoiceIds.map((id: number, index: number) => {
        const name = `invoiceId${index}`;
        invoiceReq.input(name, sql.Int, id);
        return `@${name}`;
      });
      invoiceFilters.push(`i.invoice_id IN (${params.join(', ')})`);
    }

    const invoiceResult = await invoiceReq.query(`
      SELECT i.invoice_id, i.invoice_number, i.yard_id, i.customer_id, i.total_amount,
        i.vat_amount, i.grand_total, ISNULL(i.balance_amount, i.grand_total) AS line_total
      FROM Invoices i
      WHERE ${invoiceFilters.join(' AND ')}
      ORDER BY i.created_at ASC, i.invoice_id ASC
    `);
    const invoices = invoiceResult.recordset;
    if (invoices.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ invoice ค้างชำระที่ยังไม่ถูกวางบิล' }, { status: 400 });
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const vatAmount = invoices.reduce((sum, inv) => sum + Number(inv.vat_amount || 0), 0);
    const grandTotal = invoices.reduce((sum, inv) => sum + Number(inv.line_total || inv.grand_total || 0), 0);
    const statementNumber = await nextDocumentNumber({
      db,
      yardId,
      documentType: 'billing_statement',
      prefix: 'STMT',
    });

    const statementResult = await db.request()
      .input('statementNumber', sql.NVarChar(80), statementNumber)
      .input('yardId', sql.Int, yardId)
      .input('customerId', sql.Int, customerId)
      .input('periodFrom', sql.DateTime2, cleanDate(body.period_from))
      .input('periodTo', sql.DateTime2, cleanDate(body.period_to))
      .input('dueDate', sql.DateTime2, cleanDate(body.due_date))
      .input('totalAmount', sql.Decimal(12, 2), totalAmount)
      .input('vatAmount', sql.Decimal(12, 2), vatAmount)
      .input('grandTotal', sql.Decimal(12, 2), grandTotal)
      .input('status', sql.NVarChar(30), 'issued')
      .input('notes', sql.NVarChar(1000), cleanText(body.notes, 1000))
      .input('actorUserId', sql.Int, (actor as { userId: number }).userId)
      .query(`
        INSERT INTO BillingStatements (
          statement_number, yard_id, customer_id, period_from, period_to,
          due_date, total_amount, vat_amount, grand_total, status, notes,
          issued_by_user_id, issued_at
        )
        OUTPUT INSERTED.*
        VALUES (
          @statementNumber, @yardId, @customerId, @periodFrom, @periodTo,
          @dueDate, @totalAmount, @vatAmount, @grandTotal, @status, @notes,
          @actorUserId, GETDATE()
        )
      `);
    const statement = statementResult.recordset[0];

    const lines = [];
    for (let index = 0; index < invoices.length; index += 1) {
      const invoice = invoices[index];
      const line = await db.request()
        .input('statementId', sql.Int, statement.statement_id)
        .input('invoiceId', sql.Int, invoice.invoice_id)
        .input('lineNumber', sql.Int, index + 1)
        .input('lineTotal', sql.Decimal(12, 2), Number(invoice.line_total || invoice.grand_total || 0))
        .query(`
          INSERT INTO BillingStatementLines (statement_id, invoice_id, line_number, line_total)
          OUTPUT INSERTED.*
          VALUES (@statementId, @invoiceId, @lineNumber, @lineTotal)
        `);
      lines.push({ ...line.recordset[0], ...invoice });
    }

    await logAudit({
      userId: (actor as { userId: number }).userId,
      yardId,
      action: 'billing_statement_issue',
      entityType: 'billing_statement',
      entityId: statement.statement_id,
      details: { statement_number: statementNumber, customer_id: customerId, invoice_count: lines.length, grand_total: grandTotal },
    });

    return NextResponse.json({ success: true, statement, lines });
  } catch (error) {
    console.error('❌ POST billing statement error:', error);
    return NextResponse.json({ error: 'ไม่สามารถออกเอกสารวางบิลได้' }, { status: 500 });
  }
}
