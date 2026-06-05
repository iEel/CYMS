import { NextRequest, NextResponse } from 'next/server';

import {
  assertTransportJobSource,
  buildTransportJobAccessSql,
  isDriverTransportActor,
  isTruckingTransportActor,
  requireTransportPortalActor,
  resolveTransportJobId,
} from '../transportPortalAccess';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/transport/jobs', { headers });
}

function makeDb(recordset: unknown[]) {
  const query = jest.fn().mockResolvedValue({ recordset });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

describe('transport portal access policy', () => {
  it('accepts trucking coordinators as company-scoped transport actors', async () => {
    const db = makeDb([{ user_id: 12, customer_id: 44, role_code: 'customer', customer_portal_role: 'trucking_coordinator' }]);

    const result = await requireTransportPortalActor(makeRequest({ 'x-user-id': '12' }), db, 'transport.jobs.view');

    expect(result).toEqual({
      userId: 12,
      customerId: 44,
      customerPortalRole: 'trucking_coordinator',
      mode: 'trucking',
    });
    expect(isTruckingTransportActor(result as never)).toBe(true);
    expect(db.input).toHaveBeenCalledWith('userId', expect.anything(), 12);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('customer_portal_role'));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('customer_id IS NOT NULL'));
  });

  it('accepts driver users as user-scoped transport actors', async () => {
    const db = makeDb([{ user_id: 21, customer_id: 44, role_code: 'customer', customer_portal_role: 'driver_user' }]);

    const result = await requireTransportPortalActor(makeRequest({ 'x-user-id': '21' }), db, 'transport.eir.view');

    expect(result).toEqual({
      userId: 21,
      customerId: 44,
      customerPortalRole: 'driver_user',
      mode: 'driver',
    });
    expect(isDriverTransportActor(result as never)).toBe(true);
  });

  it('allows transport job action and activity view scopes for transport actors', async () => {
    const jobActionDb = makeDb([{ user_id: 22, customer_id: 44, role_code: 'customer', customer_portal_role: 'driver_user' }]);
    const activityViewDb = makeDb([{ user_id: 23, customer_id: 44, role_code: 'customer', customer_portal_role: 'trucking_coordinator' }]);

    const jobAction = await requireTransportPortalActor(
      makeRequest({ 'x-user-id': '22' }),
      jobActionDb,
      'transport.jobs.action',
    );
    const activityView = await requireTransportPortalActor(
      makeRequest({ 'x-user-id': '23' }),
      activityViewDb,
      'transport.activity.view',
    );

    expect(jobAction).not.toBeInstanceOf(NextResponse);
    expect(activityView).not.toBeInstanceOf(NextResponse);
  });

  it('rejects non-transport customer portal roles', async () => {
    const db = makeDb([{ user_id: 31, customer_id: 44, role_code: 'customer', customer_portal_role: 'customer_admin' }]);

    const result = await requireTransportPortalActor(makeRequest({ 'x-user-id': '31' }), db, 'transport.jobs.view');

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('rejects internal users and requests without a valid user id', async () => {
    const db = makeDb([{ user_id: 41, customer_id: null, role_code: 'yard_manager', customer_portal_role: null }]);

    const missing = await requireTransportPortalActor(makeRequest(), db, 'transport.jobs.view');
    const internal = await requireTransportPortalActor(makeRequest({ 'x-user-id': '41' }), db, 'transport.jobs.view');

    expect(missing).toBeInstanceOf(NextResponse);
    expect((missing as NextResponse).status).toBe(401);
    expect(internal).toBeInstanceOf(NextResponse);
    expect((internal as NextResponse).status).toBe(403);
  });

  it('builds different SQL predicates for trucking companies and exact driver assignments', () => {
    const truckingSql = buildTransportJobAccessSql({
      userId: 12,
      customerId: 44,
      customerPortalRole: 'trucking_coordinator',
      mode: 'trucking',
    });
    const driverSql = buildTransportJobAccessSql({
      userId: 21,
      customerId: 44,
      customerPortalRole: 'driver_user',
      mode: 'driver',
    });

    expect(truckingSql).toContain('@transportCustomerId');
    expect(truckingSql).toContain("pea.access_role = 'trucking'");
    expect(driverSql).toContain('@transportUserId');
    expect(driverSql).not.toContain('@transportCustomerId');
  });

  it('resolves request and gate transport job ids', () => {
    expect(resolveTransportJobId('request-88')).toEqual({ source: 'gate_out_request', id: 88 });
    expect(resolveTransportJobId('gate-99')).toEqual({ source: 'gate_transaction', id: 99 });
  });

  it('rejects invalid transport job ids', () => {
    expect(resolveTransportJobId('request-x')).toBeNull();
    expect(resolveTransportJobId('invoice-1')).toBeNull();
    expect(resolveTransportJobId(88)).toBeNull();
  });

  it('checks whether a resolved job source is allowed', () => {
    const job = resolveTransportJobId('request-88');

    expect(job).not.toBeNull();
    expect(assertTransportJobSource(job!, ['gate_out_request'])).toBe(true);
    expect(assertTransportJobSource(job!, ['gate_transaction'])).toBe(false);
  });
});
