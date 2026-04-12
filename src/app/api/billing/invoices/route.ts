import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

type DbPool = Awaited<ReturnType<typeof getDb>>;

async function ensureInvoiceDocumentColumns(db: DbPool) {
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

function normalizePositiveAmount(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// GET — ดึง Invoices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const invoiceId = searchParams.get('invoice_id');

    const db = await getDb();
    await ensureInvoiceDocumentColumns(db);
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) { conditions.push('i.yard_id = @yardId'); req.input('yardId', sql.Int, parseInt(yardId)); }
    if (status) { conditions.push('i.status = @status'); req.input('status', sql.NVarChar, status); }
    if (customerId) { conditions.push('i.customer_id = @customerId'); req.input('customerId', sql.Int, parseInt(customerId)); }
    if (invoiceId) { conditions.push('i.invoice_id = @invoiceId'); req.input('invoiceId', sql.Int, parseInt(invoiceId)); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT i.*, ref.invoice_number as ref_invoice_number,
             repl.invoice_number as replaces_invoice_number,
             c.customer_name, c.tax_id as customer_tax_id,
             c.address as customer_address,
             ISNULL(c.branch_type, 'head_office') as customer_branch_type,
             ISNULL(c.branch_number, '00000') as customer_branch_number,
             ct.container_number, ct.status as container_status,
             y.yard_name, y.yard_code,
             ISNULL(y.branch_type, 'head_office') as yard_branch_type,
             ISNULL(y.branch_number, '00000') as yard_branch_number
      FROM Invoices i
      LEFT JOIN Invoices ref ON i.ref_invoice_id = ref.invoice_id
      LEFT JOIN Invoices repl ON i.replaces_invoice_id = repl.invoice_id
      LEFT JOIN Customers c ON i.customer_id = c.customer_id
      LEFT JOIN Containers ct ON i.container_id = ct.container_id
      LEFT JOIN Yards y ON i.yard_id = y.yard_id
      ${where}
      ORDER BY i.created_at DESC
    `);

    // Summary stats
    const statsResult = await db.request()
      .input('yardId2', sql.Int, parseInt(yardId || '1'))
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN status = 'issued' THEN grand_total ELSE 0 END), 0) as total_outstanding,
          ISNULL(SUM(CASE WHEN status = 'paid' THEN grand_total ELSE 0 END), 0) as total_paid,
          ISNULL(SUM(CASE WHEN status = 'overdue' THEN grand_total ELSE 0 END), 0) as total_overdue,
          COUNT(CASE WHEN status = 'issued' THEN 1 END) as pending_count
        FROM Invoices WHERE yard_id = @yardId2
      `);

    return NextResponse.json({
      invoices: result.recordset,
      stats: statsResult.recordset[0],
    });
  } catch (error) {
    console.error('❌ GET invoices error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// POST — สร้าง Invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();
    await ensureInvoiceDocumentColumns(db);

    // Generate invoice number
    const countResult = await db.request()
      .input('yardId', sql.Int, body.yard_id)
      .query('SELECT COUNT(*) as cnt FROM Invoices WHERE yard_id = @yardId');
    const invNumber = `INV-${new Date().getFullYear()}-${String(countResult.recordset[0].cnt + 1).padStart(6, '0')}`;

    const vatRate = 0.07;
    const totalAmount = body.quantity * body.unit_price;
    const vatAmount = totalAmount * vatRate;
    const grandTotal = totalAmount + vatAmount;

    const result = await db.request()
      .input('invNumber', sql.NVarChar, invNumber)
      .input('yardId', sql.Int, body.yard_id)
      .input('customerId', sql.Int, body.customer_id)
      .input('containerId', sql.Int, body.container_id || null)
      .input('chargeType', sql.NVarChar, body.charge_type)
      .input('description', sql.NVarChar, body.description)
      .input('quantity', sql.Decimal(10, 2), body.quantity)
      .input('unitPrice', sql.Decimal(12, 2), body.unit_price)
      .input('totalAmount', sql.Decimal(12, 2), totalAmount)
      .input('vatAmount', sql.Decimal(12, 2), vatAmount)
      .input('grandTotal', sql.Decimal(12, 2), grandTotal)
      .input('dueDate', sql.DateTime2, body.due_date || null)
      .input('notes', sql.NVarChar, body.notes || null)
      .input('documentType', sql.NVarChar, body.document_type || 'invoice')
      .input('refInvoiceId', sql.Int, body.ref_invoice_id || null)
      .input('replacesInvoiceId', sql.Int, body.replaces_invoice_id || null)
      .input('balanceAmount', sql.Decimal(12, 2), grandTotal)
      .query(`
        INSERT INTO Invoices (invoice_number, yard_id, customer_id, container_id,
          charge_type, description, quantity, unit_price, total_amount,
          vat_amount, grand_total, due_date, notes, document_type, ref_invoice_id,
          replaces_invoice_id, balance_amount)
        OUTPUT INSERTED.*
        VALUES (@invNumber, @yardId, @customerId, @containerId,
          @chargeType, @description, @quantity, @unitPrice, @totalAmount,
          @vatAmount, @grandTotal, @dueDate, @notes, @documentType, @refInvoiceId,
          @replacesInvoiceId, @balanceAmount)
      `);

    // Audit log
    const inv = result.recordset[0];
    await logAudit({
      userId: body.user_id, yardId: body.yard_id,
      action: 'invoice_create', entityType: 'invoice', entityId: inv.invoice_id,
      details: { invoice_number: invNumber, customer_id: body.customer_id, charge_type: body.charge_type, grand_total: grandTotal, container_id: body.container_id }
    });

    return NextResponse.json({ success: true, invoice: inv, invoice_number: invNumber });
  } catch (error) {
    console.error('❌ POST invoice error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างใบแจ้งหนี้ได้' }, { status: 500 });
  }
}

