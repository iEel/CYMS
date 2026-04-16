import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { ensureApprovalReviews } from '@/lib/approvalReview';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const status = searchParams.get('status') || 'pending_review';
    const permissionCode = searchParams.get('permission_code');

    const db = await getDb();
    await ensureApprovalReviews(db);

    const req = db.request();
    const conditions: string[] = [];
    if (yardId) {
      conditions.push('ar.yard_id = @yardId');
      req.input('yardId', sql.Int, parseInt(yardId));
    }
    if (status && status !== 'all') {
      conditions.push('ar.status = @status');
      req.input('status', sql.NVarChar, status);
    }
    if (permissionCode) {
      conditions.push('ar.permission_code = @permissionCode');
      req.input('permissionCode', sql.NVarChar, permissionCode);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await req.query(`
      SELECT TOP 500
        ar.*,
        requester.full_name AS requested_by_name,
        approver.full_name AS approved_by_name,
        y.yard_name
      FROM ApprovalReviews ar
      LEFT JOIN Users requester ON ar.requested_by = requester.user_id
      LEFT JOIN Users approver ON ar.approved_by = approver.user_id
      LEFT JOIN Yards y ON ar.yard_id = y.yard_id
      ${where}
      ORDER BY ar.created_at DESC
    `);

    return NextResponse.json({ reviews: result.recordset });
  } catch (error) {
    console.error('❌ GET approval reviews error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายการ review ได้' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { review_id, status = 'approved', approved_by, reason } = body;

    if (!review_id || !['approved', 'rejected', 'pending_review'].includes(status)) {
      return NextResponse.json({ error: 'review_id หรือ status ไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    await ensureApprovalReviews(db);

    await db.request()
      .input('reviewId', sql.Int, review_id)
      .input('status', sql.NVarChar, status)
      .input('approvedBy', sql.Int, approved_by || null)
      .input('reason', sql.NVarChar, reason || null)
      .query(`
        UPDATE ApprovalReviews
        SET status = @status,
            approved_by = @approvedBy,
            reason = COALESCE(@reason, reason),
            reviewed_at = CASE WHEN @status = 'pending_review' THEN NULL ELSE GETDATE() END
        WHERE review_id = @reviewId
      `);

    await logAudit({
      userId: approved_by || null,
      action: `approval_review_${status}`,
      entityType: 'approval_review',
      entityId: review_id,
      details: { review_id, status, reason: reason || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT approval review error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตรายการ review ได้' }, { status: 500 });
  }
}
