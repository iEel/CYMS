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

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickDefined<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function splitTemplateVersionRow(row: Record<string, unknown>) {
  return {
    template: pickDefined({
      template_id: row.template_template_id,
      template_code: row.template_template_code,
      template_name: row.template_template_name,
      document_type: row.template_document_type,
      description: row.template_description,
      status: row.template_status,
      is_default: row.template_is_default,
      current_version_no: row.template_current_version_no,
      created_by: row.template_created_by,
      updated_by: row.template_updated_by,
      created_at: row.template_created_at,
      updated_at: row.template_updated_at,
    }),
    version: pickDefined({
      version_id: row.version_version_id,
      template_id: row.version_template_id,
      template_code: row.version_template_code,
      version_no: row.version_version_no,
      status: row.version_status,
      paper_width_mm: row.version_paper_width_mm,
      paper_height_mm: row.version_paper_height_mm,
      paper_size_code: row.version_paper_size_code,
      mode: row.version_mode,
      copy_mode: row.version_copy_mode,
      reprint_label_template: row.version_reprint_label_template,
      red_ref_source: row.version_red_ref_source,
      created_by: row.version_created_by,
      created_at: row.version_created_at,
    }),
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { templateId: rawTemplateId } = await context.params;
    const templateId = parseDocumentTemplateId(rawTemplateId);
    if (!templateId) return NextResponse.json({ error: 'templateId ไม่ถูกต้อง' }, { status: 400 });

    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.create', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const body = await request.json();
    const templateCode = cleanString(body.template_code).toUpperCase();
    const templateName = cleanString(body.template_name);

    if (!templateCode || !templateName) {
      return NextResponse.json({ error: 'template_code และ template_name ใหม่จำเป็นต้องระบุ' }, { status: 400 });
    }

    const sourceResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .query(`
        SELECT TOP 1
          t.template_id,
          t.document_type,
          t.description,
          v.reprint_label_template,
          v.red_ref_source,
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
    const sourceConfig = parsedConfig ? applyStoredPrintPolicy(parsedConfig, source) : null;
    const normalized = normalizeTemplateConfig(body.config || sourceConfig);
    if (!normalized.config) {
      return NextResponse.json({ error: 'template config ไม่ถูกต้อง', errors: normalized.errors }, { status: 400 });
    }

    const duplicateRequest = db.request()
      .input('templateCode', sql.NVarChar(80), templateCode)
      .input('templateName', sql.NVarChar(200), templateName)
      .input('documentType', sql.NVarChar(50), cleanString(body.document_type) || source.document_type)
      .input('description', sql.NVarChar(500), body.description === undefined ? source.description : cleanString(body.description) || null)
      .input('createdBy', sql.Int, actor.userId)
      .input('versionNo', sql.Int, 1)
      .input('status', sql.NVarChar(20), 'draft');

    const duplicateResult = await bindTemplateVersionConfig(duplicateRequest, normalized.config).query(`
        DECLARE @createdTemplate TABLE (
          template_id INT,
          template_code NVARCHAR(80),
          template_name NVARCHAR(200),
          document_type NVARCHAR(50),
          description NVARCHAR(500),
          status NVARCHAR(20),
          is_default BIT,
          current_version_no INT,
          created_by INT,
          updated_by INT,
          created_at DATETIME2,
          updated_at DATETIME2
        );
        DECLARE @createdVersion TABLE (
          version_id INT,
          template_id INT,
          template_code NVARCHAR(80),
          version_no INT,
          status NVARCHAR(20),
          paper_width_mm DECIMAL(10,2),
          paper_height_mm DECIMAL(10,2),
          paper_size_code NVARCHAR(40),
          mode NVARCHAR(20),
          copy_mode NVARCHAR(20),
          reprint_label_template NVARCHAR(120),
          red_ref_source NVARCHAR(50),
          created_by INT,
          created_at DATETIME2
        );

        BEGIN TRY
          BEGIN TRAN;

        INSERT INTO DocumentTemplates (
          template_code, template_name, document_type, description,
          status, is_default, current_version_no, created_by
        )
            OUTPUT INSERTED.template_id, INSERTED.template_code, INSERTED.template_name,
              INSERTED.document_type, INSERTED.description, INSERTED.status, INSERTED.is_default,
              INSERTED.current_version_no, INSERTED.created_by, INSERTED.updated_by,
              INSERTED.created_at, INSERTED.updated_at
            INTO @createdTemplate
        VALUES (
          @templateCode, @templateName, @documentType, @description,
          'draft', 0, 1, @createdBy
        );

      INSERT INTO DocumentTemplateVersions (
        template_id, template_code, version_no, status,
        paper_width_mm, paper_height_mm, paper_size_code, mode, copy_mode,
        reprint_label_template, red_ref_source,
        top_offset_mm, left_offset_mm, font_size, row_height, print_scale,
        config_json, created_by
      )
          OUTPUT INSERTED.version_id, INSERTED.template_id, INSERTED.template_code,
            INSERTED.version_no, INSERTED.status, INSERTED.paper_width_mm,
            INSERTED.paper_height_mm, INSERTED.paper_size_code, INSERTED.mode,
            INSERTED.copy_mode, INSERTED.reprint_label_template, INSERTED.red_ref_source,
            INSERTED.created_by, INSERTED.created_at
          INTO @createdVersion
      VALUES (
            (SELECT TOP 1 template_id FROM @createdTemplate), @templateCode, @versionNo, @status,
        @paperWidthMm, @paperHeightMm, @paperSizeCode, @mode, @copyMode,
        @reprintLabelTemplate, @redRefSource,
        @topOffsetMm, @leftOffsetMm, @fontSize, @rowHeight, @printScale,
        @configJson, @createdBy
      );

          COMMIT TRAN;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRAN;
          THROW;
        END CATCH;

        SELECT
          t.template_id AS template_template_id,
          t.template_code AS template_template_code,
          t.template_name AS template_template_name,
          t.document_type AS template_document_type,
          t.description AS template_description,
          t.status AS template_status,
          t.is_default AS template_is_default,
          t.current_version_no AS template_current_version_no,
          t.created_by AS template_created_by,
          t.updated_by AS template_updated_by,
          t.created_at AS template_created_at,
          t.updated_at AS template_updated_at,
          v.version_id AS version_version_id,
          v.template_id AS version_template_id,
          v.template_code AS version_template_code,
          v.version_no AS version_version_no,
          v.status AS version_status,
          v.paper_width_mm AS version_paper_width_mm,
          v.paper_height_mm AS version_paper_height_mm,
          v.paper_size_code AS version_paper_size_code,
          v.mode AS version_mode,
          v.copy_mode AS version_copy_mode,
          v.reprint_label_template AS version_reprint_label_template,
          v.red_ref_source AS version_red_ref_source,
          v.created_by AS version_created_by,
          v.created_at AS version_created_at
        FROM @createdTemplate t
        CROSS JOIN @createdVersion v;
    `);
    const { template, version } = splitTemplateVersionRow(duplicateResult.recordset[0] as Record<string, unknown>);

    await logAudit({
      userId: actor.userId,
      action: 'document_template_duplicate',
      entityType: 'document_template',
      entityId: Number(template.template_id),
      details: { source_template_id: templateId, template_code: templateCode, template_name: templateName },
    });

    return NextResponse.json({ success: true, template, version });
  } catch (error) {
    console.error('POST duplicate document template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถคัดลอกเทมเพลตเอกสารได้' }, { status: 500 });
  }
}
