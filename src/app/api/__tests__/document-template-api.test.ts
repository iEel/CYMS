import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GET, POST } from '../document-templates/route';
import { POST as duplicateTemplate } from '../document-templates/[templateId]/duplicate/route';
import { POST as createDraftTemplate } from '../document-templates/[templateId]/draft/route';
import { PUT as updateTemplate } from '../document-templates/[templateId]/route';
import { POST as publishTemplate } from '../document-templates/[templateId]/publish/route';
import { POST as setDefaultTemplate } from '../document-templates/[templateId]/set-default/route';
import { POST as deactivateTemplate } from '../document-templates/[templateId]/deactivate/route';
import { GET as previewTemplate } from '../document-templates/preview/route';
import { POST as testPrintTemplate } from '../document-templates/test-print/route';
import { POST as printLogTemplate } from '../document-templates/print-log/route';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission, requirePermission, requireYardAccess } from '@/lib/apiAuth';
import { buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplates';
import { buildContinuousPrintPayload, buildSampleContinuousPrintPayload } from '@/lib/billingContinuousPrint';
import { nextDocumentNumber } from '@/lib/documentNumber';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn().mockResolvedValue({ userId: 7, role: 'yard_manager' }),
  requirePermission: jest.fn().mockResolvedValue({ userId: 7, role: 'yard_manager' }),
  requireYardAccess: jest.fn().mockResolvedValue({ userId: 7, role: 'yard_manager' }),
}));

jest.mock('@/lib/billingContinuousPrint', () => ({
  buildContinuousPrintPayload: jest.fn(async () => ({
    document: { invoice_id: 77, document_type: 'tax_invoice_receipt' },
    lines: [],
    totals: { subtotal: 0, vat_rate: 0, vat_amount: 0, grand_total: 0, amount_text_th: 'ศูนย์บาทถ้วน' },
  })),
  buildSampleContinuousPrintPayload: jest.fn(() => ({
    document: { invoice_id: 0, document_type: 'sample' },
    lines: [],
    totals: { subtotal: 0, vat_rate: 0, vat_amount: 0, grand_total: 0, amount_text_th: 'ศูนย์บาทถ้วน' },
  })),
}));

