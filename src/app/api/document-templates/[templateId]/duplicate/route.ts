import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import {
  bindTemplateVersionConfig,
  normalizeTemplateConfig,
  parseDocumentTemplateId,
  parseStoredTemplateConfig,
} from '@/lib/documentTemplates';

const SETTINGS_MESSAGE = 'คุณไม่มีสิทธิ์จัดการเทมเพลตเอกสาร';

type RouteContext = { params: Promise<{ templateId: string }> };

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { templateId: rawTemplateId } = await context.params;
    const templateId = parseDocumentTemplateId(rawTemplateId);
    if (!templateId) return NextResponse.json({ error: 'templateId ไม่ถูกต้อง' }, { status: 400 });

    const body = await request.json();
    const templateCode = cleanString(body.template_code).toUpperCase();
    const templateName = cleanString(body.template_name);
    if (!templateCode || !templateName) {
      return NextResponse.json({ error: 'template_code และ template_name ใหม่จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const sourceResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .query(`
        SELECT TOP 1
          t.template_id,
          t.document_type,
          t.description,
          v.config_json
        FROM DocumentTemplates t
        JOIN DocumentTemplateVersions v
          ON v.template_id = t.template_id
         AND v.version_no = t.current_version_no
        WHERE t.template_id = @templateId
      `);

    const source = sourceResult.recordset[0];
    if (!source) return NextResponse.json({ error: 'ไม่พบเทมเพลตต้นฉบับ' }, { status: 404 });

    const parsedConfig = parseStoredTemplateConfig(source.config_json);
    const normalized = normalizeTemplateConfig(body.config || parsedConfig);
    if (!normalized.config) {
      return NextResponse.json({ error: 'template config ไม่ถูกต้อง', errors: normalized.errors }, { status: 400 });
    }

    const templateResult = await db.request()
      .input('templateCode', sql.NVarChar(80), templateCode)
      .input('templateName', sql.NVarChar(200), templateName)
      .input('documentType', sql.NVarChar(50), cleanString(body.document_type) || source.document_type)
      .input('description', sql.NVarChar(500), body.description === undefined ? source.description : cleanString(body.description) || null)
      .input('createdBy', sql.Int, actor.userId)
      .query(`
        INSERT INTO DocumentTemplates (
          template_code, template_name, document_type, description,
          status, is_default, current_version_no, created_by
        )
        OUTPUT INSERTED.*
        VALUES (
          @templateCode, @templateName, @documentType, @description,
          'draft', 0, 1, @createdBy
        )
      `);

    const template = templateResult.recordset[0];
    const versionRequest = db.request()
      .input('templateId', sql.Int, template.template_id)
      .input('templateCode', sql.NVarChar(80), templateCode)
      .input('versionNo', sql.Int, 1)
      .input('status', sql.NVarChar(20), 'draft')
      .input('createdBy', sql.Int, actor.userId);

    const versionResult = await bindTemplateVersionConfig(versionRequest, normalized.config).query(`
      INSERT INTO DocumentTemplateVersions (
        template_id, template_code, version_no, status,
        paper_width_mm, paper_height_mm, paper_size_code, mode, copy_mode,
        top_offset_mm, left_offset_mm, font_size, row_height, print_scale,
        config_json, created_by
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateId, @templateCode, @versionNo, @status,
        @paperWidthMm, @paperHeightMm, @paperSizeCode, @mode, @copyMode,
        @topOffsetMm, @leftOffsetMm, @fontSize, @rowHeight, @printScale,
        @configJson, @createdBy
      )
    `);

    await logAudit({
      userId: actor.userId,
      action: 'document_template_duplicate',
      entityType: 'document_template',
      entityId: template.template_id,
      details: { source_template_id: templateId, template_code: templateCode, template_name: templateName },
    });

    return NextResponse.json({ success: true, template, version: versionResult.recordset[0] });
  } catch (error) {
    console.error('POST duplicate document template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถคัดลอกเทมเพลตเอกสารได้' }, { status: 500 });
  }
}
