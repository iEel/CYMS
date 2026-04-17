import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export async function ensureAttachmentCenter(db: DbPool) {
  await db.request().query(`
    IF OBJECT_ID('EntityAttachments', 'U') IS NULL
    BEGIN
      CREATE TABLE EntityAttachments (
        attachment_id BIGINT PRIMARY KEY IDENTITY(1,1),
        entity_type NVARCHAR(40) NOT NULL,
        entity_id INT NULL,
        entity_number NVARCHAR(80) NULL,
        category NVARCHAR(50) NOT NULL,
        file_url NVARCHAR(MAX) NOT NULL,
        file_name NVARCHAR(255) NULL,
        mime_type NVARCHAR(100) NULL,
        source NVARCHAR(50) NULL,
        uploaded_by INT NULL,
        yard_id INT NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_EntityAttachments_Entity ON EntityAttachments (entity_type, entity_id, entity_number, created_at);
    END
  `);
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
  await pool.request()
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
      VALUES (
        @entityType, @entityId, @entityNumber, @category, @fileUrl, @fileName,
        @mimeType, @source, @uploadedBy, @yardId, @metadata
      )
    `);
}
