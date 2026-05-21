import { buildApprovalInbox } from '../approvalInbox';

describe('approval inbox', () => {
  const now = new Date('2026-05-21T05:00:00.000Z');

  const reviews = [
    {
      review_id: 1,
      permission_code: 'billing.credit_note.approve',
      action: 'credit_note_created',
      entity_type: 'invoice',
      status: 'pending_review' as const,
      requested_by_name: 'Billing One',
      details: JSON.stringify({ cn_number: 'CN-2569-000001', credit_amount: 75000 }),
      created_at: '2026-05-19T05:00:00.000Z',
    },
    {
      review_id: 2,
      permission_code: 'gate.eir.cancel',
      action: 'gate_out_with_billing_hold',
      entity_type: 'gate_transaction',
      status: 'pending_review' as const,
      requested_by_name: 'Gate One',
      details: JSON.stringify({ container_number: 'MSCU1234567' }),
      created_at: '2026-05-21T00:00:00.000Z',
    },
    {
      review_id: 3,
      permission_code: 'survey.grade.approve',
      action: 'container_grade_change_after_save',
      entity_type: 'container',
      status: 'pending_review' as const,
      requested_by_name: 'Survey One',
      details: JSON.stringify({ previous_grade: 'A', new_grade: 'C' }),
      created_at: '2026-05-21T03:00:00.000Z',
    },
    {
      review_id: 4,
      permission_code: 'billing.credit_note.approve',
      action: 'credit_note_created',
      entity_type: 'invoice',
      status: 'approved' as const,
      requested_by_name: 'Billing Two',
      details: JSON.stringify({ credit_amount: 999999 }),
      created_at: '2026-05-18T05:00:00.000Z',
    },
  ];

  it('prioritizes pending reviews by SLA breach, risk, and amount', () => {
    const inbox = buildApprovalInbox(reviews, now);

    expect(inbox.items.map(item => item.review_id)).toEqual([1, 2, 3]);
    expect(inbox.items[0]).toMatchObject({
      review_id: 1,
      group: 'Billing',
      label: 'ออกใบลดหนี้',
      sla_status: 'breached',
      severity: 'critical',
      financial_amount: 75000,
    });
  });

  it('summarizes SLA breaches, critical work, and financial exposure', () => {
    const inbox = buildApprovalInbox(reviews, now);

    expect(inbox.summary).toMatchObject({
      pending_total: 3,
      breached_sla: 2,
      critical_total: 2,
      financial_exposure: 75000,
      oldest_hours: 48,
    });
    expect(inbox.summary.group_counts).toEqual({
      Billing: 1,
      Gate: 1,
      Survey: 1,
    });
  });

  it('ignores non-pending reviews', () => {
    const inbox = buildApprovalInbox(reviews, now);

    expect(inbox.items.some(item => item.review_id === 4)).toBe(false);
  });
});