// PUT — อัปเดตสถานะ Invoice
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoice_id, action } = body;
    const db = await getDb();
    await ensureInvoiceDocumentColumns(db);

    switch (action) {
      case 'issue':
        await db.request().input('id', sql.Int, invoice_id)
          .query("UPDATE Invoices SET status = 'issued' WHERE invoice_id = @id");
        break;
      case 'pay':
        await db.request().input('id', sql.Int, invoice_id)
          .query("UPDATE Invoices SET status = 'paid', paid_at = GETDATE() WHERE invoice_id = @id");

        // Auto-release hold if container has one
        const invResult = await db.request().input('id2', sql.Int, invoice_id)
          .query('SELECT container_id FROM Invoices WHERE invoice_id = @id2');
        if (invResult.recordset[0]?.container_id) {
          await db.request().input('cid', sql.Int, invResult.recordset[0].container_id)
            .query("UPDATE Containers SET hold_status = NULL, updated_at = GETDATE() WHERE container_id = @cid AND hold_status = 'billing_hold'");
        }
        break;
      case 'cancel':
        await db.request().input('id', sql.Int, invoice_id)
          .query("UPDATE Invoices SET status = 'cancelled' WHERE invoice_id = @id");
        break;
      case 'credit_note': {
        // Full credit note workflow: create a new CN invoice referencing the original
        const { reason, credit_amount, ref_invoice_id, create_revised_invoice, revised_invoice } = body;
        const refId = ref_invoice_id || invoice_id;

        // Fetch original invoice
        const origInv = await db.request()
          .input('refId', sql.Int, refId)
          .query('SELECT * FROM Invoices WHERE invoice_id = @refId');
        
        if (!origInv.recordset[0]) {
          return NextResponse.json({ error: 'ไม่พบใบแจ้งหนี้ต้นฉบับ' }, { status: 404 });
        }

        const orig = origInv.recordset[0];
        if (orig.status === 'credit_note' || String(orig.invoice_number || '').startsWith('CN-')) {
          return NextResponse.json({ error: 'ไม่สามารถออกใบลดหนี้จากใบลดหนี้ได้' }, { status: 400 });
        }

        const creditedResult = await db.request()
          .input('refId', sql.Int, refId)
          .input('refNote', sql.NVarChar, `%อ้างอิง: ${orig.invoice_number}%`)
          .query(`
            SELECT ISNULL(SUM(ABS(grand_total)), 0) as credited_total
            FROM Invoices
            WHERE status = 'credit_note'
              AND (ref_invoice_id = @refId OR notes LIKE @refNote)
          `);

        const creditedTotal = Number(creditedResult.recordset[0]?.credited_total || 0);
        const remainingBeforeCredit = Math.max(Number(orig.grand_total || 0) - creditedTotal, 0);
        const creditAmt = normalizePositiveAmount(credit_amount, remainingBeforeCredit || Number(orig.grand_total || 0));

        // Validate credit amount
        if (remainingBeforeCredit <= 0) {
          return NextResponse.json({ error: 'ใบแจ้งหนี้นี้ถูกลดหนี้ครบยอดแล้ว' }, { status: 400 });
        }
        if (creditAmt - remainingBeforeCredit > 0.01) {
          return NextResponse.json({ error: `ยอดลดหนี้เกินยอดคงเหลือของบิลเดิม (คงเหลือ ฿${remainingBeforeCredit.toLocaleString()})` }, { status: 400 });
        }

        // Generate CN number
        const cnCount = await db.request()
          .input('yardId', sql.Int, orig.yard_id)
          .query("SELECT COUNT(*) as cnt FROM Invoices WHERE yard_id = @yardId AND invoice_number LIKE 'CN-%'");
        const cnNumber = `CN-${new Date().getFullYear()}-${String(cnCount.recordset[0].cnt + 1).padStart(6, '0')}`;

        // Calculate proportional VAT
        const creditBeforeVat = creditAmt / 1.07;
        const creditVat = creditAmt - creditBeforeVat;

        // Create credit note invoice (negative amounts)
        const cnResult = await db.request()
          .input('cnNumber', sql.NVarChar, cnNumber)
          .input('yardId', sql.Int, orig.yard_id)
          .input('customerId', sql.Int, orig.customer_id)
          .input('containerId', sql.Int, orig.container_id || null)
          .input('chargeType', sql.NVarChar, orig.charge_type)
          .input('description', sql.NVarChar, `ใบลดหนี้ อ้างอิง ${orig.invoice_number}${reason ? ' — ' + reason : ''}`)
          .input('quantity', sql.Decimal(10, 2), 1)
          .input('unitPrice', sql.Decimal(12, 2), -creditBeforeVat)
          .input('totalAmount', sql.Decimal(12, 2), -creditBeforeVat)
          .input('vatAmount', sql.Decimal(12, 2), -creditVat)
          .input('grandTotal', sql.Decimal(12, 2), -creditAmt)
          .input('notes', sql.NVarChar, `อ้างอิง: ${orig.invoice_number} | เหตุผล: ${reason || '-'}`)
          .input('refInvoiceId', sql.Int, refId)
          .input('balanceAmount', sql.Decimal(12, 2), 0)
          .query(`
            INSERT INTO Invoices (invoice_number, yard_id, customer_id, container_id,
              charge_type, description, quantity, unit_price, total_amount,
              vat_amount, grand_total, status, notes, document_type, ref_invoice_id,
              balance_amount)
            OUTPUT INSERTED.*
            VALUES (@cnNumber, @yardId, @customerId, @containerId,
              @chargeType, @description, @quantity, @unitPrice, @totalAmount,
              @vatAmount, @grandTotal, 'credit_note', @notes, 'credit_note',
              @refInvoiceId, @balanceAmount)
          `);

        const remainingAfterCredit = Math.max(remainingBeforeCredit - creditAmt, 0);

        // If full credit, cancel original invoice
        if (remainingAfterCredit < 0.01) {
          await db.request()
            .input('origId', sql.Int, refId)
            .input('cnNumber', sql.NVarChar, cnNumber)
            .query("UPDATE Invoices SET status = 'cancelled', balance_amount = 0, notes = ISNULL(notes, '') + ' [ยกเลิกโดยใบลดหนี้ ' + @cnNumber + ']' WHERE invoice_id = @origId");
        } else {
          await db.request()
            .input('origId', sql.Int, refId)
            .input('balanceAmount', sql.Decimal(12, 2), remainingAfterCredit)
            .query('UPDATE Invoices SET balance_amount = @balanceAmount WHERE invoice_id = @origId');
        }

        let revisedInvoice = null;
        let revisedNumber = null;
        if (create_revised_invoice) {
          const revisedQuantity = normalizePositiveAmount(revised_invoice?.quantity, orig.quantity || 1);
          const revisedUnitPrice = normalizePositiveAmount(
            revised_invoice?.unit_price,
            Number(orig.unit_price || 0) > 0 ? Number(orig.unit_price) : Math.max(Number(orig.grand_total || 0) / 1.07 / revisedQuantity, 0)
          );
          const revisedTotal = revisedQuantity * revisedUnitPrice;
          const revisedVat = revisedTotal * 0.07;
          const revisedGrandTotal = revisedTotal + revisedVat;
          if (revisedGrandTotal <= 0) {
            return NextResponse.json({ error: 'ยอดใบแจ้งหนี้ใหม่ต้องมากกว่า 0 บาท' }, { status: 400 });
          }

          const invCount = await db.request()
            .input('yardId', sql.Int, orig.yard_id)
            .query("SELECT COUNT(*) as cnt FROM Invoices WHERE yard_id = @yardId AND invoice_number LIKE 'INV-%'");
          revisedNumber = `INV-${new Date().getFullYear()}-${String(invCount.recordset[0].cnt + 1).padStart(6, '0')}`;

          const revisedNotes = JSON.stringify({
            document_type: 'invoice',
            ref_invoice_number: orig.invoice_number,
            credit_note_number: cnNumber,
            reason: reason || null,
          });

          const revisedResult = await db.request()
            .input('invNumber', sql.NVarChar, revisedNumber)
            .input('yardId', sql.Int, orig.yard_id)
            .input('customerId', sql.Int, revised_invoice?.customer_id || orig.customer_id)
            .input('containerId', sql.Int, orig.container_id || null)
            .input('chargeType', sql.NVarChar, revised_invoice?.charge_type || orig.charge_type)
            .input('description', sql.NVarChar, revised_invoice?.description || `${orig.description || 'ค่าบริการ'} (ออกใหม่แทน ${orig.invoice_number})`)
            .input('quantity', sql.Decimal(10, 2), revisedQuantity)
            .input('unitPrice', sql.Decimal(12, 2), revisedUnitPrice)
            .input('totalAmount', sql.Decimal(12, 2), revisedTotal)
            .input('vatAmount', sql.Decimal(12, 2), revisedVat)
            .input('grandTotal', sql.Decimal(12, 2), revisedGrandTotal)
            .input('dueDate', sql.DateTime2, revised_invoice?.due_date || orig.due_date || null)
            .input('notes', sql.NVarChar, revisedNotes)
            .input('replacesInvoiceId', sql.Int, refId)
            .input('refInvoiceId', sql.Int, cnResult.recordset[0].invoice_id)
            .input('balanceAmount', sql.Decimal(12, 2), revisedGrandTotal)
            .query(`
              INSERT INTO Invoices (invoice_number, yard_id, customer_id, container_id,
                charge_type, description, quantity, unit_price, total_amount,
                vat_amount, grand_total, due_date, notes, status, document_type,
                replaces_invoice_id, ref_invoice_id, balance_amount)
              OUTPUT INSERTED.*
              VALUES (@invNumber, @yardId, @customerId, @containerId,
                @chargeType, @description, @quantity, @unitPrice, @totalAmount,
                @vatAmount, @grandTotal, @dueDate, @notes, 'issued', 'invoice',
                @replacesInvoiceId, @refInvoiceId, @balanceAmount)
            `);

          revisedInvoice = revisedResult.recordset[0];
        }

        // Audit log
        await logAudit({
          userId: body.user_id, yardId: orig.yard_id,
          action: 'credit_note_create', entityType: 'invoice', entityId: cnResult.recordset[0].invoice_id,
          details: { cn_number: cnNumber, ref_invoice: orig.invoice_number, credit_amount: creditAmt, remaining_amount: remainingAfterCredit, revised_invoice_number: revisedNumber, reason }
        });

        return NextResponse.json({
          success: true,
          credit_note: cnResult.recordset[0],
          cn_number: cnNumber,
          ref_invoice: orig.invoice_number,
          credited_total: creditedTotal + creditAmt,
          remaining_amount: remainingAfterCredit,
          revised_invoice: revisedInvoice,
          revised_invoice_number: revisedNumber,
        });
      }
      case 'hold':
        // Put billing hold on container — only if still in yard
        const inv2 = await db.request().input('id3', sql.Int, invoice_id)
          .query('SELECT i.container_id, ct.status as container_status FROM Invoices i LEFT JOIN Containers ct ON i.container_id = ct.container_id WHERE i.invoice_id = @id3');
        if (inv2.recordset[0]?.container_id) {
          if (inv2.recordset[0].container_status === 'gated_out') {
            return NextResponse.json({ success: false, error: 'ตู้นี้ออกจากลานไปแล้ว ไม่สามารถ Hold ได้' });
          }
          await db.request().input('cid2', sql.Int, inv2.recordset[0].container_id)
            .query("UPDATE Containers SET hold_status = 'billing_hold', updated_at = GETDATE() WHERE container_id = @cid2 AND status = 'in_yard'");
        }
        break;
      case 'release':
        const inv3 = await db.request().input('id4', sql.Int, invoice_id)
          .query('SELECT container_id FROM Invoices WHERE invoice_id = @id4');
        if (inv3.recordset[0]?.container_id) {
          await db.request().input('cid3', sql.Int, inv3.recordset[0].container_id)
            .query("UPDATE Containers SET hold_status = NULL, updated_at = GETDATE() WHERE container_id = @cid3");
        }
        break;
    }

    // Audit log
    await logAudit({
      userId: body.user_id, yardId: body.yard_id,
      action: `invoice_${action}`, entityType: 'invoice', entityId: invoice_id,
      details: { action, invoice_id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT invoice error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}
