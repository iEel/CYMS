import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission, requirePermission, requireYardAccess } from '@/lib/apiAuth';
import {
  applyStoredPrintPolicy,
  buildDefaultContinuousTemplateConfig,
  parseStoredTemplateConfig,
} from '@/lib/documentTemplates';
import {
  buildContinuousPrintPayload,
  buildSampleContinuousPrintPayloadWithCompanyProfile,
} from '@/lib/billingContinuousPrint';
import { applyCalibrationProfileToConfig } from '@/lib/documentTemplateDesigner';
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

async function invoicePreviewScope(
  db: Awaited<ReturnType<typeof getDb>>,
  invoiceId: number,
): Promise<{ yard_id: number; status?: string | null } | NextResponse> {
  const result = await db.request()
    .input('invoiceId', sql.Int, invoiceId)
    .query<{ yard_id?: number; status?: string | null }>(`
      SELECT TOP 1 yard_id, status
      FROM Invoices
      WHERE invoice_id = @invoiceId
    `);

  const row = result.recordset[0];
  if (!row) return NextResponse.json({ error: 'invoice not found' }, { status: 404 });
  return { yard_id: Number(row.yard_id), status: row.status };
}

function modeFrom(value: string | null): DocumentTemplateMode | null {
  if (value === 'full' || value === 'overlay') return value;
  return null;
}

function copyModeFrom(value: string | null): DocumentTemplateCopyMode | null {
  if (value === 'carbonless' || value === 'separate') return value;
  return null;
}

function cleanString(value: string | null): string {
  return value?.trim() || '';
}

async function currentTemplateConfig(
  db: Awaited<ReturnType<typeof getDb>>,
  documentType: string,
  templateId: number | null,
  versionNo: number | null,
) {
  const result = await db.request()
    .input('documentType', sql.NVarChar(50), documentType)
    .input('templateId', sql.Int, templateId)
    .input('versionNo', sql.Int, versionNo)
    .query<{
      config_json?: string;
      reprint_label_template?: string;
      red_ref_source?: string;
      template_code?: string;
      template_name?: string;
      version_no?: number;
    }>(`
      SELECT TOP 1
        t.template_code,
        t.template_name,
        v.version_no,
        v.config_json,
        v.reprint_label_template,
        v.red_ref_source
      FROM DocumentTemplates t
      JOIN DocumentTemplateVersions v
        ON v.template_id = t.template_id
       AND (
          (@templateId IS NULL AND v.version_no = t.current_version_no)
          OR (@templateId IS NOT NULL AND (@versionNo IS NULL OR v.version_no = @versionNo))
       )
      WHERE t.status <> 'inactive'
        AND (
          (@templateId IS NOT NULL AND t.template_id = @templateId)
          OR (
            @templateId IS NULL
            AND (
              t.document_type = @documentType
              OR (
                @documentType IN ('receipt', 'tax_invoice_receipt')
                AND t.document_type IN ('receipt', 'tax_invoice_receipt')
              )
            )
          )
        )
      ORDER BY
        CASE WHEN @templateId IS NOT NULL AND t.template_id = @templateId THEN 0 ELSE 1 END,
        CASE WHEN @versionNo IS NOT NULL AND v.version_no = @versionNo THEN 0 ELSE 1 END,
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
        template_name: row?.template_name || '',
        template_family: config?.template_family || 'continuous_tax_receipt',
        template_version: Number(row?.version_no || 1),
      };
}

function applyPreviewOverrides(
  config: DocumentTemplateConfig,
  mode: DocumentTemplateMode | null,
  copyMode: DocumentTemplateCopyMode | null,
  calibrationProfileId: string,
) {
  const nextConfig = {
    ...config,
    mode: mode || config.mode,
    copy_mode: copyMode || config.copy_mode,
  };
  return calibrationProfileId ? applyCalibrationProfileToConfig(nextConfig, calibrationProfileId) : nextConfig;
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = parseInvoiceId(searchParams.get('id'));
    const useSample = searchParams.get('preview') === 'sample' || !invoiceId;
    const actor = useSample
      ? await requirePermission(request, db, 'document_templates.view', SETTINGS_MESSAGE)
      : await requireAnyPermission(request, db, REAL_INVOICE_PREVIEW_PERMISSIONS, SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const documentType = searchParams.get('type') || 'tax_invoice_receipt';
    const templateId = parseInvoiceId(searchParams.get('templateId'));
    const versionNo = parseInvoiceId(searchParams.get('versionNo'));
    const mode = modeFrom(searchParams.get('mode'));
    const copyMode = copyModeFrom(searchParams.get('copyMode'));
    const calibrationProfileId = cleanString(searchParams.get('calibrationProfileId'));
    if (!useSample && invoiceId) {
      const invoiceScope = await invoicePreviewScope(db, invoiceId);
      if (invoiceScope instanceof NextResponse) return invoiceScope;

      const yardAccess = await requireYardAccess(request, db, invoiceScope.yard_id);
      if (yardAccess instanceof NextResponse) return yardAccess;
    }

    const template = await currentTemplateConfig(db, documentType, templateId, versionNo);
    const config = applyPreviewOverrides(template.config, mode, copyMode, calibrationProfileId);
    const payload = useSample
      ? await buildSampleContinuousPrintPayloadWithCompanyProfile(db)
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
        ...(calibrationProfileId ? { calibration_profile_id: calibrationProfileId } : {}),
      },
    });

    return NextResponse.json({
      payload,
      config,
        template: {
          template_code: template.template_code,
          template_name: template.template_name,
          template_family: config.template_family || template.template_family,
          template_version: template.template_version,
        },
    });
  } catch (error) {
    console.error('GET document template preview error:', error);
    return NextResponse.json({ error: 'ไม่สามารถ preview เทมเพลตเอกสารได้' }, { status: 500 });
  }
}
