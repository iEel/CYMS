import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/apiAuth', () => ({
  requireRole: jest.fn(() => ({ userId: 99, role: 'yard_manager' })),
}));

import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { PUT } from '../settings/users/route';

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;

let queries: string[] = [];
let queryQueue: Array<{ recordset: unknown[] }> = [];

function makeDbRequest() {
  return {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation((query: string) => {
      queries.push(query);
      const next = queryQueue.shift();
      if (next) return Promise.resolve(next);
      return Promise.resolve({ recordset: [] });
    }),
  };
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/settings/users', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '99',
      'x-user-role': 'yard_manager',
    },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/settings/users — device binding actions', () => {
  beforeEach(() => {
    queries = [];
    queryQueue = [];
    mockedGetDb.mockResolvedValue({ request: makeDbRequest });
    mockedLogAudit.mockClear();
  });

  it('clears a user trusted-device binding without requiring a full profile update payload', async () => {
    const res = await PUT(makeRequest({ action: 'reset_device_binding', user_id: 8 }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'ล้างการผูกอุปกรณ์เรียบร้อย' });
    expect(queries.some(query => query.includes('bound_device_mac = NULL'))).toBe(true);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 99,
      action: 'device_binding_reset',
      entityType: 'user',
      entityId: 8,
    }));
  });

  it('resets failed-login lock state when an admin changes a user password', async () => {
    queryQueue = [{ recordset: [{ role_id: 4 }] }];

    const res = await PUT(makeRequest({
      user_id: 8,
      full_name: 'Gate User',
      role_code: 'gate_clerk',
      email: 'gate@example.com',
      phone: '',
      status: 'active',
      password: 'Valid@123',
    }));

    expect(res.status).toBe(200);
    const updateQuery = queries.find(query => query.includes('UPDATE Users SET') && query.includes('password_hash'));
    expect(updateQuery).toContain('password_hash = @passwordHash');
    expect(updateQuery).toContain('failed_login_count = 0');
    expect(updateQuery).toContain('locked_at = NULL');
  });
});
