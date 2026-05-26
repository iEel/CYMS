# Document Template Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 of Document Template Manager with continuous tax invoice / receipt printing, preview, test print, template versioning, print snapshots, and reprint logging while reusing the existing document number system.

**Architecture:** Add a template and print lifecycle layer around the existing billing/payment records. Document numbers remain owned by `DocumentSequences` and `nextDocumentNumber()`; template helpers only read existing invoice/payment/receipt numbers and produce versioned print payloads. UI is a structured settings workspace in Phase 1, with config schema ready for Phase 2 visual designer.

**Tech Stack:** Next.js App Router, React client components, TypeScript, MS SQL via `mssql`, Jest tests, Tailwind utility classes, existing CYMS auth/audit/document-number helpers.

---

## Scope Rules

- Keep `/billing/print?id=...` A4 invoice/receipt behavior unchanged.
- Do not create a second document-number engine.
- Do not call `nextDocumentNumber()` from preview, test print, or reprint.
- Do not create or update invoices/payments from print-only actions.
- Put schema changes in `scripts/migrate-runtime-core-schema.js` and `src/lib/schema.sql`.
- Do not add runtime DDL in API routes.
- Keep Phase 1 editor structured; drag/drop visual designer is a separate Phase 2.

## File Map

Create:

- `src/lib/thaiBahtText.ts` — reusable Thai amount text formatter.
- `src/lib/documentTemplateTypes.ts` — shared template config, payload, and print log types.
- `src/lib/documentTemplates.ts` — template loading, validation, default lookup, publish/default helpers.
- `src/lib/billingContinuousPrint.ts` — normalized continuous print payload builder.
- `src/lib/documentPrintLog.ts` — print/reprint count, snapshot, and audit helpers.
- `src/components/billing/ContinuousTaxReceipt.tsx` — continuous print renderer for full and overlay mode.
- `src/app/billing/print/continuous/page.tsx` — browser print page.
- `src/app/api/document-templates/route.ts` — list/create templates.
- `src/app/api/document-templates/[templateId]/route.ts` — read/update one template.
- `src/app/api/document-templates/[templateId]/duplicate/route.ts`
- `src/app/api/document-templates/[templateId]/publish/route.ts`
- `src/app/api/document-templates/[templateId]/set-default/route.ts`
- `src/app/api/document-templates/[templateId]/deactivate/route.ts`
- `src/app/api/document-templates/preview/route.ts`
- `src/app/api/document-templates/test-print/route.ts`
- `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`
- `src/app/api/__tests__/thai-baht-text.test.ts`
- `src/app/api/__tests__/document-template-helpers.test.ts`
- `src/app/api/__tests__/continuous-print-payload.test.ts`
- `src/app/api/__tests__/document-print-log.test.ts`
- `src/app/api/__tests__/document-template-api.test.ts`
- `src/app/api/__tests__/continuous-print-ui.test.ts`

Modify:

- `scripts/migrate-runtime-core-schema.js` — add tables and default seed.
- `src/lib/schema.sql` — canonical schema.
- `src/app/billing/print/page.tsx` — import `thaiBahtText`; the helper must stay dependency-free so it is safe for the client bundle.
- `src/app/(dashboard)/settings/page.tsx` — add Document Templates tab.
- `src/app/(dashboard)/billing/page.tsx` — add continuous print actions.
- `src/app/(dashboard)/billing/BillingClearanceTab.tsx` — add continuous print action where clearance prints receipt/invoice.
- `src/app/(dashboard)/gate/GateInTab.tsx` — add continuous receipt action after clearance/payment.
- `src/app/(dashboard)/gate/GateOutTab.tsx` — add continuous receipt action after clearance/payment.
- `DEVELOPER_HANDOFF.md` — document new module, migration, tests, and usage.

---

### Task 1: Add Schema And Static Guards

**Files:**
- Modify: `scripts/migrate-runtime-core-schema.js`
- Modify: `src/lib/schema.sql`
- Create: `src/app/api/__tests__/document-template-schema.test.ts`

- [ ] **Step 1: Write schema guard tests**

Create `src/app/api/__tests__/document-template-schema.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(path.join(process.cwd(), 'scripts/migrate-runtime-core-schema.js'), 'utf8');
const schema = fs.readFileSync(path.join(process.cwd(), 'src/lib/schema.sql'), 'utf8');
const apiFiles = fs.readdirSync(path.join(process.cwd(), 'src/app/api'), { recursive: true })
  .filter(file => String(file).endsWith('route.ts'))
  .map(file => fs.readFileSync(path.join(process.cwd(), 'src/app/api', String(file)), 'utf8'))
  .join('\n');

describe('document template schema', () => {
  it('declares document template and print log tables in migration and canonical schema', () => {
    for (const table of ['DocumentTemplates', 'DocumentTemplateVersions', 'DocumentPrintLogs', 'DocumentPrintSnapshots']) {
      expect(migration).toContain(table);
      expect(schema).toContain(table);
    }
  });

  it('keeps document template DDL out of API routes', () => {
    expect(apiFiles).not.toMatch(/CREATE TABLE\s+DocumentTemplates/i);
    expect(apiFiles).not.toMatch(/ALTER TABLE\s+DocumentTemplates/i);
    expect(apiFiles).not.toMatch(/CREATE TABLE\s+DocumentPrintLogs/i);
    expect(apiFiles).not.toMatch(/ALTER TABLE\s+DocumentPrintLogs/i);
  });
});
```

- [ ] **Step 2: Run schema test and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-schema.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because the new tables are not in migration/schema yet.

- [ ] **Step 3: Add migration DDL**

In `scripts/migrate-runtime-core-schema.js`, add idempotent SQL for:

