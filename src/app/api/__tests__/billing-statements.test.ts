import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { nextDocumentNumber } from '@/lib/documentNumber';
import { requireAnyPermission, requirePermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/documentNumber', () => ({
  nextDocumentNumber: jest.fn(async () => 'STMT-202605-000001'),
}));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;
const mockedNextDocumentNumber = nextDocumentNumber as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const inputs: Array<[string, unknown, unknown]> = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Invoices i') && statement.includes('NOT EXISTS')) {
      return Promise.resolve({
        recordset: [
          { invoice_id: 1, invoice_number: 'INV-1', grand_total: 1070, balance_amount: 1070, customer_id: 10, yard_id: 1 },
          { invoice_id: 2, invoice_number: 'INV-2', grand_total: 535, balance_amount: 535, customer_id: 10, yard_id: 1 },
        ],
      });
    }
    if (statement.includes('INSERT INTO BillingStatements')) {
      return Promise.resolve({
        recordset: [{
          statement_id: 22,
          statement_number: 'STMT-202605-000001',
          customer_id: 10,
          yard_id: 1,
          status: 'issued',
          grand_total: 1605,
        }],
      });
    }
    if (statement.includes('INSERT INTO BillingStatementLines')) {
      return Promise.resolve({ recordset: [{ line_id: 1 }] });
    }
    if (statement.includes('SELECT TOP 1 bs.*') && statement.includes('FROM BillingStatements bs')) {
      return Promise.resolve({
        recordset: [{
          statement_id: 22,
          statement_number: 'STMT-202605-000001',
          customer_name: 'ACME',
          grand_total: 1605,
        }],
      });
    }
    if (statement.includes('FROM BillingStatementLines bsl')) {
      return Promise.resolve({
        recordset: [
          { invoice_id: 1, invoice_number: 'INV-1', line_total: 1070 },
          { invoice_id: 2, invoice_number: 'INV-2', line_total: 535 },
        ],
      });
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

function makeRequest(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-user-id': '9', 'x-user-role': 'billing_officer' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('billing statements', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../billing/statements/route') as typeof import('../billing/statements/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAnyPermission.mockResolvedValue({ userId: 9, role: 'billing_officer' });
    mockedRequirePermission.mockResolvedValue({ userId: 9, role: 'billing_officer' });
    mockedRequireYardAccess.mockResolvedValue({ userId: 9, role: 'billing_officer' });
    mockedNextDocumentNumber.mockResolvedValue('STMT-202605-000001');
  });

  it('issues one billing statement from open invoices and locks the invoices as statement lines', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(makeRequest('POST', 'http://localhost/api/billing/statements', {
      yard_id: 1,
      customer_id: 10,
      period_from: '2026-05-01',
      period_to: '2026-05-31',
      due_date: '2026-06-15',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.statement.statement_number).toBe('STMT-202605-000001');
    expect(body.lines).toHaveLength(2);
    expect(db.queries.join('\n')).toContain('INSERT INTO BillingStatements');
    expect(db.queries.join('\n')).toContain('INSERT INTO BillingStatementLines');
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'billing.invoice.create', expect.any(String));
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'billing_statement_issue',
      entityType: 'billing_statement',
      entityId: 22,
    }));
  });

  it('returns statement detail with invoice lines', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest('GET', 'http://localhost/api/billing/statements?yard_id=1&statement_id=22'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.statement.statement_number).toBe('STMT-202605-000001');
    expect(body.lines.map((line: { invoice_number: string }) => line.invoice_number)).toEqual(['INV-1', 'INV-2']);
  });
});
