/**
 * API Integration Tests — /api/reports/dwell & /api/reports/mnr
 * Verifies response shape, default params, and error handling
 *
 * Mock strategy: each db.request() call returns a fresh chain
 * so multiple queries per handler work correctly.
 */

import { NextRequest } from 'next/server';

// ── Mock DB ─────────────────────────────────────────────────────────
// We queue up per-query results using an array
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

function q(recordset: unknown[]): { recordset: unknown[] } { return { recordset }; }
function qErr(msg: string): Error { return new Error(msg); }

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

// ── Dwell Report ────────────────────────────────────────────────────
describe('GET /api/reports/dwell', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('../reports/dwell/route') as typeof import('../reports/dwell/route');

  const mockSummary = {
    total_in_yard: 48, avg_dwell_days: 12.5, max_dwell_days: 45, overdue_count: 3,
    within_7_days: 20, within_8_14_days: 15, within_15_30_days: 10, over_30_days: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryQueue = [];
    mockDb.request.mockImplementation(makeChain);
  });

  it('returns report with correct structure', async () => {
    queryQueue = [
      // 1. byShippingLine
      q([
        { shipping_line: 'EVERI', container_count: 20, avg_dwell_days: 10, max_dwell_days: 25, min_dwell_days: 2, total_dwell_days: 200, overdue_count: 1 },
        { shipping_line: 'MSC',   container_count: 15, avg_dwell_days: 14, max_dwell_days: 40, min_dwell_days: 3, total_dwell_days: 210, overdue_count: 2 },
      ]),
      // 2. overdueList
      q([]),
      // 3. summary
      q([mockSummary]),
    ];

    const res = await GET(makeRequest('http://localhost/api/reports/dwell?yard_id=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('byShippingLine');
    expect(body).toHaveProperty('overdueList');
    expect(body).toHaveProperty('overdueDays');
    expect(body.summary.total_in_yard).toBe(48);
    expect(body.byShippingLine).toHaveLength(2);
  });

  it('defaults yard_id=1 when not provided', async () => {
    queryQueue = [q([]), q([]), q([])];
    const res = await GET(makeRequest('http://localhost/api/reports/dwell'));
    expect(res.status).toBe(200);
  });

  it('respects custom overdue_days param', async () => {
    queryQueue = [q([]), q([]), q([])];
    const res = await GET(makeRequest('http://localhost/api/reports/dwell?yard_id=1&overdue_days=14'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overdueDays).toBe(14);
  });

  it('overdueList contains required fields', async () => {
    const overdueItem = {
      container_number: 'EVRU1234567', shipping_line: 'EVERI',
      size: '20', type: 'GP', dwell_days: 35,
      zone_name: 'A', bay: 1, row: 1, tier: 1,
      gate_in_date: '2026-02-20', pending_invoice_count: 1,
    };
    // byShippingLine → overdueList (with item) → summary
    queryQueue = [q([]), q([overdueItem]), q([mockSummary])];
    const res = await GET(makeRequest('http://localhost/api/reports/dwell?yard_id=1'));
    const body = await res.json();
    expect(body.overdueList[0].dwell_days).toBe(35);
    expect(body.overdueList[0].container_number).toBe('EVRU1234567');
  });

  it('returns 500 on DB error', async () => {
    queryQueue = [qErr('DB connection lost')];
    const res = await GET(makeRequest('http://localhost/api/reports/dwell?yard_id=1'));
    expect(res.status).toBe(500);
  });
});

// ── M&R Report ──────────────────────────────────────────────────────
describe('GET /api/reports/mnr', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('../reports/mnr/route') as typeof import('../reports/mnr/route');

  const mockSummary = {
    total_eor: 20, approved_count: 10, rejected_count: 3,
    pending_count: 4, completed_count: 3,
    total_estimated: 150000, total_actual: 120000,
    avg_estimated: 7500, avg_actual: 6000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryQueue = [];
    mockDb.request.mockImplementation(makeChain);
  });

  it('returns M&R report with correct structure', async () => {
    queryQueue = [
      q([mockSummary]),
      q([{ status: 'approved', count: 10, total_estimated: 80000, total_actual: 70000, avg_cost: 7000 }]),
      q([]),
      q([]),
    ];
    const res = await GET(makeRequest('http://localhost/api/reports/mnr?yard_id=1&date_from=2026-03-01&date_to=2026-03-26'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('byStatus');
    expect(body).toHaveProperty('eorList');
    expect(body).toHaveProperty('trend');
    expect(body).toHaveProperty('dateFrom');
    expect(body).toHaveProperty('dateTo');
    expect(body.summary.total_eor).toBe(20);
  });

  it('uses default date range when not provided', async () => {
    queryQueue = [q([]), q([]), q([]), q([])];
    const res = await GET(makeRequest('http://localhost/api/reports/mnr?yard_id=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dateFrom).toBeDefined();
    expect(body.dateTo).toBeDefined();
  });

  it('generatedAt is valid ISO timestamp', async () => {
    queryQueue = [q([]), q([]), q([]), q([])];
    const res = await GET(makeRequest('http://localhost/api/reports/mnr?yard_id=1'));
    const body = await res.json();
    expect(new Date(body.generatedAt).getTime()).not.toBeNaN();
  });

  it('returns 500 on DB error', async () => {
    queryQueue = [qErr('Timeout')];
    const res = await GET(makeRequest('http://localhost/api/reports/mnr?yard_id=1'));
    expect(res.status).toBe(500);
  });
});
