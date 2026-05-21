import { NextRequest } from 'next/server';

let queryQueue: Array<{ recordset: unknown[] } | Error> = [];
const queries: string[] = [];

function makeChain() {
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    const next = queryQueue.shift();
    if (!next) return Promise.resolve({ recordset: [] });
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  });
  return { input, query };
}

const mockDb = { request: jest.fn().mockImplementation(makeChain) };

jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockResolvedValue(mockDb),
}));

function q(recordset: unknown[]): { recordset: unknown[] } { return { recordset }; }

function makeRequest(url = 'http://localhost/api/portal/notifications'): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-customer-id': '42' },
  });
}

describe('GET /api/portal/notifications', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../portal/notifications/route') as typeof import('../portal/notifications/route');

  beforeEach(() => {
    jest.clearAllMocks();
    queryQueue = [];
    queries.length = 0;
    mockDb.request.mockImplementation(makeChain);
  });

  it('returns customer-scoped reefer and booking notifications', async () => {
    queryQueue = [
      q([{
        exception_id: 7,
        container_id: 11,
        container_number: 'RFU1234567',
        severity: 'critical',
        reason: 'out_of_range',
        measured_temp_c: -5,
        set_point_c: -18,
        event_time: '2026-05-21T09:00:00.000Z',
      }]),
      q([{
        booking_id: 77,
        booking_number: 'BK-RF-1',
        status: 'confirmed',
        eta: '2026-05-22T00:00:00.000Z',
        event_time: '2026-05-21T08:00:00.000Z',
      }]),
    ];

    const res = await route.GET(makeRequest('http://localhost/api/portal/notifications?limit=5'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.notifications).toHaveLength(2);
    expect(body.notifications[0]).toEqual(expect.objectContaining({
      type: 'reefer_exception',
      severity: 'critical',
      deep_link: '/portal/reefer?container_id=11',
    }));
    expect(body.notifications[1]).toEqual(expect.objectContaining({
      type: 'booking_status',
      deep_link: '/portal/bookings',
    }));
    expect(queries.join('\n')).toContain('PortalEntityAccess');
    expect(queries.join('\n')).toContain("pea.customer_id = @cid");
  });

  it('requires a portal customer session', async () => {
    const req = new NextRequest('http://localhost/api/portal/notifications', { method: 'GET' });
    const res = await route.GET(req);
    expect([401, 403]).toContain(res.status);
  });
});
