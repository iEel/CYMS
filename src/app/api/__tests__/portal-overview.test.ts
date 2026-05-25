import { NextRequest } from 'next/server';
import { GET } from '../portal/overview/route';
import { getDb } from '@/lib/db';
import { writeIntegrationLog } from '@/lib/integrationLog';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/integrationLog', () => ({
  writeIntegrationLog: jest.fn().mockResolvedValue(undefined),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedWriteIntegrationLog = writeIntegrationLog as jest.Mock;

function makeDb(results?: Array<{ recordset: unknown[] }>, role = 'customer_admin') {
  const queries: string[] = [];
  const queue = [...(results || [])];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Users')) {
      return Promise.resolve({ recordset: [{ customer_portal_role: role }] });
    }
    return Promise.resolve(queue.shift() || { recordset: [] });
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

function makeRequest() {
  return new NextRequest('http://localhost/api/portal/overview', {
    headers: { 'x-customer-id': '42', 'x-user-id': '7' },
  });
}

describe('GET /api/portal/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the same portal container summary buckets as the container inventory page', async () => {
    const db = makeDb([
      { recordset: [{ customer_name: 'ACME' }] },
      { recordset: [{ total: 14, in_yard: 5, released: 9, on_hold: 1, repair: 0 }] },
      { recordset: [{ count: 2, total: 1200 }] },
      { recordset: [{ count: 3 }] },
      { recordset: [] },
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      containers: { total: 14, in_yard: 5, released: 9, on_hold: 1, repair: 0 },
    });
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain("status IN ('released', 'gated_out')");
    expect(combinedSql).toContain('on_hold');
    expect(combinedSql).toContain('repair');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(mockedWriteIntegrationLog).toHaveBeenCalledWith(expect.objectContaining({
      payloadSummary: expect.objectContaining({ containers: 14 }),
    }));
  });
});
