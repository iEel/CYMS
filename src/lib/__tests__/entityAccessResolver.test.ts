import { NextRequest, NextResponse } from 'next/server';
import { requireYardAccess } from '@/lib/apiAuth';
import {
  isEntityAccessResponse,
  normalizeEntityType,
  parseEntityId,
  requireResolvedEntityYardAccess,
  resolveEntityScope,
} from '../entityAccessResolver';

jest.mock('@/lib/apiAuth', () => ({
  requireYardAccess: jest.fn(),
}));

const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function makeRequest() {
  return new NextRequest('http://localhost/api/test', {
    headers: { 'x-user-id': '9', 'x-user-role': 'gate_clerk' },
  });
}

function makeDb(scopeRows: unknown[] = [{ entity_id: 44, entity_ref: 'CONT44', yard_id: 7 }]) {
  const statements: string[] = [];
  const inputs: Record<string, unknown> = {};
  type MockDbRequest = {
    input: jest.Mock;
    query: jest.Mock;
  };
  const request: MockDbRequest = {
    input: jest.fn((name: string, _type: unknown, value: unknown): MockDbRequest => {
      inputs[name] = value;
      return request;
    }),
    query: jest.fn(async (statement: string) => {
      statements.push(statement);
      return { recordset: scopeRows };
    }),
  };

  return {
    request: jest.fn(() => request),
    requestStub: request,
    statements,
    inputs,
  };
}

describe('entity access resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireYardAccess.mockResolvedValue({ userId: 9, role: 'gate_clerk' });
  });

  it('normalizes supported entity type aliases', () => {
    expect(normalizeEntityType(' Billing_Statement ')).toBe('billing_statement');
    expect(normalizeEntityType('EOR')).toBe('eor');
    expect(normalizeEntityType('eir')).toBe('eir');
    expect(normalizeEntityType('unknown')).toBeNull();
  });

  it('parses positive integer entity ids and rejects invalid ids', async () => {
    expect(parseEntityId('42')).toBe(42);
    expect(parseEntityId(42)).toBe(42);

    const invalid = parseEntityId('abc');
    expect(invalid).toBeInstanceOf(NextResponse);
    await expect((invalid as NextResponse).json()).resolves.toMatchObject({
      error: expect.stringContaining('entity_id'),
    });
  });

  it('resolves container scope by id or reference from the allowlisted table map', async () => {
    const db = makeDb([{ entity_id: 44, entity_ref: 'CONT44', yard_id: 7, customer_id: 12 }]);

    const scope = await resolveEntityScope({
      db,
      entityType: 'container',
      entityId: 44,
      entityRef: 'CONT44',
    });

    expect(scope).toEqual({
      entityType: 'container',
      entityId: 44,
      entityRef: 'CONT44',
      yardId: 7,
      customerId: 12,
    });
    expect(db.statements[0]).toContain('FROM Containers');
    expect(db.statements[0]).toContain('container_id AS entity_id');
    expect(db.statements[0]).toContain('container_number AS entity_ref');
    expect(db.inputs).toMatchObject({ entityId: 44, entityRef: 'CONT44' });
  });

  it('fails closed for unsupported or unresolved entities', async () => {
    const unsupported = await resolveEntityScope({
      db: makeDb(),
      entityType: 'unknown',
      entityId: 1,
      entityRef: null,
    });
    expect(isEntityAccessResponse(unsupported)).toBe(true);
    expect((unsupported as NextResponse).status).toBe(400);

    const missing = await resolveEntityScope({
      db: makeDb([]),
      entityType: 'container',
      entityId: 1,
      entityRef: null,
    });
    expect(isEntityAccessResponse(missing)).toBe(true);
    expect((missing as NextResponse).status).toBe(404);
  });

  it('requires yard access when resolved scope has a yard id', async () => {
    const db = makeDb();
    const actor = { userId: 9, role: 'gate_clerk' };
    const result = await requireResolvedEntityYardAccess({
      request: makeRequest(),
      db,
      actor,
      scope: { entityType: 'container', entityId: 44, entityRef: 'CONT44', yardId: 7, customerId: 12 },
      message: 'denied',
    });

    expect(result).toEqual({ userId: 9, role: 'gate_clerk' });
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.anything(), db, 7, 'denied');
  });

  it('denies non-manager actors when a resolved entity has no yard id', async () => {
    const result = await requireResolvedEntityYardAccess({
      request: makeRequest(),
      db: makeDb(),
      actor: { userId: 9, role: 'gate_clerk' },
      scope: { entityType: 'reefer_check', entityId: 1, entityRef: null, yardId: null, customerId: null },
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
