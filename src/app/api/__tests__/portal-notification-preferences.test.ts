import { NextRequest } from 'next/server';

const inputs: Array<[string, unknown, unknown]> = [];
const queries: string[] = [];
let queryQueue: Array<{ recordset: unknown[] } | Error> = [];

function makeChain() {
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return chain;
  });
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Users')) {
      return Promise.resolve({ recordset: [{ customer_portal_role: 'customer_admin' }] });
    }
    const next = queryQueue.shift();
    if (!next) return Promise.resolve({ recordset: [] });
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  });
  const chain = { input, query };
  return chain;
}

const mockDb = { request: jest.fn().mockImplementation(makeChain) };

jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockResolvedValue(mockDb),
}));

function q(recordset: unknown[]) { return { recordset }; }

function request(method = 'GET', body?: unknown) {
  return new NextRequest('http://localhost/api/portal/notification-preferences', {
    method,
    headers: { 'x-customer-id': '42', 'x-user-id': '7', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/portal/notification-preferences', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../portal/notification-preferences/route') as typeof import('../portal/notification-preferences/route');

  beforeEach(() => {
    jest.clearAllMocks();
    inputs.length = 0;
    queries.length = 0;
    queryQueue = [];
    mockDb.request.mockImplementation(makeChain);
  });

  it('returns default preferences merged with saved customer rows', async () => {
    queryQueue = [q([{ notification_type: 'booking_status', enabled: false }])];

    const res = await route.GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.preferences).toEqual(expect.objectContaining({
      reefer_exception: true,
      booking_status: false,
      invoice: true,
      gate_activity: true,
    }));
    expect(queries.join('\n')).toContain('PortalNotificationPreferences');
    expect(inputs).toContainEqual(['customerId', expect.anything(), 42]);
  });

  it('upserts only allowed preference keys for the authenticated customer', async () => {
    const res = await route.PUT(request('PUT', {
      customer_id: 999,
      preferences: {
        reefer_exception: false,
        booking_status: true,
        unknown_type: false,
      },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.preferences).toEqual(expect.objectContaining({
      reefer_exception: false,
      booking_status: true,
      invoice: true,
      gate_activity: true,
    }));
    expect(queries.join('\n')).toContain('MERGE PortalNotificationPreferences');
    expect(inputs).toContainEqual(['customerId', expect.anything(), 42]);
    expect(inputs).not.toContainEqual(['customerId', expect.anything(), 999]);
    expect(inputs.map(item => item[2])).not.toContain('unknown_type');
  });
});
