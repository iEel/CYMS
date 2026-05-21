import { NextRequest } from 'next/server';
import { PUT } from '../settings/permissions/route';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;

function makeDb() {
  const query = jest.fn().mockResolvedValue({ recordset: [] });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

function makeRequest(body: unknown, headers: Record<string, string>) {
  return new NextRequest('http://localhost/api/settings/permissions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/settings/permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDb.mockResolvedValue(makeDb());
  });

  it('rejects non-yard-manager permission changes before opening a DB connection', async () => {
    const res = await PUT(makeRequest(
      { role_id: 2, permission_id: 3, granted: true },
      { 'x-user-id': '9', 'x-user-role': 'gate_clerk' }
    ));

    expect(res.status).toBe(403);
    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('records the authenticated actor from proxy headers when permissions change', async () => {
    const res = await PUT(makeRequest(
      { role_id: 2, permission_id: 3, granted: true, user_id: 999 },
      { 'x-user-id': '7', 'x-user-role': 'yard_manager' }
    ));

    expect(res.status).toBe(200);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'permission_update',
      entityType: 'permission',
    }));
  });
});
