import { NextRequest } from 'next/server';
import { GET } from '../portal/bookings/route';
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

function makeRequest(url = 'http://localhost/api/portal/bookings') {
  return new NextRequest(url, {
    headers: { 'x-customer-id': '42' },
  });
}

describe('GET /api/portal/bookings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses explicit portal entity grants instead of Bookings.customer_id as the access policy', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).toContain("pea.entity_type = 'booking'");
    expect(combinedSql).toContain('pea.entity_id = b.booking_id');
    expect(combinedSql).toContain('pea.entity_ref = b.booking_number');
    expect(combinedSql).not.toContain('b.customer_id = @cid');
  });
});