```sql
IF OBJECT_ID('DocumentTemplates', 'U') IS NULL
BEGIN
  CREATE TABLE DocumentTemplates (
    template_id INT PRIMARY KEY IDENTITY(1,1),
    template_code NVARCHAR(80) NOT NULL UNIQUE,
    template_name NVARCHAR(200) NOT NULL,
    document_type NVARCHAR(50) NOT NULL,
    description NVARCHAR(500) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'draft',
    is_default BIT NOT NULL DEFAULT 0,
    current_version_no INT NOT NULL DEFAULT 1,
    created_by INT NULL,
    updated_by INT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NULL
  );
END;

IF OBJECT_ID('DocumentTemplateVersions', 'U') IS NULL
BEGIN
  CREATE TABLE DocumentTemplateVersions (
    version_id INT PRIMARY KEY IDENTITY(1,1),
    template_id INT NOT NULL REFERENCES DocumentTemplates(template_id),
    template_code NVARCHAR(80) NOT NULL,
    version_no INT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'draft',
    paper_width_mm DECIMAL(10,2) NOT NULL,
    paper_height_mm DECIMAL(10,2) NOT NULL,
    paper_size_code NVARCHAR(40) NOT NULL,
    mode NVARCHAR(20) NOT NULL DEFAULT 'full',
    copy_mode NVARCHAR(20) NOT NULL DEFAULT 'carbonless',
    top_offset_mm DECIMAL(10,2) NOT NULL DEFAULT 0,
    left_offset_mm DECIMAL(10,2) NOT NULL DEFAULT 0,
    font_size DECIMAL(10,2) NOT NULL DEFAULT 10,
    line_height DECIMAL(10,2) NOT NULL DEFAULT 1.25,
    row_height DECIMAL(10,2) NOT NULL DEFAULT 6,
    print_scale DECIMAL(10,3) NOT NULL DEFAULT 1,
    show_reprint_label BIT NOT NULL DEFAULT 1,
    reprint_label_template NVARCHAR(120) NOT NULL DEFAULT N'พิมพ์ซ้ำครั้งที่ {reprint_count}',
    reprint_label_position NVARCHAR(30) NOT NULL DEFAULT 'top-right',
    reprint_label_x_mm DECIMAL(10,2) NULL,
    reprint_label_y_mm DECIMAL(10,2) NULL,
    reprint_label_font_size DECIMAL(10,2) NOT NULL DEFAULT 10,
    reprint_label_color NVARCHAR(30) NOT NULL DEFAULT '#B91C1C',
    require_reprint_reason BIT NOT NULL DEFAULT 1,
    print_red_ref BIT NOT NULL DEFAULT 1,
    red_ref_source NVARCHAR(50) NOT NULL DEFAULT 'receipt_number',
    manual_preprinted_form_no_required BIT NOT NULL DEFAULT 0,
    invoice_number_source NVARCHAR(50) NOT NULL DEFAULT 'invoice_number',
    receipt_number_source NVARCHAR(50) NOT NULL DEFAULT 'receipt_number',
    tax_invoice_number_source NVARCHAR(50) NOT NULL DEFAULT 'invoice_number',
    top_reference_source NVARCHAR(50) NOT NULL DEFAULT 'invoice_number',
    config_json NVARCHAR(MAX) NOT NULL,
    published_by INT NULL,
    published_at DATETIME2 NULL,
    created_by INT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_DocumentTemplateVersions UNIQUE (template_id, version_no)
  );
END;

IF OBJECT_ID('DocumentPrintLogs', 'U') IS NULL
BEGIN
  CREATE TABLE DocumentPrintLogs (
    print_id BIGINT PRIMARY KEY IDENTITY(1,1),
    document_type NVARCHAR(50) NOT NULL,
    document_id INT NOT NULL,
    document_no NVARCHAR(100) NULL,
    template_code NVARCHAR(80) NOT NULL,
    template_version INT NOT NULL,
    print_no INT NOT NULL,
    is_reprint BIT NOT NULL DEFAULT 0,
    reprint_count INT NOT NULL DEFAULT 0,
    reprint_reason NVARCHAR(500) NULL,
    manual_preprinted_form_no NVARCHAR(100) NULL,
    mode NVARCHAR(20) NOT NULL,
    copy_mode NVARCHAR(20) NOT NULL,
    printed_by INT NULL,
    printed_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    ip_address NVARCHAR(100) NULL,
    user_agent NVARCHAR(500) NULL
  );
END;

IF OBJECT_ID('DocumentPrintSnapshots', 'U') IS NULL
BEGIN
  CREATE TABLE DocumentPrintSnapshots (
    snapshot_id BIGINT PRIMARY KEY IDENTITY(1,1),
    print_id BIGINT NOT NULL REFERENCES DocumentPrintLogs(print_id),
    document_type NVARCHAR(50) NOT NULL,
    document_id INT NOT NULL,
    document_no NVARCHAR(100) NULL,
    template_code NVARCHAR(80) NOT NULL,
    template_version INT NOT NULL,
    snapshot_json NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END;
```

Also add indexes:

```sql
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DocumentPrintLogs_Document')
  CREATE INDEX IX_DocumentPrintLogs_Document
  ON DocumentPrintLogs (document_type, document_id, printed_at DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DocumentTemplateVersions_Code')
  CREATE INDEX IX_DocumentTemplateVersions_Code
  ON DocumentTemplateVersions (template_code, version_no, status);
```

- [ ] **Step 4: Mirror schema in `src/lib/schema.sql`**

Add the same four table definitions and indexes to `src/lib/schema.sql` near the existing document/billing schema.

- [ ] **Step 5: Run schema test**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-schema.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-runtime-core-schema.js src/lib/schema.sql src/app/api/__tests__/document-template-schema.test.ts
git commit -m "Add document template schema"
```

---

### Task 2: Extract Thai Baht Text Helper

**Files:**
- Create: `src/lib/thaiBahtText.ts`
- Create: `src/app/api/__tests__/thai-baht-text.test.ts`
- Modify: `src/app/billing/print/page.tsx`

- [ ] **Step 1: Write tests**

Create `src/app/api/__tests__/thai-baht-text.test.ts`:

```ts
import { amountToThaiBahtText } from '@/lib/thaiBahtText';

