import { NextRequest } from 'next/server';
import { GET } from '../portal/containers/route';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;

function makeDb(results?: Array<{ recordset: unknown[] }>, role = 'customer_admin') {
  const queries: string[] = [];
  const queue = [...(results || [])];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Users')) {
      return Promise.resolve({ recordset: [{ customer_portal_role: role }] });
    }
    const next = queue.shift();
    if (next) return Promise.resolve(next);
    if (statement.includes('COUNT(*)')) return Promise.resolve({ recordset: [{ total: 0 }] });
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

function makeRequest(url = 'http://localhost/api/portal/containers') {
  return new NextRequest(url, {
    headers: { 'x-customer-id': '42', 'x-user-id': '7' },
  });
}

describe('GET /api/portal/containers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses explicit portal entity grants instead of inferred owner/billing SQL', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).toContain("pea.entity_type = 'container'");
    expect(combinedSql).toContain('pea.entity_id = c.container_id');
    expect(combinedSql).toContain('pea.entity_ref = c.container_number');
    expect(combinedSql).not.toContain('c.container_owner_id = @cid');
    expect(combinedSql).not.toContain('billing_customer_id = @cid');
    expect(combinedSql).not.toContain('b.customer_id = @cid');
    expect(combinedSql).not.toContain('i.customer_id = @cid');
    expect(combinedSql).not.toContain('c.customer_id');
  });

  it('ignores attacker supplied customer ids in the query string', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest('http://localhost/api/portal/containers?customer_id=999&cid=999'));

    expect(res.status).toBe(200);
    const cidInputs = db.input.mock.calls.filter((call: unknown[]) => call[0] === 'cid');
    expect(cidInputs.length).toBeGreaterThan(0);
    expect(cidInputs.every((call: unknown[]) => call[2] === 42)).toBe(true);
    expect(db.input.mock.calls.some((call: unknown[]) => call[2] === 999)).toBe(false);
  });

  it('returns customer inventory summary and enriched container context', async () => {
    const db = makeDb([
      { recordset: [{ total: 3, in_yard: 2, released: 1, on_hold: 1, repair: 0 }] },
      { recordset: [{ total: 1 }] },
      {
        recordset: [{
          container_id: 7,
          container_number: 'MSKU1234567',
          status: 'in_yard',
          latest_booking_number: 'BK-100',
          latest_eir_number: 'EIR-IN-1',
          gate_in_eir_number: 'EIR-IN-1',
          gate_out_eir_number: 'EIR-OUT-1',
          open_invoice_count: 1,
          dwell_days: 5,
          visibility_role: 'booking_customer',
        }],
      },
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest('http://localhost/api/portal/containers?status=in_yard&search=MSKU&page=1&limit=20'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toMatchObject({ total: 3, in_yard: 2, released: 1, on_hold: 1, repair: 0 });
    expect(body.containers[0]).toMatchObject({
      container_number: 'MSKU1234567',
      latest_booking_number: 'BK-100',
      latest_eir_number: 'EIR-IN-1',
      gate_in_eir_number: 'EIR-IN-1',
      gate_out_eir_number: 'EIR-OUT-1',
      open_invoice_count: 1,
      dwell_days: 5,
      visibility_role: 'booking_customer',
    });

    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('latest_booking_number');
    expect(combinedSql).toContain('gate_in_eir_number');
    expect(combinedSql).toContain('gate_out_eir_number');
    expect(combinedSql).toContain('open_invoice_count');
    expect(combinedSql).toContain('dwell_days');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).not.toContain('g.container_number');
    expect(db.input).toHaveBeenCalledWith('status', expect.anything(), 'in_yard');
    expect(db.input).toHaveBeenCalledWith('search', expect.anything(), '%MSKU%');
  });

  it('redacts invoice context for portal roles without invoice view', async () => {
    const db = makeDb([
      { recordset: [{ total: 3, in_yard: 2, released: 1, on_hold: 0, repair: 0 }] },
      { recordset: [{ total: 1 }] },
      {
        recordset: [{
          container_id: 7,
          container_number: 'MSKU1234567',
          status: 'in_yard',
          open_invoice_count: 9,
          open_invoice_amount: 9999,
        }],
      },
    ], 'document_user');
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.containers[0]).toEqual(expect.objectContaining({
      open_invoice_count: 0,
      open_invoice_amount: 0,
    }));
    expect(db.queries.join('\n')).not.toContain('FROM Invoices');
  });

  it('keeps invoice context for billing portal roles', async () => {
    const db = makeDb([
      { recordset: [{ total: 3, in_yard: 2, released: 1, on_hold: 0, repair: 0 }] },
      { recordset: [{ total: 1 }] },
      {
        recordset: [{
          container_id: 7,
          container_number: 'MSKU1234567',
          status: 'in_yard',
          open_invoice_count: 2,
          open_invoice_amount: 5000,
        }],
      },
    ], 'billing_user');
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.containers[0]).toEqual(expect.objectContaining({
      open_invoice_count: 2,
      open_invoice_amount: 5000,
    }));
    expect(db.queries.join('\n')).toContain('FROM Invoices');
  });

  it('maps released portal filter to released and gated-out statuses', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest('http://localhost/api/portal/containers?status=released'));

    expect(res.status).toBe(200);
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain("c.status IN ('released', 'gated_out')");
    expect(db.input.mock.calls.some((call: unknown[]) => call[0] === 'status')).toBe(false);
  });
});
