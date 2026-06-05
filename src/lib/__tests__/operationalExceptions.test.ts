import type { ConnectionPool } from 'mssql';

import {
  buildOperationalIssueCode,
  normalizeApprovalException,
  normalizeReconciliationException,
  normalizeReeferException,
  normalizeTransportException,
  summarizeOperationalExceptions,
  type OperationalExceptionItem,
} from '../operationalExceptions';
import {
  loadOperationalActionRecords,
  upsertOperationalAction,
} from '../operationalExceptionActions';

function makeOperationalItem(overrides: Partial<OperationalExceptionItem>): OperationalExceptionItem {
  return {
    exception_id: 'reconciliation.invoice_open_overdue:1',
    source: 'reconciliation',
    issue_code: 'reconciliation.invoice_open_overdue',
    title: 'Open invoice',
    message: 'Open invoice',
    severity: 'warning',
    status: 'open',
    entity_type: 'reconciliation_issue',
    entity_id: 1,
    entity_ref: 'INV-1',
    href: '/billing?invoice_id=1',
    allowed_actions: ['assign', 'resolve', 'ignore', 'open_detail'],
    context: {},
    ...overrides,
  };
}

function makeDb(recordset: Array<Record<string, unknown>>) {
  type MockRequest = {
    input: jest.Mock;
    query: jest.Mock;
  };

  const request = {} as MockRequest;
  request.input = jest.fn((): MockRequest => request);
  request.query = jest.fn(async (statement: string) => ({ recordset, statement }));

  const db = {
    request: jest.fn(() => request),
  };

  return { db: db as unknown as ConnectionPool, request };
}

describe('operational exception normalization', () => {
  it('namespaces issue codes by source', () => {
    expect(buildOperationalIssueCode('reefer', 'out_of_range')).toBe('reefer.out_of_range');
  });

  it('normalizes reconciliation rows into operational exceptions', () => {
    const item = normalizeReconciliationException({
      issue: {
        code: 'invoice_open_overdue',
        title: 'Open invoice',
        severity: 'warning',
        owner_role: 'Billing',
        recommended_action: 'Follow up payment',
      },
      row: {
        entity_id: 7,
        reference: 'INV-7',
        customer_name: 'ACME',
        action_status: 'open',
        sla_age_days: 4,
        deep_link: '/billing?invoice_id=7',
      },
    });

    expect(item.source).toBe('reconciliation');
    expect(item.exception_id).toBe('reconciliation.invoice_open_overdue:7');
    expect(item.status).toBe('open');
    expect(item.href).toBe('/billing?invoice_id=7');
    expect(item.context.customer_name).toBe('ACME');
  });

  it('normalizes reefer exceptions with severity and SLA context', () => {
    const item = normalizeReeferException({
      exception_id: 3,
      container_number: 'RFPU1234567',
      severity: 'critical',
      status: 'open',
      reason: 'out_of_range',
      recommended_action: 'Check reefer unit',
      escalation_breached: true,
      escalation_age_minutes: 180,
    });

    expect(item.source).toBe('reefer');
    expect(item.exception_id).toBe('reefer.out_of_range:3');
    expect(item.severity).toBe('critical');
    expect(item.status).toBe('open');
    expect(item.sla_breached).toBe(true);
    expect(item.href).toContain('/reefer');
  });

  it('maps high reefer severity into the normalized severity scale', () => {
    const item = normalizeReeferException({
      exception_id: 4,
      reason: 'out_of_range',
      severity: 'high',
      status: 'open',
    });

    expect(item.severity).toBe('warning');
  });

  it('keeps approval exceptions as deep-link only actions', () => {
    const item = normalizeApprovalException({
      review_id: 9,
      permission_code: 'billing.waive.approve',
      entity_type: 'billing_clearance',
      entity_id: 22,
      status: 'pending_review',
      reason: 'waive request',
      requested_by_name: 'Gate User',
    });

    expect(item.source).toBe('approval');
    expect(item.entity_id).toBe(9);
    expect(item.allowed_actions).toEqual(['open_detail']);
    expect(item.href).toBe('/supervisor-review?review_id=9');
  });

  it('normalizes transport attention jobs', () => {
    const item = normalizeTransportException({
      request_id: 12,
      status: 'issue_reported',
      container_number: 'TLLU1234567',
      booking_number: 'BK-1',
      attention_reason: 'Driver reported damaged seal',
    });

    expect(item.source).toBe('transport');
    expect(item.entity_ref).toBe('TLLU1234567');
    expect(item.allowed_actions).toContain('acknowledge');
    expect(item.href).toBe('/transport?job=request-12');
  });

  it('summarizes open exception counts by severity and source', () => {
    const summary = summarizeOperationalExceptions([
      makeOperationalItem({
        source: 'reefer',
        issue_code: 'reefer.power_issue',
        exception_id: 'reefer.power_issue:1',
        severity: 'critical',
        status: 'open',
        sla_breached: true,
      }),
      makeOperationalItem({
        source: 'reconciliation',
        issue_code: 'reconciliation.invoice_open_overdue',
        exception_id: 'reconciliation.invoice_open_overdue:2',
        severity: 'warning',
        status: 'open',
      }),
      makeOperationalItem({
        source: 'transport',
        issue_code: 'transport.issue_reported',
        exception_id: 'transport.issue_reported:3',
        severity: 'info',
        status: 'ignored',
      }),
      makeOperationalItem({
        source: 'approval',
        issue_code: 'approval.pending_review',
        exception_id: 'approval.pending_review:4',
        severity: 'warning',
        status: 'resolved',
      }),
    ]);

    expect(summary.total_open).toBe(2);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(1);
    expect(summary.info).toBe(0);
    expect(summary.sla_breached).toBe(1);
    expect(summary.by_source).toEqual({
      reconciliation: 1,
      reefer: 1,
      approval: 0,
      transport: 0,
    });
  });
});

describe('operational exception action records', () => {
  it('loads action records scoped to a yard', async () => {
    const { db, request } = makeDb([
      {
        action_id: 1,
        issue_code: 'reefer.out_of_range',
        entity_id: 3,
        status: 'acknowledged',
      },
    ]);

    const records = await loadOperationalActionRecords(db, 5);

    expect(request.input).toHaveBeenCalledWith('yardId', expect.anything(), 5);
    expect(request.query.mock.calls[0][0]).toContain('FROM ReconciliationActions');
    expect(request.query.mock.calls[0][0]).toContain('WHERE yard_id = @yardId');
    expect(records[0]).toMatchObject({
      issue_code: 'reefer.out_of_range',
      status: 'acknowledged',
    });
  });

  it('upserts action state with a parameterized MERGE', async () => {
    const { db, request } = makeDb([{ action_id: 42 }]);

    const actionId = await upsertOperationalAction(db, {
      yardId: 5,
      issueCode: 'transport.issue_reported',
      entityId: 12,
      entityRef: 'TLLU1234567',
      status: 'acknowledged',
      reason: 'Driver contacted',
      assignedTo: 'Ops Lead',
      actor: { userId: 99, role: 'supervisor' },
    });

    expect(actionId).toBe(42);
    expect(request.input).toHaveBeenCalledWith('yardId', expect.anything(), 5);
    expect(request.input).toHaveBeenCalledWith('issueCode', expect.anything(), 'transport.issue_reported');
    expect(request.input).toHaveBeenCalledWith('actorId', expect.anything(), 99);
    expect(request.query.mock.calls[0][0]).toContain('MERGE ReconciliationActions WITH (HOLDLOCK) AS target');
    expect(request.query.mock.calls[0][0]).toContain('OUTPUT INSERTED.action_id');
  });
});
