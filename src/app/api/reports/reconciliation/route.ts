import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { ensureCustomerCreditColumns } from '@/lib/customerCredit';
import {
  RECONCILIATION_ISSUE_DEFINITIONS,
  buildReconciliationIssueResponse,
  loadReconciliationActionRecords,
  runReconciliationIssue,
} from '@/lib/reconciliationIssueRegistry';
import { requireRequestActor, requireYardAccess } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';
import { assertRuntimeSchemaReady } from '@/lib/schemaCapabilities';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawYardId = searchParams.get('yard_id');
    const yardId = Number(rawYardId);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200);
    const includeClosed = searchParams.get('include_closed') === '1';
    const db = await getDb();
    assertRuntimeSchemaReady();
    const yardAccess = await requireYardAccess(request, db, rawYardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    await ensureCustomerCreditColumns(db);

    const issues = [];
    for (const definition of RECONCILIATION_ISSUE_DEFINITIONS) {
      issues.push(await runReconciliationIssue(db, yardId, limit, definition));
    }
    const actions = await loadReconciliationActionRecords(db, yardId);
    const enrichedIssues = issues.map((issue) => buildReconciliationIssueResponse({ issue, actions, includeClosed }));

    const availableIssues = enrichedIssues.filter((issue) => !issue.unavailable);
    const summary = {
      total_open: availableIssues.reduce((sum, issue) => sum + issue.count, 0),
      critical: availableIssues.filter((issue) => issue.severity === 'critical').reduce((sum, issue) => sum + issue.count, 0),
      warning: availableIssues.filter((issue) => issue.severity === 'warning').reduce((sum, issue) => sum + issue.count, 0),
      info: availableIssues.filter((issue) => issue.severity === 'info').reduce((sum, issue) => sum + issue.count, 0),
      unavailable_checks: issues.filter((issue) => issue.unavailable).length,
    };

    return NextResponse.json({
      yard_id: yardId,
      generated_at: new Date().toISOString(),
      summary,
      issues: enrichedIssues,
    });
  } catch (error) {
    console.error('GET reconciliation report error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายงาน reconciliation ได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = requireRequestActor(request);
  if (actor instanceof NextResponse) return actor;

  try {
    const body = await request.json();
    const yardId = Number(body.yard_id);
    const issueCode = typeof body.issue_code === 'string' ? body.issue_code.trim() : '';
    const entityId = Number.isInteger(Number(body.entity_id)) ? Number(body.entity_id) : null;
    const entityRef = typeof body.entity_ref === 'string' ? body.entity_ref.trim() : null;
    const status = typeof body.status === 'string' ? body.status : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null;
    const assignedTo = typeof body.assigned_to === 'string' ? body.assigned_to.trim() : null;

    if (!issueCode || !['open', 'resolved', 'ignored'].includes(status)) {
      return NextResponse.json({ error: 'issue_code หรือ status ไม่ถูกต้อง' }, { status: 400 });
    }
    if (!entityId && !entityRef) {
      return NextResponse.json({ error: 'ต้องระบุ entity_id หรือ entity_ref' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('issueCode', sql.NVarChar(80), issueCode)
      .input('entityId', sql.Int, entityId)
      .input('entityRef', sql.NVarChar(150), entityRef)
      .input('status', sql.NVarChar(20), status)
      .input('reason', sql.NVarChar(500), reason)
      .input('assignedTo', sql.NVarChar(100), assignedTo)
      .input('actorId', sql.Int, actor.userId)
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

    const actionId = result.recordset[0]?.action_id || null;
    await logAudit({
      userId: actor.userId,
      yardId,
      action: `reconciliation_${status}`,
      entityType: 'reconciliation_issue',
      entityId: actionId,
      details: { issue_code: issueCode, entity_id: entityId, entity_ref: entityRef, reason, assigned_to: assignedTo },
    });

    return NextResponse.json({ success: true, action_id: actionId, status });
  } catch (error) {
    console.error('PATCH reconciliation action error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสถานะ reconciliation ได้' }, { status: 500 });
  }
}
