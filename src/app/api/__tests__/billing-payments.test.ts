import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/documentNumber', () => ({
  nextDocumentNumber: jest.fn(async ({ prefix }: { prefix: string }) => `${prefix}-202605-000001`),
}));
jest.mock('@/lib/apiAuth', () => ({
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const inputs: Array<[string, unknown, unknown]> = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('SELECT TOP 1') && statement.includes('FROM Invoices')) {
      return Promise.resolve({
        recordset: [{ invoice_id: 77, yard_id: 1, customer_id: 10, invoice_number: 'INV-77', balance_amount: 1070, grand_total: 1070, status: 'issued' }],
      });
    }
    if (statement.includes('INSERT INTO BillingPayments')) {
      return Promise.resolve({
        recordset: [{ payment_id: 40, payment_number: 'PAY-202605-000001', receipt_number: 'RCPT-202605-000001', amount: 500 }],
      });
    }
    if (statement.includes('INSERT INTO BillingPaymentAllocations')) {
      return Promise.resolve({ recordset: [{ allocation_id: 41 }] });
    }
    if (statement.includes('UPDATE Invoices')) {
      return Promise.resolve({ recordset: [{ invoice_id: 77, status: 'issued', balance_amount: 570 }] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return chain;
  });
  const chain = { input, query };
  return { request: jest.fn(() => chain), input, query, queries, inputs };
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/billing/payments?yard_id=1', {
    method,
    headers: { 'content-type': 'application/json', 'x-user-id': '9', 'x-user-role': 'billing_officer' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('billing payments allocation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../billing/payments/route') as typeof import('../billing/payments/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'billing_officer' });
    mockedRequireYardAccess.mockResolvedValue({ userId: 9, role: 'billing_officer' });
  });

  it('records a partial payment allocation without marking the invoice paid', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(makeRequest('POST', {
      yard_id: 1,
      customer_id: 10,
      amount: 500,
      payment_method: 'transfer',
      payment_ref: 'BANK-500',
      allocations: [{ invoice_id: 77, amount: 500 }],
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.payment.payment_number).toBe('PAY-202605-000001');
    expect(body.allocations).toHaveLength(1);
    expect(db.queries.join('\n')).toContain('INSERT INTO BillingPayments');
    expect(db.queries.join('\n')).toContain('INSERT INTO BillingPaymentAllocations');
    expect(db.inputs).toContainEqual(['newBalance0', expect.anything(), 570]);
    expect(db.inputs).toContainEqual(['nextStatus0', expect.anything(), 'issued']);
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'billing.payment.receive', expect.any(String));
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'billing_payment_allocate',
      entityType: 'billing_payment',
      entityId: 40,
    }));
  });
});
