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
  void db;
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
