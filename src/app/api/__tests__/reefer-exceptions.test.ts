import { NextRequest } from 'next/server';
import { GET, PATCH } from '../reefer/exceptions/route';
import { POST as postCheck } from '../reefer/checks/route';
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
        recordset: [{ scope_type: 'customer', customer_id: 42, interval_hours: 4, warning_grace_minutes: 30, min_temp_c: -20, max_temp_c: -16, is_active: true }],
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
          policy_snapshot: JSON.stringify({ min_temp_c: -20, max_temp_c: -16 }),
        }],
      });
    }
    if (statement.includes('INSERT INTO ReeferExceptions')) {
      return Promise.resolve({
        recordset: [{ exception_id: 900, status: 'open', severity: 'high' }],
      });
    }
    if (statement.includes('FROM ReeferExceptions WHERE exception_id = @exceptionId')) {
      return Promise.resolve({ recordset: [{ yard_id: 1, status: 'open' }] });
    }
    if (statement.includes('FROM ReeferExceptions e')) {
      return Promise.resolve({
        recordset: [{
          exception_id: 901,
          check_id: 555,
          container_id: 123,
          booking_id: 77,
          yard_id: 1,
          customer_id: 42,
          severity: 'critical',
          status: 'open',
          reason: 'power_issue',
          recommended_action: 'ตรวจแหล่งจ่ายไฟทันที',
          created_at: '2026-05-22T07:20:00.000Z',
          container_number: 'MSKU1234567',
        }],
      });
    }
    if (statement.includes('UPDATE ReeferExceptions')) {
      return Promise.resolve({ recordset: [{ exception_id: 900, status: 'resolved', resolution_note: 'ตรวจปลั๊กแล้ว' }] });
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

describe('reefer exception workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'supervisor' });
    mockedRequireYardAccess.mockResolvedValue({ ok: true });
  });

  it('opens an exception automatically when a reefer check is out of range', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await postCheck(makeRequest('http://localhost/api/reefer/checks', {
      method: 'POST',
      body: JSON.stringify({
        yard_id: 1,
        container_id: 123,
        measured_temp_c: -14.5,
        set_point_c: -18,
      }),
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exception).toEqual(expect.objectContaining({ exception_id: 900, status: 'open' }));
    expect(db.queries.join('\n')).toContain('INSERT INTO ReeferExceptions');
    expect(db.inputs).toEqual(expect.arrayContaining([
      ['severity', expect.anything(), 'high'],
      ['reason', expect.anything(), 'temperature_out_of_range'],
      ['recommendedAction', expect.anything(), 'ตรวจปลั๊กไฟ/เครื่อง reefer และแจ้ง supervisor'],
    ]));
  });

  it('updates exception actions with server-side permission and yard checks', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await PATCH(makeRequest('http://localhost/api/reefer/exceptions', {
      method: 'PATCH',
      body: JSON.stringify({
        exception_id: 900,
        action: 'resolve',
        resolution_note: 'ตรวจปลั๊กแล้ว',
      }),
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exception.status).toBe('resolved');
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'reefer.exception.manage', expect.any(String));
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 1);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reefer_exception_resolve',
      entityType: 'reefer_exception',
      entityId: 900,
    }));
  });

  it('returns escalation metadata for active exceptions', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-22T08:00:00.000Z'));
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeRequest('http://localhost/api/reefer/exceptions?yard_id=1'));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exceptions[0]).toEqual(expect.objectContaining({
      exception_id: 901,
      escalation_level: 'critical',
      escalation_breached: true,
      escalation_due_minutes: 30,
      escalation_age_minutes: 40,
    }));

    jest.useRealTimers();
  });
});
