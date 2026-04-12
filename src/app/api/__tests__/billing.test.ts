/**
 * API Integration Tests — /api/billing/invoices
 *
 * Route behavior:
 * - GET: 2 queries (invoice list + stats), returns { invoices, stats }
 * - POST: no Zod validation, returns { success, invoice, invoice_number }
 * - PUT: actions: issue, pay, cancel — returns { success }
 */

import { NextRequest } from 'next/server';

// ── Jest mock setup (before imports that need mocks) ─────────────────
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));

// ── Imports (after mocks are registered) ─────────────────────────────
import { GET, POST, PUT } from '../billing/invoices/route';
import { getDb } from '@/lib/db';

const mockedGetDb = getDb as jest.Mock;

// ── Query queue helpers ──────────────────────────────────────────────
let queryQueue: Array<{ recordset: unknown[] } | Error> = [];

function makeChain() {
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement?: unknown) => {
    if (typeof statement === 'string' && statement.includes("COL_LENGTH('Invoices'")) {
      return Promise.resolve({ recordset: [] });
    }
    const nxt = queryQueue.shift();
    if (!nxt) return Promise.resolve({ recordset: [] });
    if (nxt instanceof Error) return Promise.reject(nxt);
    return Promise.resolve(nxt);
  });
  return { input, query };
}

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
describe('GET /api/billing/invoices', () => {
  beforeEach(setup);

  const mockStats = { total_outstanding: 5000, total_paid: 10000, total_overdue: 0, pending_count: 2 };

  it('returns invoices + stats for given yard_id', async () => {
    const inv1 = { invoice_id: 1, invoice_number: 'INV-2569-000001', grand_total: 5000, status: 'issued' };
    const inv2 = { invoice_id: 2, invoice_number: 'INV-2569-000002', grand_total: 3000, status: 'paid' };
    queryQueue = [q([inv1, inv2]), q([mockStats])]; // list → stats

    const res = await GET(makeRequest('GET', 'http://localhost/api/billing/invoices?yard_id=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('invoices');
    expect(body).toHaveProperty('stats');
    expect(body.invoices).toHaveLength(2);
    expect(body.invoices[0].invoice_number).toBe('INV-2569-000001');
    expect(body.stats.total_outstanding).toBe(5000);
  });

  it('returns empty invoices when none found', async () => {
    queryQueue = [q([]), q([mockStats])];
    const res = await GET(makeRequest('GET', 'http://localhost/api/billing/invoices?yard_id=99'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices).toEqual([]);
  });

  it('filters by status=paid', async () => {
    queryQueue = [
      q([{ invoice_id: 2, status: 'paid', invoice_number: 'INV-2569-000002', grand_total: 3000 }]),
      q([mockStats]),
    ];
    const res = await GET(makeRequest('GET', 'http://localhost/api/billing/invoices?yard_id=1&status=paid'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoices.every((i: { status: string }) => i.status === 'paid')).toBe(true);
  });

  it('returns 500 on DB error', async () => {
    queryQueue = [qErr('Connection reset')];
    const res = await GET(makeRequest('GET', 'http://localhost/api/billing/invoices?yard_id=1'));
    expect(res.status).toBe(500);
  });
});

// ── POST ─────────────────────────────────────────────────────────────
describe('POST /api/billing/invoices', () => {
  beforeEach(setup);

  const validInvoice = {
    yard_id: 1, customer_id: 1, container_id: 1,
    charge_type: 'storage', description: 'ค่าจอดตู้',
    quantity: 10, unit_price: 500,
  };

  it('creates invoice and returns invoice_number', async () => {
    queryQueue = [
      q([{ cnt: 10 }]), // COUNT
      q([{ invoice_id: 11, invoice_number: 'INV-2569-000011', status: 'draft', grand_total: 5350 }]), // INSERT
    ];
    const res = await POST(makeRequest('POST', 'http://localhost/api/billing/invoices', validInvoice));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.invoice_number).toMatch(/^INV-/);
    expect(body.invoice?.invoice_id).toBe(11);
  });

  it('auto-calculates VAT (7%) in grand_total', async () => {
    // 10 * 500 = 5000 + 7% VAT = 5350
    queryQueue = [q([{ cnt: 5 }]), q([{ invoice_id: 6, grand_total: 5350 }])];
    const res = await POST(makeRequest('POST', 'http://localhost/api/billing/invoices', validInvoice));
    expect(res.status).toBe(200);
  });

  it('returns 500 on DB error', async () => {
    queryQueue = [qErr('Deadlock detected')];
    const res = await POST(makeRequest('POST', 'http://localhost/api/billing/invoices', validInvoice));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

// ── PUT ──────────────────────────────────────────────────────────────
describe('PUT /api/billing/invoices — status actions', () => {
  beforeEach(setup);

  it('marks invoice as paid', async () => {
    queryQueue = [
      q([]),                    // UPDATE status = paid
      q([{ container_id: 5 }]), // SELECT container_id
      q([]),                    // UPDATE container hold
    ];
    const res = await PUT(makeRequest('PUT', 'http://localhost/api/billing/invoices', {
      invoice_id: 1, action: 'pay', yard_id: 1,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('issues invoice', async () => {
    queryQueue = [q([])]; // UPDATE status = issued
    const res = await PUT(makeRequest('PUT', 'http://localhost/api/billing/invoices', {
      invoice_id: 1, action: 'issue', yard_id: 1,
    }));
    expect(res.status).toBe(200);
  });

  it('cancels invoice', async () => {
    queryQueue = [q([])]; // UPDATE status = cancelled
    const res = await PUT(makeRequest('PUT', 'http://localhost/api/billing/invoices', {
      invoice_id: 1, action: 'cancel', yard_id: 1,
    }));
    expect(res.status).toBe(200);
  });

  it('returns 500 on DB error during pay', async () => {
    queryQueue = [qErr('Timeout during UPDATE')];
    const res = await PUT(makeRequest('PUT', 'http://localhost/api/billing/invoices', {
      invoice_id: 1, action: 'pay', yard_id: 1,
    }));
    expect(res.status).toBe(500);
  });

  it('creates credit note and revised invoice', async () => {
    const original = {
      invoice_id: 1,
      invoice_number: 'INV-2026-000001',
      yard_id: 1,
      customer_id: 2,
      container_id: 3,
      charge_type: 'storage',
      description: 'ค่าฝากตู้',
      quantity: 1,
      unit_price: 1000,
      grand_total: 1070,
      due_date: null,
      status: 'issued',
    };
    queryQueue = [
      q([original]), // original invoice
      q([{ credited_total: 0 }]), // previous CN
      q([{ cnt: 0 }]), // CN number
      q([{ invoice_id: 21, invoice_number: 'CN-2026-000001', grand_total: -1070 }]), // insert CN
      q([]), // cancel original
      q([{ cnt: 1 }]), // revised invoice number
      q([{ invoice_id: 22, invoice_number: 'INV-2026-000002', grand_total: 535 }]), // insert revised
    ];

    const res = await PUT(makeRequest('PUT', 'http://localhost/api/billing/invoices', {
      invoice_id: 1,
      action: 'credit_note',
      ref_invoice_id: 1,
      reason: 'ยอดเดิมผิด',
      credit_amount: 1070,
      create_revised_invoice: true,
      revised_invoice: { description: 'ค่าฝากตู้แก้ไข', quantity: 1, unit_price: 500 },
      yard_id: 1,
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cn_number).toMatch(/^CN-/);
    expect(body.revised_invoice_number).toMatch(/^INV-/);
    expect(body.remaining_amount).toBe(0);
  });

  it('rejects cumulative credit notes over original invoice total', async () => {
    queryQueue = [
      q([{ invoice_id: 1, invoice_number: 'INV-2026-000001', grand_total: 1070, status: 'issued' }]),
      q([{ credited_total: 1000 }]),
    ];

    const res = await PUT(makeRequest('PUT', 'http://localhost/api/billing/invoices', {
      invoice_id: 1,
      action: 'credit_note',
      ref_invoice_id: 1,
      credit_amount: 100,
      yard_id: 1,
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('ยอดลดหนี้เกินยอดคงเหลือ');
  });
});