describe('amountToThaiBahtText', () => {
  it('formats whole baht amounts', () => {
    expect(amountToThaiBahtText(1070)).toBe('หนึ่งพันเจ็ดสิบบาทถ้วน');
  });

  it('formats satang amounts', () => {
    expect(amountToThaiBahtText(1234.56)).toBe('หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบหกสตางค์');
  });

  it('formats zero', () => {
    expect(amountToThaiBahtText(0)).toBe('ศูนย์บาทถ้วน');
  });

  it('formats negative values for refund line support', () => {
    expect(amountToThaiBahtText(-250)).toBe('ลบสองร้อยห้าสิบบาทถ้วน');
  });
});
```

- [ ] **Step 2: Run helper test and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/thai-baht-text.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because `src/lib/thaiBahtText.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `src/lib/thaiBahtText.ts`:

```ts
const THAI_NUMBERS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

function readThaiNumber(value: number): string {
  if (value === 0) return THAI_NUMBERS[0];
  const text = String(Math.floor(value));
  let output = '';
  for (let index = 0; index < text.length; index += 1) {
    const digit = Number(text[index]);
    const position = text.length - index - 1;
    if (digit === 0) continue;
    if (position === 0 && digit === 1 && text.length > 1) output += 'เอ็ด';
    else if (position === 1 && digit === 1) output += 'สิบ';
    else if (position === 1 && digit === 2) output += 'ยี่สิบ';
    else output += THAI_NUMBERS[digit] + THAI_POSITIONS[position];
  }
  return output;
}

export function amountToThaiBahtText(input: number | string | null | undefined): string {
  const numeric = Number(input ?? 0);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;
  const sign = safeValue < 0 ? 'ลบ' : '';
  const absolute = Math.abs(safeValue);
  const baht = Math.floor(absolute);
  const satang = Math.round((absolute - baht) * 100);
  const bahtText = `${readThaiNumber(baht)}บาท`;
  if (satang === 0) return `${sign}${bahtText}ถ้วน`;
  return `${sign}${bahtText}${readThaiNumber(satang)}สตางค์`;
}
```

- [ ] **Step 4: Reuse helper in existing A4 print page**

In `src/app/billing/print/page.tsx`, replace the local Thai text function with:

```ts
import { amountToThaiBahtText } from '@/lib/thaiBahtText';
```

Then replace usage:

```ts
const amountText = amountToThaiBahtText(displayGrandTotal);
```

- [ ] **Step 5: Run helper and A4 print tests**

Run:

```bash
npm test -- src/app/api/__tests__/thai-baht-text.test.ts src/app/api/__tests__/billing-statement-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/thaiBahtText.ts src/app/api/__tests__/thai-baht-text.test.ts src/app/billing/print/page.tsx
git commit -m "Extract Thai baht text helper"
```

---

### Task 3: Add Template Types And Defaults

**Files:**
- Create: `src/lib/documentTemplateTypes.ts`
- Create: `src/lib/documentTemplates.ts`
- Create: `src/app/api/__tests__/document-template-helpers.test.ts`

- [ ] **Step 1: Write helper tests**

Create `src/app/api/__tests__/document-template-helpers.test.ts`:

```ts
import { buildDefaultContinuousTemplateConfig, validateTemplateConfig } from '@/lib/documentTemplates';

describe('document template helpers', () => {
  it('builds default continuous tax invoice template config', () => {
    const config = buildDefaultContinuousTemplateConfig();
    expect(config.paper.width_mm).toBe(241.3);
    expect(config.paper.height_mm).toBe(139.7);
    expect(config.mode).toBe('full');
    expect(config.copy_mode).toBe('carbonless');
    expect(config.copy_labels).toHaveLength(5);
    expect(config.fields.some(field => field.field_key === 'customer.customer_name')).toBe(true);
    expect(config.fields.some(field => field.field_key === 'totals.grand_total')).toBe(true);
  });

  it('validates field coordinates and required field keys', () => {
    const config = buildDefaultContinuousTemplateConfig();
    expect(validateTemplateConfig(config)).toEqual({ valid: true, errors: [] });
    const invalid = { ...config, fields: [{ ...config.fields[0], x_mm: -1 }] };
    expect(validateTemplateConfig(invalid).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run helper tests and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-helpers.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because helper files do not exist.

- [ ] **Step 3: Add shared types**

Create `src/lib/documentTemplateTypes.ts` with exported types:

```ts
export type DocumentTemplateMode = 'full' | 'overlay';
export type DocumentTemplateCopyMode = 'carbonless' | 'separate';

export type DocumentTemplateField = {
  field_id: string;
  field_key: string;
  label: string;
  binding_source: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  font_size: number;
  font_weight: 'normal' | 'medium' | 'semibold' | 'bold';
  text_align: 'left' | 'center' | 'right';
  visible: boolean;
  layer: 'form' | 'data' | 'calibration';
  locked: boolean;
  format: 'text' | 'money' | 'number' | 'date' | 'checkbox';
  default_value?: string;
  sample_value?: string;
};

export type DocumentTemplateConfig = {
  paper: {
    width_mm: number;
    height_mm: number;
    top_offset_mm: number;
    left_offset_mm: number;
    print_scale: number;
  };
  mode: DocumentTemplateMode;
  copy_mode: DocumentTemplateCopyMode;
  copy_labels: string[];
  fields: DocumentTemplateField[];
  sections: {
    line_items: {
      start_y_mm: number;
      row_height_mm: number;
      max_rows: number;
    };
  };
};
```

- [ ] **Step 4: Implement defaults and validation**

Create `src/lib/documentTemplates.ts`:

```ts
import type { DocumentTemplateConfig } from './documentTemplateTypes';

