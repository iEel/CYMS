import { NextRequest } from 'next/server';
import { GET as getChecks, POST as postCheck } from '../reefer/checks/route';
import { GET as getPortalReefer } from '../portal/reefer/route';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));
jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn(),
}));
jest.mock('@/lib/apiAuth', () => ({
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const inputs: Array<[string, unknown, unknown]> = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Containers c') && statement.includes('c.container_id = @containerId')) {
      return Promise.resolve({
        recordset: [{
          container_id: 123,
          container_number: 'MSKU1234567',
          type: 'RF',
          yard_id: 1,
          booking_id: 77,
          customer_id: 42,
        }],
      });
    }
    if (statement.includes('FROM ReeferCheckPolicies')) {
      return Promise.resolve({
        recordset: [
          { scope_type: 'default', interval_hours: 8, warning_grace_minutes: 30, is_active: true },
          { scope_type: 'customer', customer_id: 42, interval_hours: 4, warning_grace_minutes: 30, min_temp_c: -20, max_temp_c: -16, is_active: true },
        ],
      });
    }
    if (statement.includes('FROM ReeferTemperatureChecks rc')) {
      return Promise.resolve({
        recordset: [{
          check_id: 900,
          container_id: 123,
          booking_id: 77,
          measured_temp_c: -18.2,
          set_point_c: -18,
          supply_temp_c: -19,
          return_temp_c: -17.5,
          status: 'normal',
          photo_url: '/uploads/photos/reefer-900.jpg',
          notes: 'Display clear',
          checked_at: '2026-05-22T08:00:00.000Z',
          checked_by_name: 'Survey User',
          exception_id: null,
        }],
      });
    }
    if (statement.includes('INSERT INTO ReeferTemperatureChecks')) {
      return Promise.resolve({
        recordset: [{
          check_id: 555,
          container_id: 123,
          booking_id: 77,
          yard_id: 1,
          customer_id: 42,
          measured_temp_c: -14.5,
          status: 'out_of_range',
        }],
      });
    }
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return requestApi;
  });
  const requestApi = { input, query };
  const request = jest.fn(() => requestApi);
  return { request, input, query, queries, inputs };
}

function makeRequest(url: string, init: { method?: string; body?: BodyInit | null; headers?: HeadersInit } = {}) {
  return new NextRequest(url, {
    method: init.method,
    body: init.body,
    headers: init.headers,
  });
}

describe('reefer monitoring API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'surveyor' });
    mockedRequireYardAccess.mockResolvedValue({ ok: true });
  });

  it('records a reefer check against the server-side container/customer/booking linkage', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await postCheck(makeRequest('http://localhost/api/reefer/checks', {
      method: 'POST',
      body: JSON.stringify({
        yard_id: 1,
        container_id: 123,
        customer_id: 999,
        measured_temp_c: -14.5,
        set_point_c: -18,
        photo_url: '/uploads/photos/reefer.jpg',
        notes: 'Display photo attached',
      }),
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.check.status).toBe('out_of_range');
    expect(db.queries.join('\n')).toContain('INSERT INTO ReeferTemperatureChecks');
    expect(db.inputs).toEqual(expect.arrayContaining([
      ['customerId', expect.anything(), 42],
      ['bookingId', expect.anything(), 77],
      ['checkedByUserId', expect.anything(), 9],
    ]));
    expect(db.inputs).not.toEqual(expect.arrayContaining([
      ['customerId', expect.anything(), 999],
    ]));
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'reefer.check.record', expect.any(String));
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 1);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 9,
      yardId: 1,
      action: 'reefer_check_record',
      entityType: 'reefer_temperature_check',
      entityId: 555,
    }));
  });

  it('lists only yard-scoped RF containers for the reefer queue', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await getChecks(makeRequest('http://localhost/api/reefer/checks?yard_id=1'));

    expect(res.status).toBe(200);
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain("c.type = 'RF'");
    expect(combinedSql).toContain('ReeferTemperatureChecks');
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 1);
  });

  it('returns staff-visible check history for a selected reefer container', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await getChecks(makeRequest('http://localhost/api/reefer/checks?yard_id=1&container_id=123'));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        check_id: 900,
        measured_temp_c: -18.2,
        photo_url: '/uploads/photos/reefer-900.jpg',
        checked_by_name: 'Survey User',
      }),
    ]));
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('FROM ReeferTemperatureChecks rc');
    expect(combinedSql).toContain('LEFT JOIN Users u');
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'reefer.check.read', expect.any(String));
  });
});

describe('GET /api/portal/reefer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses PortalEntityAccess grants as the portal visibility policy', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await getPortalReefer(makeRequest('http://localhost/api/portal/reefer', {
      headers: { 'x-customer-id': '42' },
    }));

    expect(res.status).toBe(200);
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).toContain("pea.entity_type = 'container'");
    expect(combinedSql).toContain("c.type = 'RF'");
    expect(combinedSql).not.toContain('c.customer_id = @cid');
  });
});
