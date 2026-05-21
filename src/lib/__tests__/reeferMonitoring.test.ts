import {
  chooseEffectiveReeferPolicy,
  deriveReeferCheckStatus,
  deriveReeferDueStatus,
  normalizeReeferPolicy,
} from '../reeferMonitoring';

describe('reeferMonitoring helpers', () => {
  it('chooses the most specific active policy and falls back to the yard default', () => {
    const effective = chooseEffectiveReeferPolicy([
      normalizeReeferPolicy({ scope_type: 'default', interval_hours: 8, warning_grace_minutes: 45 }),
      normalizeReeferPolicy({ scope_type: 'yard', yard_id: 1, interval_hours: 6 }),
      normalizeReeferPolicy({ scope_type: 'customer', customer_id: 42, interval_hours: 4 }),
      normalizeReeferPolicy({ scope_type: 'booking', booking_id: 77, interval_hours: 3, is_active: false }),
      normalizeReeferPolicy({ scope_type: 'container', container_id: 123, interval_hours: 2, min_temp_c: -20, max_temp_c: -16 }),
    ]);

    expect(effective.scope_type).toBe('container');
    expect(effective.interval_hours).toBe(2);
    expect(effective.min_temp_c).toBe(-20);
    expect(effective.max_temp_c).toBe(-16);
  });

  it('marks checks out of range when measured temperature violates the policy threshold', () => {
    const policy = normalizeReeferPolicy({ scope_type: 'yard', interval_hours: 4, min_temp_c: -20, max_temp_c: -16 });

    expect(deriveReeferCheckStatus({ measured_temp_c: -18, manual_status: 'normal', policy })).toBe('normal');
    expect(deriveReeferCheckStatus({ measured_temp_c: -14.5, manual_status: 'normal', policy })).toBe('out_of_range');
    expect(deriveReeferCheckStatus({ measured_temp_c: -22, manual_status: 'normal', policy })).toBe('out_of_range');
    expect(deriveReeferCheckStatus({ measured_temp_c: null, manual_status: 'unreadable', policy })).toBe('unreadable');
  });

  it('classifies reefer rounds as not checked, ok, due, or overdue from interval and grace', () => {
    const now = new Date('2026-05-21T08:00:00.000Z');
    const policy = normalizeReeferPolicy({ scope_type: 'default', interval_hours: 4, warning_grace_minutes: 30 });

    expect(deriveReeferDueStatus({ last_checked_at: null, policy, now })).toBe('not_checked');
    expect(deriveReeferDueStatus({ last_checked_at: '2026-05-21T05:00:00.000Z', policy, now })).toBe('ok');
    expect(deriveReeferDueStatus({ last_checked_at: '2026-05-21T03:45:00.000Z', policy, now })).toBe('due');
    expect(deriveReeferDueStatus({ last_checked_at: '2026-05-21T03:00:00.000Z', policy, now })).toBe('overdue');
  });
});