const field = (
  field_id: string,
  label: string,
  binding_source: string,
  x_mm: number,
  y_mm: number,
  width_mm: number,
  height_mm = 6,
  format: DocumentTemplateConfig['fields'][number]['format'] = 'text'
) => ({
  field_id,
  field_key: binding_source,
  label,
  binding_source,
  x_mm,
  y_mm,
  width_mm,
  height_mm,
  font_size: 10,
  font_weight: 'normal' as const,
  text_align: format === 'money' ? 'right' as const : 'left' as const,
  visible: true,
  layer: 'data' as const,
  locked: false,
  format,
  sample_value: '',
});

export function buildDefaultContinuousTemplateConfig(): DocumentTemplateConfig {
  return {
    paper: { width_mm: 241.3, height_mm: 139.7, top_offset_mm: 0, left_offset_mm: 0, print_scale: 1 },
    mode: 'full',
    copy_mode: 'carbonless',
    copy_labels: [
      'ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน',
      'สำเนาใบกำกับภาษี/ใบเสร็จรับเงิน',
      'สำเนาสำหรับบัญชี',
      'สำเนาสำหรับลูกค้า',
      'สำเนาสำหรับเก็บ',
    ],
    fields: [
      field('company_name_th', 'Company Thai Name', 'company.name_th', 12, 10, 120),
      field('customer_name', 'Customer Name', 'customer.customer_name', 18, 42, 130),
      field('customer_tax_id', 'Customer Tax ID', 'customer.tax_id', 18, 54, 80),
      field('document_no', 'Document No.', 'document.receipt_number', 172, 28, 54),
      field('document_date', 'Document Date', 'document.document_date', 172, 38, 54, 6, 'date'),
      field('totals_grand_total', 'Grand Total', 'totals.grand_total', 180, 112, 44, 6, 'money'),
      field('totals_amount_text_th', 'Amount Text', 'totals.amount_text_th', 18, 123, 150),
    ],
    sections: { line_items: { start_y_mm: 76, row_height_mm: 6, max_rows: 8 } },
  };
}

