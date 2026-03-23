import { getDb } from '@/lib/db';
import sql from 'mssql';

/**
 * บันทึก Audit Trail — ใคร ทำอะไร ที่ไหน อย่างไร
 * ไม่ throw error — ถ้า audit log ล้มเหลว จะไม่กระทบ main operation
 */
export async function logAudit(params: {
  userId?: number | null;
  yardId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: Record<string, unknown> | string;
}) {
  try {
    const db = await getDb();
    await db.request()
      .input('userId', sql.Int, params.userId || null)
      .input('yardId', sql.Int, params.yardId || null)
      .input('action', sql.NVarChar, params.action)
      .input('entityType', sql.NVarChar, params.entityType)
      .input('entityId', sql.Int, params.entityId || null)
      .input('details', sql.NVarChar, typeof params.details === 'string' ? params.details : JSON.stringify(params.details || {}))
      .query(`
        INSERT INTO AuditLog (user_id, yard_id, action, entity_type, entity_id, details, created_at)
        VALUES (@userId, @yardId, @action, @entityType, @entityId, @details, GETDATE())
      `);
  } catch (e) {
    console.warn('⚠️ Audit log failed:', e);
  }
}
