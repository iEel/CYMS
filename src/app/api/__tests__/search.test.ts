/**
 * API Integration Tests — /api/search
 * Global search powers the topbar quick jump across core operational entities.
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

import { GET } from '../search/route';
import { getDb } from '@/lib/db';

const mockedGetDb = getDb as jest.Mock;

let queryQueue: Array<{ recordset: unknown[] } | Error> = [];
let requestInputs: jest.Mock[] = [];

function makeDbRequest() {
  const request = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation(() => {
      const next = queryQueue.shift();
      if (!next) return Promise.resolve({ recordset: [] });
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    }),
  };
  requestInputs.push(request.input);
  return request;
}

function setup() {
  queryQueue = [];
  requestInputs = [];
  mockedGetDb.mockResolvedValue({ request: makeDbRequest });
}

function q(recordset: unknown[]) {
  return { recordset };
}

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': '1',
      'x-user-role': 'yard_manager',
    },
  });
}

describe('GET /api/search', () => {
  beforeEach(setup);

  it('returns an empty result set for short queries without hitting the database', async () => {
    const res = await GET(makeRequest('http://localhost/api/search?q=A&yard_id=1'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('aggregates normalized results across containers, gate history, invoices, and bookings', async () => {
    queryQueue = [
      q([
        {
          container_id: 10,
          container_number: 'EVRU1234567',
          size: '40',
          type: 'HC',
          shipping_line: 'EVERGREEN',
          status: 'in_yard',
          yard_name: 'ลานหลัก',
          zone_name: 'A',
          bay: 2,
          row: 3,
          tier: 1,
        },
      ]),
      q([
        {
          transaction_id: 20,
          eir_number: 'EIR-IN-2026-000020',
          transaction_type: 'gate_in',
          container_number: 'EVRU1234567',
          truck_plate: 'กข 1234',
          driver_name: 'สมชาย',
          created_at: '2026-05-21T08:00:00.000Z',
        },
      ]),
      q([
        {
          invoice_id: 30,
          invoice_number: 'INV-202605-000030',
          customer_name: 'ACME Logistics',
          grand_total: 5350,
          status: 'issued',
        },
      ]),
      q([
        {
          booking_id: 40,
          booking_number: 'BK-202605-000040',
          vessel_name: 'CYMS STAR',
          voyage_number: 'V001',
          customer_name: 'ACME Logistics',
          status: 'confirmed',
          received_count: 2,
          container_count: 5,
        },
      ]),
    ];

    const res = await GET(makeRequest('http://localhost/api/search?q=EVRU&yard_id=1&limit=8'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([
      expect.objectContaining({
        id: 'container-10',
        kind: 'container',
        title: 'EVRU1234567',
        href: '/yard?search=EVRU1234567',
        status: 'in_yard',
      }),
      expect.objectContaining({
        id: 'gate-20',
        kind: 'gate',
        title: 'EIR-IN-2026-000020',
        href: '/gate?tab=history&search=EVRU1234567',
        status: 'gate_in',
      }),
      expect.objectContaining({
        id: 'invoice-30',
        kind: 'invoice',
        title: 'INV-202605-000030',
        href: '/billing?tab=invoices&invoice_id=30',
        status: 'issued',
      }),
      expect.objectContaining({
        id: 'booking-40',
        kind: 'booking',
        title: 'BK-202605-000040',
        href: '/booking?search=BK-202605-000040',
        status: 'confirmed',
      }),
    ]);
  });

  it('binds yard_id and wildcard search parameters for each entity query', async () => {
    queryQueue = [q([]), q([]), q([]), q([])];

    await GET(makeRequest('http://localhost/api/search?q=MSCU&yard_id=2'));

    expect(requestInputs).toHaveLength(4);
    for (const input of requestInputs) {
      expect(input).toHaveBeenCalledWith('yardId', expect.anything(), 2);
      expect(input).toHaveBeenCalledWith('search', expect.anything(), '%MSCU%');
      expect(input).toHaveBeenCalledWith('limit', expect.anything(), expect.any(Number));
    }
  });

  it('returns 500 when a database query fails', async () => {
    queryQueue = [new Error('connection lost')];
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET(makeRequest('http://localhost/api/search?q=EVRU&yard_id=1'));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ไม่สามารถค้นหาข้อมูลได้' });
    errorSpy.mockRestore();
  });
});
