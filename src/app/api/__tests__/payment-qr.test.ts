import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

import { getDb } from '@/lib/db';
import { GET } from '../billing/payment-qr/route';

const mockedGetDb = getDb as jest.Mock;

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

function makeRequest(invoiceId = '12') {
  return new NextRequest(`http://localhost/api/billing/payment-qr?invoice_id=${invoiceId}`);
}

describe('GET /api/billing/payment-qr', () => {
  beforeEach(() => {
    queryQueue = [];
    mockedGetDb.mockResolvedValue({ request: makeDbRequest });
  });

  it('returns a PromptPay payload for an unpaid invoice when configured', async () => {
    queryQueue = [
      q([{ setting_value: JSON.stringify({ enabled: true, promptpay_id: '0812345678', merchant_name: 'CYMS' }) }]),
      q([{ invoice_id: 12, invoice_number: 'INV-2026-000001', status: 'issued', grand_total: 123.45, customer_name: 'ACME' }]),
    ];

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.invoice_number).toBe('INV-2026-000001');
    expect(body.amount).toBe(123.45);
    expect(body.qr_payload).toContain('5406123.45');
  });

  it('rejects QR generation when PromptPay is not configured', async () => {
    queryQueue = [q([])];

    const res = await GET(makeRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'ยังไม่ได้ตั้งค่า PromptPay สำหรับรับชำระเงิน' });
  });
});
