import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { ensureAttachmentCenter, logAttachment } from '@/lib/attachmentCenter';
import {
  isAttachmentAuthResponse,
  parseAttachmentEntityId,
  requireAttachmentEntityAccess,
  requireAttachmentUpload,
  requireAttachmentView,
  resolveAttachmentEntityScope,
} from '@/lib/attachmentAccess';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = parseAttachmentEntityId(searchParams.get('entity_id'));
    const entityNumber = searchParams.get('entity_number')?.trim() || null;

    if (!entityType || (!entityId && !entityNumber)) {
      return NextResponse.json({ error: 'entity_type และ entity_id หรือ entity_number จำเป็นต้องระบุ' }, { status: 400 });
    }
    if (isAttachmentAuthResponse(entityId)) return entityId;

    const db = await getDb();
    const actor = await requireAttachmentView(request, db);
    if (isAttachmentAuthResponse(actor)) return actor;

    await ensureAttachmentCenter(db);
    const scope = await resolveAttachmentEntityScope({ db, entityType, entityId, entityNumber });
    if (isAttachmentAuthResponse(scope)) return scope;
    const entityAccess = await requireAttachmentEntityAccess({ request, db, actor, scope });
    if (isAttachmentAuthResponse(entityAccess)) return entityAccess;

    const req = db.request()
      .input('entityType', sql.NVarChar, scope.entityType)
      .input('entityId', sql.Int, scope.entityId)
      .input('entityNumber', sql.NVarChar, scope.entityNumber)
      .input('yardId', sql.Int, scope.yardId);

    const result = await req.query(`
      SELECT attachment_id, entity_type, entity_id, entity_number, category,
        file_url, file_name, mime_type, uploaded_by, created_at
      FROM EntityAttachments
      WHERE entity_type = @entityType
        AND (
          (@entityId IS NOT NULL AND entity_id = @entityId)
          OR (@entityNumber IS NOT NULL AND entity_number = @entityNumber)
        )
        AND (@yardId IS NULL OR yard_id = @yardId OR yard_id IS NULL)
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ attachments: result.recordset });
  } catch (error) {
    console.error('GET attachments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงเอกสารแนบได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.entity_type || !body.file_url) {
      return NextResponse.json({ error: 'entity_type และ file_url จำเป็นต้องระบุ' }, { status: 400 });
    }
    const entityId = parseAttachmentEntityId(body.entity_id);
    const entityNumber = typeof body.entity_number === 'string' ? body.entity_number.trim() || null : null;
    if (isAttachmentAuthResponse(entityId)) return entityId;
    if (!entityId && !entityNumber) {
      return NextResponse.json({ error: 'entity_id หรือ entity_number จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requireAttachmentUpload(request, db);
    if (isAttachmentAuthResponse(actor)) return actor;
    const scope = await resolveAttachmentEntityScope({
      db,
      entityType: String(body.entity_type),
      entityId,
      entityNumber,
    });
    if (isAttachmentAuthResponse(scope)) return scope;
    const entityAccess = await requireAttachmentEntityAccess({ request, db, actor, scope });
    if (isAttachmentAuthResponse(entityAccess)) return entityAccess;

    const attachment = await logAttachment({
      db,
      entityType: scope.entityType,
      entityId: scope.entityId,
      entityNumber: scope.entityNumber,
      category: body.category || 'general',
      fileUrl: body.file_url,
      fileName: body.file_name || null,
      mimeType: body.mime_type || null,
      uploadedBy: actor.userId,
      yardId: scope.yardId,
    });

    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    console.error('POST attachments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกเอกสารแนบได้' }, { status: 500 });
  }
}
