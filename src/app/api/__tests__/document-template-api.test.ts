import { NextRequest } from 'next/server';
import { GET, POST } from '../document-templates/route';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import { buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplates';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/apiAuth', () => ({
  requirePermission: jest.fn().mockResolvedValue({ userId: 7, role: 'yard_manager' }),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;

type QueryPlan = Array<{ recordset?: unknown[] }>;

function makeDb(plan: QueryPlan = []) {
  const queries: string[] = [];
  const inputs: Array<{ name: string; value: unknown }> = [];
  const query = jest.fn(async (statement: string) => {
    queries.push(statement);
    return plan.shift() || { recordset: [] };
  });
  const input = jest.fn(function input(name: string, _type: unknown, value: unknown) {
    inputs.push({ name, value });
    return this;
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries, inputs };
}

function makeRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe('document template API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 7, role: 'yard_manager' });
  });

  it('requires settings permission and lists templates with current version info', async () => {
    const template = {
      template_id: 11,
      template_code: 'TAX_CONTINUOUS',
      template_name: 'Tax invoice continuous',
      document_type: 'tax_invoice',
      version_no: 2,
      version_status: 'published',
    };
    const db = makeDb([{ recordset: [template] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'settings.manage',
      expect.any(String),
    );
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.queries[0]).toContain('DocumentTemplates');
    expect(db.queries[0]).toContain('DocumentTemplateVersions');
    expect(body).toEqual({ templates: [template] });
  });

  it('creates a template with valid config, version 1 draft, and audit trail', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    const created = {
      template_id: 12,
      template_code: 'TAX_CONTINUOUS',
      template_name: 'Tax invoice continuous',
      document_type: 'tax_invoice',
      status: 'draft',
    };
    const version = {
      version_id: 21,
      template_id: 12,
      version_no: 1,
      status: 'draft',
    };
    const db = makeDb([{ recordset: [created] }, { recordset: [version] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_code: 'TAX_CONTINUOUS',
        template_name: 'Tax invoice continuous',
        document_type: 'tax_invoice',
        config,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(db.queries.join('\n')).toContain('INSERT INTO DocumentTemplates');
    expect(db.queries.join('\n')).toContain('INSERT INTO DocumentTemplateVersions');
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'templateCode', value: 'TAX_CONTINUOUS' },
      { name: 'versionNo', value: 1 },
      { name: 'status', value: 'draft' },
      { name: 'configJson', value: JSON.stringify(config) },
    ]));
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_create',
      entityType: 'document_template',
      entityId: 12,
    }));
    expect(body).toEqual({ success: true, template: created, version });
  });

  it('rejects invalid template config before insert or audit', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const response = await POST(makeRequest('/api/document-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_code: 'BROKEN',
        template_name: 'Broken',
        document_type: 'tax_invoice',
        config: { paper: { width_mm: 0 } },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('template config ไม่ถูกต้อง');
    expect(db.query).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });
});
