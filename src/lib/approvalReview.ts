import sql from 'mssql';
import { logAudit } from '@/lib/audit';

type DbPool = sql.ConnectionPool;

interface ApprovalReviewParams {
  db: DbPool;
  yardId?: number | null;
  permissionCode: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  requestedBy?: number | null;
  approvedBy?: number | null;
  reason?: string | null;
  details?: Record<string, unknown>;
}

export async function ensureApprovalReviews(db: DbPool) {
  await db.request().query(`
    IF OBJECT_ID('ApprovalReviews', 'U') IS NULL
    BEGIN
      CREATE TABLE ApprovalReviews (
        review_id INT PRIMARY KEY IDENTITY(1,1),
        yard_id INT NULL,
        permission_code NVARCHAR(100) NOT NULL,
        action NVARCHAR(100) NOT NULL,
        entity_type NVARCHAR(50) NOT NULL,
        entity_id INT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'pending_review',
        requested_by INT NULL,
        approved_by INT NULL,
        reason NVARCHAR(500) NULL,
        details NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        reviewed_at DATETIME2 NULL
      );
    END
  `);
}

/**
 * Soft approval review.
 * The operation already completed; this only creates a supervisor review item.
 * It intentionally swallows errors so approval logging never blocks yard work.
 */
export async function logApprovalReview(params: ApprovalReviewParams) {
  try {
    await ensureApprovalReviews(params.db);

    const status = params.approvedBy ? 'approved' : 'pending_review';
    const result = await params.db.request()
      .input('yardId', sql.Int, params.yardId || null)
      .input('permissionCode', sql.NVarChar, params.permissionCode)
      .input('action', sql.NVarChar, params.action)
      .input('entityType', sql.NVarChar, params.entityType)
      .input('entityId', sql.Int, params.entityId || null)
      .input('status', sql.NVarChar, status)
      .input('requestedBy', sql.Int, params.requestedBy || null)
      .input('approvedBy', sql.Int, params.approvedBy || null)
      .input('reason', sql.NVarChar, params.reason || null)
      .input('details', sql.NVarChar, JSON.stringify(params.details || {}))
      .query(`
        INSERT INTO ApprovalReviews (
          yard_id, permission_code, action, entity_type, entity_id,
          status, requested_by, approved_by, reason, details, reviewed_at
        )
        OUTPUT INSERTED.review_id
        VALUES (
          @yardId, @permissionCode, @action, @entityType, @entityId,
          @status, @requestedBy, @approvedBy, @reason, @details,
          CASE WHEN @approvedBy IS NULL THEN NULL ELSE GETDATE() END
        )
      `);

    await logAudit({
      userId: params.requestedBy || null,
      yardId: params.yardId || null,
      action: status === 'approved' ? 'approval_review_recorded' : 'approval_review_pending',
      entityType: 'approval_review',
      entityId: result.recordset[0]?.review_id || null,
      details: {
        permission_code: params.permissionCode,
        reviewed_action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        status,
        reason: params.reason || null,
      },
    });
  } catch (error) {
    console.warn('⚠️ Approval review log failed:', error);
  }
}
