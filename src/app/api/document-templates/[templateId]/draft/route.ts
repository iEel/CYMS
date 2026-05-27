import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import { parseDocumentTemplateId } from '@/lib/documentTemplates';

const UPDATE_DRAFT_MESSAGE = 'คุณไม่มีสิทธิ์แก้ไข draft เทมเพลตเอกสาร';

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { templateId: rawTemplateId } = await context.params;
    const templateId = parseDocumentTemplateId(rawTemplateId);
    if (!templateId) return NextResponse.json({ error: 'templateId ไม่ถูกต้อง' }, { status: 400 });

    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.update_draft', UPDATE_DRAFT_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const result = await db.request()
      .input('templateId', sql.Int, templateId)
      .input('createdBy', sql.Int, actor.userId)
      .query(`
        BEGIN TRY
          BEGIN TRAN;

          DECLARE @templateCode NVARCHAR(80);
          DECLARE @sourceVersionNo INT;
          DECLARE @draftVersionId INT;
          DECLARE @nextVersionNo INT;

          SELECT
            @templateCode = template_code,
            @sourceVersionNo = current_version_no
          FROM DocumentTemplates
          WHERE template_id = @templateId
            AND ISNULL(status, '') <> 'inactive';

          IF @templateCode IS NOT NULL
          BEGIN
            SELECT TOP 1 @draftVersionId = version_id
            FROM DocumentTemplateVersions
            WHERE template_id = @templateId
              AND status = 'draft'
            ORDER BY version_no DESC;

            IF @draftVersionId IS NULL
            BEGIN
              SELECT @nextVersionNo = ISNULL(MAX(version_no), 0) + 1
              FROM DocumentTemplateVersions
              WHERE template_id = @templateId;

              INSERT INTO DocumentTemplateVersions (
                template_id, template_code, version_no, status,
                paper_width_mm, paper_height_mm, paper_size_code, mode, copy_mode,
                reprint_label_template, red_ref_source,
                top_offset_mm, left_offset_mm, font_size, row_height, print_scale,
                config_json, created_by
              )
              SELECT
                template_id, template_code, @nextVersionNo, 'draft',
                paper_width_mm, paper_height_mm, paper_size_code, mode, copy_mode,
                reprint_label_template, red_ref_source,
                top_offset_mm, left_offset_mm, font_size, row_height, print_scale,
                config_json, @createdBy
              FROM DocumentTemplateVersions
              WHERE template_id = @templateId
                AND version_no = @sourceVersionNo;

              SET @draftVersionId = SCOPE_IDENTITY();
            END
          END

          SELECT *
          FROM DocumentTemplateVersions
          WHERE version_id = @draftVersionId;

          COMMIT TRAN;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRAN;
          THROW;
        END CATCH;
      `);

    const version = result.recordset[0];
    if (!version) return NextResponse.json({ error: 'ไม่พบเทมเพลตหรือ version สำหรับสร้าง draft' }, { status: 404 });

    await logAudit({
      userId: actor.userId,
      action: 'document_template_draft_create',
      entityType: 'document_template',
      entityId: templateId,
      details: { version_no: version.version_no },
    });

    return NextResponse.json({ success: true, version });
  } catch (error) {
    console.error('POST document template draft error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง draft เทมเพลตเอกสารได้' }, { status: 500 });
  }
}
