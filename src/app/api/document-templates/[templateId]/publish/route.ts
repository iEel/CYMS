import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import { parseDocumentTemplateId } from '@/lib/documentTemplates';

const SETTINGS_MESSAGE = 'คุณไม่มีสิทธิ์จัดการเทมเพลตเอกสาร';

type RouteContext = { params: Promise<{ templateId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { templateId: rawTemplateId } = await context.params;
    const templateId = parseDocumentTemplateId(rawTemplateId);
    if (!templateId) return NextResponse.json({ error: 'templateId ไม่ถูกต้อง' }, { status: 400 });

    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.publish', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const body = await request.json().catch(() => ({}));
    const versionNo = parseDocumentTemplateId(body.version_no) || null;

    const result = await db.request()
      .input('templateId', sql.Int, templateId)
      .input('versionNo', sql.Int, versionNo)
      .input('publishedBy', sql.Int, actor.userId)
      .query(`
        BEGIN TRY
          BEGIN TRAN;

        DECLARE @targetVersionNo INT;

        SELECT TOP 1 @targetVersionNo = version_no
        FROM DocumentTemplateVersions
        WHERE template_id = @templateId
          AND (@versionNo IS NULL OR version_no = @versionNo)
        ORDER BY version_no DESC;

        IF @targetVersionNo IS NOT NULL
        BEGIN
          UPDATE DocumentTemplateVersions
          SET status = CASE WHEN version_no = @targetVersionNo THEN 'published' ELSE status END,
              published_by = CASE WHEN version_no = @targetVersionNo THEN @publishedBy ELSE published_by END,
              published_at = CASE WHEN version_no = @targetVersionNo THEN GETDATE() ELSE published_at END
          WHERE template_id = @templateId;

          UPDATE DocumentTemplates
          SET status = 'active',
              current_version_no = @targetVersionNo,
              updated_by = @publishedBy,
              updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE template_id = @templateId;
        END

          COMMIT TRAN;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRAN;
          THROW;
        END CATCH;
      `);

    const template = result.recordset[0];
    if (!template) return NextResponse.json({ error: 'ไม่พบ version ที่ต้องการ publish' }, { status: 404 });

    await logAudit({
      userId: actor.userId,
      action: 'document_template_publish',
      entityType: 'document_template',
      entityId: templateId,
      details: { version_no: versionNo || template.current_version_no },
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('POST publish document template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถ publish เทมเพลตเอกสารได้' }, { status: 500 });
  }
}
