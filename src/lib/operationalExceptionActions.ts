import sql from 'mssql';

import type { RequestActor } from '@/lib/apiAuth';
import type { ReconciliationActionRecord, ReconciliationActionStatus } from '@/lib/reconciliationActions';

export type OperationalActionRecord = ReconciliationActionRecord;

export interface OperationalActionUpsertInput {
  yardId: number;
  issueCode: string;
  entityId?: number | null;
  entityRef?: string | null;
  status: ReconciliationActionStatus;
  reason?: string | null;
  assignedTo?: string | null;
  actor: RequestActor;
}

const OPERATIONAL_ACTION_STATUSES: ReconciliationActionStatus[] = ['open', 'resolved', 'ignored'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOperationalActionStatus(status: unknown): status is ReconciliationActionStatus {
  return OPERATIONAL_ACTION_STATUSES.includes(status as ReconciliationActionStatus);
}

function collectSqlErrorParts(error: unknown, parts: unknown[] = []): unknown[] {
  if (!isRecord(error)) return parts;

  parts.push(error);

  if (error.originalError && error.originalError !== error) {
    collectSqlErrorParts(error.originalError, parts);
  }
  if (error.info && error.info !== error) {
    collectSqlErrorParts(error.info, parts);
  }
  if (Array.isArray(error.precedingErrors)) {
    for (const precedingError of error.precedingErrors) {
      collectSqlErrorParts(precedingError, parts);
    }
  }

  return parts;
}

function isMissingSqlServerObjectError(error: unknown) {
  const parts = collectSqlErrorParts(error);
  const messages = parts
    .filter(isRecord)
    .map(part => (typeof part.message === 'string' ? part.message : ''));
  const namesReconciliationActions = messages.some(message => /ReconciliationActions/i.test(message));

  return parts.some((part) => {
    if (!isRecord(part)) return false;

    const errorNumber = Number(part.number);
    const message = typeof part.message === 'string' ? part.message : '';
    const namesMissingReconciliationActions =
      /Invalid object name\s+'?ReconciliationActions'?/i.test(message)
      || (/invalid object name/i.test(message) && /ReconciliationActions/i.test(message));

    return namesMissingReconciliationActions || (errorNumber === 208 && namesReconciliationActions);
  });
}

export async function loadOperationalActionRecords(
  db: sql.ConnectionPool,
  yardId: number,
): Promise<OperationalActionRecord[]> {
  try {
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT
          action_id,
          issue_code,
          entity_id,
          entity_ref,
          status,
          reason,
          assigned_to,
          updated_at
        FROM ReconciliationActions
        WHERE yard_id = @yardId
      `);

    return result.recordset as OperationalActionRecord[];
  } catch (error) {
    if (isMissingSqlServerObjectError(error)) return [];
    throw error;
  }
}

export async function upsertOperationalAction(
  db: sql.ConnectionPool,
  input: OperationalActionUpsertInput,
): Promise<number | null> {
  if (!isOperationalActionStatus(input.status)) {
    throw new Error('Invalid operational action status');
  }

  const result = await db.request()
    .input('yardId', sql.Int, input.yardId)
    .input('issueCode', sql.NVarChar(80), input.issueCode)
    .input('entityId', sql.Int, input.entityId ?? null)
    .input('entityRef', sql.NVarChar(150), input.entityRef ?? null)
    .input('status', sql.NVarChar(20), input.status)
    .input('reason', sql.NVarChar(500), input.reason || null)
    .input('assignedTo', sql.NVarChar(100), input.assignedTo || null)
    .input('actorId', sql.Int, input.actor.userId)
    .query(`
      MERGE ReconciliationActions WITH (HOLDLOCK) AS target
      USING (
        SELECT
          @yardId AS yard_id,
          @issueCode AS issue_code,
          @entityId AS entity_id,
          @entityRef AS entity_ref
      ) AS source
      ON target.yard_id = source.yard_id
        AND target.issue_code = source.issue_code
        AND ISNULL(target.entity_id, -1) = ISNULL(source.entity_id, -1)
        AND ISNULL(target.entity_ref, '') = ISNULL(source.entity_ref, '')
      WHEN MATCHED THEN
        UPDATE SET
          status = @status,
          reason = @reason,
          assigned_to = @assignedTo,
          updated_by = @actorId,
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (
          yard_id, issue_code, entity_id, entity_ref, status,
          reason, assigned_to, created_by, updated_by, created_at, updated_at
        )
        VALUES (
          @yardId, @issueCode, @entityId, @entityRef, @status,
          @reason, @assignedTo, @actorId, @actorId, GETDATE(), GETDATE()
        )
      OUTPUT INSERTED.action_id;
    `);

  const actionId = Number(result.recordset[0]?.action_id);
  return Number.isInteger(actionId) && actionId > 0 ? actionId : null;
}
