import { NextRequest } from 'next/server';
import { GET } from '../portal/containers/route';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('COUNT(*)')) return Promise.resolve({ recordset: [{ total: 0 }] });
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

function makeRequest(url = 'http://localhost/api/portal/containers') {
  return new NextRequest(url, {
    headers: { 'x-customer-id': '42' },
  });
}

describe('GET /api/portal/containers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses owner/billing/booking visibility instead of legacy c.customer_id', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('c.container_owner_id = @cid');
    expect(combinedSql).toContain('billing_customer_id = @cid');
    expect(combinedSql).toContain('BookingContainers');
    expect(combinedSql).toContain('Invoices');
    expect(combinedSql).not.toContain('c.customer_id');
  });
});
