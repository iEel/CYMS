import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { buildPortalDocumentBundleEntries } from '@/lib/portalDocumentBundle';
import { getPortalCustomerId, portalGateVisibilitySql, portalInvoiceVisibilitySql } from '@/lib/portalAccess';
import { createZipArchive } from '@/lib/zipArchive';
import { requirePortalAction } from '@/lib/customerPortalPermissions';

function requestBaseUrl(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost';
  return `${proto}://${host}`;
}

function safeDateStamp(value: Date) {
  return value.toISOString().slice(0, 10).replace(/-/g, '');
}

// GET — Customer Portal: downloadable ZIP bundle with statement + document links
export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.document.download');
    if (portalActor instanceof NextResponse) return portalActor;

    const statementResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN i.status = 'issued' THEN i.grand_total ELSE 0 END), 0) as outstanding,
          ISNULL(SUM(CASE WHEN i.status = 'paid' THEN i.grand_total ELSE 0 END), 0) as paid_total,
          ISNULL(SUM(CASE WHEN i.status = 'credit_note' OR i.document_type = 'credit_note' OR i.invoice_number LIKE 'CN-%' THEN ABS(i.grand_total) ELSE 0 END), 0) as credit_note_total,
          COUNT(CASE WHEN i.status = 'issued' THEN 1 END) as open_count,
          COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN i.status = 'credit_note' OR i.document_type = 'credit_note' OR i.invoice_number LIKE 'CN-%' THEN 1 END) as credit_note_count
        FROM Invoices i
        WHERE ${portalInvoiceVisibilitySql('i')}
          AND (
            i.status IN ('issued', 'paid', 'cancelled', 'credit_note')
            OR i.document_type = 'credit_note'
            OR i.invoice_number LIKE 'CN-%'
          )
      `);

    const invoiceResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT TOP 200 invoice_id, invoice_number, status, grand_total, document_type
        FROM Invoices i
        WHERE ${portalInvoiceVisibilitySql('i')}
          AND (
            i.status IN ('issued', 'paid', 'cancelled', 'credit_note')
            OR i.document_type = 'credit_note'
            OR i.invoice_number LIKE 'CN-%'
          )
        ORDER BY created_at DESC
      `);

    const eirResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT TOP 200 g.eir_number, c.container_number, g.transaction_type, g.created_at
        FROM GateTransactions g
        JOIN Containers c ON g.container_id = c.container_id
        WHERE g.eir_number IS NOT NULL
          AND ${portalGateVisibilitySql('g', 'c')}
        ORDER BY g.created_at DESC
      `);

    const generatedAt = new Date();
    const entries = buildPortalDocumentBundleEntries({
      baseUrl: requestBaseUrl(request),
      generatedAt: generatedAt.toISOString(),
      statement: statementResult.recordset[0] || {},
      invoices: invoiceResult.recordset as never,
      eirs: eirResult.recordset as never,
    });
    const zip = createZipArchive(entries, generatedAt);

    return new NextResponse(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="CYMS-Portal-Bundle-${cid}-${safeDateStamp(generatedAt)}.zip"`,
      },
    });
  } catch (error) {
    console.error('❌ Portal document bundle error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง document bundle ได้' }, { status: 500 });
  }
}
