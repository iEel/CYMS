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
    if (statement.includes('SELECT TOP 1') && statement.includes('FROM PaymentReconciliationRows')) {
      return Promise.resolve({ recordset: [{ reconciliation_id: 10, yard_id: 1, amount: 1070, status: 'pending', statement_ref: 'BANK-1' }] });
    }
    if (statement.includes('SELECT TOP 1') && statement.includes('FROM Invoices')) {
      return Promise.resolve({ recordset: [{ invoice_id: 77, invoice_number: 'INV-1', yard_id: 1, customer_id: 10, status: 'issued', balance_amount: 1070, grand_total: 1070 }] });
    }
    if (statement.includes('INSERT INTO BillingPayments')) {
      return Promise.resolve({ recordset: [{ payment_id: 20, payment_number: 'PAY-1', receipt_number: 'RCPT-1' }] });
    }
    if (statement.includes('INSERT INTO BillingPaymentAllocations')) {
      return Promise.resolve({ recordset: [{ allocation_id: 21 }] });
    }
    if (statement.includes('INSERT INTO PaymentReconciliationRows')) {
      return Promise.resolve({ recordset: [{ reconciliation_id: 10, status: 'pending' }] });
    }
    if (statement.includes('UPDATE PaymentReconciliationRows')) {
      return Promise.resolve({ recordset: [{ reconciliation_id: 10, status: 'matched', invoice_id: 77 }] });
    }
    if (statement.includes('UPDATE Invoices')) {
      return Promise.resolve({ recordset: [{ invoice_id: 77, status: 'paid' }] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return chain;
  });
  const chain = { input, query };
  const request = jest.fn(() => chain);
  return { request, input, query, queries, inputs };
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/billing/payment-reconciliation?yard_id=1', {
    method,
    headers: { 'x-user-id': '9', 'x-user-role': 'yard_manager', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('payment reconciliation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../billing/payment-reconciliation/route') as typeof import('../billing/payment-reconciliation/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'yard_manager' });
    mockedRequireYardAccess.mockResolvedValue({ ok: true });
  });

  it('imports bank statement rows as pending reconciliation records', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(makeRequest('POST', {
      yard_id: 1,
      rows: [{ statement_ref: 'BANK-1', paid_at: '2026-05-22', payer_name: 'ACME', amount: 1070, invoice_number: 'INV-1' }],
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(1);
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'billing.payment.receive', expect.any(String));
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 1);
    expect(db.queries.join('\n')).toContain('INSERT INTO PaymentReconciliationRows');
    expect(db.queries.join('\n')).not.toContain('UPDATE Invoices');
  });

  it('matches a reconciliation row to an invoice and marks the invoice paid', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.PATCH(makeRequest('PATCH', {
      reconciliation_id: 10,
      action: 'match',
      invoice_id: 77,
      note: 'matched from bank',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.row).toEqual(expect.objectContaining({ status: 'matched', invoice_id: 77 }));
    expect(db.queries.join('\n')).toContain('UPDATE Invoices');
    expect(db.inputs).toContainEqual(['invoiceStatus', expect.anything(), 'paid']);
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'payment_reconciliation_match',
      entityType: 'payment_reconciliation',
      entityId: 10,
    }));
  });
});
