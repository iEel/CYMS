import {
  RECONCILIATION_ISSUE_DEFINITIONS,
  buildReconciliationIssueResponse,
  decorateReconciliationIssue,
  type ReconciliationIssueResult,
} from '@/lib/reconciliationIssueRegistry';
import type { ReconciliationActionRecord } from '@/lib/reconciliationActions';

describe('reconciliation issue registry', () => {
  it('exports reconciliation issue definitions in report query order', () => {
    expect(RECONCILIATION_ISSUE_DEFINITIONS.map(issue => issue.code)).toEqual([
      'gate_missing_eir',
      'gate_missing_billing_clearance',
      'invoice_open_overdue',
      'booking_over_received',
      'booking_over_released',
      'mnr_completed_without_invoice',
      'edi_failed',
      'customer_credit_over_limit',
    ]);
  });

  it('decorates customer credit issues from data quality rules', () => {
    const result = decorateReconciliationIssue('customer_credit_over_limit', 'Fallback', 'warning');

    expect(result.title).toBeTruthy();
    expect(result.owner_role).toBeTruthy();
    expect(result.recommended_action).toBeTruthy();
  });

  it('overlays action state and hides closed reconciliation rows when requested', () => {
    const issue: ReconciliationIssueResult = {
      code: 'invoice_open_overdue',
      title: 'Open or overdue invoice',
      severity: 'warning',
      owner_role: 'Billing',
      recommended_action: 'Review invoice',
      message: 'Invoice is still open',
      count: 2,
      rows: [
        { entity_id: 1, reference: 'INV-1', created_at: '2026-06-01T00:00:00.000Z' },
        { entity_id: 2, reference: 'INV-2', created_at: '2026-06-02T00:00:00.000Z' },
      ],
      unavailable: false,
    };
    const actions: ReconciliationActionRecord[] = [
      {
        action_id: 11,
        issue_code: 'invoice_open_overdue',
        entity_id: 1,
        status: 'resolved',
        reason: 'Paid',
        updated_at: '2026-06-03T00:00:00.000Z',
      },
    ];

    const result = buildReconciliationIssueResponse({
      issue,
      actions,
      includeClosed: false,
      now: new Date('2026-06-05T00:00:00.000Z'),
    });

    expect(result.raw_count).toBe(2);
    expect(result.closed_count).toBe(1);
    expect(result.count).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      entity_id: 2,
      action_status: 'open',
      deep_link: '/billing?invoice_id=2',
    });
  });
});
