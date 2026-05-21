import { NextRequest } from 'next/server';

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
  getDeviceBindingPolicy: jest.fn(),
  isDeviceBindingRequired: jest.fn((policy, role) => policy.enabled && policy.enforce_roles.includes(role)),
  normalizeDeviceId: jest.fn((value) => {
    const normalized = String(value || '').trim();
    return normalized.length >= 16 ? normalized : null;
  }),
}));
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: jest.fn() },
}));

import bcrypt from 'bcryptjs';
import { createToken } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getDeviceBindingPolicy } from '@/lib/deviceBinding';
import { POST } from '../auth/login/route';

const mockedGetDb = getDb as jest.Mock;
const mockedCreateToken = createToken as jest.Mock;
const mockedCompare = bcrypt.compare as jest.Mock;
const mockedGetDeviceBindingPolicy = getDeviceBindingPolicy as jest.Mock;

let queryQueue: Array<{ recordset: unknown[] } | Error> = [];
let queries: string[] = [];

function makeDbRequest() {
  return {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation((query: string) => {
      queries.push(query);
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

describe('POST /api/auth/login — device binding', () => {
  const enforcedPolicy = {
    enabled: true,
    auto_bind: true,
    enforce_roles: ['rs_driver'],
  };
  const user = {
    user_id: 8,
    username: 'forklift01',
    password_hash: '$hash',
    full_name: 'Forklift Driver',
    status: 'active',
    failed_login_count: 0,
    locked_at: null,
    role_code: 'rs_driver',
    two_fa_enabled: false,
    two_fa_secret: null,
    bound_device_mac: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryQueue = [];
    queries = [];
    mockedGetDb.mockResolvedValue({ request: makeDbRequest });
    mockedCompare.mockResolvedValue(true);
    mockedCreateToken.mockResolvedValue('signed-jwt');
    mockedGetDeviceBindingPolicy.mockResolvedValue(enforcedPolicy);
  });

  it('auto-binds the first trusted device for enforced roles before creating a session', async () => {
    queryQueue = [
      q([user]),
      q([]),
      q([]),
      q([{ yard_id: 1 }]),
      q([]),
    ];

    const res = await POST(makeRequest({
      username: 'forklift01',
      password: 'valid-pass',
      device_id: '550e8400-e29b-41d4-a716-446655440000',
    }));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(queries.some(query => query.includes('bound_device_mac = @deviceId'))).toBe(true);
    expect(mockedCreateToken).toHaveBeenCalled();
  });

  it('rejects login from a different device when a binding already exists', async () => {
    queryQueue = [q([{ ...user, bound_device_mac: 'trusted-device-0001' }])];

    const res = await POST(makeRequest({
      username: 'forklift01',
      password: 'valid-pass',
      device_id: 'trusted-device-9999',
    }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'อุปกรณ์นี้ไม่ได้รับอนุญาตสำหรับบัญชีนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อล้างการผูกอุปกรณ์',
      device_mismatch: true,
    });
    expect(mockedCreateToken).not.toHaveBeenCalled();
  });
});
