import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission, requirePermission } from '@/lib/apiAuth';
import {
  applyStoredPrintPolicy,
  buildDefaultContinuousTemplateConfig,
  parseStoredTemplateConfig,
} from '@/lib/documentTemplates';
import {
  buildContinuousPrintPayload,
  buildSampleContinuousPrintPayload,
} from '@/lib/billingContinuousPrint';
import type {
  DocumentTemplateConfig,
  DocumentTemplateCopyMode,
  DocumentTemplateMode,
} from '@/lib/documentTemplateTypes';

const SETTINGS_MESSAGE = 'คุณไม่มีสิทธิ์ preview เทมเพลตเอกสาร';
const REAL_INVOICE_PREVIEW_PERMISSIONS = [
  'settings.manage',
  'billing.invoice.create',
  'billing.payment.receive',
  'reports.view',
  'gate.in',
  'gate.out',
];

function parseInvoiceId(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function modeFrom(value: string | null): DocumentTemplateMode | null {
  if (value === 'full' || value === 'overlay') return value;
  return null;
}

function copyModeFrom(value: string | null): DocumentTemplateCopyMode | null {
  if (value === 'carbonless' || value === 'separate') return value;
  return null;
}

async function currentTemplateConfig(db: Awaited<ReturnType<typeof getDb>>, documentType: string) {
  const result = await db.request()
    .input('documentType', sql.NVarChar(50), documentType)
    .query<{
      config_json?: string;
      reprint_label_template?: string;
      red_ref_source?: string;
      template_code?: string;
      version_no?: number;
    }>(`
      SELECT TOP 1
        t.template_code,
        v.version_no,
        v.config_json,
        v.reprint_label_template,
        v.red_ref_source
      FROM DocumentTemplates t
      JOIN DocumentTemplateVersions v
        ON v.template_id = t.template_id
       AND v.version_no = t.current_version_no
      WHERE t.status <> 'inactive'
        AND (
          t.document_type = @documentType
          OR (
            @documentType IN ('receipt', 'tax_invoice_receipt')
            AND t.document_type IN ('receipt', 'tax_invoice_receipt')
          )
        )
      ORDER BY
        CASE WHEN t.document_type = @documentType THEN 0 ELSE 1 END,
        t.is_default DESC,
        CASE WHEN v.status = 'published' THEN 0 ELSE 1 END,
        t.updated_at DESC
    `);

  const row = result.recordset[0];
  const config = parseStoredTemplateConfig(row?.config_json);
  return {
    config: config && row ? applyStoredPrintPolicy(config, row) : buildDefaultContinuousTemplateConfig(),
    template_code: row?.template_code || documentType.toUpperCase(),
    template_version: Number(row?.version_no || 1),
  };
}

function applyPreviewOverrides(
  config: DocumentTemplateConfig,
  mode: DocumentTemplateMode | null,
  copyMode: DocumentTemplateCopyMode | null,
) {
  return {
    ...config,
    mode: mode || config.mode,
    copy_mode: copyMode || config.copy_mode,
  };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = parseInvoiceId(searchParams.get('id'));
    const useSample = searchParams.get('preview') === 'sample' || !invoiceId;
    const actor = useSample
      ? await requirePermission(request, db, 'settings.manage', SETTINGS_MESSAGE)
      : await requireAnyPermission(request, db, REAL_INVOICE_PREVIEW_PERMISSIONS, SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const documentType = searchParams.get('type') || 'tax_invoice_receipt';
    const mode = modeFrom(searchParams.get('mode'));
    const copyMode = copyModeFrom(searchParams.get('copyMode'));
    const template = await currentTemplateConfig(db, documentType);
    const config = applyPreviewOverrides(template.config, mode, copyMode);
    const payload = useSample
      ? buildSampleContinuousPrintPayload()
      : await buildContinuousPrintPayload(db, { invoiceId, type: documentType });

    await logAudit({
      userId: actor.userId,
      action: 'document_template_preview',
      entityType: 'document_template',
      entityId: useSample ? null : invoiceId,
      details: {
        document_type: documentType,
        preview: useSample ? 'sample' : 'real',
        invoice_id: invoiceId,
        mode: config.mode,
        copy_mode: config.copy_mode,
      },
    });

    return NextResponse.json({
      payload,
      config,
      template: {
        template_code: template.template_code,
        template_version: template.template_version,
      },
    });
  } catch (error) {
    console.error('GET document template preview error:', error);
    return NextResponse.json({ error: 'ไม่สามารถ preview เทมเพลตเอกสารได้' }, { status: 500 });
  }
}
