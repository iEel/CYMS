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
    const actor = await requirePermission(request, db, 'settings.manage', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const existingResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .query(`
        SELECT template_id, document_type
        FROM DocumentTemplates
        WHERE template_id = @templateId
          AND status <> 'inactive'
      `);

    const existing = existingResult.recordset[0];
    if (!existing) return NextResponse.json({ error: 'ไม่พบเทมเพลตเอกสารที่เปิดใช้งานได้' }, { status: 404 });

    await db.request()
      .input('documentType', sql.NVarChar(50), existing.document_type)
      .query(`
        UPDATE DocumentTemplates
        SET is_default = 0,
            updated_at = GETDATE()
        WHERE document_type = @documentType
      `);

    const updateResult = await db.request()
      .input('templateId', sql.Int, templateId)
      .input('updatedBy', sql.Int, actor.userId)
      .query(`
        UPDATE DocumentTemplates
        SET is_default = 1,
            status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
            updated_by = @updatedBy,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE template_id = @templateId
      `);

    await logAudit({
      userId: actor.userId,
      action: 'document_template_set_default',
      entityType: 'document_template',
      entityId: templateId,
      details: { document_type: existing.document_type },
    });

    return NextResponse.json({ success: true, template: updateResult.recordset[0] });
  } catch (error) {
    console.error('POST set default document template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถตั้งค่า default เทมเพลตเอกสารได้' }, { status: 500 });
  }
}
