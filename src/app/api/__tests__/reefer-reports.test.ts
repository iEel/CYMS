import fs from 'fs';
import path from 'path';
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

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/reports/reefer', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../reports/reefer/route') as typeof import('../reports/reefer/route');

  beforeEach(() => {
    jest.clearAllMocks();
    queryQueue = [];
    mockDb.request.mockImplementation(makeChain);
  });

  it('returns reefer compliance dashboard data', async () => {
    queryQueue = [
      q([{
        total_rf: 12,
        normal_count: 8,
        out_of_range_count: 2,
        unreadable_count: 1,
        power_issue_count: 1,
        not_checked_count: 0,
        active_exceptions: 3,
        compliance_rate: 66.67,
      }]),
      q([{ check_date: '2026-05-21', total_checks: 10, normal_count: 8, exception_count: 2, compliance_rate: 80 }]),
      q([{ exception_id: 4, container_number: 'RFU1234567', severity: 'critical', status: 'open', reason: 'out_of_range', age_hours: 5 }]),
      q([{ customer_name: 'ABC Foods', container_count: 3, exception_count: 1, avg_temp_c: -18.5 }]),
    ];

    const res = await route.GET(makeRequest('http://localhost/api/reports/reefer?yard_id=1&date_from=2026-05-01&date_to=2026-05-21'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary.total_rf).toBe(12);
    expect(body.summary.compliance_rate).toBe(66.67);
    expect(body).toHaveProperty('trend');
    expect(body).toHaveProperty('openExceptions');
    expect(body).toHaveProperty('byCustomer');
    expect(body.dateFrom).toBe('2026-05-01');
    expect(body.dateTo).toBe('2026-05-21');
    expect(new Date(body.generatedAt).getTime()).not.toBeNaN();
  });

  it('requires yard_id through the yard access guard', async () => {
    const res = await route.GET(makeRequest('http://localhost/api/reports/reefer'));
    expect(res.status).toBe(400);
  });
});

describe('reports UI exposes reefer compliance', () => {
  it('adds a reefer compliance tab backed by /api/reports/reefer', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/reports/page.tsx'), 'utf8');

    expect(source).toContain('/api/reports/reefer');
    expect(source).toContain('Reefer Compliance');
    expect(source).toContain('openExceptions');
    expect(source).toContain('compliance_rate');
  });
});
