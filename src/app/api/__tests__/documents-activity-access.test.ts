import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import * as route from '../documents/activity/route';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

const mockedGetDb = getDb as jest.Mock;

type QueryResult = { recordset: unknown[] };
type MockDbRequest = {
  input: (name: string, _type: unknown, value: unknown) => MockDbRequest;
  query: (statement: string) => Promise<QueryResult>;
};

function makeRequest(url: string, role = 'operations_viewer') {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': '17',
      'x-user-role': role,
    },
  });
}

function makeDb(options: { allowYardAccess?: boolean } = {}) {
  const statements: string[] = [];
  const inputsByQuery: Array<Record<string, unknown>> = [];
  const allowYardAccess = options.allowYardAccess ?? true;

  const db = {
    statements,
    inputsByQuery,
    request: jest.fn(() => {
      const inputs: Record<string, unknown> = {};
      const request: MockDbRequest = {
        input: jest.fn((name: string, _type: unknown, value: unknown): MockDbRequest => {
          inputs[name] = value;
          return request;
        }),
        query: jest.fn(async (statement: string): Promise<QueryResult> => {
          statements.push(statement);
          inputsByQuery.push({ ...inputs });

          if (statement.includes('FROM Roles r')) {
            return { recordset: [{ granted: 1 }] };
          }
          if (statement.includes('FROM UserYardAccess')) {
            return { recordset: allowYardAccess ? [{ allowed: 1 }] : [] };
          }
          if (statement.includes('FROM Invoices')) {
            return {
              recordset: [{
                entity_id: 10,
                entity_ref: 'INV-001',
                yard_id: 5,
                customer_id: 20,
              }],
            };
          }
          if (statement.includes('FROM GateTransactions')) {
            return {
              recordset: [{
                entity_id: 30,
                entity_ref: 'EIR-001',
                yard_id: 5,
                customer_id: 20,
              }],
            };
          }
          if (statement.includes('FROM DocumentLifecycle') && !statement.includes('FROM DocumentLifecycle dl')) {
            return {
              recordset: [{
                invoice_id: 10,
                invoice_number: 'INV-001',
              }],
            };
          }
          if (statement.includes('FROM DocumentLifecycle dl')) {
            return {
              recordset: [{
                lifecycle_id: 1,
                document_type: inputs.documentType,
                document_id: inputs.documentId || 10,
                document_number: inputs.documentNumber || 'INV-001',
                event_type: 'created',
                metadata: null,
                created_at: '2026-05-28T00:00:00.000Z',
                user_name: 'Ops User',
                yard_name: 'A Yard',
                yard_id: 5,
              }],
            };
          }
          return { recordset: [] };
        }),
      };
      return request;
    }),
  };

  return db;
}

describe('/api/documents/activity resolver-first access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('denies invoice activity before querying DocumentLifecycle rows when yard access is denied', async () => {
    const db = makeDb({ allowYardAccess: false });
    mockedGetDb.mockResolvedValue(db);

    const response = await route.GET(makeRequest('http://localhost/api/documents/activity?document_number=INV-001'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain('ลานนี้');
    expect(db.statements.some(statement => statement.includes('FROM Invoices'))).toBe(true);
    expect(db.statements.some(statement => statement.includes('FROM DocumentLifecycle dl'))).toBe(false);
  });

  it('returns invoice lifecycle rows after resolver and yard access pass', async () => {
    const db = makeDb({ allowYardAccess: true });
    mockedGetDb.mockResolvedValue(db);

    const response = await route.GET(makeRequest('http://localhost/api/documents/activity?document_number=INV-001'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.document_type).toBe('invoice');
    expect(body.events).toHaveLength(1);
    expect(db.statements.find(statement => statement.includes('FROM Invoices'))).toBeTruthy();
    expect(db.statements.find(statement => statement.includes('FROM DocumentLifecycle dl'))).toBeTruthy();
  });

  it('resolves EIR activity through gate transactions before lifecycle query', async () => {
    const db = makeDb({ allowYardAccess: true });
    mockedGetDb.mockResolvedValue(db);

    const response = await route.GET(makeRequest('http://localhost/api/documents/activity?document_number=EIR-001'));

    expect(response.status).toBe(200);
    expect(db.statements.find(statement => statement.includes('FROM GateTransactions'))).toBeTruthy();
    expect(db.statements.find(statement => statement.includes('FROM DocumentLifecycle dl'))).toBeTruthy();
  });

  it.each([
    ['receipt', 'RCP-001'],
    ['credit_note', 'CN-001'],
  ])('resolves %s activity through the related invoice before lifecycle query', async (documentType, documentNumber) => {
    const db = makeDb({ allowYardAccess: true });
    mockedGetDb.mockResolvedValue(db);

    const response = await route.GET(makeRequest(`http://localhost/api/documents/activity?document_type=${documentType}&document_number=${documentNumber}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.document_type).toBe(documentType);
    expect(db.statements.find(statement => statement.includes('FROM DocumentLifecycle') && !statement.includes('FROM DocumentLifecycle dl'))).toBeTruthy();
    expect(db.statements.find(statement => statement.includes('FROM Invoices'))).toBeTruthy();
    expect(db.statements.find(statement => statement.includes('FROM DocumentLifecycle dl'))).toBeTruthy();
  });

  it('rejects unsupported document types before querying activity rows', async () => {
    const db = makeDb({ allowYardAccess: true });
    mockedGetDb.mockResolvedValue(db);

    const response = await route.GET(makeRequest('http://localhost/api/documents/activity?document_type=unknown&document_number=DOC-001'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('document_type');
    expect(db.statements.some(statement => statement.includes('FROM DocumentLifecycle dl'))).toBe(false);
  });
});
