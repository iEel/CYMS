import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

import { getDb } from '@/lib/db';
import {
  buildTransportJobAccessSql,
  requireTransportPortalActor,
  resolveTransportJobId,
  type TransportJobSource,
} from '@/lib/transportPortalAccess';

type TimelineRow = Record<string, unknown>;

const safeUploadUrlPattern = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:jpg|jpeg|png|webp|gif|pdf)$/i;

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asString(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asIsoString(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function formatJobId(source: TransportJobSource, id: number) {
  return `${source === 'gate_out_request' ? 'request' : 'gate'}-${id}`;
}

function sanitizeUploadUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (
    !trimmed.startsWith('/uploads/') ||
    trimmed.includes('..') ||
    trimmed.includes('\\') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    !safeUploadUrlPattern.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function toActivity(row: TimelineRow) {
  return {
    activityId: asNumber(row.activity_id),
    action: asString(row.action),
    previousStatus: asNullableString(row.previous_status),
    newStatus: asNullableString(row.new_status),
    note: asNullableString(row.note),
    proofUrl: sanitizeUploadUrl(row.proof_url),
    actorMode: asString(row.actor_mode),
    createdAt: asIsoString(row.created_at),
  };
}

function toProof(row: TimelineRow) {
  return {
    proofId: asNumber(row.proof_id),
    proofType: asString(row.proof_type),
    fileUrl: sanitizeUploadUrl(row.file_url),
    note: asNullableString(row.note),
    createdAt: asIsoString(row.created_at),
  };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireTransportPortalActor(request, db, 'transport.activity.view');
    if (actor instanceof NextResponse) return actor;

    const { searchParams } = new URL(request.url);
    const job = resolveTransportJobId(searchParams.get('job_id'));
    if (!job) {
      return NextResponse.json({ error: 'job_id ไม่ถูกต้อง' }, { status: 400 });
    }

    const accessSql = buildTransportJobAccessSql(actor);
    const jobRequest = db.request()
      .input('transportUserId', sql.Int, actor.userId)
      .input('transportCustomerId', sql.Int, actor.customerId);

    const jobResult = job.source === 'gate_out_request'
      ? await jobRequest
        .input('requestId', sql.Int, job.id)
        .query(`
          SELECT TOP 1 gor.request_id
          FROM GateOutRequests gor
          LEFT JOIN GateTransactions g ON g.transaction_id = gor.gate_transaction_id
          LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
            OR (gor.booking_ref IS NOT NULL AND b.booking_number = gor.booking_ref AND b.yard_id = gor.yard_id)
          WHERE gor.request_id = @requestId
            AND ${accessSql}
        `)
      : await jobRequest
        .input('transactionId', sql.Int, job.id)
        .query(`
          SELECT TOP 1 g.transaction_id
          FROM GateTransactions g
          LEFT JOIN GateOutRequests gor ON gor.gate_transaction_id = g.transaction_id
          LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
            OR (g.booking_ref IS NOT NULL AND b.booking_number = g.booking_ref AND b.yard_id = g.yard_id)
          WHERE g.transaction_id = @transactionId
            AND ${accessSql}
        `);

    if (jobResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบงานขนส่งหรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });
    }

    const activityResult = await db.request()
      .input('jobSource', sql.NVarChar(40), job.source)
      .input('jobId', sql.Int, job.id)
      .query(`
        SELECT
          a.activity_id,
          a.action,
          a.previous_status,
          a.new_status,
          a.note,
          a.proof_url,
          a.actor_mode,
          a.created_at
        FROM TransportJobActivities a
        WHERE a.job_source = @jobSource
          AND a.job_id = @jobId
        ORDER BY a.created_at DESC, a.activity_id DESC
      `);

    const proofResult = await db.request()
      .input('jobSource', sql.NVarChar(40), job.source)
      .input('jobId', sql.Int, job.id)
      .query(`
        SELECT
          p.proof_id,
          p.proof_type,
          p.file_url,
          p.note,
          p.created_at
        FROM TransportJobProofs p
        WHERE p.job_source = @jobSource
          AND p.job_id = @jobId
        ORDER BY p.created_at DESC, p.proof_id DESC
      `);

    return NextResponse.json({
      jobId: formatJobId(job.source, job.id),
      activities: activityResult.recordset.map(toActivity),
      proofs: proofResult.recordset.map(toProof),
    });
  } catch (error) {
    console.error('Transport activity API error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดประวัติงานขนส่งได้' }, { status: 500 });
  }
}
