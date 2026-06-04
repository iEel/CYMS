import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { z } from 'zod';

import { getDb } from '@/lib/db';
import {
  buildTransportJobAccessSql,
  requireTransportPortalActor,
  resolveTransportJobId,
} from '@/lib/transportPortalAccess';

const actionBodySchema = z.object({
  job_id: z.string().trim().min(1).max(80),
  action: z.enum(['confirm_job', 'mark_arrived', 'report_issue', 'add_proof']),
  note: z.string().trim().max(1000).nullable().optional(),
  proof_url: z.string().trim().max(500).nullable().optional(),
  proof_type: z.enum(['pickup', 'arrival', 'seal', 'other']).optional().default('pickup'),
});

const finalRequestStatuses = new Set(['released', 'completed', 'cancelled', 'rejected']);

type TransportAction = z.infer<typeof actionBodySchema>['action'];

const transitionRules: Record<TransportAction, { nextStatus: string | null; allowedPreviousStatuses: string[] }> = {
  confirm_job: {
    nextStatus: 'confirmed',
    allowedPreviousStatuses: ['requested', 'pending', 'issue_reported'],
  },
  mark_arrived: {
    nextStatus: 'at_gate',
    allowedPreviousStatuses: ['confirmed', 'issue_reported'],
  },
  report_issue: {
    nextStatus: 'issue_reported',
    allowedPreviousStatuses: ['requested', 'pending', 'confirmed', 'at_gate'],
  },
  add_proof: {
    nextStatus: null,
    allowedPreviousStatuses: ['requested', 'pending', 'confirmed', 'at_gate', 'issue_reported'],
  },
};

const safeUploadUrlPattern = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|webp|gif|pdf)$/i;

