import { NextRequest } from 'next/server';
import { createTotpCode } from '@/lib/totp';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth', () => ({ createToken: jest.fn(async () => 'signed-jwt') }));
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn(() => '127.0.0.1'),
  rateLimitLogin: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/lib/passwordPolicy', () => ({
  getPasswordPolicy: jest.fn(async () => ({ max_login_attempts: 5, lockout_duration_min: 30 })),
}));
jest.mock('@/lib/deviceBinding', () => ({
  getDeviceBindingPolicy: jest.fn(async () => ({ enabled: false, auto_bind: true, enforce_roles: ['rs_driver'] })),
  isDeviceBindingRequired: jest.fn(() => false),
  normalizeDeviceId: jest.fn((value) => value || null),
}));
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: jest.fn() },
}));

import bcrypt from 'bcryptjs';
import { createToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { POST } from '../auth/login/route';

const mockedGetDb = getDb as jest.Mock;
const mockedCreateToken = createToken as jest.Mock;
const mockedCompare = bcrypt.compare as jest.Mock;

let queryQueue: Array<{ recordset: unknown[] } | Error> = [];

function makeDbRequest() {
  return {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation(() => {
      const next = queryQueue.shift();
      if (!next) return Promise.resolve({ recordset: [] });
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    }),
  };
}

function q(recordset: unknown[]) {
  return { recordset };
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login — two-factor auth', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const user = {
    user_id: 1,
    username: 'admin',
    password_hash: '$hash',
    full_name: 'Admin',
    status: 'active',
    failed_login_count: 0,
    locked_at: null,
    role_code: 'yard_manager',
    two_fa_enabled: true,
    two_fa_secret: secret,
  };

  beforeEach(() => {
    queryQueue = [];
    mockedGetDb.mockResolvedValue({ request: makeDbRequest });
    mockedCompare.mockResolvedValue(true);
    mockedCreateToken.mockResolvedValue('signed-jwt');
  });

  it('requires a TOTP code after a valid password when 2FA is enabled', async () => {
    queryQueue = [q([user])];

    const res = await POST(makeRequest({ username: 'admin', password: 'admin123' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: false,
      requires_2fa: true,
      error: 'กรุณากรอกรหัสยืนยัน 2FA',
    });
    expect(mockedCreateToken).not.toHaveBeenCalled();
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('creates the session after a valid TOTP code', async () => {
    const code = createTotpCode(secret);
    queryQueue = [
      q([user]),
      q([]),
      q([{ yard_id: 1 }, { yard_id: 2 }]),
      q([]),
    ];

    const res = await POST(makeRequest({ username: 'admin', password: 'admin123', totp_code: code }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.session.token).toBe('signed-jwt');
    expect(body.session.yardIds).toEqual([1, 2]);
    expect(res.headers.get('Set-Cookie')).toContain('cyms_token=signed-jwt');
    expect(mockedCreateToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      username: 'admin',
      role: 'yard_manager',
      yardIds: [1, 2],
    }));
  });

  it('includes customer portal role in the login session for transport users', async () => {
    const transportUser = {
      ...user,
      user_id: 7,
      username: 'driver1',
      role_code: 'customer',
      two_fa_enabled: false,
      two_fa_secret: null,
      customer_portal_role: 'driver_user',
    };
    queryQueue = [
      q([transportUser]),
      q([]),
      q([{ yard_id: 1 }]),
      q([{ customer_id: 44 }]),
      q([]),
    ];

    const res = await POST(makeRequest({ username: 'driver1', password: 'driverpass' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.customerId).toBe(44);
    expect(body.session.customerPortalRole).toBe('driver_user');
    expect(mockedCreateToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      role: 'customer',
      customerId: 44,
      customerPortalRole: 'driver_user',
    }));
  });
});
