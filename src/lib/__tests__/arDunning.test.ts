import { buildARDunningPlan } from '../arDunning';

describe('AR dunning plan', () => {
  const customers = [
    {
      customer_id: 1,
      customer_name: 'Alpha Logistics',
      total: 12000,
      current: 0,
      d30: 12000,
      d60: 0,
      d90: 0,
      d90plus: 0,
      invoice_count: 2,
      oldest_days: 18,
    },
    {
      customer_id: 2,
      customer_name: 'Beta Line',
      total: 85000,
      current: 0,
      d30: 0,
      d60: 0,
      d90: 0,
      d90plus: 85000,
      invoice_count: 4,
      oldest_days: 120,
    },
  ];

  it('assigns dunning stages by oldest AR age', () => {
    const plan = buildARDunningPlan(customers);

    expect(plan.items[0]).toMatchObject({
      customer_name: 'Beta Line',
      stage: 'final_notice',
      severity: 'critical',
      recommended_action: 'final_notice_and_credit_hold_review',
    });
    expect(plan.items[1]).toMatchObject({
      customer_name: 'Alpha Logistics',
      stage: 'friendly_reminder',
      severity: 'info',
      recommended_action: 'email_reminder',
    });
  });

  it('summarizes critical exposure and reminder counts', () => {
    const plan = buildARDunningPlan(customers);

    expect(plan.summary).toMatchObject({
      total_customers: 2,
      critical_customers: 1,
      total_exposure: 97000,
      final_notice_count: 1,
    });
  });

  it('generates a useful reminder draft for each customer', () => {
    const plan = buildARDunningPlan(customers);
    const beta = plan.items[0];

    expect(beta.email_subject).toContain('Beta Line');
    expect(beta.email_body).toContain('฿85,000');
    expect(beta.email_body).toContain('120 วัน');
  });
});
