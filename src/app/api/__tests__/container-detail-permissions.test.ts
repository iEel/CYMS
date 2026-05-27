import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';
import { GET as getContainerDetail } from '../containers/detail/route';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

let queryQueue: Array<{ recordset: unknown[] } | Error> = [];

function makeDb() {
  const query = jest.fn().mockImplementation(() => {
    const next = queryQueue.shift();
    if (!next) return Promise.resolve({ recordset: [] });
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  });
  const input = jest.fn().mockReturnThis();

  return {
    request: jest.fn(() => ({ input, query })),
    query,
  };
}

function q(recordset: unknown[]) {
  return { recordset };
}

function makeRequest() {
  return new NextRequest('http://localhost/api/containers/detail?container_id=22', {
    headers: { 'x-user-id': '9', 'x-user-role': 'gate_operator' },
  });
}

describe('container detail read permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryQueue = [];
    mockedRequireAnyPermission.mockResolvedValue({ userId: 9, role: 'gate_operator' });
    mockedRequireYardAccess.mockResolvedValue({ userId: 9, role: 'gate_operator' });
  });

  it('rejects missing route permission before querying container detail data', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequireAnyPermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'forbidden' }, { status: 403 })
    );

    const res = await getContainerDetail(makeRequest());

    expect(res.status).toBe(403);
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      expect.arrayContaining([
        'gate.in',
        'gate.out',
        'yard.location.assign',
        'yard.slot.move',
        'billing.invoice.create',
        'billing.payment.receive',
        'mnr.eor.create',
        'mnr.eor.update',
        'reports.view',
      ]),
      expect.any(String)
    );
    expect(db.request).not.toHaveBeenCalled();
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
  });

  it('checks loaded container yard access before later detail queries', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequireYardAccess.mockResolvedValueOnce(
      NextResponse.json({ error: 'yard denied' }, { status: 403 })
    );
    queryQueue = [
      q([{
        container_id: 22,
        yard_id: 44,
        container_number: 'TGHU1234567',
        status: 'in_yard',
      }]),
    ];

    const res = await getContainerDetail(makeRequest());

    expect(res.status).toBe(403);
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(
      expect.anything(),
      db,
      44,
      expect.any(String)
    );
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
