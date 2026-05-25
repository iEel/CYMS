import sql from 'mssql';
import type { PortalEntityType } from './portalAccess';

export interface PortalEntityAccessDbRequest {
  input(name: string, type: unknown, value: unknown): PortalEntityAccessDbRequest;
  query(statement: string): Promise<unknown>;
}

export interface PortalEntityAccessDb {
  request(): PortalEntityAccessDbRequest;
}

export interface PortalEntityAccessGrant {
  db: PortalEntityAccessDb;
  customerId?: number | null;
  entityType: PortalEntityType;
  entityId?: number | null;
  entityRef?: string | null;
  accessRole: string;
  sourceTable: string;
  sourceId?: number | null;
  permissionScope?: Record<string, unknown> | string | null;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
}

function positiveInt(value?: number | null) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function normalizePermissionScope(value?: Record<string, unknown> | string | null) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export async function upsertPortalEntityAccess(params: PortalEntityAccessGrant) {
  const customerId = positiveInt(params.customerId);
  const entityId = positiveInt(params.entityId);
  const entityRef = params.entityRef?.trim() || null;
  const sourceId = positiveInt(params.sourceId);

  if (!customerId || (!entityId && !entityRef)) return;

  try {
    const permissionScope = normalizePermissionScope(params.permissionScope);

    await params.db.request()
      .input('customerId', sql.Int, customerId)
      .input('entityType', sql.NVarChar, params.entityType)
      .input('entityId', sql.Int, entityId)
      .input('entityRef', sql.NVarChar, entityRef)
      .input('accessRole', sql.NVarChar, params.accessRole)
      .input('sourceTable', sql.NVarChar, params.sourceTable)
      .input('sourceId', sql.Int, sourceId)
      .input('permissionScope', sql.NVarChar, permissionScope)
      .input('validFrom', sql.DateTime2, params.validFrom ?? null)
      .input('validUntil', sql.DateTime2, params.validUntil ?? null)
      .query(`
        IF EXISTS (
          SELECT 1
          FROM PortalEntityAccess
          WHERE customer_id = @customerId
            AND entity_type = @entityType
            AND access_role = @accessRole
            AND is_active = 1
            AND (
              (@entityId IS NOT NULL AND entity_id = @entityId)
              OR (@entityId IS NULL AND @entityRef IS NOT NULL AND entity_ref = @entityRef)
            )
        )
        UPDATE PortalEntityAccess
        SET source_table = @sourceTable,
            source_id = @sourceId,
            permission_scope = COALESCE(@permissionScope, permission_scope),
            valid_from = COALESCE(@validFrom, valid_from),
            valid_until = COALESCE(@validUntil, valid_until),
            updated_at = GETDATE()
        WHERE customer_id = @customerId
          AND entity_type = @entityType
          AND access_role = @accessRole
          AND is_active = 1
          AND (
            (@entityId IS NOT NULL AND entity_id = @entityId)
            OR (@entityId IS NULL AND @entityRef IS NOT NULL AND entity_ref = @entityRef)
          )
        ELSE
          INSERT INTO PortalEntityAccess (
            customer_id, entity_type, entity_id, entity_ref, access_role, source_table, source_id,
            permission_scope, valid_from, valid_until
          )
          VALUES (
            @customerId, @entityType, @entityId, @entityRef, @accessRole, @sourceTable, @sourceId,
            @permissionScope, @validFrom, @validUntil
          )
      `);
  } catch (error) {
    console.error('⚠️ Portal entity access grant failed:', error);
  }
}
