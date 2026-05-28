import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import * as dashboardRoute from '../dashboard/route';
import * as searchRoute from '../search/route';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

const mockedGetDb = getDb as jest.Mock;

let executedSql: string[] = [];

function makeDb() {
  return {
    request: jest.fn(() => {
      const request = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn(async (statement: string) => {
          executedSql.push(statement);

          if (statement.includes('FROM UserYardAccess')) {
            return { recordset: [{ allowed: 1 }] };
          }

          if (statement.includes('FROM Roles r')) {
            return { recordset: [] };
          }

          throw new Error('business query should not run after permission denial');
        }),
      };
      return request;
    }),
  };
}

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': '17',
      'x-user-role': 'operations_viewer',
    },
  });
}

function businessQueries() {
  return executedSql.filter(statement =>
    /\bFROM\s+(Containers|GateTransactions|Invoices|Bookings|WorkOrders|RepairOrders)\b/i.test(statement)
  );
}

describe('read route runtime permission guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executedSql = [];
    mockedGetDb.mockResolvedValue(makeDb());
  });

  it('dashboard returns 403 before analytics queries when reports.view is missing', async () => {
    const res = await dashboardRoute.GET(makeRequest('http://localhost/api/dashboard?yard_id=1'));

    expect(res.status).toBe(403);
    expect(businessQueries()).toEqual([]);
  });

  it('search returns 403 before search queries when all read permissions are missing', async () => {
    const res = await searchRoute.GET(makeRequest('http://localhost/api/search?q=EVRU&yard_id=1'));

    expect(res.status).toBe(403);
    expect(businessQueries()).toEqual([]);
  });
});
