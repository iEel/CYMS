import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export async function ensureAttachmentCenter(db: DbPool) {
  void db;
}

export async function logAttachment({
  db,
  entityType,
  entityId,
  entityNumber,
  category,
  fileUrl,
  fileName,
  mimeType,
  source,
  uploadedBy,
  yardId,
  metadata,
}: {
  db?: DbPool;
  entityType: string;
  entityId?: number | null;
  entityNumber?: string | null;
  category: string;
  fileUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  source?: string | null;
  uploadedBy?: number | null;
  yardId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  const pool = db || await getDb();
  await ensureAttachmentCenter(pool);
  const result = await pool.request()
    .input('entityType', sql.NVarChar(40), entityType)
    .input('entityId', sql.Int, entityId || null)
    .input('entityNumber', sql.NVarChar(80), entityNumber || null)
    .input('category', sql.NVarChar(50), category)
    .input('fileUrl', sql.NVarChar(sql.MAX), fileUrl)
    .input('fileName', sql.NVarChar(255), fileName || null)
    .input('mimeType', sql.NVarChar(100), mimeType || null)
    .input('source', sql.NVarChar(50), source || null)
    .input('uploadedBy', sql.Int, uploadedBy || null)
    .input('yardId', sql.Int, yardId || null)
    .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null)
    .query(`
      INSERT INTO EntityAttachments (
        entity_type, entity_id, entity_number, category, file_url, file_name,
        mime_type, source, uploaded_by, yard_id, metadata
      )
      OUTPUT INSERTED.*
      VALUES (
        @entityType, @entityId, @entityNumber, @category, @fileUrl, @fileName,
        @mimeType, @source, @uploadedBy, @yardId, @metadata
      )
    `);
  return result.recordset[0] || null;
}
