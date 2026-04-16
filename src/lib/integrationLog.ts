import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export type IntegrationSystem = 'EDI' | 'ERP' | 'PORTAL' | 'API';
export type IntegrationDirection = 'outbound' | 'inbound';
export type IntegrationStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface IntegrationLogInput {
  yardId?: number | null;
  system: IntegrationSystem;
  direction?: IntegrationDirection;
  messageType: string;
  destination?: string | null;
  endpointName?: string | null;
  referenceType?: string | null;
  referenceId?: string | number | null;
  referenceNumber?: string | null;
  payloadSummary?: Record<string, unknown> | null;
  status: IntegrationStatus;
  errorMessage?: string | null;
  retryCount?: number;
  recordCount?: number;
  filename?: string | null;
  requestId?: string | null;
  actorId?: number | null;
}

export async function ensureIntegrationLogTable(db: DbPool) {
  await db.request().query(`
    IF OBJECT_ID('IntegrationLogs', 'U') IS NULL
    BEGIN
      CREATE TABLE IntegrationLogs (
        integration_log_id INT PRIMARY KEY IDENTITY(1,1),
        yard_id INT NULL,
        system NVARCHAR(30) NOT NULL,
        direction NVARCHAR(20) NOT NULL DEFAULT 'outbound',
        message_type NVARCHAR(80) NOT NULL,
        destination NVARCHAR(300) NULL,
        endpoint_name NVARCHAR(150) NULL,
        reference_type NVARCHAR(80) NULL,
        reference_id NVARCHAR(80) NULL,
        reference_number NVARCHAR(150) NULL,
        payload_summary NVARCHAR(MAX) NULL,
        status NVARCHAR(30) NOT NULL,
        error_message NVARCHAR(MAX) NULL,
        retry_count INT NOT NULL DEFAULT 0,
        record_count INT NOT NULL DEFAULT 0,
        filename NVARCHAR(255) NULL,
        request_id NVARCHAR(100) NULL,
        actor_id INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
      );
    END

    IF COL_LENGTH('IntegrationLogs', 'retry_count') IS NULL
      ALTER TABLE IntegrationLogs ADD retry_count INT NOT NULL DEFAULT 0;
    IF COL_LENGTH('IntegrationLogs', 'record_count') IS NULL
      ALTER TABLE IntegrationLogs ADD record_count INT NOT NULL DEFAULT 0;
    IF COL_LENGTH('IntegrationLogs', 'request_id') IS NULL
      ALTER TABLE IntegrationLogs ADD request_id NVARCHAR(100) NULL;
  `);
}

export async function writeIntegrationLog(input: IntegrationLogInput) {
  const db = await getDb();
  await ensureIntegrationLogTable(db);

  const result = await db.request()
    .input('yardId', sql.Int, input.yardId || null)
    .input('system', sql.NVarChar, input.system)
    .input('direction', sql.NVarChar, input.direction || 'outbound')
    .input('messageType', sql.NVarChar, input.messageType)
    .input('destination', sql.NVarChar, input.destination || null)
    .input('endpointName', sql.NVarChar, input.endpointName || null)
    .input('referenceType', sql.NVarChar, input.referenceType || null)
    .input('referenceId', sql.NVarChar, input.referenceId != null ? String(input.referenceId) : null)
    .input('referenceNumber', sql.NVarChar, input.referenceNumber || null)
    .input('payloadSummary', sql.NVarChar, input.payloadSummary ? JSON.stringify(input.payloadSummary) : null)
    .input('status', sql.NVarChar, input.status)
    .input('errorMessage', sql.NVarChar, input.errorMessage || null)
    .input('retryCount', sql.Int, input.retryCount || 0)
    .input('recordCount', sql.Int, input.recordCount || 0)
    .input('filename', sql.NVarChar, input.filename || null)
    .input('requestId', sql.NVarChar, input.requestId || null)
    .input('actorId', sql.Int, input.actorId || null)
    .query(`
      INSERT INTO IntegrationLogs (
        yard_id, system, direction, message_type, destination, endpoint_name,
        reference_type, reference_id, reference_number, payload_summary, status,
        error_message, retry_count, record_count, filename, request_id, actor_id
      )
      OUTPUT INSERTED.integration_log_id
      VALUES (
        @yardId, @system, @direction, @messageType, @destination, @endpointName,
        @referenceType, @referenceId, @referenceNumber, @payloadSummary, @status,
        @errorMessage, @retryCount, @recordCount, @filename, @requestId, @actorId
      )
    `);

  return result.recordset[0]?.integration_log_id as number | undefined;
}