export function validateTemplateConfig(config: DocumentTemplateConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.paper || config.paper.width_mm <= 0 || config.paper.height_mm <= 0) errors.push('paper size must be positive');
  if (!['full', 'overlay'].includes(config.mode)) errors.push('mode must be full or overlay');
  if (!['carbonless', 'separate'].includes(config.copy_mode)) errors.push('copy_mode must be carbonless or separate');
  if (!Array.isArray(config.copy_labels) || config.copy_labels.length !== 5) errors.push('copy_labels must contain five labels');
  for (const templateField of config.fields || []) {
    if (!templateField.field_key) errors.push('field_key is required');
    if (templateField.x_mm < 0 || templateField.y_mm < 0) errors.push(`${templateField.field_id} coordinates must be positive`);
    if (templateField.width_mm <= 0 || templateField.height_mm <= 0) errors.push(`${templateField.field_id} size must be positive`);
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-helpers.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentTemplateTypes.ts src/lib/documentTemplates.ts src/app/api/__tests__/document-template-helpers.test.ts
git commit -m "Add document template helpers"
```

---

### Task 4: Build Continuous Print Payload Helper

**Files:**
- Create: `src/lib/billingContinuousPrint.ts`
- Create: `src/app/api/__tests__/continuous-print-payload.test.ts`

- [ ] **Step 1: Write payload tests**

Create `src/app/api/__tests__/continuous-print-payload.test.ts`:

```ts
import { buildContinuousPrintPayload, buildSampleContinuousPrintPayload } from '@/lib/billingContinuousPrint';

function makeDb(invoiceRow: Record<string, unknown>) {
  const query = jest.fn().mockResolvedValue({ recordset: [invoiceRow] });
  const input = jest.fn().mockReturnThis();
  return { request: jest.fn(() => ({ input, query })), query, input };
}

describe('billing continuous print payload', () => {
  it('builds sample data without a db call', async () => {
    const payload = buildSampleContinuousPrintPayload();
    expect(payload.document.document_title).toContain('ใบกำกับภาษี');
    expect(payload.lines.length).toBeGreaterThan(0);
    expect(payload.totals.amount_text_th).toContain('บาท');
  });

  it('preserves negative invoice charge lines', async () => {
    const db = makeDb({
      invoice_id: 7,
      invoice_number: 'INV-7',
      receipt_number: 'RCPT-7',
      document_type: 'invoice',
      customer_name: 'ABC',
      customer_tax_id: '0100000000000',
      customer_address: 'Bangkok',
      grand_total: 963,
      vat_amount: 63,
      total_amount: 900,
      notes: JSON.stringify({
        charges: [
          { description: 'DEPOT SERVICE', quantity: 1, unit_price: 1000, subtotal: 1000 },
          { description: 'DEPOT REFUND', quantity: 1, unit_price: -100, subtotal: -100 }
        ]
      })
    });
    const payload = await buildContinuousPrintPayload(db as never, { invoiceId: 7, type: 'receipt' });
    expect(payload.lines.map(line => line.description)).toContain('DEPOT REFUND');
    expect(payload.lines.find(line => line.description === 'DEPOT REFUND')?.amount).toBe(-100);
  });
});
```

- [ ] **Step 2: Run payload tests and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-payload.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because `billingContinuousPrint.ts` does not exist.

- [ ] **Step 3: Implement payload helper**

Create `src/lib/billingContinuousPrint.ts` with:

```ts
import sql from 'mssql';
import { amountToThaiBahtText } from './thaiBahtText';

type DbPool = { request: () => { input: (...args: unknown[]) => unknown; query: (statement: string) => Promise<{ recordset: Record<string, unknown>[] }> } };

export type ContinuousPrintLine = {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
  container_refs?: string;
  job_refs?: string;
};

export type ContinuousPrintPayload = {
  company: Record<string, unknown>;
  customer: Record<string, unknown>;
  document: Record<string, unknown>;
  lines: ContinuousPrintLine[];
  totals: { subtotal: number; vat_rate: number; vat_amount: number; grand_total: number; amount_text_th: string };
  payment: Record<string, unknown>;
};

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLines(row: Record<string, unknown>): ContinuousPrintLine[] {
  try {
    const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : null;
    if (Array.isArray(notes?.charges)) {
      return notes.charges.map((charge: Record<string, unknown>) => ({
        description: String(charge.description || row.description || 'Service charge'),
        qty: numberValue(charge.quantity ?? charge.qty ?? 1),
        unit_price: numberValue(charge.unit_price),
        amount: numberValue(charge.subtotal ?? charge.amount),
        container_refs: row.container_number ? String(row.container_number) : undefined,
      }));
    }
  } catch {
    return [];
  }
  return [{
    description: String(row.description || row.charge_type || 'Service charge'),
    qty: numberValue(row.quantity || 1),
    unit_price: numberValue(row.unit_price),
    amount: numberValue(row.total_amount || row.grand_total),
    container_refs: row.container_number ? String(row.container_number) : undefined,
  }];
}

export function buildSampleContinuousPrintPayload(): ContinuousPrintPayload {
  const subtotal = 900;
  const vat_amount = 63;
  const grand_total = 963;
  return {
    company: { name_th: 'บริษัท ตัวอย่าง ดีโป้ จำกัด', name_en: 'Sample Depot Co., Ltd.', tax_id: '0105559999999', branch_code: '00000' },
    customer: { customer_name: 'ABC Logistics Co., Ltd.', billing_address: 'Bangkok', tax_id: '0100000000000', branch_code: '00000' },
    document: { invoice_id: 1, invoice_number: 'INV-202605-000001', receipt_number: 'RCPT-202605-000001', document_date: '2026-05-26', document_title: 'ใบกำกับภาษี/ใบเสร็จรับเงิน', copy_label: 'ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน' },
    lines: [{ description: 'DEPOT SERVICE', qty: 1, unit_price: 1000, amount: 1000 }, { description: 'DEPOT REFUND', qty: 1, unit_price: -100, amount: -100 }],
    totals: { subtotal, vat_rate: 0.07, vat_amount, grand_total, amount_text_th: amountToThaiBahtText(grand_total) },
    payment: { payment_method: 'transfer', payment_ref: 'BANK-REF-001', collector_name: 'CYMS' },
  };
}

export async function buildContinuousPrintPayload(db: DbPool, options: { invoiceId: number; type: string }): Promise<ContinuousPrintPayload> {
  const result = await db.request()
    .input('invoiceId', sql.Int, options.invoiceId)
    .query(`
      SELECT TOP 1 i.*, c.customer_name, c.tax_id as customer_tax_id,
        COALESCE(c.billing_address, c.address) as customer_address,
        ISNULL(c.branch_number, '00000') as customer_branch_number,
        ct.container_number, y.yard_name, y.yard_code
      FROM Invoices i
      LEFT JOIN Customers c ON c.customer_id = i.customer_id
      LEFT JOIN Containers ct ON ct.container_id = i.container_id
      LEFT JOIN Yards y ON y.yard_id = i.yard_id
      WHERE i.invoice_id = @invoiceId
    `);
  const row = result.recordset[0];
  if (!row) throw new Error('Invoice not found');
  const lines = parseLines(row);
  const subtotal = numberValue(row.total_amount || lines.reduce((sum, line) => sum + line.amount, 0));
  const vat_amount = numberValue(row.vat_amount);
  const grand_total = numberValue(row.grand_total);
  return {
    company: { name_th: 'CYMS', name_en: 'Container Yard Management System' },
    customer: { customer_name: row.customer_name, billing_address: row.customer_address, tax_id: row.customer_tax_id, branch_code: row.customer_branch_number },
    document: { invoice_id: row.invoice_id, invoice_number: row.invoice_number, receipt_number: row.receipt_number, tax_invoice_number: row.invoice_number, document_date: row.paid_at || row.created_at, document_title: options.type === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบกำกับภาษี/ใบเสร็จรับเงิน' },
    lines,
    totals: { subtotal, vat_rate: 0.07, vat_amount, grand_total, amount_text_th: amountToThaiBahtText(grand_total) },
    payment: { payment_method: 'transfer', payment_ref: row.receipt_number || row.invoice_number, collector_name: '' },
  };
}
```

- [ ] **Step 4: Run payload tests**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-payload.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billingContinuousPrint.ts src/app/api/__tests__/continuous-print-payload.test.ts
git commit -m "Add continuous billing print payload builder"
```

---

### Task 5: Add Print Log Helper

**Files:**
- Create: `src/lib/documentPrintLog.ts`
- Create: `src/app/api/__tests__/document-print-log.test.ts`

- [ ] **Step 1: Write print log tests**

Create `src/app/api/__tests__/document-print-log.test.ts`:

```ts
import { buildReprintLabel, calculatePrintState } from '@/lib/documentPrintLog';

describe('document print log helper', () => {
  it('marks first print as original', () => {
    expect(calculatePrintState(0)).toEqual({ print_no: 1, is_reprint: false, reprint_count: 0 });
  });

  it('marks second print as first reprint', () => {
    expect(calculatePrintState(1)).toEqual({ print_no: 2, is_reprint: true, reprint_count: 1 });
  });

  it('renders reprint label from template', () => {
    expect(buildReprintLabel('พิมพ์ซ้ำครั้งที่ {reprint_count}', 2)).toBe('พิมพ์ซ้ำครั้งที่ 2');
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/document-print-log.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement helper**

Create `src/lib/documentPrintLog.ts`:

```ts
export function calculatePrintState(existingPrintCount: number) {
  const safeCount = Math.max(Number(existingPrintCount || 0), 0);
  const print_no = safeCount + 1;
  const is_reprint = print_no > 1;
  const reprint_count = Math.max(print_no - 1, 0);
  return { print_no, is_reprint, reprint_count };
}

export function buildReprintLabel(template: string, reprintCount: number) {
  return template.replace('{reprint_count}', String(reprintCount));
}
```

Then extend the same file with DB helpers:

```ts
export async function countDocumentPrints(db: { request: () => any }, documentType: string, documentId: number) {
  const result = await db.request()
    .input('documentType', documentType)
    .input('documentId', documentId)
    .query(`
      SELECT COUNT(1) as print_count
      FROM DocumentPrintLogs
      WHERE document_type = @documentType AND document_id = @documentId
    `);
  return Number(result.recordset[0]?.print_count || 0);
}
```

- [ ] **Step 4: Run print log tests**

Run:

```bash
npm test -- src/app/api/__tests__/document-print-log.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentPrintLog.ts src/app/api/__tests__/document-print-log.test.ts
git commit -m "Add document print log helper"
```

---

### Task 6: Add Document Template APIs

**Files:**
- Create API route files under `src/app/api/document-templates`
- Create: `src/app/api/__tests__/document-template-api.test.ts`
- Modify: `src/lib/documentTemplates.ts`

- [ ] **Step 1: Write API tests**

Create `src/app/api/__tests__/document-template-api.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({ requirePermission: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM DocumentTemplates')) return Promise.resolve({ recordset: [] });
    if (statement.includes('INSERT INTO DocumentTemplates')) return Promise.resolve({ recordset: [{ template_id: 1, template_code: 'continuous_tax_invoice_receipt' }] });
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockReturnThis();
  return { request: jest.fn(() => ({ input, query })), queries, input, query };
}

describe('document template API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockResolvedValue({ userId: 1, role: 'yard_manager' });
  });

  it('lists templates with settings permission', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    const route = require('../document-templates/route') as typeof import('../document-templates/route');
    const res = await route.GET(new NextRequest('http://localhost/api/document-templates'));
    expect(res.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(expect.anything(), db, 'settings.manage', expect.any(String));
    expect(db.queries.join('\n')).toContain('DocumentTemplates');
  });
});
```

- [ ] **Step 2: Run API tests and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-api.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement `GET/POST /api/document-templates`**

Create `src/app/api/document-templates/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';
import { buildDefaultContinuousTemplateConfig, validateTemplateConfig } from '@/lib/documentTemplates';

