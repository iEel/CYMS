import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

import { getDb } from '@/lib/db';
import {
  buildTransportJobAccessSql,
  requireTransportPortalActor,
} from '@/lib/transportPortalAccess';
import type { TransportAction } from '@/components/transport/types';

type TransportJobRow = Record<string, unknown>;

const finalRequestStatuses = new Set(['released', 'completed', 'cancelled', 'rejected']);

const transitionRules: Record<TransportAction, string[]> = {
  confirm_job: ['requested', 'pending', 'issue_reported'],
  mark_arrived: ['confirmed', 'issue_reported'],
  report_issue: ['requested', 'pending', 'confirmed', 'at_gate'],
  add_proof: ['requested', 'pending', 'confirmed', 'at_gate', 'issue_reported'],
};

function asString(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value);
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asIsoString(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function buildYardSlot(row: TransportJobRow) {
  const zone = asNullableString(row.zone_name);
  const bay = row.bay === null || row.bay === undefined ? null : asNumber(row.bay);
  const rowNo = row.row_no === null || row.row_no === undefined ? null : asNumber(row.row_no);
  const tier = row.tier === null || row.tier === undefined ? null : asNumber(row.tier);
  const parts = [zone, bay, rowNo, tier].filter((part) => part !== null && part !== undefined && part !== '');
  return parts.length > 0 ? parts.join('-') : undefined;
}

function availableActionsForStatus(status: string, source: string): TransportAction[] {
  const normalized = status.trim().toLowerCase();
  if (source !== 'gate_out_request' || finalRequestStatuses.has(normalized)) return [];

  return (Object.keys(transitionRules) as TransportAction[]).filter((action) => {
    return transitionRules[action].includes(normalized);
  });
}

function toTransportJob(row: TransportJobRow) {
  const source = asString(row.source) === 'gate_transaction' ? 'gate_transaction' : 'gate_out_request';
  const status = asString(row.status, 'open');

  return {
    jobId: asString(row.job_id),
    source,
    status,
    availableActions: availableActionsForStatus(status, source),
    proofCount: asNumber(row.proof_count),
    lastActivityAt: asIsoString(row.last_activity_at),
    containerNumber: asString(row.container_number),
    bookingNumber: asNullableString(row.booking_number),
    transactionType: asNullableString(row.transaction_type),
    yardName: asNullableString(row.yard_name),
    yardSlot: buildYardSlot(row),
    requestedAt: asIsoString(row.requested_at),
    gateDatetime: asIsoString(row.gate_datetime),
    driverName: asNullableString(row.driver_name),
    truckPlate: asNullableString(row.truck_plate),
    eirNumber: asNullableString(row.eir_number),
    attentionReason: asNullableString(row.attention_reason),
  };
}

function buildSummary(jobs: ReturnType<typeof toTransportJob>[]) {
  const today = new Date().toISOString().slice(0, 10);

  return jobs.reduce(
    (summary, job) => {
      const status = job.status.toLowerCase();
      if (!['released', 'completed', 'cancelled'].includes(status)) summary.open += 1;
      if (status === 'at_gate') summary.atGate += 1;
      if (
        ['released', 'completed'].includes(status) &&
        (job.gateDatetime?.slice(0, 10) === today || job.requestedAt?.slice(0, 10) === today)
      ) {
        summary.releasedToday += 1;
      }
      if (job.attentionReason) summary.attention += 1;
      return summary;
    },
    { open: 0, atGate: 0, releasedToday: 0, attention: 0 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requireTransportPortalActor(request, db, 'transport.jobs.view');
    if (actor instanceof NextResponse) return actor;

    const accessSql = buildTransportJobAccessSql(actor);
    const result = await db.request()
      .input('transportUserId', sql.Int, actor.userId)
      .input('transportCustomerId', sql.Int, actor.customerId)
      .query(`
        WITH RequestJobs AS (
          SELECT
            CONCAT('request-', gor.request_id) AS job_id,
            'gate_out_request' AS source,
            gor.status,
            c.container_number,
            COALESCE(b.booking_number, gor.booking_ref) AS booking_number,
            'gate_out' AS transaction_type,
            y.yard_name,
            z.zone_name,
            c.bay,
            c.[row] AS row_no,
            c.tier,
            gor.requested_at,
            g.created_at AS gate_datetime,
            COALESCE(gor.driver_name, g.driver_name) AS driver_name,
            COALESCE(gor.truck_plate, g.truck_plate) AS truck_plate,
            COALESCE(gor.eir_number, g.eir_number) AS eir_number,
            COALESCE(proofStats.proof_count, 0) AS proof_count,
            activityStats.last_activity_at,
            CASE
              WHEN gor.status IN ('cancelled', 'rejected') THEN gor.status
              WHEN gor.status = 'pending' THEN 'รอดำเนินการ'
              ELSE NULL
            END AS attention_reason
          FROM GateOutRequests gor
          LEFT JOIN GateTransactions g ON g.transaction_id = gor.gate_transaction_id
          LEFT JOIN Containers c ON c.container_id = gor.container_id
          LEFT JOIN Bookings b ON b.booking_id = gor.booking_id
            OR (gor.booking_ref IS NOT NULL AND b.booking_number = gor.booking_ref AND b.yard_id = gor.yard_id)
          LEFT JOIN Yards y ON y.yard_id = gor.yard_id
          LEFT JOIN YardZones z ON z.zone_id = c.zone_id
          OUTER APPLY (
            SELECT COUNT(*) AS proof_count
            FROM TransportJobProofs tp
            WHERE tp.job_source = 'gate_out_request'
              AND tp.job_id = gor.request_id
          ) proofStats
          OUTER APPLY (
            SELECT TOP 1 ta.created_at AS last_activity_at
            FROM TransportJobActivities ta
            WHERE ta.job_source = 'gate_out_request'
              AND ta.job_id = gor.request_id
            ORDER BY ta.created_at DESC
          ) activityStats
          WHERE ${accessSql}
        ),
        GateJobs AS (
          SELECT
            CONCAT('gate-', g.transaction_id) AS job_id,
            'gate_transaction' AS source,
            CASE WHEN g.transaction_type = 'gate_out' THEN 'released' ELSE 'completed' END AS status,
            c.container_number,
            COALESCE(b.booking_number, g.booking_ref) AS booking_number,
            g.transaction_type,
            y.yard_name,
            z.zone_name,
            c.bay,
            c.[row] AS row_no,
            c.tier,
            NULL AS requested_at,
            g.created_at AS gate_datetime,
            g.driver_name,
            g.truck_plate,
            g.eir_number,
            0 AS proof_count,
            NULL AS last_activity_at,
            NULL AS attention_reason
          FROM GateTransactions g
          LEFT JOIN GateOutRequests gor ON gor.gate_transaction_id = g.transaction_id
          LEFT JOIN Containers c ON c.container_id = g.container_id
          LEFT JOIN Bookings b ON b.booking_number = g.booking_ref AND b.yard_id = g.yard_id
          LEFT JOIN Yards y ON y.yard_id = g.yard_id
          LEFT JOIN YardZones z ON z.zone_id = c.zone_id
          WHERE gor.request_id IS NULL
            AND ${accessSql}
        )
        SELECT TOP 200 *
        FROM (
          SELECT * FROM RequestJobs
          UNION ALL
          SELECT * FROM GateJobs
        ) transport_jobs
        ORDER BY COALESCE(requested_at, gate_datetime) DESC, job_id DESC
      `);

    const jobs = result.recordset.map(toTransportJob);
    return NextResponse.json({
      summary: buildSummary(jobs),
      jobs,
    });
  } catch (error) {
    console.error('Transport jobs API error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายการงานขนส่งได้' }, { status: 500 });
  }
}
