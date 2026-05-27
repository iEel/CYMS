import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import {
  bindTemplateVersionConfig,
  applyStoredPrintPolicy,
  normalizeTemplateConfig,
  parseDocumentTemplateId,
  parseStoredTemplateConfig,
} from '@/lib/documentTemplates';

const SETTINGS_MESSAGE = 'คุณไม่มีสิทธิ์จัดการเทมเพลตเอกสาร';

type RouteContext = { params: Promise<{ templateId: string }> };

function cleanOptionalString(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  return typeof value === 'string' ? value.trim() || null : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { templateId: rawTemplateId } = await context.params;
    const templateId = parseDocumentTemplateId(rawTemplateId);
    if (!templateId) return NextResponse.json({ error: 'templateId ไม่ถูกต้อง' }, { status: 400 });

    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.view', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const templateResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .query(`
        SELECT *
        FROM DocumentTemplates
        WHERE template_id = @templateId
      `);

    const template = templateResult.recordset[0];
    if (!template) return NextResponse.json({ error: 'ไม่พบเทมเพลตเอกสาร' }, { status: 404 });

    const versionsResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .query(`
        SELECT *
        FROM DocumentTemplateVersions
        WHERE template_id = @templateId
        ORDER BY version_no DESC
      `);

    const versions = versionsResult.recordset.map((version: Record<string, unknown>) => {
      const config = parseStoredTemplateConfig(version.config_json);
      return {
        ...version,
        config: config ? applyStoredPrintPolicy(config, version) : null,
      };
    });

    return NextResponse.json({ template, versions });
  } catch (error) {
    console.error('GET document template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงเทมเพลตเอกสารได้' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { templateId: rawTemplateId } = await context.params;
    const templateId = parseDocumentTemplateId(rawTemplateId);
    if (!templateId) return NextResponse.json({ error: 'templateId ไม่ถูกต้อง' }, { status: 400 });

    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.update_draft', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const body = await request.json();

    const currentResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .query(`
        SELECT t.*, v.version_id, v.version_no, v.status AS version_status
        FROM DocumentTemplates t
        OUTER APPLY (
          SELECT TOP 1 version_id, version_no, status
          FROM DocumentTemplateVersions
          WHERE template_id = t.template_id
            AND status = 'draft'
          ORDER BY version_no DESC
        ) v
        WHERE t.template_id = @templateId
      `);

    const current = currentResult.recordset[0];
    if (!current) return NextResponse.json({ error: 'ไม่พบเทมเพลตเอกสาร' }, { status: 404 });
    if (!current.version_id) {
      return NextResponse.json({ error: 'แก้ไข active template ต้องสร้าง draft version ก่อน' }, { status: 400 });
    }

    const templateName = cleanOptionalString(body.template_name);
    const documentType = cleanOptionalString(body.document_type);
    const description = body.description === undefined ? undefined : cleanOptionalString(body.description);
    const status = cleanOptionalString(body.status);
    if (status && !['draft', 'active', 'inactive'].includes(status)) {
      return NextResponse.json({ error: 'status ไม่ถูกต้อง' }, { status: 400 });
    }

    let normalizedConfig = null;
    if (body.config !== undefined) {
      normalizedConfig = normalizeTemplateConfig(body.config);
      if (!normalizedConfig.config) {
        return NextResponse.json({ error: 'template config ไม่ถูกต้อง', errors: normalizedConfig.errors }, { status: 400 });
      }
    }

    const updateResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .input('templateName', sql.NVarChar(200), templateName)
      .input('documentType', sql.NVarChar(50), documentType)
      .input('description', sql.NVarChar(500), description === undefined ? current.description : description)
      .input('status', sql.NVarChar(20), status)
      .input('updatedBy', sql.Int, actor.userId)
      .query(`
        UPDATE DocumentTemplates
        SET template_name = COALESCE(@templateName, template_name),
            document_type = COALESCE(@documentType, document_type),
            description = @description,
            status = COALESCE(@status, status),
            updated_by = @updatedBy,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE template_id = @templateId
      `);

    let version = null;
    if (normalizedConfig?.config) {
      const versionRequest = db.request()
        .input('versionId', sql.Int, current.version_id);
      const versionResult = await bindTemplateVersionConfig(versionRequest, normalizedConfig.config).query(`
        UPDATE DocumentTemplateVersions
        SET paper_width_mm = @paperWidthMm,
            paper_height_mm = @paperHeightMm,
            paper_size_code = @paperSizeCode,
            mode = @mode,
            copy_mode = @copyMode,
            reprint_label_template = @reprintLabelTemplate,
            red_ref_source = @redRefSource,
            top_offset_mm = @topOffsetMm,
            left_offset_mm = @leftOffsetMm,
            font_size = @fontSize,
            row_height = @rowHeight,
            print_scale = @printScale,
            config_json = @configJson
        OUTPUT INSERTED.*
        WHERE version_id = @versionId
          AND status = 'draft'
      `);
      version = versionResult.recordset[0] || null;
    }

    await logAudit({
      userId: actor.userId,
      action: 'document_template_update',
      entityType: 'document_template',
      entityId: templateId,
      details: {
        template_name: templateName,
        document_type: documentType,
        status,
        config_updated: Boolean(normalizedConfig?.config),
      },
    });

    return NextResponse.json({ success: true, template: updateResult.recordset[0], version });
  } catch (error) {
    console.error('PUT document template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกเทมเพลตเอกสารได้' }, { status: 500 });
  }
}
