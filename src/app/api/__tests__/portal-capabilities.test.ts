import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;

function makeRequest() {
  return new NextRequest('http://localhost/api/portal/capabilities', {
    headers: { 'x-customer-id': '42', 'x-user-id': '7' },
  });
}

function q(recordset: unknown[]) {
  return { recordset };
}

function mockDb(queue: Array<{ recordset: unknown[] }>, role = 'customer_admin') {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn(async (statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Users')) return q([{ customer_portal_role: role }]);
    return queue.shift() || q([]);
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

describe('GET /api/portal/capabilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides reefer when customer module is disabled', async () => {
    const route = await import('../portal/capabilities/route');
    const db = mockDb([
      q([{ portal_enabled: true, portal_default_permission_scope: JSON.stringify({ modules: { reefer: false } }) }]),
      q([{ rf_count: 2, reefer_grant_count: 1 }]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modules.reefer.visible).toBe(false);
    expect(body.modules.reefer.reason).toBe('module_disabled');
  });

  it('shows reefer when module, user action, and RF access exist', async () => {
    const route = await import('../portal/capabilities/route');
    const db = mockDb([
      q([{ portal_enabled: true, portal_default_permission_scope: JSON.stringify({ modules: { reefer: true } }) }]),
      q([{ rf_count: 1, reefer_grant_count: 0 }]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modules.reefer.visible).toBe(true);
    expect(body.modules.reefer.reason).toBe('available');
    expect(db.queries.join('\n')).toContain('PortalEntityAccess');
  });

  it('hides reefer when user role lacks portal.reefer.view', async () => {
    const route = await import('../portal/capabilities/route');
    const db = mockDb([
      q([{ portal_enabled: true, portal_default_permission_scope: JSON.stringify({ modules: { reefer: true } }) }]),
      q([{ rf_count: 1, reefer_grant_count: 0 }]),
    ], 'billing_user');
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modules.reefer.visible).toBe(false);
    expect(body.modules.reefer.reason).toBe('user_permission_missing');
  });
});
