import { NextRequest } from 'next/server';

let queryQueue: Array<{ recordset: unknown[] } | Error> = [];

function makeChain() {
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation(() => {
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

jest.mock('@/lib/apiAuth', () => ({
  requireYardAccess: jest.fn((_request: NextRequest, _db: unknown, yardId: string | number | null) => {
    const { NextResponse } = jest.requireActual('next/server') as typeof import('next/server');
    const parsed = Number(yardId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }
    return { userId: 1, role: 'yard_manager' };
  }),
  requirePermission: jest.fn(() => ({ userId: 1, role: 'yard_manager' })),
}));

function q(recordset: unknown[]): { recordset: unknown[] } { return { recordset }; }
function makeRequest(url: string): NextRequest { return new NextRequest(url, { method: 'GET' }); }

describe('GET /api/reefer/plug-plan', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../reefer/plug-plan/route') as typeof import('../reefer/plug-plan/route');

  beforeEach(() => {
    jest.clearAllMocks();
    queryQueue = [];
    mockDb.request.mockImplementation(makeChain);
  });

  it('returns plug capacity, projected shortage, and upcoming RF bookings', async () => {
    queryQueue = [
      q([{ plug_capacity: 10, reefer_zones: 2, current_rf: 7, current_in_reefer_zone: 6, current_unplugged_risk: 1 }]),
      q([
        { booking_id: 77, booking_number: 'RF-BK-1', customer_name: 'Cold Chain', container_count: 5, eta: '2026-05-22', status: 'confirmed', policy_id: 91, interval_hours: 4 },
      ]),
      q([{ plan_date: '2026-05-22', expected_rf: 5 }]),
    ];

    const res = await route.GET(makeRequest('http://localhost/api/reefer/plug-plan?yard_id=1&date_from=2026-05-21&date_to=2026-05-28'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const capacityQuery = mockDb.request.mock.results[0].value.query.mock.calls[0][0] as string;

    expect(capacityQuery).toContain('COALESCE(NULLIF(plug_capacity, 0)');
    expect(capacityQuery).toContain('ISNULL(max_bay, 0) * ISNULL(max_row, 0)');
    expect(body.summary.plug_capacity).toBe(10);
    expect(body.summary.upcoming_rf).toBe(5);
    expect(body.summary.projected_required_plugs).toBe(12);
    expect(body.summary.projected_shortage).toBe(2);
    expect(body.upcomingBookings[0]).toEqual(expect.objectContaining({ booking_number: 'RF-BK-1', interval_hours: 4 }));
    expect(body.byDay[0]).toEqual(expect.objectContaining({ expected_rf: 5 }));
  });

  it('requires yard_id through the yard access guard', async () => {
    const res = await route.GET(makeRequest('http://localhost/api/reefer/plug-plan'));
    expect(res.status).toBe(400);
  });
});
