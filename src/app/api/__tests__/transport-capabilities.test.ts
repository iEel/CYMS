import { NextRequest } from 'next/server';

import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;

function makeRequest(userId = 21) {
  return new NextRequest('http://localhost/api/transport/capabilities', {
    headers: { 'x-user-id': String(userId) },
  });
}

function q(recordset: unknown[]) {
  return { recordset };
}

function mockDb(recordset: unknown[]) {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn(async (statement: string) => {
    queries.push(statement);
    return q(recordset);
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

describe('GET /api/transport/capabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enables driver mode for driver users', async () => {
    const route = await import('../transport/capabilities/route');
    const db = mockDb([{ user_id: 21, customer_id: 44, role_code: 'customer', customer_portal_role: 'driver_user' }]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest(21));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.transport).toEqual({ enabled: true, mode: 'driver' });
  });

  it('enables trucking mode for trucking coordinators', async () => {
    const route = await import('../transport/capabilities/route');
    const db = mockDb([{ user_id: 12, customer_id: 44, role_code: 'customer', customer_portal_role: 'trucking_coordinator' }]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest(12));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.transport).toEqual({ enabled: true, mode: 'trucking' });
  });

  it('rejects normal customer users', async () => {
    const route = await import('../transport/capabilities/route');
    const db = mockDb([{ user_id: 7, customer_id: 44, role_code: 'customer', customer_portal_role: 'customer_admin' }]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest(7));

    expect(res.status).toBe(403);
  });
});
