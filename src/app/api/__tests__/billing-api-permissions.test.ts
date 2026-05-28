import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requirePermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;
const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

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
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'billing_officer' });
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

  it('normalizes invoice customer through the shared business party resolver', () => {
    const source = read('src/app/api/billing/invoices/route.ts');

    expect(source).toContain('normalizeBusinessPartyContext');
    expect(source).toContain('validateBusinessPartyInput');
    expect(source).toContain('invoicePartyContext.billToCustomerId');
    expect(source).toContain(".input('customerId', sql.Int, invoiceCustomerId)");
    expect(source).not.toContain(".input('customerId', sql.Int, body.customer_id)");
    expect(source).not.toContain('customer_id: body.customer_id');
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

  it.each([
    {
      name: 'tariff list',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/tariffs/route') as typeof import('../billing/tariffs/route'),
      invoke: (route: typeof import('../billing/tariffs/route')) =>
        route.GET(makeRequest('http://localhost/api/billing/tariffs?yard_id=1')),
      permissions: ['settings.manage', 'billing.invoice.create', 'billing.payment.receive', 'reports.view'],
    },
    {
      name: 'auto billing calculation',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/auto-calculate/route') as typeof import('../billing/auto-calculate/route'),
      invoke: (route: typeof import('../billing/auto-calculate/route')) =>
        route.POST(new NextRequest('http://localhost/api/billing/auto-calculate', {
          method: 'POST',
          headers: { 'x-user-id': '9', 'x-user-role': 'billing_officer' },
          body: JSON.stringify({ yard_id: 1, container_id: 22 }),
        })),
      permissions: ['billing.invoice.create', 'billing.payment.receive', 'gate.out', 'reports.view'],
    },
    {
      name: 'gate-out billing check',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/gate-check/route') as typeof import('../billing/gate-check/route'),
      invoke: (route: typeof import('../billing/gate-check/route')) =>
        route.POST(new NextRequest('http://localhost/api/billing/gate-check', {
          method: 'POST',
          headers: { 'x-user-id': '9', 'x-user-role': 'gate_operator' },
          body: JSON.stringify({ yard_id: 1, container_id: 22 }),
        })),
      permissions: ['gate.out', 'billing.invoice.create', 'billing.payment.receive'],
    },
    {
      name: 'gate-in billing check',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/gate-in-check/route') as typeof import('../billing/gate-in-check/route'),
      invoke: (route: typeof import('../billing/gate-in-check/route')) =>
        route.POST(new NextRequest('http://localhost/api/billing/gate-in-check', {
          method: 'POST',
          headers: { 'x-user-id': '9', 'x-user-role': 'gate_operator' },
          body: JSON.stringify({ yard_id: 1, container_number: 'ABCU1234567', size: '20' }),
        })),
      permissions: ['gate.in', 'billing.invoice.create', 'billing.payment.receive'],
    },
  ])('requires server-side permission before %s', async ({ load, invoke, permissions }) => {
    const route = load();
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequireAnyPermission.mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }));

    const res = await invoke(route as never);

    expect(res.status).toBe(403);
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      expect.arrayContaining(permissions),
      expect.any(String)
    );
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
  });

  it('requires settings.manage before tariff mutations', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../billing/tariffs/route') as typeof import('../billing/tariffs/route');
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequirePermission.mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }));

    const res = await route.POST(new NextRequest('http://localhost/api/billing/tariffs', {
      method: 'POST',
      headers: { 'x-user-id': '9', 'x-user-role': 'billing_officer' },
      body: JSON.stringify({ yard_id: 1, charge_type: 'storage', rate: 100, unit: 'per_day' }),
    }));

    expect(res.status).toBe(403);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      'settings.manage',
      expect.any(String)
    );
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'tariff list',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/tariffs/route') as typeof import('../billing/tariffs/route'),
      invoke: (route: typeof import('../billing/tariffs/route')) =>
        route.GET(makeRequest('http://localhost/api/billing/tariffs?yard_id=2')),
    },
    {
      name: 'auto billing calculation',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/auto-calculate/route') as typeof import('../billing/auto-calculate/route'),
      invoke: (route: typeof import('../billing/auto-calculate/route')) =>
        route.POST(new NextRequest('http://localhost/api/billing/auto-calculate', {
          method: 'POST',
          headers: { 'x-user-id': '9', 'x-user-role': 'billing_officer' },
          body: JSON.stringify({ yard_id: 2, container_id: 22 }),
        })),
    },
    {
      name: 'gate-out billing check',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/gate-check/route') as typeof import('../billing/gate-check/route'),
      invoke: (route: typeof import('../billing/gate-check/route')) =>
        route.POST(new NextRequest('http://localhost/api/billing/gate-check', {
          method: 'POST',
          headers: { 'x-user-id': '9', 'x-user-role': 'gate_operator' },
          body: JSON.stringify({ yard_id: 2, container_id: 22 }),
        })),
    },
    {
      name: 'gate-in billing check',
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      load: () => require('../billing/gate-in-check/route') as typeof import('../billing/gate-in-check/route'),
      invoke: (route: typeof import('../billing/gate-in-check/route')) =>
        route.POST(new NextRequest('http://localhost/api/billing/gate-in-check', {
          method: 'POST',
          headers: { 'x-user-id': '9', 'x-user-role': 'gate_operator' },
          body: JSON.stringify({ yard_id: 2, container_number: 'ABCU1234567', size: '20' }),
        })),
    },
  ])('requires yard access before %s touches billing data', async ({ load, invoke }) => {
    const route = load();
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequireYardAccess.mockResolvedValueOnce(Response.json({ error: 'yard denied' }, { status: 403 }));

    const res = await invoke(route as never);

    expect(res.status).toBe(403);
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(
      expect.anything(),
      db,
      2,
      expect.any(String)
    );
  });
});