export async function GET(request: NextRequest) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ดู Document Templates');
  if (actor instanceof NextResponse) return actor;
  const result = await db.request().query(`
    SELECT t.*, v.version_id, v.status as version_status, v.mode, v.copy_mode, v.paper_size_code
    FROM DocumentTemplates t
    OUTER APPLY (
      SELECT TOP 1 *
      FROM DocumentTemplateVersions v
      WHERE v.template_id = t.template_id AND v.version_no = t.current_version_no
      ORDER BY v.version_id DESC
    ) v
    ORDER BY t.document_type, t.template_name
  `);
  return NextResponse.json({ templates: result.recordset });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const db = await getDb();
  const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์สร้าง Document Template');
  if (actor instanceof NextResponse) return actor;
  const config = body.config || buildDefaultContinuousTemplateConfig();
  const validation = validateTemplateConfig(config);
  if (!validation.valid) return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
  const result = await db.request()
    .input('templateCode', sql.NVarChar(80), String(body.template_code || 'continuous_tax_invoice_receipt'))
    .input('templateName', sql.NVarChar(200), String(body.template_name || 'Continuous Tax Invoice / Receipt'))
    .input('documentType', sql.NVarChar(50), String(body.document_type || 'tax_invoice_receipt'))
    .input('description', sql.NVarChar(500), body.description || null)
    .input('configJson', sql.NVarChar(sql.MAX), JSON.stringify(config))
    .input('createdBy', sql.Int, actor.userId)
    .query(`
      INSERT INTO DocumentTemplates (template_code, template_name, document_type, description, status, is_default, current_version_no, created_by)
      OUTPUT INSERTED.*
      VALUES (@templateCode, @templateName, @documentType, @description, 'draft', 0, 1, @createdBy);

      INSERT INTO DocumentTemplateVersions (template_id, template_code, version_no, status, paper_width_mm, paper_height_mm, paper_size_code, mode, copy_mode, config_json, created_by)
      SELECT template_id, template_code, 1, 'draft', 241.3, 139.7, 'continuous_9_5x5_5', 'full', 'carbonless', @configJson, @createdBy
      FROM DocumentTemplates
      WHERE template_code = @templateCode;
    `);
  await logAudit({ userId: actor.userId, action: 'document_template_create', entityType: 'document_template', entityId: result.recordset[0]?.template_id, details: { template_code: body.template_code } });
  return NextResponse.json({ success: true, template: result.recordset[0] });
}
```

- [ ] **Step 4: Add publish/default/deactivate routes**

Implement route files with `requirePermission(request, db, 'settings.manage', ...)`, parameterized SQL, and `logAudit`.

Use these actions:

- Publish: set version `status = 'published'`, template `status = 'active'`, `current_version_no = @versionNo`.
- Set default: clear `is_default` for same `document_type`, then set selected template default.
- Deactivate: set template `status = 'inactive'`, `is_default = 0`.

- [ ] **Step 5: Run API tests**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-api.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/document-templates src/lib/documentTemplates.ts src/app/api/__tests__/document-template-api.test.ts
git commit -m "Add document template APIs"
```

---

### Task 7: Add Continuous Print Page And Renderer

**Files:**
- Create: `src/components/billing/ContinuousTaxReceipt.tsx`
- Create: `src/app/billing/print/continuous/page.tsx`
- Create: `src/app/api/__tests__/continuous-print-ui.test.ts`

- [ ] **Step 1: Write static UI tests**

Create `src/app/api/__tests__/continuous-print-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('continuous print UI', () => {
  it('adds a continuous print page and component', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/billing/print/continuous/page.tsx'), 'utf8');
    const component = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/ContinuousTaxReceipt.tsx'), 'utf8');
    expect(page).toContain('/api/document-templates/preview');
    expect(component).toContain('ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน');
    expect(component).toContain('copyMode');
    expect(component).toContain('mode');
  });
});
```

- [ ] **Step 2: Run UI test and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because page/component do not exist.

- [ ] **Step 3: Implement renderer component**

