/**
 * API Integration Tests — /api/gate
 * Tests the gate history GET endpoint (transactions list)
 */

import { NextRequest } from 'next/server';

// ── Mock DB ────────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockInput = jest.fn().mockReturnThis();
const mockDb = {
  request: jest.fn().mockReturnValue({ input: mockInput, query: mockQuery }),
};

jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function mockGateHistoryQuery(recordset: unknown[]) {
  mockQuery.mockImplementation((statement?: unknown) => {
    if (typeof statement === 'string' && (
      statement.includes("COL_LENGTH('Containers'") ||
      statement.includes("OBJECT_ID('BillingClearances'") ||
      statement.includes("COL_LENGTH('GateTransactions'")
    )) {
      return Promise.resolve({ recordset: [] });
    }
    return Promise.resolve({ recordset });
  });
}

// ── GET tests ──────────────────────────────────────────────────────
describe('GET /api/gate (history)', () => {
  const { GET } = jest.requireActual('../gate/route') as typeof import('../gate/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockInput.mockReturnThis();
    mockDb.request.mockReturnValue({ input: mockInput, query: mockQuery });
  });

  const mockTransactions = [
    {
      transaction_id: 1,
      container_number: 'EVRU1234567',
      transaction_type: 'gate_in',
      eir_number: 'EIR-2569-000001',
      driver_name: 'สมชาย ใจดี',
      truck_plate: 'กข 1234',
      created_at: new Date().toISOString(),
      full_name: 'สมหมาย รักดี',
    },
    {
      transaction_id: 2,
      container_number: 'MSCU9876543',
      transaction_type: 'gate_out',
      eir_number: 'EIR-2569-000002',
      driver_name: 'วิชัย สุขใจ',
      truck_plate: 'คง 5678',
      created_at: new Date().toISOString(),
      full_name: 'สมหมาย รักดี',
    },
  ];

  it('returns transaction list for given yard_id', async () => {
    mockGateHistoryQuery(mockTransactions);

    const req = makeGetRequest('http://localhost/api/gate?yard_id=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0].container_number).toBe('EVRU1234567');
    expect(body.transactions[1].transaction_type).toBe('gate_out');
  });

  it('returns empty array when no transactions', async () => {
    mockGateHistoryQuery([]);

    const req = makeGetRequest('http://localhost/api/gate?yard_id=99');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toEqual([]);
  });

  it('filters by date param', async () => {
    mockGateHistoryQuery([]);

    const req = makeGetRequest('http://localhost/api/gate?yard_id=1&date=2026-03-26');
    await GET(req);
    expect(mockInput).toHaveBeenCalledWith('date', expect.anything(), '2026-03-26');
  });

  it('filters by search param (container number / EIR)', async () => {
    mockGateHistoryQuery([]);

    const req = makeGetRequest('http://localhost/api/gate?yard_id=1&search=EVRU1234567');
    await GET(req);
    expect(mockInput).toHaveBeenCalledWith('search', expect.anything(), '%EVRU1234567%');
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockImplementation((statement?: unknown) => {
      if (typeof statement === 'string' && (
        statement.includes("COL_LENGTH('Containers'") ||
        statement.includes("OBJECT_ID('BillingClearances'") ||
        statement.includes("COL_LENGTH('GateTransactions'")
      )) {
        return Promise.resolve({ recordset: [] });
      }
      return Promise.reject(new Error('Query execution failed'));
    });

    const req = makeGetRequest('http://localhost/api/gate?yard_id=1');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
