/**
 * API Integration Tests — /api/containers
 *
 * Mock strategy: factory function inside jest.mock so hoisting doesn't
 * cause 'Cannot access before initialization' reference errors.
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../containers/route';

// ── Mock DB (factory pattern to avoid hoisting issues) ───────────────
let queryQueue: Array<{ recordset: unknown[] } | Error> = [];

function makeChain() {
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement?: unknown) => {
    if (typeof statement === 'string' && statement.includes("COL_LENGTH('Containers'")) {
      return Promise.resolve({ recordset: [] });
    }
    const nxt = queryQueue.shift();
    if (!nxt) return Promise.resolve({ recordset: [] });
    if (nxt instanceof Error) return Promise.reject(nxt);
    return Promise.resolve(nxt);
  });
  return { input, query };
}

jest.mock('@/lib/db', () => {
  const q: Array<{ recordset: unknown[] } | Error> = [];
  const chain = () => {
    const input = jest.fn().mockReturnThis();
    const query = jest.fn();
    return { input, query };
  };
  return { getDb: jest.fn(), __queue: q, __chain: chain };
});

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

// Override getDb to use our queue
import { getDb } from '@/lib/db';
const mockedGetDb = getDb as jest.Mock;

function setup() {
  queryQueue = [];
  mockedGetDb.mockResolvedValue({ request: makeChain });
}

function q(recordset: unknown[]) { return { recordset }; }
function qErr(msg: string) { return new Error(msg); }

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── GET ─────────────────────────────────────────────────────────────
describe('GET /api/containers', () => {
  beforeEach(setup);

  const mockContainers = [
    { container_id: 1, container_number: 'EVRU1234567', status: 'in_yard', size: '20', type: 'GP' },
    { container_id: 2, container_number: 'MSCU9876543', status: 'in_yard', size: '40', type: 'HC' },
  ];

  it('returns container array for valid yard_id', async () => {
    queryQueue = [q(mockContainers)];
    const res = await GET(makeRequest('GET', 'http://localhost/api/containers?yard_id=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].container_number).toBe('EVRU1234567');
  });

  it('returns empty array when no containers found', async () => {
    queryQueue = [q([])];
    const res = await GET(makeRequest('GET', 'http://localhost/api/containers?yard_id=99'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns all containers when yard_id is omitted', async () => {
    queryQueue = [q([])];
    const res = await GET(makeRequest('GET', 'http://localhost/api/containers'));
    expect(res.status).toBe(200);
  });

  it('handles check_position=1 mode (no conflict)', async () => {
    queryQueue = [q([])];
    const res = await GET(makeRequest('GET',
      'http://localhost/api/containers?check_position=1&zone_id=1&bay=1&row=1&tier=1&yard_id=1'
    ));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('conflict');
    expect(body.conflict).toBeNull();
  });

  it('handles check_position=1 with existing container (conflict)', async () => {
    queryQueue = [q([{ container_id: 5, container_number: 'TGHU1111111' }])];
    const res = await GET(makeRequest('GET',
      'http://localhost/api/containers?check_position=1&zone_id=1&bay=1&row=1&tier=1&yard_id=1'
    ));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conflict).not.toBeNull();
    expect(body.conflict.container_number).toBe('TGHU1111111');
  });

  it('returns 500 on DB error', async () => {
    queryQueue = [qErr('Connection failed')];
    const res = await GET(makeRequest('GET', 'http://localhost/api/containers?yard_id=1'));
    expect(res.status).toBe(500);
  });
});

// ── POST ─────────────────────────────────────────────────────────────
describe('POST /api/containers', () => {
  beforeEach(setup);

  const validBody = {
    container_number: 'EVRU1234567',
    size: '20', type: 'GP',
    yard_id: 1, zone_id: 1, bay: 1, row: 1, tier: 1,
  };

  it('creates container and returns { success, data }', async () => {
    const inserted = { ...validBody, container_id: 42, created_at: new Date().toISOString() };
    queryQueue = [q([inserted])];
    const res = await POST(makeRequest('POST', 'http://localhost/api/containers', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.container_id).toBe(42);
  });

  it('returns 500 on DB error (maps UNIQUE error to Thai message)', async () => {
    queryQueue = [qErr('UNIQUE KEY violation')];
    const res = await POST(makeRequest('POST', 'http://localhost/api/containers', validBody));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('defaults status to in_yard when omitted', async () => {
    const { ...bodyWithoutStatus } = validBody;
    const inserted = { ...bodyWithoutStatus, container_id: 43, status: 'in_yard' };
    queryQueue = [q([inserted])];
    const res = await POST(makeRequest('POST', 'http://localhost/api/containers', bodyWithoutStatus));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
