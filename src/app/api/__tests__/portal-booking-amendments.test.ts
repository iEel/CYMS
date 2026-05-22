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
    if (statement.includes('FROM Bookings b') && statement.includes('PortalEntityAccess')) {
      return Promise.resolve({ recordset: [{ booking_id: 77, booking_number: 'BK-1', yard_id: 1, customer_id: 42 }] });
    }
    if (statement.includes('INSERT INTO PortalBookingAmendments')) {
      return Promise.resolve({ recordset: [{ amendment_id: 900, booking_id: 77, request_type: 'amend', status: 'pending' }] });
    }
    if (statement.includes('FROM PortalBookingAmendments a') && statement.includes('a.amendment_id = @amendmentId')) {
      return Promise.resolve({
        recordset: [{
          amendment_id: 900,
          booking_id: 77,
          booking_number: 'BK-1',
          yard_id: 1,
          status: 'pending',
          request_type: 'cancel',
          requested_changes: JSON.stringify({ eta: '2026-06-01' }),
          reason: 'เปลี่ยนแผน',
        }],
      });
    }
    if (statement.includes('UPDATE Bookings')) {
      return Promise.resolve({ recordset: [{ booking_id: 77, booking_number: 'BK-1', status: 'cancelled' }] });
    }
    if (statement.includes('UPDATE PortalBookingAmendments')) {
      return Promise.resolve({ recordset: [{ amendment_id: 900, status: 'approved' }] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return chain;
  });
  const chain = { input, query };
  const request = jest.fn(() => chain);
  return { request, input, query, queries, inputs };
}

function portalReq(body?: unknown) {
  return new NextRequest('http://localhost/api/portal/bookings/amendments', {
    method: body ? 'POST' : 'GET',
    headers: { 'x-customer-id': '42', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function staffReq(body?: unknown) {
  return new NextRequest('http://localhost/api/edi/bookings/amendments', {
    method: body ? 'PATCH' : 'GET',
    headers: { 'x-user-id': '9', 'x-user-role': 'yard_manager', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('portal booking amendment requests', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const portalRoute = require('../portal/bookings/amendments/route') as typeof import('../portal/bookings/amendments/route');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const staffRoute = require('../edi/bookings/amendments/route') as typeof import('../edi/bookings/amendments/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'yard_manager' });
    mockedRequireYardAccess.mockResolvedValue({ ok: true });
  });

  it('creates a pending amendment scoped by portal grants without mutating Bookings', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await portalRoute.POST(portalReq({
      booking_id: 77,
      customer_id: 999,
      request_type: 'amend',
      requested_changes: { eta: '2026-06-01', vessel_name: 'NEW VESSEL', status: 'confirmed' },
      reason: 'เรือเลื่อน',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.amendment).toEqual(expect.objectContaining({ amendment_id: 900, status: 'pending' }));
    const sqlText = db.queries.join('\n');
    expect(sqlText).toContain('PortalEntityAccess');
    expect(sqlText).toContain('INSERT INTO PortalBookingAmendments');
    expect(sqlText).not.toContain('UPDATE Bookings');
    expect(db.inputs).toContainEqual(['customerId', expect.anything(), 42]);
    expect(db.inputs).not.toContainEqual(['customerId', expect.anything(), 999]);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'portal_booking_amendment_create',
      entityType: 'booking_amendment',
      entityId: 900,
    }));
  });

  it('approves an amendment server-side and applies the booking change with audit', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await staffRoute.PATCH(staffReq({ amendment_id: 900, action: 'approve', note: 'รับทราบ' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.amendment).toEqual(expect.objectContaining({ status: 'approved' }));
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'booking.manage', expect.any(String));
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 1);
    expect(db.queries.join('\n')).toContain('UPDATE Bookings');
    expect(db.inputs).toContainEqual(['bookingStatus', expect.anything(), 'cancelled']);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'booking_amendment_approve',
      entityType: 'booking_amendment',
      entityId: 900,
    }));
  });
});
