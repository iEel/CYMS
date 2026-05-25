import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;

interface MockDbRequest {
  inputs: Record<string, unknown>;
  input: jest.Mock<MockDbRequest, [string, unknown, unknown]>;
  query: jest.Mock<Promise<{ recordset: unknown[] }>, [string]>;
}

function request(body: Record<string, unknown>, role = 'yard_manager') {
  return new NextRequest('http://localhost/api/portal/grants/field-scope', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-user-id': '7',
      'x-user-role': role,
    },
    body: JSON.stringify(body),
  });
}

function mockDb(recordset: unknown[]) {
  const requests: MockDbRequest[] = [];
  const db = {
    request: jest.fn(() => {
      const req: MockDbRequest = {
        inputs: {},
        input: jest.fn((name: string, _type: unknown, value: unknown): MockDbRequest => {
          req.inputs[name] = value;
          return req;
        }),
        query: jest.fn(async (statement: string): Promise<{ recordset: unknown[] }> => {
          if (statement.includes('SELECT TOP 1')) return { recordset };
          return { recordset: [] };
        }),
      };
      requests.push(req);
      return req;
    }),
  };
  mockedGetDb.mockResolvedValue(db);
  return { db, requests };
}

describe('/api/portal/grants/field-scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('statically wires the field-scope route to yard-manager auth and audit labels', () => {
    const routePath = path.join(process.cwd(), 'src/app/api/portal/grants/field-scope/route.ts');

    expect(fs.existsSync(routePath)).toBe(true);

    const source = fs.readFileSync(routePath, 'utf8');
    expect(source).toContain('export async function PATCH');
    expect(source).toContain('requireRole');
    expect(source).toContain("['yard_manager']");
    expect(source).toContain('container_grade');
    expect(source).toContain('portal_grant_field_scope_update');
    expect(source).toContain('แสดงเกรดตู้ใน EIR ให้ลูกค้า');
    expect(source).not.toMatch(/\b(CREATE|ALTER|DROP)\s+TABLE\b/i);
  });

  it('rejects non-yard-manager callers before opening the database', async () => {
    const { PATCH } = await import('../portal/grants/field-scope/route');

    const res = await PATCH(request({
      access_id: 42,
      field: 'container_grade',
      enabled: true,
    }, 'gate_clerk'));

    expect(res.status).toBe(403);
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('updates the container grade field scope and audits the exact change', async () => {
    const { requests } = mockDb([{
      access_id: 42,
      customer_id: 11,
      entity_type: 'booking',
      entity_id: 99,
      entity_ref: 'BK-001',
      permission_scope: JSON.stringify({
        eir: { fields: { seal_number: true, container_grade: false } },
        documents: { invoice: true },
      }),
    }]);
    const { PATCH } = await import('../portal/grants/field-scope/route');

    const res = await PATCH(request({
      access_id: 42,
      field: 'container_grade',
      enabled: true,
      reason: 'Approved for this consignee',
    }));
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.success).toBe(true);

    const updateRequest = requests[1];
    expect(updateRequest.inputs.accessId).toBe(42);
    expect(JSON.parse(updateRequest.inputs.permissionScope as string)).toEqual({
      eir: { fields: { seal_number: true, container_grade: true } },
      documents: { invoice: true },
    });
    expect(updateRequest.query.mock.calls[0][0]).toContain('UPDATE PortalEntityAccess');
    expect(updateRequest.query.mock.calls[0][0]).toContain('updated_at = GETDATE()');

    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'portal_grant_field_scope_update',
      entityType: 'portal_entity_access',
      entityId: 42,
      details: expect.objectContaining({
        label: 'แสดงเกรดตู้ใน EIR ให้ลูกค้า',
        field: 'container_grade',
        field_path: 'permission_scope.eir.fields.container_grade',
        old_value: false,
        new_value: true,
        customer_id: 11,
        entity_type: 'booking',
        entity_id: 99,
        entity_ref: 'BK-001',
        reason: 'Approved for this consignee',
      }),
    }));
  });

  it('returns not found when the portal grant does not exist', async () => {
    mockDb([]);
    const { PATCH } = await import('../portal/grants/field-scope/route');

    const res = await PATCH(request({
      access_id: 404,
      field: 'container_grade',
      enabled: false,
    }));

    expect(res.status).toBe(404);
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });
});
