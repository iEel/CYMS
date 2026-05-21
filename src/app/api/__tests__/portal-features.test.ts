import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;

type QueryResult = { recordset: unknown[] };

function q(recordset: unknown[]): QueryResult {
  return { recordset };
}

function makeDb(queue: QueryResult[]) {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    return Promise.resolve(queue.shift() || q([]));
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

function portalRequest(url: string, init: RequestInit = {}) {
  const { headers, signal, ...rest } = init;
  void signal;
  return new NextRequest(url, {
    ...rest,
    headers: {
      'x-customer-id': '42',
      ...(headers || {}),
    },
  });
}

describe('Customer Portal feature APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an invoice dispute only after customer ownership is verified', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../portal/disputes/route') as typeof import('../portal/disputes/route');
    const db = makeDb([
      q([{ invoice_id: 7, invoice_number: 'INV-7' }]),
      q([{ dispute_id: 55 }]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(portalRequest('http://localhost/api/portal/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: 7,
        category: 'billing',
        message: 'ยอดค่าบริการไม่ตรงกับเอกสารที่ได้รับ',
      }),
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true, dispute_id: 55 });
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('invoice_id = @invoiceId');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).toContain("pea.entity_type = 'invoice'");
    expect(combinedSql).toContain('INSERT INTO PortalDisputes');
  });

  it('returns a portal document bundle as a zip download', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../portal/document-bundle/route') as typeof import('../portal/document-bundle/route');
    const db = makeDb([
      q([{ outstanding: 1200, open_count: 1 }]),
      q([{ invoice_id: 7, invoice_number: 'INV-7', status: 'issued', grand_total: 1200 }]),
      q([{ eir_number: 'EIR-7', container_number: 'MSKU1234567', transaction_type: 'gate_in', created_at: '2026-05-21T08:00:00.000Z' }]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(portalRequest('http://localhost/api/portal/document-bundle'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toContain('CYMS-Portal-Bundle');
    const buffer = Buffer.from(await res.arrayBuffer());
    expect(buffer.subarray(0, 4).toString('binary')).toBe('PK\u0003\u0004');
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('FROM Invoices');
    expect(combinedSql).toContain('FROM GateTransactions g');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).toContain("pea.entity_type = 'gate_transaction'");
  });
});
