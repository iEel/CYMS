/**
 * API Integration Tests — /api/mnr (Repair Orders / EOR)
 * Tests GET (list), POST (create EOR), PUT (status transitions)
 */

import { NextRequest } from 'next/server';

// ── Mock DB ────────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockInput = jest.fn().mockReturnThis();
const mockDbRequest = jest.fn().mockReturnValue({ input: mockInput, query: mockQuery });
const mockDb = { request: mockDbRequest };

jest.mock('@/lib/db', () => ({
  getDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── GET tests ──────────────────────────────────────────────────────
describe('GET /api/mnr', () => {
  const { GET } = jest.requireActual('../mnr/route') as typeof import('../mnr/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockInput.mockReturnThis();
    mockDbRequest.mockReturnValue({ input: mockInput, query: mockQuery });
  });

  it('returns EOR list for given yard_id', async () => {
    const mockOrders = [
      { eor_id: 1, eor_number: 'EOR-2569-000001', status: 'approved', estimated_cost: 5000 },
      { eor_id: 2, eor_number: 'EOR-2569-000002', status: 'pending_approval', estimated_cost: 2000 },
    ];
    mockQuery.mockResolvedValueOnce({ recordset: mockOrders });

    const req = makeRequest('GET', 'http://localhost/api/mnr?yard_id=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(2);
    expect(body.orders[0].eor_number).toBe('EOR-2569-000001');
  });

  it('returns empty orders when none found', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    const req = makeRequest('GET', 'http://localhost/api/mnr?yard_id=999');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toEqual([]);
  });

  it('filters by status param', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    const req = makeRequest('GET', 'http://localhost/api/mnr?yard_id=1&status=approved');
    await GET(req);
    expect(mockInput).toHaveBeenCalledWith('status', expect.anything(), 'approved');
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB timeout'));
    const req = makeRequest('GET', 'http://localhost/api/mnr?yard_id=1');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ── POST tests ─────────────────────────────────────────────────────
describe('POST /api/mnr', () => {
  const { POST } = jest.requireActual('../mnr/route') as typeof import('../mnr/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockInput.mockReturnThis();
    mockDbRequest.mockReturnValue({ input: mockInput, query: mockQuery });
  });

  const validEOR = {
    container_id: 1,
    yard_id: 1,
    customer_id: 1,
    estimated_cost: 3500,
    damage_details: [{ code: 'P1-DM1-RP1', description: 'รอยบุ๋มด้านหน้า' }],
  };

  it('creates EOR with valid payload', async () => {
    // COUNT query for EOR number generation
    mockQuery.mockResolvedValueOnce({ recordset: [{ cnt: 5 }] });
    // INSERT query
    mockQuery.mockResolvedValueOnce({
      recordset: [{ eor_id: 6, eor_number: 'EOR-2569-000006', status: 'draft' }],
    });
    // Container status update
    mockQuery.mockResolvedValueOnce({ recordset: [] });

    const req = makeRequest('POST', 'http://localhost/api/mnr', validEOR);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.eor_number).toMatch(/^EOR-\d{4}-\d{6}$/);
  });

  it('returns 400 when container_id is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/mnr', {
      yard_id: 1,
      estimated_cost: 1000,
      // Missing: container_id
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when yard_id is missing', async () => {
    const req = makeRequest('POST', 'http://localhost/api/mnr', {
      container_id: 1,
      estimated_cost: 1000,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Insert failed'));
    const req = makeRequest('POST', 'http://localhost/api/mnr', validEOR);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ── PUT tests ──────────────────────────────────────────────────────
describe('PUT /api/mnr — status transitions', () => {
  const { PUT } = jest.requireActual('../mnr/route') as typeof import('../mnr/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockInput.mockReturnThis();
    mockDbRequest.mockReturnValue({ input: mockInput, query: mockQuery });
  });

  const mockOrder = { eor_number: 'EOR-2569-000001', container_id: 1, yard_id: 1 };

  it('approves EOR successfully', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [mockOrder] }); // SELECT
    mockQuery.mockResolvedValueOnce({ recordset: [] });           // UPDATE

    const req = makeRequest('PUT', 'http://localhost/api/mnr', {
      eor_id: 1, action: 'approve', user_id: 5,
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('rejects EOR successfully', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [mockOrder] }); // SELECT
    mockQuery.mockResolvedValueOnce({ recordset: [] });           // UPDATE status
    mockQuery.mockResolvedValueOnce({ recordset: [] });           // UPDATE container status

    const req = makeRequest('PUT', 'http://localhost/api/mnr', {
      eor_id: 1, action: 'reject', user_id: 5,
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
  });

  it('completes EOR with actual_cost', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [mockOrder] }); // SELECT
    mockQuery.mockResolvedValueOnce({ recordset: [] });           // UPDATE with actual_cost
    mockQuery.mockResolvedValueOnce({ recordset: [] });           // Revert container status

    const req = makeRequest('PUT', 'http://localhost/api/mnr', {
      eor_id: 1, action: 'complete', actual_cost: 4200, user_id: 5,
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mockInput).toHaveBeenCalledWith('actualCost', expect.anything(), 4200);
  });

  it('returns 400 for invalid action', async () => {
    const req = makeRequest('PUT', 'http://localhost/api/mnr', {
      eor_id: 1, action: 'invalid_action',
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when EOR not found', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] }); // Empty = not found

    const req = makeRequest('PUT', 'http://localhost/api/mnr', {
      eor_id: 999, action: 'approve',
    });
    const res = await PUT(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when eor_id is missing', async () => {
    const req = makeRequest('PUT', 'http://localhost/api/mnr', {
      action: 'approve',
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