function asStatus(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function isSafeUploadUrl(value: string) {
  return (
    value.startsWith('/uploads/') &&
    !value.includes('..') &&
    !value.includes('\\') &&
    !value.includes('?') &&
    !value.includes('#') &&
    safeUploadUrlPattern.test(value)
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireTransportPortalActor(request, db, 'transport.jobs.action');
    if (actor instanceof NextResponse) return actor;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON body ไม่ถูกต้อง' }, { status: 400 });
    }

    const parsed = actionBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'คำสั่งงานขนส่งไม่ถูกต้อง' }, { status: 400 });
    }

    const body = parsed.data;
    const job = resolveTransportJobId(body.job_id);
    if (!job) {
      return NextResponse.json({ error: 'job_id ไม่ถูกต้อง' }, { status: 400 });
    }

    if (job.source !== 'gate_out_request') {
      return NextResponse.json(
        { error: 'Transport Portal ไม่สามารถแก้ไขรายการ Gate ที่เสร็จแล้วได้' },
        { status: 400 },
      );
    }

    const accessSql = buildTransportJobAccessSql(actor);
    const jobResult = await db.request()
      .input('transportUserId', sql.Int, actor.userId)
      .input('transportCustomerId', sql.Int, actor.customerId)
      .input('requestId', sql.Int, job.id)
      .query(`
        SELECT TOP 1
          gor.request_id,
          gor.status,
          gor.gate_transaction_id,
          gor.driver_user_id,
          gor.trucking_company_id,
          gor.booking_id
        FROM GateOutRequests gor
        LEFT JOIN GateTransactions g ON g.transaction_id = gor.gate_transaction_id
        LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
          OR (gor.booking_ref IS NOT NULL AND b.booking_number = gor.booking_ref AND b.yard_id = gor.yard_id)
        WHERE gor.request_id = @requestId
          AND ${accessSql}
      `);

    const row = jobResult.recordset[0];
    if (!row) {
      return NextResponse.json({ error: 'ไม่พบงานขนส่งหรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const previousStatus = asStatus(row.status);
    if (finalRequestStatuses.has(previousStatus)) {
      return NextResponse.json({ error: 'งานขนส่งนี้สิ้นสุดแล้ว' }, { status: 409 });
    }

    const transitionRule = transitionRules[body.action];
    if (!transitionRule.allowedPreviousStatuses.includes(previousStatus)) {
      return NextResponse.json({ error: 'สถานะงานขนส่งไม่รองรับคำสั่งนี้' }, { status: 409 });
    }

    if (body.action === 'report_issue' && !body.note) {
      return NextResponse.json({ error: 'กรุณาระบุรายละเอียดปัญหา' }, { status: 400 });
    }

    if (body.action === 'add_proof' && (!body.proof_url || !isSafeUploadUrl(body.proof_url))) {
      return NextResponse.json({ error: 'proof_url ต้องอยู่ใน /uploads/' }, { status: 400 });
    }

    const nextStatus = transitionRule.nextStatus;
    const responseStatus = nextStatus ?? previousStatus;

    if (nextStatus) {
      const updateRequest = db.request()
        .input('requestId', sql.Int, job.id)
        .input('newStatus', sql.NVarChar(40), nextStatus)
        .input('transportUserId', sql.Int, actor.userId)
        .input('transportCustomerId', sql.Int, actor.customerId);

      const allowedStatusParams = transitionRule.allowedPreviousStatuses.map((status, index) => {
        const paramName = `allowedStatus${index}`;
        updateRequest.input(paramName, sql.NVarChar(40), status);
        return `@${paramName}`;
      });

      const updateResult = await updateRequest.query(`
        UPDATE gor SET status = @newStatus, updated_at = GETDATE()
        FROM GateOutRequests gor
        LEFT JOIN GateTransactions g ON g.transaction_id = gor.gate_transaction_id
        LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
          OR (gor.booking_ref IS NOT NULL AND b.booking_number = gor.booking_ref AND b.yard_id = gor.yard_id)
        WHERE gor.request_id = @requestId
          AND gor.status IN (${allowedStatusParams.join(', ')})
          AND ${accessSql}
        `);

      if (Array.isArray(updateResult.rowsAffected) && updateResult.rowsAffected[0] === 0) {
        return NextResponse.json({ error: 'สถานะงานขนส่งเปลี่ยนไปแล้ว' }, { status: 409 });
      }
    }

    if (body.action === 'add_proof') {
      const proofRequest = db.request()
        .input('jobSource', sql.NVarChar(40), 'gate_out_request')
        .input('jobId', sql.Int, job.id)
        .input('requestId', sql.Int, job.id)
        .input('proofType', sql.NVarChar(40), body.proof_type)
        .input('proofUrl', sql.NVarChar(500), body.proof_url)
        .input('note', sql.NVarChar(1000), body.note || null)
        .input('uploadedByUserId', sql.Int, actor.userId)
        .input('uploadedByCustomerId', sql.Int, actor.customerId)
        .input('action', sql.NVarChar(40), body.action)
        .input('actorUserId', sql.Int, actor.userId)
        .input('actorCustomerId', sql.Int, actor.customerId)
        .input('actorMode', sql.NVarChar(20), actor.mode)
        .input('transportUserId', sql.Int, actor.userId)
        .input('transportCustomerId', sql.Int, actor.customerId);

      const allowedStatusParams = transitionRule.allowedPreviousStatuses.map((status, index) => {
        const paramName = `allowedStatus${index}`;
        proofRequest.input(paramName, sql.NVarChar(40), status);
        return `@${paramName}`;
      });

      const guardedProofWhere = `
        FROM GateOutRequests gor WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN GateTransactions g ON g.transaction_id = gor.gate_transaction_id
        LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
          OR (gor.booking_ref IS NOT NULL AND b.booking_number = gor.booking_ref AND b.yard_id = gor.yard_id)
        WHERE gor.request_id = @requestId
          AND gor.status IN (${allowedStatusParams.join(', ')})
          AND ${accessSql}
      `;

      const proofResult = await proofRequest.query(`
        DECLARE @proofRows INT = 0;
        DECLARE @activityRows INT = 0;

        BEGIN TRY
          BEGIN TRAN;

          INSERT INTO TransportJobProofs (
            job_source, job_id, proof_type, file_url, note,
            uploaded_by_user_id, uploaded_by_customer_id
          )
          SELECT
            @jobSource, @jobId, @proofType, @proofUrl, @note,
            @uploadedByUserId, @uploadedByCustomerId
          ${guardedProofWhere};
          SET @proofRows = @@ROWCOUNT;

          INSERT INTO TransportJobActivities (
            job_source, job_id, action, previous_status, new_status,
            note, proof_url, actor_user_id, actor_customer_id, actor_mode
          )
          SELECT
            @jobSource, @jobId, @action, gor.status, gor.status,
            @note, @proofUrl, @actorUserId, @actorCustomerId, @actorMode
          ${guardedProofWhere};
          SET @activityRows = @@ROWCOUNT;

          IF @proofRows <> 1 OR @activityRows <> 1
          BEGIN
            ROLLBACK;
            SELECT CAST(0 AS INT) AS success, @proofRows AS proofRows, @activityRows AS activityRows;
          END
          ELSE
          BEGIN
            COMMIT;
            SELECT CAST(1 AS INT) AS success, @proofRows AS proofRows, @activityRows AS activityRows;
          END
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK;
          THROW;
        END CATCH
      `);

      const proofSuccess = Number((proofResult.recordset?.[0] as { success?: unknown } | undefined)?.success) === 1;
      if (!proofSuccess) {
        return NextResponse.json({ error: 'สถานะงานขนส่งเปลี่ยนไปแล้ว' }, { status: 409 });
      }

      return NextResponse.json({
        success: true,
        action: body.action,
        status: responseStatus,
      });
    }

    await db.request()
      .input('jobSource', sql.NVarChar(40), 'gate_out_request')
      .input('jobId', sql.Int, job.id)
      .input('action', sql.NVarChar(40), body.action)
      .input('previousStatus', sql.NVarChar(40), previousStatus || null)
      .input('newStatus', sql.NVarChar(40), responseStatus || null)
      .input('note', sql.NVarChar(1000), body.note || null)
      .input('proofUrl', sql.NVarChar(500), body.proof_url || null)
      .input('actorUserId', sql.Int, actor.userId)
      .input('actorCustomerId', sql.Int, actor.customerId)
      .input('actorMode', sql.NVarChar(20), actor.mode)
      .query(`
        INSERT INTO TransportJobActivities (
          job_source, job_id, action, previous_status, new_status,
          note, proof_url, actor_user_id, actor_customer_id, actor_mode
        )
        VALUES (
          @jobSource, @jobId, @action, @previousStatus, @newStatus,
          @note, @proofUrl, @actorUserId, @actorCustomerId, @actorMode
        )
      `);

    return NextResponse.json({
      success: true,
      action: body.action,
      status: responseStatus,
    });
  } catch (error) {
    console.error('Transport actions API error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตงานขนส่งได้' }, { status: 500 });
  }
}
