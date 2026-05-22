import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const inputs: Array<[string, unknown, unknown]> = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('COUNT(*) AS total_pending')) {
      return Promise.resolve({ recordset: [{ total_pending: 1, rf_pending: 1 }] });
    }
    if (statement.includes('FROM Bookings b') && statement.includes("b.status = 'pending'")) {
      return Promise.resolve({
        recordset: [{
          booking_id: 77,
          booking_number: 'BK-PENDING',
          status: 'pending',
          yard_id: 1,
          customer_name: 'ACME',
          container_type: 'RF',
          container_count: 2,
        }],
      });
    }
    if (statement.includes('SELECT TOP 1 booking_id')) {
      return Promise.resolve({ recordset: [{ booking_id: 77, booking_number: 'BK-PENDING', yard_id: 1, status: 'pending' }] });
    }
    if (statement.includes('UPDATE Bookings')) {
      return Promise.resolve({ recordset: [{ booking_id: 77, booking_number: 'BK-PENDING', status: 'confirmed' }] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return requestApi;
  });
  const requestApi = { input, query };
  const request = jest.fn(() => requestApi);
  return { request, inputs, queries };
}

function req(url: string, method = 'GET', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'x-user-id': '9', 'x-user-role': 'yard_manager' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/edi/bookings/approval', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../edi/bookings/approval/route') as typeof import('../edi/bookings/approval/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'yard_manager' });
    mockedRequireYardAccess.mockResolvedValue({ ok: true });
  });

  it('lists pending booking requests with server-side permission checks', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(req('http://localhost/api/edi/bookings/approval?yard_id=1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bookings).toHaveLength(1);
    expect(body.summary).toEqual(expect.objectContaining({ total_pending: 1, rf_pending: 1 }));
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'booking.manage', expect.any(String));
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 1);
  });

  it('approves pending bookings and writes an audit event', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.PATCH(req('http://localhost/api/edi/bookings/approval', 'PATCH', {
      booking_id: 77,
      action: 'approve',
      note: 'เอกสารครบ',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.booking).toEqual(expect.objectContaining({ status: 'confirmed' }));
    expect(db.inputs).toContainEqual(['status', expect.anything(), 'confirmed']);
    expect(db.queries.join('\n')).toContain('UPDATE Bookings');
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'booking_approval_approve',
      entityType: 'booking',
      entityId: 77,
    }));
  });
});
