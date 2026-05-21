import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

import {
  getRequestActor,
  requireYardAccess,
  requirePermission,
  requireRequestActor,
  requireRole,
} from '../apiAuth';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/test', { headers });
}

function makeDb(recordset: unknown[]) {
  const query = jest.fn().mockResolvedValue({ recordset });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

describe('API request actor helpers', () => {
  it('parses the authenticated actor from proxy headers', () => {
    const actor = getRequestActor(makeRequest({
      'x-user-id': '12',
      'x-user-role': 'yard_manager',
      'x-user-name': 'admin',
      'x-customer-id': '44',
    }));

    expect(actor).toEqual({
      userId: 12,
      role: 'yard_manager',
      username: 'admin',
      customerId: 44,
    });
  });

  it('rejects requests without a valid proxy actor', async () => {
    const result = requireRequestActor(makeRequest({ 'x-user-role': 'yard_manager' }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    await expect((result as NextResponse).json()).resolves.toMatchObject({
      error: expect.stringContaining('ไม่ได้รับอนุญาต'),
    });
  });

  it('rejects roles outside the allowed set', async () => {
    const result = requireRole(
      makeRequest({ 'x-user-id': '21', 'x-user-role': 'gate_clerk' }),
      ['yard_manager']
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('allows yard_manager permission checks without querying RolePermissions', async () => {
    const db = makeDb([]);
    const result = await requirePermission(
      makeRequest({ 'x-user-id': '7', 'x-user-role': 'yard_manager' }),
      db,
      'permissions.manage'
    );

    expect(result).toEqual({ userId: 7, role: 'yard_manager' });
    expect(db.request).not.toHaveBeenCalled();
  });

  it('checks granular permissions for non-yard-manager roles', async () => {
    const db = makeDb([{ granted: 1 }]);
    const result = await requirePermission(
      makeRequest({ 'x-user-id': '8', 'x-user-role': 'supervisor' }),
      db,
      'reports.view'
    );

    expect(result).toEqual({ userId: 8, role: 'supervisor' });
    expect(db.input).toHaveBeenCalledWith('roleCode', expect.anything(), 'supervisor');
    expect(db.input).toHaveBeenCalledWith('permissionCode', expect.anything(), 'reports.view');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('RolePermissions'));
  });

  it('denies non-yard-manager roles without the required permission', async () => {
    const db = makeDb([]);
    const result = await requirePermission(
      makeRequest({ 'x-user-id': '9', 'x-user-role': 'gate_clerk' }),
      db,
      'permissions.manage'
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it('rejects yard-scoped requests without a valid yard id', async () => {
    const db = makeDb([]);
    const result = await requireYardAccess(
      makeRequest({ 'x-user-id': '10', 'x-user-role': 'gate_clerk' }),
      db,
      null
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(db.request).not.toHaveBeenCalled();
  });

  it('allows yard_manager yard access checks without querying UserYardAccess', async () => {
    const db = makeDb([]);
    const result = await requireYardAccess(
      makeRequest({ 'x-user-id': '11', 'x-user-role': 'yard_manager' }),
      db,
      2
    );

    expect(result).toEqual({ userId: 11, role: 'yard_manager' });
    expect(db.request).not.toHaveBeenCalled();
  });

  it('allows non-yard-manager users assigned to the yard', async () => {
    const db = makeDb([{ allowed: 1 }]);
    const result = await requireYardAccess(
      makeRequest({ 'x-user-id': '12', 'x-user-role': 'gate_clerk' }),
      db,
      3
    );

    expect(result).toEqual({ userId: 12, role: 'gate_clerk' });
    expect(db.input).toHaveBeenCalledWith('userId', expect.anything(), 12);
    expect(db.input).toHaveBeenCalledWith('yardId', expect.anything(), 3);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UserYardAccess'));
  });

  it('denies non-yard-manager users outside the requested yard', async () => {
    const db = makeDb([]);
    const result = await requireYardAccess(
      makeRequest({ 'x-user-id': '13', 'x-user-role': 'gate_clerk' }),
      db,
      99
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