jest.mock('@/lib/documentNumber', () => ({
  nextDocumentNumber: jest.fn(async () => 'SHOULD-NOT-BE-CALLED'),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;
const mockedBuildContinuousPrintPayload = buildContinuousPrintPayload as jest.Mock;
const mockedBuildSampleContinuousPrintPayload = buildSampleContinuousPrintPayload as jest.Mock;
const mockedNextDocumentNumber = nextDocumentNumber as jest.Mock;

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
    mockedRequireAnyPermission.mockResolvedValue({ userId: 7, role: 'yard_manager' });
    mockedRequirePermission.mockResolvedValue({ userId: 7, role: 'yard_manager' });
    mockedRequireYardAccess.mockResolvedValue({ userId: 7, role: 'yard_manager' });
    mockedBuildContinuousPrintPayload.mockResolvedValue({
      document: { invoice_id: 77, document_type: 'tax_invoice_receipt' },
      lines: [],
      totals: { subtotal: 0, vat_rate: 0, vat_amount: 0, grand_total: 0, amount_text_th: 'ศูนย์บาทถ้วน' },
    });
    mockedBuildSampleContinuousPrintPayload.mockReturnValue({
      document: { invoice_id: 0, document_type: 'sample' },
      lines: [],
      totals: { subtotal: 0, vat_rate: 0, vat_amount: 0, grand_total: 0, amount_text_th: 'ศูนย์บาทถ้วน' },
    });
  });

  it('requires document template view permission and lists templates with current version info', async () => {
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
      'document_templates.view',
      expect.any(String),
    );
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.queries[0]).toContain('DocumentTemplates');
    expect(db.queries[0]).toContain('DocumentTemplateVersions');
    expect(body).toEqual({ templates: [template] });
  });

  it('creates a template with valid config, version 1 draft, and audit trail', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.print_policy.reprint_label_template = 'REPRINT {reprint_count}';
    config.print_policy.red_ref_source = 'invoice_number';
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
    expect(db.queries[0]).toContain('reprint_label_template NVARCHAR(120)');
    expect(db.queries[0]).toContain('red_ref_source NVARCHAR(50)');
    expect(db.queries[0]).toContain('INSERTED.reprint_label_template');
    expect(db.queries[0]).toContain('INSERTED.red_ref_source');
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'templateCode', value: 'TAX_CONTINUOUS' },
      { name: 'isDefault', value: 0 },
      { name: 'versionNo', value: 1 },
      { name: 'status', value: 'draft' },
      { name: 'configJson', value: JSON.stringify(config) },
      { name: 'reprintLabelTemplate', value: 'REPRINT {reprint_count}' },
      { name: 'redRefSource', value: 'invoice_number' },
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
      'document_templates.create',
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
      'document_templates.create',
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
      'document_templates.create',
      expect.any(String),
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  it('publishes a template version after publish permission and records audit trail', async () => {
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
      'document_templates.publish',
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

  it('deactivates a template with publish permission and clears default state', async () => {
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
      'document_templates.publish',
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
      'document_templates.publish',
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
        version_id: null,
        version_no: null,
        version_status: null,
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
    expect(body.error).toBe('แก้ไข active template ต้องสร้าง draft version ก่อน');
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.queries[0]).toContain('FROM DocumentTemplates');
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('creates a draft version from the current published template before designer edits', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    const draft = {
      version_id: 23,
      template_id: 12,
      version_no: 3,
      status: 'draft',
      config_json: JSON.stringify(config),
    };
    const db = makeDb([{ recordset: [draft] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/12/draft', { method: 'POST' });

    const response = await createDraftTemplate(request, makeRouteContext('12'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      request,
      db,
      'document_templates.update_draft',
      expect.any(String),
    );
    expect(db.queries[0]).toContain('INSERT INTO DocumentTemplateVersions');
    expect(db.queries[0]).not.toContain('current_version_no =');
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_draft_create',
      entityType: 'document_template',
      entityId: 12,
    }));
    expect(body).toEqual({ success: true, version: draft });
  });

  it('updates draft template print policy fields with config changes', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.print_policy.reprint_label_template = 'COPY {reprint_count}';
    config.print_policy.red_ref_source = 'receipt_number';
    const db = makeDb([
      { recordset: [{
        template_id: 12,
        template_name: 'Tax invoice continuous',
        description: null,
        version_id: 22,
        version_no: 2,
        current_version_no: 1,
        version_status: 'draft',
      }] },
      { recordset: [{ template_id: 12, template_name: 'Tax invoice continuous' }] },
      { recordset: [{ version_id: 22, config_json: JSON.stringify(config) }] },
    ]);
    mockedGetDb.mockResolvedValue(db);

    const response = await updateTemplate(makeRequest('/api/document-templates/12', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }), makeRouteContext('12'));

    expect(response.status).toBe(200);
    expect(db.queries[2]).toContain('reprint_label_template = @reprintLabelTemplate');
    expect(db.queries[2]).toContain('red_ref_source = @redRefSource');
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'reprintLabelTemplate', value: 'COPY {reprint_count}' },
      { name: 'redRefSource', value: 'receipt_number' },
      { name: 'configJson', value: JSON.stringify(config) },
    ]));
  });

  it('returns sample preview payload and current template config without numbering', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.print_policy.red_ref_source = 'invoice_number';
    const db = makeDb([{ recordset: [{ config_json: JSON.stringify(config) }] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/preview?preview=sample&type=tax_invoice_receipt&mode=overlay&copyMode=separate');

    const response = await previewTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(request, db, 'document_templates.view', expect.any(String));
    expect(mockedRequireAnyPermission).not.toHaveBeenCalled();
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
    expect(mockedBuildSampleContinuousPrintPayload).toHaveBeenCalled();
    expect(mockedBuildContinuousPrintPayload).not.toHaveBeenCalled();
    expect(mockedNextDocumentNumber).not.toHaveBeenCalled();
    expect(db.queries[0]).toContain("t.document_type IN ('receipt', 'tax_invoice_receipt')");
    expect(db.queries[0]).not.toContain("OR @documentType IN ('tax_invoice_receipt', 'receipt')");
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_preview',
      entityType: 'document_template',
      details: expect.objectContaining({
        document_type: 'tax_invoice_receipt',
        preview: 'sample',
        mode: 'overlay',
        copy_mode: 'separate',
      }),
    }));
    expect(body.payload.document.document_type).toBe('sample');
    expect(body.config.mode).toBe('overlay');
    expect(body.config.copy_mode).toBe('separate');
    expect(body.config.print_policy.red_ref_source).toBe('invoice_number');
  });

  it('returns designer draft preview when template id and version are specified', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    const db = makeDb([{ recordset: [{ template_code: 'TAX_CONTINUOUS', version_no: 3, status: 'draft', config_json: JSON.stringify(config) }] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/preview?preview=sample&type=tax_invoice_receipt&templateId=12&versionNo=3');

    const response = await previewTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'templateId', value: 12 },
      { name: 'versionNo', value: 3 },
    ]));
    expect(db.queries[0]).toContain('t.template_id = @templateId');
    expect(db.queries[0]).toContain('v.version_no = @versionNo');
    expect(body.template).toEqual({ template_code: 'TAX_CONTINUOUS', template_version: 3 });
  });

  it('returns real invoice preview payload without allocating document numbers', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    const db = makeDb([
      { recordset: [{ invoice_id: 77, yard_id: 5, status: 'issued' }] },
      { recordset: [{ config_json: JSON.stringify(config) }] },
    ]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/preview?id=77&type=tax_invoice_receipt&preview=real');

    const response = await previewTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(request, db, [
      'settings.manage',
      'billing.invoice.create',
      'billing.payment.receive',
      'reports.view',
      'gate.in',
      'gate.out',
    ], expect.any(String));
    expect(mockedRequirePermission).not.toHaveBeenCalled();
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(request, db, 5);
    expect(mockedBuildContinuousPrintPayload).toHaveBeenCalledWith(db, {
      invoiceId: 77,
      type: 'tax_invoice_receipt',
    });
    expect(mockedBuildSampleContinuousPrintPayload).not.toHaveBeenCalled();
    expect(mockedNextDocumentNumber).not.toHaveBeenCalled();
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_preview',
      entityType: 'document_template',
      entityId: 77,
      details: expect.objectContaining({
        document_type: 'tax_invoice_receipt',
        preview: 'real',
        invoice_id: 77,
      }),
    }));
    expect(body.payload.document.invoice_id).toBe(77);
    expect(body.config.print_policy.reprint_label_template).toBe('พิมพ์ซ้ำครั้งที่ {reprint_count}');
  });

  it('rejects real invoice preview when the invoice does not exist', async () => {
    const db = makeDb([{ recordset: [] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/preview?id=999&type=tax_invoice_receipt&preview=real');

    const response = await previewTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('invoice not found');
    expect(mockedRequireAnyPermission).toHaveBeenCalled();
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
    expect(mockedBuildContinuousPrintPayload).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('returns sample test print payload with settings permission and no document numbering', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.print_policy.red_ref_source = 'receipt_number';
    const db = makeDb([{ recordset: [{ config_json: JSON.stringify(config) }] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/test-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: 'receipt',
        mode: 'overlay',
        copyMode: 'separate',
        template_id: 12,
      }),
    });

    const response = await testPrintTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(request, db, 'document_templates.test_print', expect.any(String));
    expect(mockedRequireAnyPermission).not.toHaveBeenCalled();
    expect(mockedBuildSampleContinuousPrintPayload).toHaveBeenCalled();
    expect(mockedBuildContinuousPrintPayload).not.toHaveBeenCalled();
    expect(mockedNextDocumentNumber).not.toHaveBeenCalled();
    expect(db.queries.join('\n')).not.toContain('DocumentPrintLogs');
    expect(db.queries[0]).toContain("t.document_type IN ('receipt', 'tax_invoice_receipt')");
    expect(db.queries[0]).not.toContain("OR @documentType IN ('tax_invoice_receipt', 'receipt')");
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_template_test_print',
      entityType: 'document_template',
      entityId: 12,
      details: expect.objectContaining({
        document_type: 'receipt',
        mode: 'overlay',
        copy_mode: 'separate',
        template_id: 12,
      }),
    }));
    expect(body.payload.document.document_type).toBe('sample');
    expect(body.config.mode).toBe('overlay');
    expect(body.config.copy_mode).toBe('separate');
    expect(body.config.print_policy.red_ref_source).toBe('receipt_number');
    expect(body.testPrint).toBe(true);
  });

  it('returns sample test print payload from a selected draft version when versionNo is provided', async () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.paper.top_offset_mm = 4;
    const db = makeDb([{ recordset: [{ config_json: JSON.stringify(config) }] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/test-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: 'tax_invoice_receipt',
        template_id: 12,
        versionNo: 3,
      }),
    });

    const response = await testPrintTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'templateId', value: 12 },
      { name: 'versionNo', value: 3 },
    ]));
    expect(db.queries[0]).toContain('@versionNo IS NULL OR v.version_no = @versionNo');
    expect(db.queries[0]).toContain('v.version_no = t.current_version_no');
    expect(mockedNextDocumentNumber).not.toHaveBeenCalled();
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.objectContaining({
        template_id: 12,
        version_no: 3,
      }),
    }));
    expect(body.config.paper.top_offset_mm).toBe(4);
  });

  it('rejects malformed test print JSON after settings permission without auditing', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/test-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });

    const response = await testPrintTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(mockedRequirePermission).toHaveBeenCalledWith(request, db, 'document_templates.test_print', expect.any(String));
    expect(body.error).toBe('JSON body ไม่ถูกต้อง');
    expect(db.query).not.toHaveBeenCalled();
    expect(mockedBuildSampleContinuousPrintPayload).not.toHaveBeenCalled();
    expect(mockedNextDocumentNumber).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('records document print logs through the dedicated print-log route', async () => {
    const db = makeDb([
      { recordset: [{ invoice_id: 77, yard_id: 5, invoice_number: 'INV-DB-77', receipt_number: 'RCT-DB-77', status: 'paid' }] },
      { recordset: [{ template_id: 12, version_id: 22 }] },
      { recordset: [{ success: true, print_no: 1, is_reprint: false, reprint_count: 0 }] },
    ]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/print-log', {
      method: 'POST',
      body: JSON.stringify({
        document_type: 'tax_invoice_receipt',
        document_id: 77,
        document_no: 'INV-77',
        template_code: 'TAX_CONTINUOUS',
        template_version: 2,
        snapshot: { document: { invoice_id: 77 } },
        mode: 'full',
        copy_mode: 'carbonless',
        show_reprint_label: true,
        reprint_label_template: 'พิมพ์ซ้ำครั้งที่ {reprint_count}',
      }),
    });

    const response = await printLogTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ print_no: 1, is_reprint: false, reprint_count: 0 });
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(
      request,
      db,
      ['settings.manage', 'billing.invoice.create', 'billing.payment.receive', 'gate.in', 'gate.out', 'reports.view'],
      expect.any(String),
    );
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(request, db, 5);
    expect(db.queries.join('\n')).toMatch(/INSERT\s+INTO\s+DocumentPrintLogs/i);
    expect(db.queries.join('\n')).toMatch(/INSERT\s+INTO\s+DocumentPrintSnapshots/i);
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'documentNo', value: 'INV-DB-77' },
    ]));
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'document_print',
      entityType: 'tax_invoice_receipt',
      entityId: 77,
      details: expect.objectContaining({
        document_no: 'INV-DB-77',
      }),
    }));
    expect(mockedNextDocumentNumber).not.toHaveBeenCalled();
  });

  it('allows print-log to validate an older published template version for reprints', async () => {
    const db = makeDb([
      { recordset: [{ invoice_id: 77, yard_id: 5, invoice_number: 'INV-DB-77', receipt_number: null, status: 'issued' }] },
      { recordset: [{ template_id: 12, version_id: 21, version_no: 1 }] },
      { recordset: [{ success: true, print_no: 3, is_reprint: true, reprint_count: 2 }] },
    ]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/print-log', {
      method: 'POST',
      body: JSON.stringify({
        document_type: 'tax_invoice_receipt',
        document_id: 77,
        template_code: 'TAX_CONTINUOUS',
        template_version: 1,
        snapshot: { document: { invoice_id: 77 } },
      }),
    });

    const response = await printLogTemplate(request);

    expect(response.status).toBe(200);
    expect(db.queries[1]).not.toContain('v.version_no = t.current_version_no');
    expect(db.inputs).toEqual(expect.arrayContaining([
      { name: 'templateVersion', value: 1 },
    ]));
  });

  it('rejects print-log for unknown invoices before writing', async () => {
    const db = makeDb([{ recordset: [] }]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/print-log', {
      method: 'POST',
      body: JSON.stringify({
        document_type: 'tax_invoice_receipt',
        document_id: 999,
        document_no: 'CLIENT-FORGED',
        template_code: 'TAX_CONTINUOUS',
        template_version: 2,
      }),
    });

    const response = await printLogTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('invoice not found');
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
    expect(db.queries.join('\n')).not.toMatch(/INSERT\s+INTO\s+DocumentPrintLogs/i);
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('rejects print-log for unknown templates before writing', async () => {
    const db = makeDb([
      { recordset: [{ invoice_id: 77, yard_id: 5, invoice_number: 'INV-DB-77', receipt_number: null, status: 'issued' }] },
      { recordset: [] },
    ]);
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/print-log', {
      method: 'POST',
      body: JSON.stringify({
        document_type: 'tax_invoice_receipt',
        document_id: 77,
        document_no: 'CLIENT-FORGED',
        template_code: 'UNKNOWN',
        template_version: 2,
      }),
    });

    const response = await printLogTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('unknown or inactive template');
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(request, db, 5);
    expect(db.queries.join('\n')).not.toMatch(/INSERT\s+INTO\s+DocumentPrintLogs/i);
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('rejects unsupported print-log document types without writing', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    const request = makeRequest('/api/document-templates/print-log', {
      method: 'POST',
      body: JSON.stringify({
        document_type: 'sample',
        document_id: 77,
        template_code: 'SAMPLE',
        template_version: 1,
      }),
    });

    const response = await printLogTemplate(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('unsupported document_type');
    expect(db.query).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('does not fail print-log response when audit throws after successful write', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = makeDb([
      { recordset: [{ invoice_id: 77, yard_id: 5, invoice_number: 'INV-DB-77', receipt_number: 'RCT-DB-77', status: 'paid' }] },
      { recordset: [{ template_id: 12, version_id: 22 }] },
      { recordset: [{ success: true, print_no: 2, is_reprint: true, reprint_count: 1 }] },
    ]);
    try {
      mockedGetDb.mockResolvedValue(db);
      mockedLogAudit.mockRejectedValueOnce(new Error('audit unavailable'));
      const request = makeRequest('/api/document-templates/print-log', {
        method: 'POST',
        body: JSON.stringify({
          document_type: 'receipt',
          document_id: 77,
          document_no: 'RCT-77',
          template_code: 'RCT_CONTINUOUS',
          template_version: 2,
          snapshot: { document: { invoice_id: 77 } },
          mode: 'full',
          copy_mode: 'carbonless',
          show_reprint_label: true,
          reprint_label_template: 'พิมพ์ซ้ำครั้งที่ {reprint_count}',
        }),
      });

      const response = await printLogTemplate(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        print_no: 2,
        is_reprint: true,
        reprint_count: 1,
        reprint_label: 'พิมพ์ซ้ำครั้งที่ 1',
      });
      expect(mockedLogAudit).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('document print audit failed:', expect.any(Error));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('document template calibration API flow', () => {
  it('preview accepts calibration profile id without consuming document number', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/document-templates/preview/route.ts'), 'utf8');
    expect(source).toContain('calibrationProfileId');
    expect(source).toContain('applyCalibrationProfileToConfig');
  });

  it('test print accepts calibration settings and does not write print logs', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/document-templates/test-print/route.ts'), 'utf8');
    expect(source).toContain('calibrationProfileId');
    expect(source).not.toContain('DocumentPrintLogs');
  });
});
