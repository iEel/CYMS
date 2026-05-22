import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function makeDb() {
  const query = jest.fn().mockResolvedValue({ recordset: [] });
  const input = jest.fn().mockReturnThis();
  return { request: jest.fn(() => ({ input, query })), input, query };
}

function makeRequest(url: string) {
  return new NextRequest(url, {
    headers: { 'x-user-id': '9', 'x-user-role': 'billing_officer' },
  });
}

describe('billing API read permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAnyPermission.mockResolvedValue({ userId: 9, role: 'billing_officer' });
    mockedRequireYardAccess.mockResolvedValue({ userId: 9, role: 'billing_officer' });
  });

  it('requires billing/report permission before listing invoices', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../billing/invoices/route') as typeof import('../billing/invoices/route');
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequireAnyPermission.mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }));

    const res = await route.GET(makeRequest('http://localhost/api/billing/invoices?yard_id=1'));

    expect(res.status).toBe(403);
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      expect.arrayContaining(['billing.invoice.create', 'billing.payment.receive', 'reports.view']),
      expect.any(String)
    );
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
  });

  it('requires billing/report permission before returning AR aging', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../billing/ar-aging/route') as typeof import('../billing/ar-aging/route');
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequireAnyPermission.mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }));

    const res = await route.GET(makeRequest('http://localhost/api/billing/ar-aging?yard_id=1'));

    expect(res.status).toBe(403);
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      expect.arrayContaining(['billing.invoice.create', 'billing.payment.receive', 'reports.view']),
      expect.any(String)
    );
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
  });
});
