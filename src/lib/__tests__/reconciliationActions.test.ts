import {
  applyReconciliationActions,
  buildReconciliationDeepLink,
  getReconciliationEntityKey,
  type ReconciliationActionRecord,
  type ReconciliationIssueRow,
} from '@/lib/reconciliationActions';

describe('reconciliation action helpers', () => {
  it('builds stable entity keys from issue code and entity id', () => {
    expect(getReconciliationEntityKey('invoice_open_overdue', { entity_id: 42 })).toBe('invoice_open_overdue:42');
    expect(getReconciliationEntityKey('edi_failed', { reference: 'SFTP-CODECO' })).toBe('edi_failed:SFTP-CODECO');
  });

  it('maps reconciliation issues to operational deep links', () => {
    expect(buildReconciliationDeepLink('invoice_open_overdue', { entity_id: 9 })).toBe('/billing?invoice_id=9');
    expect(buildReconciliationDeepLink('booking_over_released', { entity_id: 12 })).toBe('/booking?booking_id=12');
    expect(buildReconciliationDeepLink('gate_missing_eir', { entity_id: 5 })).toBe('/gate?transaction_id=5');
  });

  it('overlays action state and hides resolved or ignored rows by default', () => {
    const rows: ReconciliationIssueRow[] = [
      { entity_id: 1, reference: 'INV-1', created_at: '2026-05-18T00:00:00.000Z' },
      { entity_id: 2, reference: 'INV-2', created_at: '2026-05-20T00:00:00.000Z' },
      { entity_id: 3, reference: 'INV-3', created_at: '2026-05-21T00:00:00.000Z' },
    ];
    const actions: ReconciliationActionRecord[] = [
      { action_id: 10, issue_code: 'invoice_open_overdue', entity_id: 2, entity_ref: 'INV-2', status: 'resolved', reason: 'Paid', updated_at: '2026-05-21T01:00:00.000Z' },
      { action_id: 11, issue_code: 'invoice_open_overdue', entity_id: 3, entity_ref: 'INV-3', status: 'ignored', reason: 'Duplicate test invoice', updated_at: '2026-05-21T02:00:00.000Z' },
    ];

    const result = applyReconciliationActions({
      issueCode: 'invoice_open_overdue',
      rows,
      actions,
      now: new Date('2026-05-21T12:00:00.000Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      entity_id: 1,
      action_status: 'open',
      sla_age_days: 3,
      deep_link: '/billing?invoice_id=1',
    });
  });

  it('can include closed rows for audit review', () => {
    const result = applyReconciliationActions({
      issueCode: 'invoice_open_overdue',
      rows: [{ entity_id: 2, reference: 'INV-2', created_at: '2026-05-20T00:00:00.000Z' }],
      actions: [{ action_id: 10, issue_code: 'invoice_open_overdue', entity_id: 2, entity_ref: 'INV-2', status: 'resolved', reason: 'Paid', updated_at: '2026-05-21T01:00:00.000Z' }],
      includeClosed: true,
      now: new Date('2026-05-21T12:00:00.000Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      action_status: 'resolved',
      action_reason: 'Paid',
      action_id: 10,
    });
  });
});
