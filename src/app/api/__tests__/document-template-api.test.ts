import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '../document-templates/route';
import { POST as duplicateTemplate } from '../document-templates/[templateId]/duplicate/route';
import { PUT as updateTemplate } from '../document-templates/[templateId]/route';
import { POST as publishTemplate } from '../document-templates/[templateId]/publish/route';
import { POST as setDefaultTemplate } from '../document-templates/[templateId]/set-default/route';
import { POST as deactivateTemplate } from '../document-templates/[templateId]/deactivate/route';
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

function makeRouteContext(templateId: string) {
  return { params: Promise.resolve({ templateId }) };
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
    const db = makeDb([{ recordset: [{
      template_template_id: created.template_id,
      template_template_code: created.template_code,
      template_template_name: created.template_name,
      template_document_type: created.document_type,
      template_status: created.status,
      version_version_id: version.version_id,
      version_template_id: version.template_id,
      version_version_no: version.version_no,
      version_status: version.status,
    }] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_code: 'TAX_CONTINUOUS',
        template_name: 'Tax invoice continuous',
        document_type: 'tax_invoice',
        is_default: true,
        config,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(db.queries.join('\n')).toContain('INSERT INTO DocumentTemplates');
    expect(db.queries.join('\n')).toContain('INSERT INTO DocumentTemplateVersions');
    expect(db.queries[0]).toContain('BEGIN TRAN');
    expect(db.queries[0]).toContain('COMMIT TRAN');
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'templateCode', value: 'TAX_CONTINUOUS' },
      { name: 'isDefault', value: 0 },
      { name: 'versionNo', value: 1 },
      { name: 'status', value: 'draft' },
      { name: 'configJson', value: JSON.stringify(config) },
    ]));
    expect(db.inputs).not.toEqual(expect.arrayContaining([
      { name: 'isDefault', value: 1 },
    ]));
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_create',
      entityType: 'document_template',
      entityId: 12,
    }));
    expect(body).toEqual({ success: true, template: created, version });
  });

  it('returns auth response before parsing malformed create JSON', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    const forbidden = NextResponse.json({ error: 'forbidden' }, { status: 403 });
    mockedRequirePermission.mockResolvedValue(forbidden);
    const request = makeRequest('/api/document-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'forbidden' });
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'settings.manage',
      expect.any(String),
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  it('checks settings permission before returning invalid create config feedback', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const request = makeRequest('/api/document-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_code: 'BROKEN',
        template_name: 'Broken',
        document_type: 'tax_invoice',
        config: { paper: { width_mm: 0 } },
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mockedGetDb).toHaveBeenCalled();
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'settings.manage',
      expect.any(String),
    );
    expect(body.error).toBe('template config ไม่ถูกต้อง');
    expect(db.query).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('checks settings permission before returning duplicate metadata validation feedback', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/12/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_code: '', template_name: '' }),
    });

    const response = await duplicateTemplate(request, makeRouteContext('12'));

    expect(response.status).toBe(400);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'settings.manage',
      expect.any(String),
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  it('publishes a template version after settings permission and records audit trail', async () => {
    const template = {
      template_id: 12,
      template_code: 'TAX_CONTINUOUS',
      current_version_no: 2,
      status: 'active',
    };
    const db = makeDb([{ recordset: [template] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/12/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_no: 2 }),
    });

    const response = await publishTemplate(request, makeRouteContext('12'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'settings.manage',
      expect.any(String),
    );
    expect(db.queries[0]).toContain('UPDATE DocumentTemplateVersions');
    expect(db.queries[0]).toContain('UPDATE DocumentTemplates');
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'templateId', value: 12 },
      { name: 'versionNo', value: 2 },
      { name: 'publishedBy', value: 7 },
    ]));
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_publish',
      entityType: 'document_template',
      entityId: 12,
    }));
    expect(body).toEqual({ success: true, template });
  });

  it('deactivates a template with settings permission and clears default state', async () => {
    const template = {
      template_id: 12,
      template_code: 'TAX_CONTINUOUS',
      status: 'inactive',
      is_default: false,
    };
    const db = makeDb([{ recordset: [template] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/12/deactivate', { method: 'POST' });

    const response = await deactivateTemplate(request, makeRouteContext('12'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'settings.manage',
      expect.any(String),
    );
    expect(db.queries[0]).toContain("status = 'inactive'");
    expect(db.queries[0]).toContain('is_default = 0');
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document_template_deactivate',
      entityId: 12,
    }));
    expect(body).toEqual({ success: true, template });
  });

  it('sets a template as default after clearing defaults for the same document type', async () => {
    const existing = {
      template_id: 12,
      document_type: 'tax_invoice',
      version_status: 'published',
    };
    const updated = {
      template_id: 12,
      template_code: 'TAX_CONTINUOUS',
      document_type: 'tax_invoice',
      is_default: true,
      status: 'active',
    };
    const db = makeDb([
      { recordset: [existing] },
      { recordset: [updated] },
    ]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/12/set-default', { method: 'POST' });

    const response = await setDefaultTemplate(request, makeRouteContext('12'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'settings.manage',
      expect.any(String),
    );
    expect(db.queries[1]).toContain('BEGIN TRAN');
    expect(db.queries[1]).toContain('is_default = 0');
    expect(db.queries[1]).toContain('is_default = 1');
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_set_default',
      entityType: 'document_template',
      entityId: 12,
    }));
    expect(body).toEqual({ success: true, template: updated });
  });

  it('rejects setting default when the current version is not published without clearing defaults', async () => {
    const db = makeDb([{
      recordset: [{
        template_id: 12,
        document_type: 'tax_invoice',
        version_status: 'draft',
      }],
    }]);
    mockedGetDb.mockResolvedValue(db);

    const response = await setDefaultTemplate(
      makeRequest('/api/document-templates/12/set-default', { method: 'POST' }),
      makeRouteContext('12'),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('ตั้งเป็น default ได้เฉพาะ template version ที่ published แล้ว');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.queries[0]).toContain('DocumentTemplateVersions');
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('rejects PUT updates when the current version is not draft before updating', async () => {
    const db = makeDb([{
      recordset: [{
        template_id: 12,
        template_name: 'Tax invoice continuous',
        description: null,
        version_id: 22,
        version_no: 2,
        version_status: 'published',
      }],
    }]);
    mockedGetDb.mockResolvedValue(db);
    const response = await updateTemplate(makeRequest('/api/document-templates/12', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_name: 'Changed' }),
    }), makeRouteContext('12'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('แก้ไขได้เฉพาะ version draft ปัจจุบัน');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.queries[0]).toContain('FROM DocumentTemplates');
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });
});
