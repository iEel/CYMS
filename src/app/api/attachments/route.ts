import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { ensureAttachmentCenter, logAttachment } from '@/lib/attachmentCenter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const entityNumber = searchParams.get('entity_number');

    if (!entityType || (!entityId && !entityNumber)) {
      return NextResponse.json({ error: 'entity_type และ entity_id หรือ entity_number จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    await ensureAttachmentCenter(db);
    const req = db.request()
      .input('entityType', sql.NVarChar, entityType)
      .input('entityId', sql.Int, entityId ? Number(entityId) : null)
      .input('entityNumber', sql.NVarChar, entityNumber || null);

    const result = await req.query(`
      SELECT attachment_id, entity_type, entity_id, entity_number, category,
        file_url, file_name, mime_type, uploaded_by, created_at
      FROM EntityAttachments
      WHERE entity_type = @entityType
        AND (
          (@entityId IS NOT NULL AND entity_id = @entityId)
          OR (@entityNumber IS NOT NULL AND entity_number = @entityNumber)
        )
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

    const db = await getDb();
    const attachment = await logAttachment({
      db,
      entityType: body.entity_type,
      entityId: body.entity_id ? Number(body.entity_id) : null,
      entityNumber: body.entity_number || null,
      category: body.category || 'general',
      fileUrl: body.file_url,
      fileName: body.file_name || null,
      mimeType: body.mime_type || null,
      uploadedBy: body.uploaded_by ? Number(body.uploaded_by) : null,
    });

    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    console.error('POST attachments error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกเอกสารแนบได้' }, { status: 500 });
  }
}
