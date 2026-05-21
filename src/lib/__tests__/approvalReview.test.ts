import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));
jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

import { requireApprovalForAction } from '../approvalReview';

function makeRequest(role = 'gate_clerk') {
  return new NextRequest('http://localhost/api/test', {
    headers: {
      'x-user-id': '42',
      'x-user-role': role,
    },
  });
}

function makeDb(recordsets: unknown[][]) {
  const query = jest.fn().mockImplementation(() => Promise.resolve({
    recordset: recordsets.shift() || [],
  }));
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

describe('requireApprovalForAction', () => {
  it('allows the action when the actor has the approval permission', async () => {
    const db = makeDb([[{ granted: 1 }]]);

    const result = await requireApprovalForAction({
      request: makeRequest('supervisor'),
      db,
      yardId: 1,
      permissionCode: 'yard.hold.release',
      approvalPermissionCode: 'yard.hold.release',
      action: 'gate_out_with_billing_hold',
      entityType: 'container',
      entityId: 123,
    });

    expect(result).toEqual({ status: 'approved', actor: { userId: 42, role: 'supervisor' }, approvedBy: 42 });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('creates a pending approval response before mutation when actor lacks approval permission', async () => {
    const db = makeDb([[], [{ review_id: 77 }]]);

    const result = await requireApprovalForAction({
      request: makeRequest('gate_clerk'),
      db,
      yardId: 1,
      permissionCode: 'yard.hold.release',
      approvalPermissionCode: 'yard.hold.release',
      action: 'gate_out_with_billing_hold',
      entityType: 'container',
      entityId: 123,
      reason: 'Billing hold',
      details: { container_number: 'MSCU1234567' },
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(202);
    await expect((result as NextResponse).json()).resolves.toMatchObject({
      pending_approval: true,
      review_id: 77,
    });
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO ApprovalReviews');
  });
});