Create `src/components/billing/ContinuousTaxReceipt.tsx` with props:

```ts
import type { ContinuousPrintPayload } from '@/lib/billingContinuousPrint';
import type { DocumentTemplateConfig, DocumentTemplateCopyMode, DocumentTemplateMode } from '@/lib/documentTemplateTypes';

type Props = {
  payload: ContinuousPrintPayload;
  config: DocumentTemplateConfig;
  mode: DocumentTemplateMode;
  copyMode: DocumentTemplateCopyMode;
  copyIndex?: number;
  reprintLabel?: string | null;
  testPrint?: boolean;
};
```

Render rules:

- One page when `copyMode === 'carbonless'`.
- Five pages when `copyMode === 'separate'` and no `copyIndex`.
- One specific page when `copyIndex` is supplied.
- In `full` mode, render borders, labels, table, payment section, totals, footer.
- In `overlay` mode, render positioned data fields only.
- In `testPrint`, render calibration marks and grid.

- [ ] **Step 4: Implement print page**

Create `src/app/billing/print/continuous/page.tsx` as a client page that:

- Reads `id`, `type`, `mode`, `copyMode`, `copyIndex`, `preview`, and `testPrint` from `useSearchParams()`.
- Calls `/api/document-templates/preview` for preview payload/config.
- Renders `ContinuousTaxReceipt`.
- Provides print button using `window.print()`.

- [ ] **Step 5: Run UI test**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/billing/ContinuousTaxReceipt.tsx src/app/billing/print/continuous/page.tsx src/app/api/__tests__/continuous-print-ui.test.ts
git commit -m "Add continuous tax receipt print page"
```

---

### Task 8: Add Document Templates Settings UI

**Files:**
- Create: `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Create or extend: `src/app/api/__tests__/continuous-print-ui.test.ts`

- [ ] **Step 1: Add static settings UI test**

Extend `src/app/api/__tests__/continuous-print-ui.test.ts`:

```ts
it('adds Document Templates to settings navigation', () => {
  const settingsPage = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/page.tsx'), 'utf8');
  expect(settingsPage).toContain('Document Templates');
  expect(settingsPage).toContain('DocumentTemplateManager');
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because settings UI is not wired yet.

- [ ] **Step 3: Create settings component**

Create `DocumentTemplateManager.tsx` with:

- Template list table.
- Preview iframe/link button to `/billing/print/continuous?preview=sample`.
- Real document preview input for invoice id.
- Test print button with `testPrint=1`.
- Settings fields for paper size, mode, copy mode, offsets, reprint label, red ref source.
- Buttons for duplicate, publish, set default, deactivate, export/import.

Use restrained app UI:

- No hero section.
- Dense table/list on the left.
- Preview/actions in the main workspace.
- Inspector settings in compact grouped sections.

- [ ] **Step 4: Wire settings tab**

In `src/app/(dashboard)/settings/page.tsx`:

- Import `DocumentTemplateManager`.
- Add tab id `document-templates`.
- Add render branch:

```tsx
{effectiveTab === 'document-templates' && <DocumentTemplateManager />}
```

- [ ] **Step 5: Run UI test**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/settings/DocumentTemplateManager.tsx src/app/(dashboard)/settings/page.tsx src/app/api/__tests__/continuous-print-ui.test.ts
git commit -m "Add document template settings UI"
```

---

### Task 9: Wire Billing And Gate Print Actions

