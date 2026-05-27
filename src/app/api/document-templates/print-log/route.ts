import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';
import { recordDocumentPrint } from '@/lib/documentPrintLog';

const PRINT_LOG_PERMISSIONS = [
  'settings.manage',
  'billing.invoice.create',
  'billing.payment.receive',
  'gate.in',
  'gate.out',
  'reports.view',
];

const PERMISSION_MESSAGE = 'คุณไม่มีสิทธิ์บันทึกประวัติการพิมพ์เอกสาร';
const ALLOWED_DOCUMENT_TYPES = new Set(['receipt', 'tax_invoice_receipt']);

type PrintLogBody = {
  document_type?: unknown;
  type?: unknown;
  document_id?: unknown;
  id?: unknown;
  document_no?: unknown;
  template_code?: unknown;
  template_version?: unknown;
  reprint_reason?: unknown;
  manual_preprinted_form_no?: unknown;
  snapshot?: unknown;
  mode?: unknown;
  copy_mode?: unknown;
  copyMode?: unknown;
  show_reprint_label?: unknown;
  reprint_label_template?: unknown;
  require_reprint_reason?: unknown;
};

type InvoicePrintScope = {
  invoice_id: number;
  yard_id: number;
  invoice_number?: string | null;
  receipt_number?: string | null;
  status?: string | null;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function booleanFrom(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'yes';
}

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
}

async function parseBody(request: NextRequest): Promise<PrintLogBody | NextResponse> {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as PrintLogBody;
  } catch {
    return NextResponse.json({ error: 'JSON body ไม่ถูกต้อง' }, { status: 400 });
  }
}

async function invoicePrintScope(
  db: Awaited<ReturnType<typeof getDb>>,
  documentId: number,
): Promise<InvoicePrintScope | NextResponse> {
  const result = await db.request()
    .input('invoiceId', sql.Int, documentId)
    .query<InvoicePrintScope>(`
      SELECT TOP 1
        invoice_id,
        yard_id,
        invoice_number,
        receipt_number,
        status
      FROM Invoices
      WHERE invoice_id = @invoiceId
    `);

  const invoice = result.recordset[0];
  if (!invoice) return NextResponse.json({ error: 'invoice not found' }, { status: 404 });
  return invoice;
}

async function validateTemplateVersion(
  db: Awaited<ReturnType<typeof getDb>>,
  documentType: string,
  templateCode: string,
  templateVersion: number,
): Promise<boolean> {
  const result = await db.request()
    .input('documentType', sql.NVarChar(50), documentType)
    .input('templateCode', sql.NVarChar(80), templateCode)
    .input('templateVersion', sql.Int, templateVersion)
    .query<{ template_id: number }>(`
      SELECT TOP 1 t.template_id
      FROM DocumentTemplates t
      JOIN DocumentTemplateVersions v
        ON v.template_id = t.template_id
       AND v.version_no = @templateVersion
      WHERE t.template_code = @templateCode
        AND ISNULL(t.status, '') <> 'inactive'
        AND ISNULL(v.status, '') = 'published'
        AND (
          t.document_type = @documentType
          OR (
            @documentType IN ('receipt', 'tax_invoice_receipt')
            AND t.document_type IN ('receipt', 'tax_invoice_receipt')
          )
        )
    `);

  return result.recordset.length > 0;
}

function documentNoFor(documentType: string, invoice: InvoicePrintScope): string | null {
  const invoiceNumber = optionalString(invoice.invoice_number);
  const receiptNumber = optionalString(invoice.receipt_number);
  if (documentType === 'receipt') return receiptNumber || invoiceNumber;
  return invoiceNumber || receiptNumber;
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireAnyPermission(request, db, PRINT_LOG_PERMISSIONS, PERMISSION_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const body = await parseBody(request);
    if (body instanceof NextResponse) return body;

    const documentType = cleanString(body.document_type ?? body.type);
    const documentId = positiveInt(body.document_id ?? body.id);
    const templateCode = cleanString(body.template_code);
    const templateVersion = positiveInt(body.template_version);

    if (!documentType || !documentId || !templateCode || !templateVersion) {
      return NextResponse.json(
        { error: 'document_type, document_id, template_code และ template_version จำเป็นต้องระบุ' },
        { status: 400 },
      );
    }

    if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json({ error: 'unsupported document_type' }, { status: 400 });
    }

    const invoice = await invoicePrintScope(db, documentId);
    if (invoice instanceof NextResponse) return invoice;

    const yardAccess = await requireYardAccess(request, db, invoice.yard_id);
    if (yardAccess instanceof NextResponse) return yardAccess;

    const templateIsValid = await validateTemplateVersion(db, documentType, templateCode, templateVersion);
    if (!templateIsValid) {
      return NextResponse.json({ error: 'unknown or inactive template' }, { status: 400 });
    }

    const documentNo = documentNoFor(documentType, invoice);

    const result = await recordDocumentPrint(db, {
      documentType,
      documentId,
      documentNo,
      templateCode,
      templateVersion,
      reprintReason: optionalString(body.reprint_reason),
      manualPreprintedFormNo: optionalString(body.manual_preprinted_form_no),
      snapshot: body.snapshot ?? {},
      mode: cleanString(body.mode) || 'full',
      copyMode: cleanString(body.copy_mode ?? body.copyMode) || 'carbonless',
      printedBy: actor.userId,
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent'),
      showReprintLabel: booleanFrom(body.show_reprint_label),
      reprintLabelTemplate: optionalString(body.reprint_label_template),
      requireReprintReason: booleanFrom(body.require_reprint_reason),
    });

    try {
      await logAudit({
        userId: actor.userId,
        action: result.is_reprint ? 'document_reprint' : 'document_print',
        entityType: documentType,
        entityId: documentId,
        details: {
          document_type: documentType,
          document_id: documentId,
          document_no: documentNo,
          template_code: templateCode,
          template_version: templateVersion,
          print_no: result.print_no,
          is_reprint: result.is_reprint,
          reprint_count: result.reprint_count,
          mode: cleanString(body.mode) || 'full',
          copy_mode: cleanString(body.copy_mode ?? body.copyMode) || 'carbonless',
        },
      });
    } catch (auditError) {
      console.warn('document print audit failed:', auditError);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'reprint reason is required') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'snapshot_json is not serializable') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('POST document template print log error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกประวัติการพิมพ์เอกสารได้' }, { status: 500 });
  }
}
