import { NextRequest } from 'next/server';
import { GET, POST } from '../portal/bookings/route';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { upsertPortalEntityAccess } from '@/lib/portalEntityAccess';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));
jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn(),
}));
jest.mock('@/lib/portalEntityAccess', () => ({
  upsertPortalEntityAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;
const mockedUpsertPortalEntityAccess = upsertPortalEntityAccess as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const inputValues: Record<string, unknown> = {};
  type RequestChain = { input: jest.Mock; query: jest.Mock };
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('COUNT(*)')) return Promise.resolve({ recordset: [{ total: 0 }] });
    if (statement.includes('INSERT INTO Bookings')) {
      return Promise.resolve({
        recordset: [{
          booking_id: 77,
          booking_number: 'BK-PORTAL-1',
          booking_type: 'export',
          status: 'pending',
          yard_id: 1,
          customer_id: 42,
          container_count: 2,
          container_type: inputValues.containerType,
        }],
      });
    }
    if (statement.includes('INSERT INTO ReeferCheckPolicies')) {
      return Promise.resolve({ recordset: [{ policy_id: 91, scope_type: 'booking', booking_id: 77 }] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn((name: string, _type: unknown, value: unknown): RequestChain => {
    inputValues[name] = value;
    return chain;
  });
  const chain: RequestChain = { input, query };
  const request = jest.fn(() => chain);
  return { request, input, query, queries };
}

function makeRequest(url = 'http://localhost/api/portal/bookings', init: { method?: string; body?: BodyInit | null; headers?: HeadersInit } = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-customer-id', '42');

  return new NextRequest(url, {
    method: init.method,
    body: init.body,
    headers,
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

describe('POST /api/portal/bookings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a pending booking for the portal customer from the session header only', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await POST(makeRequest('http://localhost/api/portal/bookings', {
      method: 'POST',
      body: JSON.stringify({
        booking_number: 'BK-PORTAL-1',
        booking_type: 'export',
        yard_id: 1,
        customer_id: 999,
        container_count: 2,
        container_numbers: ['msku1234567'],
      }),
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.booking).toEqual(expect.objectContaining({
      booking_id: 77,
      customer_id: 42,
      status: 'pending',
    }));

    expect(db.input.mock.calls).toEqual(expect.arrayContaining([
      ['customerId', expect.anything(), 42],
      ['status', expect.anything(), 'pending'],
      ['containerNumber', expect.anything(), 'MSKU1234567'],
    ]));
    expect(db.input.mock.calls).not.toEqual(expect.arrayContaining([
      ['customerId', expect.anything(), 999],
    ]));
    expect(db.queries.join('\n')).toContain('INSERT INTO Bookings');
    expect(db.queries.join('\n')).toContain('INSERT INTO BookingContainers');
    expect(mockedUpsertPortalEntityAccess).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 42,
      entityType: 'booking',
      entityId: 77,
      entityRef: 'BK-PORTAL-1',
      accessRole: 'booking_customer',
      sourceTable: 'Bookings',
    }));
    expect(mockedUpsertPortalEntityAccess).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 42,
      entityType: 'container',
      entityRef: 'MSKU1234567',
      accessRole: 'booking_customer',
      sourceTable: 'BookingContainers',
    }));
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      yardId: 1,
      action: 'portal_booking_create',
      entityType: 'booking',
      entityId: 77,
    }));
  });

  it('rejects invalid portal booking requests before writing to the database', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await POST(makeRequest('http://localhost/api/portal/bookings', {
      method: 'POST',
      body: JSON.stringify({
        booking_number: '',
        booking_type: 'other',
        yard_id: 1,
        container_count: 0,
      }),
    }));

    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
    expect(mockedUpsertPortalEntityAccess).not.toHaveBeenCalled();
  });

  it('creates a booking scoped reefer policy for RF portal bookings', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await POST(makeRequest('http://localhost/api/portal/bookings', {
      method: 'POST',
      body: JSON.stringify({
        booking_number: 'BK-RF-PORTAL-1',
        booking_type: 'import',
        yard_id: 1,
        container_count: 2,
        container_type: 'RF',
      }),
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reefer_policy).toEqual(expect.objectContaining({
      policy_id: 91,
      scope_type: 'booking',
      booking_id: 77,
    }));
    expect(db.queries.join('\n')).toContain('INSERT INTO ReeferCheckPolicies');
    expect(db.input.mock.calls).toEqual(expect.arrayContaining([
      ['bookingId', expect.anything(), 77],
      ['scopeType', expect.anything(), 'booking'],
      ['intervalHours', expect.anything(), 4],
    ]));
  });
});
