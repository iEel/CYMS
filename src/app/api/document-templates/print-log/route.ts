import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission } from '@/lib/apiAuth';
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

    const result = await recordDocumentPrint(db, {
      documentType,
      documentId,
      documentNo: optionalString(body.document_no),
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

    await logAudit({
      userId: actor.userId,
      action: result.is_reprint ? 'document_reprint' : 'document_print',
      entityType: documentType,
      entityId: documentId,
      details: {
        document_type: documentType,
        document_id: documentId,
        document_no: optionalString(body.document_no),
        template_code: templateCode,
        template_version: templateVersion,
        print_no: result.print_no,
        is_reprint: result.is_reprint,
        reprint_count: result.reprint_count,
        mode: cleanString(body.mode) || 'full',
        copy_mode: cleanString(body.copy_mode ?? body.copyMode) || 'carbonless',
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'reprint reason is required') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('POST document template print log error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกประวัติการพิมพ์เอกสารได้' }, { status: 500 });
  }
}
