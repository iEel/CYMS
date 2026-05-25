import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { getPortalCustomerId, portalInvoiceVisibilitySql } from '@/lib/portalAccess';
import { requirePortalAction } from '@/lib/customerPortalPermissions';

const ALLOWED_CATEGORIES = new Set(['billing', 'payment', 'damage', 'detention', 'document', 'other']);

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// POST — Customer Portal: create invoice dispute request
export async function POST(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.dispute.create');
    if (portalActor instanceof NextResponse) return portalActor;

    const body = await request.json();
    const invoiceId = parsePositiveInt(body.invoice_id);
    const category = String(body.category || 'other').trim();
    const message = String(body.message || '').trim();

    if (!invoiceId) {
      return NextResponse.json({ error: 'กรุณาระบุ invoice_id' }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'ประเภท dispute ไม่ถูกต้อง' }, { status: 400 });
    }
    if (message.length < 10) {
      return NextResponse.json({ error: 'กรุณาระบุรายละเอียดอย่างน้อย 10 ตัวอักษร' }, { status: 400 });
    }
    const invoiceResult = await db.request()
      .input('invoiceId', sql.Int, invoiceId)
      .input('cid', sql.Int, cid)
      .query(`
        SELECT TOP 1 invoice_id, invoice_number
        FROM Invoices i
        WHERE i.invoice_id = @invoiceId
          AND ${portalInvoiceVisibilitySql('i')}
          AND (
            i.status IN ('issued', 'paid', 'cancelled', 'credit_note')
            OR i.document_type = 'credit_note'
            OR i.invoice_number LIKE 'CN-%'
          )
      `);

    if (invoiceResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Invoice หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const result = await db.request()
      .input('cid', sql.Int, cid)
      .input('invoiceId', sql.Int, invoiceId)
      .input('invoiceNumber', sql.NVarChar, invoiceResult.recordset[0].invoice_number)
      .input('category', sql.NVarChar, category)
      .input('message', sql.NVarChar, message)
      .input('createdBy', sql.Int, parsePositiveInt(request.headers.get('x-user-id')))
      .query(`
        INSERT INTO PortalDisputes (
          customer_id, invoice_id, invoice_number, category, message, status, created_by_user_id, created_at
        )
        OUTPUT INSERTED.dispute_id
        VALUES (
          @cid, @invoiceId, @invoiceNumber, @category, @message, 'open', @createdBy, GETDATE()
        )
      `);

    return NextResponse.json({
      success: true,
      dispute_id: result.recordset[0]?.dispute_id,
      status: 'open',
    });
  } catch (error) {
    console.error('❌ Portal dispute error:', error);
    return NextResponse.json({ error: 'ไม่สามารถส่งคำร้อง dispute ได้' }, { status: 500 });
  }
}
