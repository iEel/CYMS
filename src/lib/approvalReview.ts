import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, requireRequestActor, type RequestActor } from '@/lib/apiAuth';

interface ApprovalDbRequest {
  input(name: string, type: unknown, value: unknown): ApprovalDbRequest;
  query(statement: string): Promise<{ recordset: Array<Record<string, unknown>> }>;
}

interface DbPool {
  request(): ApprovalDbRequest;
}

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

interface HardApprovalParams extends ApprovalReviewParams {
  request: NextRequest;
  approvalPermissionCode: string;
  pendingMessage?: string;
}

interface ApprovedAction {
  status: 'approved';
  actor: RequestActor;
  approvedBy: number;
}

export async function ensureApprovalReviews(db: DbPool) {
  void db;
}

export async function requireApprovalForAction(params: HardApprovalParams): Promise<ApprovedAction | NextResponse> {
  const actor = requireRequestActor(params.request);
  if (actor instanceof NextResponse) return actor;

  const approvalCheck = await requirePermission(
    params.request,
    params.db,
    params.approvalPermissionCode,
    params.pendingMessage || 'ต้องรออนุมัติก่อนดำเนินการ'
  );

  if (!(approvalCheck instanceof NextResponse)) {
    return { status: 'approved', actor, approvedBy: actor.userId };
  }
  if (approvalCheck.status === 401) return approvalCheck;

  await ensureApprovalReviews(params.db);
  const details = {
    ...(params.details || {}),
    requested_permission_code: params.permissionCode,
    approval_permission_code: params.approvalPermissionCode,
    hard_gate: true,
  };

  const result = await params.db.request()
    .input('yardId', sql.Int, params.yardId || null)
    .input('permissionCode', sql.NVarChar, params.permissionCode)
    .input('action', sql.NVarChar, params.action)
    .input('entityType', sql.NVarChar, params.entityType)
    .input('entityId', sql.Int, params.entityId || null)
    .input('requestedBy', sql.Int, actor.userId)
    .input('reason', sql.NVarChar, params.reason || null)
    .input('details', sql.NVarChar, JSON.stringify(details))
    .query(`
      INSERT INTO ApprovalReviews (
        yard_id, permission_code, action, entity_type, entity_id,
        status, requested_by, approved_by, reason, details, reviewed_at
      )
      OUTPUT INSERTED.review_id
      VALUES (
        @yardId, @permissionCode, @action, @entityType, @entityId,
        'pending_review', @requestedBy, NULL, @reason, @details, NULL
      )
    `);

  const reviewId = Number(result.recordset[0]?.review_id || 0) || null;
  await logAudit({
    userId: actor.userId,
    yardId: params.yardId || null,
    action: 'approval_review_requested',
    entityType: 'approval_review',
    entityId: reviewId,
    details: {
      permission_code: params.permissionCode,
      approval_permission_code: params.approvalPermissionCode,
      reviewed_action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      reason: params.reason || null,
    },
  });

  return NextResponse.json(
    {
      pending_approval: true,
      review_id: reviewId,
      message: params.pendingMessage || 'ส่งคำขออนุมัติแล้ว ต้องรออนุมัติก่อนดำเนินการ',
    },
    { status: 202 }
  );
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
      entityId: Number(result.recordset[0]?.review_id || 0) || null,
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
