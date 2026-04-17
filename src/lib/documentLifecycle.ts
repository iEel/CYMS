import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export type DocumentType = 'eir' | 'invoice' | 'receipt' | 'credit_note';

interface DocumentLifecycleEvent {
  db?: DbPool;
  documentType: DocumentType;
  documentId?: number | null;
  documentNumber: string;
  status: string;
  eventType: string;
  relatedDocumentType?: DocumentType | null;
  relatedDocumentId?: number | null;
  relatedDocumentNumber?: string | null;
  reason?: string | null;
  userId?: number | null;
  yardId?: number | null;
  details?: Record<string, unknown> | null;
}

export async function ensureDocumentLifecycle(db: DbPool) {
  await db.request().query(`
    IF OBJECT_ID('DocumentLifecycle', 'U') IS NULL
    BEGIN
      CREATE TABLE DocumentLifecycle (
        lifecycle_id BIGINT PRIMARY KEY IDENTITY(1,1),
        document_type NVARCHAR(30) NOT NULL,
        document_id INT NULL,
        document_number NVARCHAR(80) NOT NULL,
        status NVARCHAR(30) NOT NULL,
        event_type NVARCHAR(50) NOT NULL,
        related_document_type NVARCHAR(30) NULL,
        related_document_id INT NULL,
        related_document_number NVARCHAR(80) NULL,
        reason NVARCHAR(500) NULL,
        details NVARCHAR(MAX) NULL,
        user_id INT NULL,
        yard_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
      );

      CREATE INDEX IX_DocumentLifecycle_Document
        ON DocumentLifecycle (document_type, document_id, document_number, created_at);

      CREATE INDEX IX_DocumentLifecycle_Related
        ON DocumentLifecycle (related_document_type, related_document_id, related_document_number, created_at);
    END
  `);
}

export async function logDocumentLifecycle(event: DocumentLifecycleEvent) {
  const db = event.db || await getDb();
  await ensureDocumentLifecycle(db);

  await db.request()
    .input('documentType', sql.NVarChar(30), event.documentType)
    .input('documentId', sql.Int, event.documentId || null)
    .input('documentNumber', sql.NVarChar(80), event.documentNumber)
    .input('status', sql.NVarChar(30), event.status)
    .input('eventType', sql.NVarChar(50), event.eventType)
    .input('relatedDocumentType', sql.NVarChar(30), event.relatedDocumentType || null)
    .input('relatedDocumentId', sql.Int, event.relatedDocumentId || null)
    .input('relatedDocumentNumber', sql.NVarChar(80), event.relatedDocumentNumber || null)
    .input('reason', sql.NVarChar(500), event.reason || null)
    .input('details', sql.NVarChar(sql.MAX), event.details ? JSON.stringify(event.details) : null)
    .input('userId', sql.Int, event.userId || null)
    .input('yardId', sql.Int, event.yardId || null)
    .query(`
      INSERT INTO DocumentLifecycle (
        document_type, document_id, document_number, status, event_type,
        related_document_type, related_document_id, related_document_number,
        reason, details, user_id, yard_id
      )
      VALUES (
        @documentType, @documentId, @documentNumber, @status, @eventType,
        @relatedDocumentType, @relatedDocumentId, @relatedDocumentNumber,
        @reason, @details, @userId, @yardId
      )
    `);
}
