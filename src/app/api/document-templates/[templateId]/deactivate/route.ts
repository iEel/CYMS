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

    const result = await db.request()
      .input('templateId', sql.Int, templateId)
      .input('updatedBy', sql.Int, actor.userId)
      .query(`
        UPDATE DocumentTemplates
        SET status = 'inactive',
            is_default = 0,
            updated_by = @updatedBy,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE template_id = @templateId
      `);

    const template = result.recordset[0];
    if (!template) return NextResponse.json({ error: 'ไม่พบเทมเพลตเอกสาร' }, { status: 404 });

    await logAudit({
      userId: actor.userId,
      action: 'document_template_deactivate',
      entityType: 'document_template',
      entityId: templateId,
      details: { template_code: template.template_code },
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('POST deactivate document template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถปิดใช้งานเทมเพลตเอกสารได้' }, { status: 500 });
  }
}
