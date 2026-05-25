import sql from 'mssql';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export type EirAccessAction = 'view' | 'download' | 'print' | 'public_verify';

export interface EirAccessLogDbRequest {
  input(name: string, type: unknown, value: unknown): EirAccessLogDbRequest;
  query(statement: string): Promise<unknown>;
}

export interface EirAccessLogDb {
  request(): EirAccessLogDbRequest;
}

export interface LogEirAccessParams {
  db?: EirAccessLogDb;
  request?: NextRequest;
  eirNumber: string;
  gateTransactionId?: number | null;
  userId?: number | null;
  customerId?: number | null;
  viewType?: string | null;
  action: EirAccessAction;
  ipAddress?: string | null;
  userAgent?: string | null;

  // Legacy Task 3 fields kept so existing callers can move over incrementally.
  transactionId?: number | null;
  actorType?: string | null;
  actorId?: number | null;
}

function getClientIp(request?: NextRequest): string | null {
  const forwardedFor = request?.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return request?.headers.get('x-real-ip') || null;
}

export async function logEirAccess(params: LogEirAccessParams): Promise<void> {
  try {
    const db = params.db ?? await getDb();
    const ipAddress = getClientIp(params.request) ?? params.ipAddress ?? null;
    const userAgent = params.request?.headers.get('user-agent') ?? params.userAgent ?? null;
    const gateTransactionId = params.gateTransactionId ?? params.transactionId ?? null;
    const userId = params.userId ?? params.actorId ?? null;
    const viewType = params.viewType ?? params.actorType ?? 'public';

    await db.request()
      .input('eirNumber', sql.NVarChar(80), params.eirNumber ?? null)
      .input('gateTransactionId', sql.Int, gateTransactionId)
      .input('userId', sql.Int, userId)
      .input('customerId', sql.Int, params.customerId ?? null)
      .input('viewType', sql.NVarChar(40), viewType)
      .input('action', sql.NVarChar(30), params.action)
      .input('ipAddress', sql.NVarChar(100), ipAddress)
      .input('userAgent', sql.NVarChar(500), userAgent)
      .query(`
        INSERT INTO EIRAccessLog (
          eir_number,
          gate_transaction_id,
          user_id,
          customer_id,
          view_type,
          action,
          ip_address,
          user_agent,
          accessed_at
        )
        VALUES (
          @eirNumber,
          @gateTransactionId,
          @userId,
          @customerId,
          @viewType,
          @action,
          @ipAddress,
          @userAgent,
          GETDATE()
        )
      `);
  } catch (error) {
    console.error('EIR access logging failed:', error);
  }
}
