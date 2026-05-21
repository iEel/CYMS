import { NextRequest } from 'next/server';
import { POST } from '../billing/dunning-actions/route';
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
  const query = jest.fn()
    .mockResolvedValueOnce({ recordset: [{ allowed: 1 }] })
    .mockResolvedValueOnce({ recordset: [{ granted: 1 }] });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/billing/dunning-actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '7',
      'x-user-role': 'billing_officer',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/billing/dunning-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDb.mockResolvedValue(makeDb());
  });

  it('rejects unauthenticated dunning logs before opening the database', async () => {
    const res = await POST(request({ customer_id: 2 }, { 'x-user-id': '', 'x-user-role': '' }));

    expect(res.status).toBe(401);
    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('validates required contact fields', async () => {
    const res = await POST(request({ customer_id: 2, yard_id: 1, contact_method: 'fax', outcome: 'sent' }));

    expect(res.status).toBe(400);
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('records promise-to-pay notes with the authenticated actor', async () => {
    const res = await POST(request({
      yard_id: 1,
      customer_id: 2,
      customer_name: 'Beta Line',
      stage: 'final_notice',
      contact_method: 'phone',
      outcome: 'promise_to_pay',
      note: 'AP promised transfer',
      promise_to_pay_date: '2026-05-25',
      promise_to_pay_amount: 50000,
    }));

    expect(res.status).toBe(200);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      yardId: 1,
      action: 'ar_dunning_contact',
      entityType: 'customer',
      entityId: 2,
      details: expect.objectContaining({
        outcome: 'promise_to_pay',
        promise_to_pay_amount: 50000,
      }),
    }));
  });
});