**Files:**
- Modify: `src/app/(dashboard)/billing/page.tsx`
- Modify: `src/app/(dashboard)/billing/BillingClearanceTab.tsx`
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`
- Extend: `src/app/api/__tests__/continuous-print-ui.test.ts`

- [ ] **Step 1: Add static action tests**

Extend `continuous-print-ui.test.ts`:

```ts
it('adds continuous print actions to billing and gate surfaces', () => {
  const billingPage = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/billing/page.tsx'), 'utf8');
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
  expect(billingPage).toContain('/billing/print/continuous?id=');
  expect(gateIn).toContain('/billing/print/continuous?id=');
  expect(gateOut).toContain('/billing/print/continuous?id=');
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL until buttons are added.

- [ ] **Step 3: Add Billing actions**

In billing invoice rows and receipt section, keep existing A4 button and add:

```tsx
<button
  onClick={() => window.open(`/billing/print/continuous?id=${inv.invoice_id}&type=${inv.status === 'paid' ? 'receipt' : 'tax_invoice_receipt'}`, '_blank')}
  className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 flex items-center gap-1"
>
  <Printer size={10} /> ฟอร์มต่อเนื่อง
</button>
```

- [ ] **Step 4: Add Gate In/Gate Out actions**

Where Gate In/Gate Out already open `/billing/print?id=...`, add sibling buttons that open:

```ts
`/billing/print/continuous?id=${invoiceId}&type=receipt`
```

Use `tax_invoice_receipt` if the transaction is not fully paid and is invoice-only.

- [ ] **Step 5: Run UI test**

Run:

```bash
npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/billing/page.tsx src/app/(dashboard)/billing/BillingClearanceTab.tsx src/app/(dashboard)/gate/GateInTab.tsx src/app/(dashboard)/gate/GateOutTab.tsx src/app/api/__tests__/continuous-print-ui.test.ts
git commit -m "Wire continuous print actions"
```

---

### Task 10: Add Preview/Test Print Backend Behavior

**Files:**
- Modify: `src/app/api/document-templates/preview/route.ts`
- Modify: `src/app/api/document-templates/test-print/route.ts`
- Modify: `src/lib/documentPrintLog.ts`
- Extend: `src/app/api/__tests__/document-template-api.test.ts`

- [ ] **Step 1: Add tests that preview/test print do not consume numbers**

Extend `document-template-api.test.ts`:

```ts
jest.mock('@/lib/documentNumber', () => ({
  nextDocumentNumber: jest.fn(),
}));

it('does not consume document numbers for preview', async () => {
  const { nextDocumentNumber } = require('@/lib/documentNumber');
  const route = require('../document-templates/preview/route') as typeof import('../document-templates/preview/route');
  mockedGetDb.mockResolvedValue(makeDb());
  const res = await route.POST(new NextRequest('http://localhost/api/document-templates/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preview: 'sample' }),
  }));
  expect(res.status).toBe(200);
  expect(nextDocumentNumber).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run API test and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-api.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL until preview route exists.

- [ ] **Step 3: Implement preview route**

`POST /api/document-templates/preview`:

- Require `settings.manage` for settings preview or billing permission for document preview.
- If `preview === 'sample'`, return `buildSampleContinuousPrintPayload()`.
- If `invoice_id` is present, return `buildContinuousPrintPayload(db, { invoiceId, type })`.
- Return template config from requested/default template.
- Do not call `nextDocumentNumber()`.
- Audit action `document_template_preview`.

- [ ] **Step 4: Implement test print route**

`POST /api/document-templates/test-print`:

- Require settings permission.
- Return sample payload, template config, and `testPrint: true`.
- Audit action `document_template_test_print`.
- Do not insert `DocumentPrintLogs`.
- Do not call `nextDocumentNumber()`.

- [ ] **Step 5: Run API tests**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-api.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/document-templates/preview/route.ts src/app/api/document-templates/test-print/route.ts src/lib/documentPrintLog.ts src/app/api/__tests__/document-template-api.test.ts
git commit -m "Add document template preview and test print APIs"
```

---

### Task 11: Add Real Print And Reprint Logging

**Files:**
- Modify: `src/lib/documentPrintLog.ts`
- Modify: `src/app/billing/print/continuous/page.tsx`
- Create: `src/app/api/document-templates/print-log/route.ts`
- Extend: `src/app/api/__tests__/document-print-log.test.ts`

- [ ] **Step 1: Add tests for reprint reason and label**

Extend `document-print-log.test.ts`:

```ts
import { validateReprintReason } from '@/lib/documentPrintLog';

it('requires reprint reason when setting is enabled and print is a reprint', () => {
  expect(validateReprintReason({ requireReason: true, isReprint: true, reason: '' })).toEqual({
    valid: false,
    error: 'reprint reason is required',
  });
  expect(validateReprintReason({ requireReason: true, isReprint: true, reason: 'customer requested' }).valid).toBe(true);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- src/app/api/__tests__/document-print-log.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL until validation function exists.

- [ ] **Step 3: Implement validation and DB write helper**

In `documentPrintLog.ts`, add:

```ts
export function validateReprintReason(options: { requireReason: boolean; isReprint: boolean; reason?: string | null }) {
  if (options.requireReason && options.isReprint && !String(options.reason || '').trim()) {
    return { valid: false, error: 'reprint reason is required' };
  }
  return { valid: true, error: null };
}
```

Add `recordDocumentPrint()` that:

- Counts previous prints.
- Calculates print state.
- Validates reprint reason.
- Inserts `DocumentPrintLogs`.
- Inserts `DocumentPrintSnapshots`.
- Returns `print_no`, `reprint_count`, and optional label.

- [ ] **Step 4: Wire real print logging to continuous page flow**

Use a dedicated API route:

- `POST /api/document-templates/print-log`

Request body:

```json
{
  "document_type": "tax_invoice_receipt",
  "document_id": 77,
  "document_no": "RCPT-202605-000001",
  "template_code": "continuous_tax_invoice_receipt",
  "template_version": 1,
  "reprint_reason": "customer requested",
  "manual_preprinted_form_no": "025564",
  "snapshot": {}
}
```

- [ ] **Step 5: Run print log tests**

Run:

```bash
npm test -- src/app/api/__tests__/document-print-log.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentPrintLog.ts src/app/api/document-templates/print-log/route.ts src/app/billing/print/continuous/page.tsx src/app/api/__tests__/document-print-log.test.ts
git commit -m "Add continuous print reprint logging"
```

---

### Task 12: Update Handoff And Run Full Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add a section under Billing / Documents:

```md
- [x] Document Template Manager Phase 1 — structured template manager for continuous tax invoice / receipt, default 9.5in x 5.5in template, full/overlay mode, carbonless/separate 5-copy behavior, preview, test print, calibration settings, print logs, snapshots, and reprint labels. Existing A4 print and DocumentSequences remain the source of truth for document numbers.
```

Add route/API notes:

```md
| GET/POST | `/api/document-templates` | Manage print templates and versions |
| POST | `/api/document-templates/preview` | Preview sample or real document without consuming numbers |
| POST | `/api/document-templates/test-print` | Calibration/test print without consuming numbers |
| POST | `/api/document-templates/print-log` | Record real print/reprint and snapshot |
| PAGE | `/billing/print/continuous` | Continuous tax invoice / receipt print page |
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/app/api/__tests__/document-template-schema.test.ts src/app/api/__tests__/thai-baht-text.test.ts src/app/api/__tests__/document-template-helpers.test.ts src/app/api/__tests__/continuous-print-payload.test.ts src/app/api/__tests__/document-print-log.test.ts src/app/api/__tests__/document-template-api.test.ts src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 3: Run type check**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: exit code 0.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Document continuous print template rollout"
```

---

## Execution Notes

- Start from a clean working tree.
- Use one commit per task.
- If a file already has user changes, read it and work with those changes.
- If a test fails for unrelated reasons, capture the failure and do not hide it.
- After all tasks pass, push only when the user asks or the execution mode includes push.

## Final Verification Commands

Run before claiming completion:

```bash
npm test -- src/app/api/__tests__/document-template-schema.test.ts src/app/api/__tests__/thai-baht-text.test.ts src/app/api/__tests__/document-template-helpers.test.ts src/app/api/__tests__/continuous-print-payload.test.ts src/app/api/__tests__/document-print-log.test.ts src/app/api/__tests__/document-template-api.test.ts src/app/api/__tests__/continuous-print-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
npx tsc --noEmit --pretty false
npm run lint
```
