import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export interface LogEirAccessParams {
  action: string;
  eirNumber?: string | null;
  transactionId?: number | null;
  actorType?: string | null;
  actorId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  db?: DbPool;
}

export async function logEirAccess(params: LogEirAccessParams): Promise<void> {
  try {
    const db = params.db ?? await getDb();
    await db.request()
      .input('eirNumber', sql.NVarChar(80), params.eirNumber ?? null)
      .input('transactionId', sql.Int, params.transactionId ?? null)
      .input('action', sql.NVarChar(80), params.action)
      .input('actorType', sql.NVarChar(80), params.actorType ?? null)
      .input('actorId', sql.Int, params.actorId ?? null)
      .input('ipAddress', sql.NVarChar(80), params.ipAddress ?? null)
      .input('userAgent', sql.NVarChar(500), params.userAgent ?? null)
      .input('metadata', sql.NVarChar(sql.MAX), params.metadata ? JSON.stringify(params.metadata) : null)
      .query(`
        INSERT INTO EIRAccessLog (
          eir_number,
          transaction_id,
          action,
          actor_type,
          actor_id,
          ip_address,
          user_agent,
          metadata
        )
        VALUES (
          @eirNumber,
          @transactionId,
          @action,
          @actorType,
          @actorId,
          @ipAddress,
          @userAgent,
          @metadata
        )
      `);
  } catch {
    // Access logging is best-effort until the durable schema is introduced.
  }
}
