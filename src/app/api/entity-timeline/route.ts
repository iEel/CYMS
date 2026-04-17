import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { ensureAttachmentCenter } from '@/lib/attachmentCenter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const entityNumber = searchParams.get('entity_number');
    const yardId = searchParams.get('yard_id');

    if (!entityType || (!entityId && !entityNumber)) {
      return NextResponse.json({ error: 'entity_type และ entity_id หรือ entity_number จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    await ensureAttachmentCenter(db);

    const req = db.request()
      .input('entityType', sql.NVarChar, entityType)
      .input('entityId', sql.Int, entityId ? Number(entityId) : null)
      .input('entityNumber', sql.NVarChar, entityNumber || null)
      .input('yardId', sql.Int, yardId ? Number(yardId) : null);

    const result = await req.query(`
      SELECT event_type, event_name, entity_type, entity_id, entity_number,
        status, description, actor_name, created_at, details
      FROM (
        SELECT
          'audit' AS event_type,
          a.action AS event_name,
          a.entity_type,
          a.entity_id,
          NULL AS entity_number,
          NULL AS status,
          a.action AS description,
          ISNULL(u.full_name, u.username) AS actor_name,
          a.created_at,
          a.details
        FROM AuditLog a
        LEFT JOIN Users u ON a.user_id = u.user_id
        WHERE a.entity_type = @entityType
          AND (@entityId IS NULL OR a.entity_id = @entityId)
          AND (@yardId IS NULL OR a.yard_id = @yardId)

        UNION ALL

        SELECT
          'document' AS event_type,
          dl.event_type AS event_name,
          dl.document_type AS entity_type,
          dl.document_id AS entity_id,
          dl.document_number AS entity_number,
          dl.status,
          dl.reason AS description,
          ISNULL(u.full_name, u.username) AS actor_name,
          dl.created_at,
          dl.details
        FROM DocumentLifecycle dl
        LEFT JOIN Users u ON dl.user_id = u.user_id
        WHERE dl.document_type = @entityType
          AND (
            (@entityId IS NOT NULL AND dl.document_id = @entityId)
            OR (@entityNumber IS NOT NULL AND dl.document_number = @entityNumber)
          )
          AND (@yardId IS NULL OR dl.yard_id = @yardId)

        UNION ALL

        SELECT
          'document' AS event_type,
          dl.event_type AS event_name,
          dl.document_type AS entity_type,
          dl.document_id AS entity_id,
          dl.document_number AS entity_number,
          dl.status,
          dl.reason AS description,
          ISNULL(u.full_name, u.username) AS actor_name,
          dl.created_at,
          dl.details
        FROM DocumentLifecycle dl
        LEFT JOIN Users u ON dl.user_id = u.user_id
        WHERE @entityType = 'container'
          AND @entityId IS NOT NULL
          AND (@yardId IS NULL OR dl.yard_id = @yardId)
          AND (
            EXISTS (
              SELECT 1
              FROM GateTransactions g
              WHERE g.container_id = @entityId
                AND g.eir_number = dl.document_number
            )
            OR EXISTS (
              SELECT 1
              FROM Invoices i
              WHERE i.container_id = @entityId
                AND (i.invoice_id = dl.document_id OR i.invoice_number = dl.document_number)
            )
          )

        UNION ALL

        SELECT
          'attachment' AS event_type,
          ea.category AS event_name,
          ea.entity_type,
          ea.entity_id,
          ea.entity_number,
          ea.mime_type AS status,
          ea.file_name AS description,
          ISNULL(u.full_name, u.username) AS actor_name,
          ea.created_at,
          JSON_QUERY((
            SELECT ea.file_url AS file_url, ea.file_name AS file_name, ea.category AS category
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
          )) AS details
        FROM EntityAttachments ea
        LEFT JOIN Users u ON ea.uploaded_by = u.user_id
        WHERE ea.entity_type = @entityType
          AND (
            (@entityId IS NOT NULL AND ea.entity_id = @entityId)
            OR (@entityNumber IS NOT NULL AND ea.entity_number = @entityNumber)
          )
      ) t
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ timeline: result.recordset });
  } catch (error) {
    console.error('GET entity timeline error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง timeline ได้' }, { status: 500 });
  }
}
