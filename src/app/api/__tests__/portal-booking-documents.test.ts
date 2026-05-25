import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { logAttachment } from '@/lib/attachmentCenter';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/attachmentCenter', () => ({
  ensureAttachmentCenter: jest.fn(),
  logAttachment: jest.fn(),
}));
jest.mock('@/lib/apiAuth', () => ({
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAttachment = logAttachment as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const inputs: Array<[string, unknown, unknown]> = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Users')) {
      return Promise.resolve({ recordset: [{ customer_portal_role: 'customer_admin' }] });
    }
    if (statement.includes('FROM Bookings b') && statement.includes('PortalEntityAccess')) {
      return Promise.resolve({ recordset: [{ booking_id: 77, booking_number: 'BK-1', yard_id: 1, customer_id: 42 }] });
    }
    if (statement.includes('FROM EntityAttachments ea')) {
      return Promise.resolve({ recordset: [{ attachment_id: 5, entity_id: 77, file_name: 'si.pdf' }] });
    }
    if (statement.includes('FROM EntityAttachments ea') && statement.includes('INNER JOIN Bookings b')) {
      return Promise.resolve({ recordset: [{ attachment_id: 5, booking_number: 'BK-1' }] });
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
  return new NextRequest('http://localhost/api/portal/bookings/documents?booking_id=77', {
    method: body ? 'POST' : 'GET',
    headers: { 'x-customer-id': '42', 'x-user-id': '7', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function staffReq() {
  return new NextRequest('http://localhost/api/edi/bookings/documents?yard_id=1', {
    headers: { 'x-user-id': '9', 'x-user-role': 'yard_manager' },
  });
}

describe('portal booking documents', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const portalRoute = require('../portal/bookings/documents/route') as typeof import('../portal/bookings/documents/route');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const staffRoute = require('../edi/bookings/documents/route') as typeof import('../edi/bookings/documents/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'yard_manager' });
    mockedRequireYardAccess.mockResolvedValue({ ok: true });
    mockedLogAttachment.mockResolvedValue({ attachment_id: 5, entity_id: 77, file_name: 'si.pdf' });
  });

  it('stores customer uploaded booking documents only after portal grant validation', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await portalRoute.POST(portalReq({
      booking_id: 77,
      customer_id: 999,
      file_url: '/uploads/documents/2026-05/si.pdf',
      file_name: 'si.pdf',
      mime_type: 'application/pdf',
      category: 'shipping_instruction',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.attachment).toEqual(expect.objectContaining({ attachment_id: 5 }));
    const sqlText = db.queries.join('\n');
    expect(sqlText).toContain('PortalEntityAccess');
    expect(db.inputs).toContainEqual(['customerId', expect.anything(), 42]);
    expect(db.inputs).not.toContainEqual(['customerId', expect.anything(), 999]);
    expect(mockedLogAttachment).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'booking',
      entityId: 77,
      entityNumber: 'BK-1',
      category: 'shipping_instruction',
      source: 'portal',
      uploadedBy: null,
      metadata: expect.objectContaining({ customer_id: 42 }),
    }));
  });

  it('lets staff list customer documents with permission and yard guard', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await staffRoute.GET(staffReq());

    expect(res.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'booking.manage', expect.any(String));
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 1);
    expect(db.queries.join('\n')).toContain('FROM EntityAttachments ea');
  });
});
