import { NextRequest } from 'next/server';
import { createTotpCode } from '@/lib/totp';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/apiAuth', () => ({
  requireRequestActor: jest.fn(() => ({ userId: 7, role: 'yard_manager', username: 'admin' })),
}));

import { getDb } from '@/lib/db';
import { GET, POST } from '../auth/2fa/route';

const mockedGetDb = getDb as jest.Mock;

let queryQueue: Array<{ recordset: unknown[] } | Error> = [];
let inputs: jest.Mock[] = [];

function makeDbRequest() {
  const request = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation(() => {
      const next = queryQueue.shift();
      if (!next) return Promise.resolve({ recordset: [] });
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    }),
  };
  inputs.push(request.input);
  return request;
}

function q(recordset: unknown[]) {
  return { recordset };
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/auth/2fa', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '7',
      'x-user-role': 'yard_manager',
      'x-user-name': 'admin',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/auth/2fa', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  beforeEach(() => {
    queryQueue = [];
    inputs = [];
    mockedGetDb.mockResolvedValue({ request: makeDbRequest });
  });

  it('returns 2FA status for the authenticated user', async () => {
    queryQueue = [q([{ two_fa_enabled: true, two_fa_secret: secret }])];

    const res = await GET(makeRequest('GET'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: true, has_secret: true });
    expect(inputs[0]).toHaveBeenCalledWith('userId', expect.anything(), 7);
  });

  it('generates a setup secret and otpauth uri without enabling 2FA yet', async () => {
    queryQueue = [q([])];

    const res = await POST(makeRequest('POST', { action: 'setup' }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.otpauth_uri).toContain('otpauth://totp/CYMS%3Aadmin');
    expect(inputs[0]).toHaveBeenCalledWith('enabled', expect.anything(), false);
  });

  it('enables 2FA after a valid TOTP code', async () => {
    const code = createTotpCode(secret);
    queryQueue = [q([{ two_fa_secret: secret }]), q([])];

    const res = await POST(makeRequest('POST', { action: 'verify', code }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, enabled: true });
  });

  it('rejects invalid TOTP codes', async () => {
    queryQueue = [q([{ two_fa_secret: secret }])];

    const res = await POST(makeRequest('POST', { action: 'verify', code: '000000' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'รหัสยืนยัน 2FA ไม่ถูกต้อง' });
  });
});
