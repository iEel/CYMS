import { ensureReeferBookingPolicy, isReeferBookingContainerType } from '../reeferBookingPolicy';

function makeDb() {
  const queries: string[] = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    return Promise.resolve({ recordset: [{ policy_id: 91, scope_type: 'booking', booking_id: 77 }] });
  });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

describe('reefer booking policy helper', () => {
  it('recognizes RF booking container types', () => {
    expect(isReeferBookingContainerType('RF')).toBe(true);
    expect(isReeferBookingContainerType('reefer')).toBe(true);
    expect(isReeferBookingContainerType('GP')).toBe(false);
  });

  it('creates a booking scoped policy for RF bookings only once', async () => {
    const db = makeDb();

    const policy = await ensureReeferBookingPolicy(db, {
      booking_id: 77,
      yard_id: 1,
      customer_id: 42,
      container_type: 'RF',
    });

    expect(policy).toEqual(expect.objectContaining({ policy_id: 91, scope_type: 'booking' }));
    expect(db.input.mock.calls).toEqual(expect.arrayContaining([
      ['bookingId', expect.anything(), 77],
      ['yardId', expect.anything(), 1],
      ['customerId', expect.anything(), 42],
      ['scopeType', expect.anything(), 'booking'],
      ['intervalHours', expect.anything(), 4],
      ['warningGraceMinutes', expect.anything(), 30],
    ]));
    expect(db.queries.join('\n')).toContain('ReeferCheckPolicies');
    expect(db.queries.join('\n')).toContain('WHERE NOT EXISTS');
  });

  it('skips non-RF bookings', async () => {
    const db = makeDb();

    const policy = await ensureReeferBookingPolicy(db, {
      booking_id: 78,
      yard_id: 1,
      customer_id: 42,
      container_type: 'GP',
    });

    expect(policy).toBeNull();
    expect(db.request).not.toHaveBeenCalled();
  });
});
