import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import {
  applyStoredPrintPolicy,
  buildDefaultContinuousTemplateConfig,
  parseStoredTemplateConfig,
} from '@/lib/documentTemplates';
import { buildSampleContinuousPrintPayload } from '@/lib/billingContinuousPrint';
import { applyCalibrationProfileToConfig } from '@/lib/documentTemplateDesigner';
import type {
  DocumentTemplateConfig,
  DocumentTemplateCopyMode,
  DocumentTemplateMode,
} from '@/lib/documentTemplateTypes';

const SETTINGS_MESSAGE = 'คุณไม่มีสิทธิ์ทดสอบพิมพ์เทมเพลตเอกสาร';

type TestPrintBody = {
  document_type?: unknown;
  mode?: unknown;
  copyMode?: unknown;
  copy_mode?: unknown;
  calibrationProfileId?: unknown;
  calibration_profile_id?: unknown;
  template_id?: unknown;
  versionNo?: unknown;
  version_no?: unknown;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function modeFrom(value: unknown): DocumentTemplateMode | null {
  return value === 'full' || value === 'overlay' ? value : null;
}

function copyModeFrom(value: unknown): DocumentTemplateCopyMode | null {
  return value === 'carbonless' || value === 'separate' ? value : null;
}

async function parseOptionalBody(request: NextRequest): Promise<TestPrintBody | NextResponse> {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as TestPrintBody;
  } catch {
    return NextResponse.json({ error: 'JSON body ไม่ถูกต้อง' }, { status: 400 });
  }
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
    .query<{ config_json?: string; reprint_label_template?: string; red_ref_source?: string }>(`
      SELECT TOP 1
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
  return config && row ? applyStoredPrintPolicy(config, row) : buildDefaultContinuousTemplateConfig();
}

function applyTestPrintOverrides(
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

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.test_print', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const body = await parseOptionalBody(request);
    if (body instanceof NextResponse) return body;

    const documentType = cleanString(body.document_type) || 'tax_invoice_receipt';
    const templateId = parsePositiveInt(body.template_id);
    const versionNo = parsePositiveInt(body.versionNo ?? body.version_no);
    const mode = modeFrom(body.mode);
    const copyMode = copyModeFrom(body.copyMode ?? body.copy_mode);
    const calibrationProfileId = cleanString(body.calibrationProfileId ?? body.calibration_profile_id);
    const config = applyTestPrintOverrides(
      await currentTemplateConfig(db, documentType, templateId, versionNo),
      mode,
      copyMode,
      calibrationProfileId,
    );
    const payload = buildSampleContinuousPrintPayload();

    await logAudit({
      userId: actor.userId,
      action: 'document_template_test_print',
      entityType: 'document_template',
      entityId: templateId,
      details: {
        document_type: documentType,
        template_id: templateId,
        ...(versionNo ? { version_no: versionNo } : {}),
        mode: config.mode,
        copy_mode: config.copy_mode,
        ...(calibrationProfileId ? { calibration_profile_id: calibrationProfileId } : {}),
        test_print: true,
      },
    });

    return NextResponse.json({ payload, config, testPrint: true });
  } catch (error) {
    console.error('POST document template test print error:', error);
    return NextResponse.json({ error: 'ไม่สามารถทดสอบพิมพ์เทมเพลตเอกสารได้' }, { status: 500 });
  }
}
