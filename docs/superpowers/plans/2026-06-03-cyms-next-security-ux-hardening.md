# CYMS Next Security UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the next practical hardening wave: move `documents/activity` to resolver-first access, remove the remaining native browser prompt/confirm dialogs, and extract the new Gate print-return draft behavior into a shared maintainable unit without changing business behavior.

**Execution status (2026-06-03):** Completed on branch `codex/cyms-next-security-ux-hardening`.

Completed slices:

- P0: `/api/documents/activity` resolver-first access via `src/lib/documentActivityAccess.ts`
- P1: native prompt/confirm cleanup via custom action dialogs
- P2: shared Gate print-return draft helper

Verified with focused Jest `7 suites / 92 tests`, `npx tsc --noEmit`, `npm run lint`, and full Jest `147 suites / 1520 tests`.

**Architecture:** Keep the existing Next.js API route, `apiAuth`, `entityAccessResolver`, and Jest patterns. Add one small document-activity access helper that resolves document numbers to a concrete entity scope before lifecycle queries. Replace native prompts with reusable React dialogs at the call sites that still use `window.prompt` or `window.confirm`, then extract only the duplicated Gate print-return draft logic that was recently stabilized.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, MS SQL via `mssql`, existing `requireAnyPermission` / `requireYardAccess` helpers, Jest, ESLint.

---

## Scope And Order

Execute as three independently shippable slices:

1. **P0 Document activity resolver-first access**: highest security value because the route currently queries `DocumentLifecycle` before deriving yard access when `yard_id` is omitted.
2. **P1 Replace remaining native prompt/confirm dialogs**: removes UX inconsistency and prevents blocked browser dialogs from breaking workflow state.
3. **P2 Extract Gate print-return draft helper**: reduces duplication after the Gate In/Gate Out print-state fix, with no UI behavior change.

Out of scope for this wave:

- Cookie-first auth token migration.
- Driver/Trucking Portal UI.
- Large page decomposition beyond the shared Gate print-return helper.
- New database schema or runtime DDL.

---

## Current Evidence

`DEVELOPER_HANDOFF.md` currently says `documents/activity` has not moved to the resolver yet because receipt/credit note lifecycle normalization needed care.

Code confirms:

- `src/app/api/documents/activity/route.ts` infers document type by prefix, queries `DocumentLifecycle`, then checks derived yard access after the query when `yard_id` is omitted.
- `src/lib/entityAccessResolver.ts` already supports `invoice`, `statement`, `billing_statement`, `gate_transaction`, `eir`, `repair_order`, `eor`, `reefer_check`, and `reefer_exception`.
- Remaining native dialogs still exist:
  - `src/app/(dashboard)/settings/PortalAccessControl.tsx`
  - `src/app/(dashboard)/gate/GateInTab.tsx`
  - `src/app/(dashboard)/gate/GateOutTab.tsx`
  - `src/app/(dashboard)/billing/page.tsx`
  - `src/app/(dashboard)/billing/PaymentReconciliationTab.tsx`
  - `src/app/billing/print/continuous/page.tsx`
  - `src/app/(dashboard)/reefer/page.tsx`
  - `src/app/(dashboard)/edi/page.tsx`
- `DEVELOPER_HANDOFF.md` still claims all `window.confirm()` points were removed, so the handoff must be corrected after implementation.

---

## File Map

### Document Activity Access

- Create `src/lib/documentActivityAccess.ts`
  - Normalize document types and aliases.
  - Resolve document number/id to an entity type supported by `entityAccessResolver`.
  - Require yard access before querying lifecycle rows when possible.
  - Preserve receipt and credit-note lifecycle compatibility.
- Modify `src/app/api/documents/activity/route.ts`
  - Use `documentActivityAccess.ts`.
  - Keep response shape unchanged.
  - Keep SQL parameterized.
- Modify `src/lib/documentLifecycle.ts`
  - Export the canonical `DocumentType` union if needed.
- Add `src/lib/__tests__/documentActivityAccess.test.ts`
  - Unit tests for type normalization and resolver target mapping.
- Modify `src/app/api/__tests__/derived-yard-access.test.ts`
  - Change expectations from post-query yard access to resolver-first yard access.
- Add `src/app/api/__tests__/documents-activity-access.test.ts`
  - Route tests for invoice, EIR, receipt, credit note, unsupported type, and no broad lifecycle query after denied access.
- Modify `src/app/api/__tests__/api-auth-coverage.test.ts` or add a focused source test
  - Assert `documents/activity` calls resolver before querying `DocumentLifecycle`.

### Dialog Cleanup

- Create `src/components/ui/ActionConfirmDialog.tsx`
  - Generic confirm modal for destructive or repair actions.
- Create `src/components/ui/ActionInputDialog.tsx`
  - Generic single/multi input modal for reason, note, amount, and reference flows.
- Add `src/components/ui/__tests__/action-dialogs.test.tsx` if existing Jest/React setup supports it; otherwise add static coverage in `src/app/api/__tests__/ui-native-dialog-coverage.test.ts`.
- Modify:
  - `src/app/(dashboard)/settings/PortalAccessControl.tsx`
  - `src/app/(dashboard)/gate/GateInTab.tsx`
  - `src/app/(dashboard)/gate/GateOutTab.tsx`
  - `src/app/(dashboard)/billing/page.tsx`
  - `src/app/(dashboard)/billing/PaymentReconciliationTab.tsx`
  - `src/app/billing/print/continuous/page.tsx`
  - `src/app/(dashboard)/reefer/page.tsx`
  - `src/app/(dashboard)/edi/page.tsx`
- Update existing tests that currently expect `window.confirm`.

### Gate Print Draft Extraction

- Create `src/app/(dashboard)/gate/hooks/useGatePrintReturnDraft.ts`
  - Shared localStorage draft persist/restore helper.
  - Namespaced by `gate_in` or `gate_out`.
  - TTL-safe and parse-safe.
- Modify:
  - `src/app/(dashboard)/gate/GateInTab.tsx`
  - `src/app/(dashboard)/gate/GateOutTab.tsx`
  - `src/app/api/__tests__/continuous-print-ui.test.ts`
  - `src/app/api/__tests__/gate-in-workstation-ui.test.ts`
- Keep current Gate UI behavior unchanged.

### Docs And Verification

- Modify `DEVELOPER_HANDOFF.md`
  - Update `documents/activity` resolver status.
  - Correct native dialog Known Issue status.
  - Record Gate print-return helper extraction.
- Run focused tests, then `npm run lint`, `npx tsc --noEmit`, and full Jest if time permits.

---

## Task 1: Characterize Document Activity Access

**Files:**

- Create `src/app/api/__tests__/documents-activity-access.test.ts`
- Modify `src/app/api/__tests__/derived-yard-access.test.ts`

- [ ] **Step 1: Write a failing test that denied derived yard access blocks before lifecycle activity query**

Create `src/app/api/__tests__/documents-activity-access.test.ts`:

```ts
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

function makeRequest(url: string, role = 'operations_viewer') {
  return new NextRequest(url, {
    headers: {
      'x-user-id': '17',
      'x-user-role': role,
    },
  });
}

function makeDb({ allowYardAccess = true } = {}) {
  const statements: string[] = [];
  const inputsByQuery: Array<Record<string, unknown>> = [];
  const db = {
    statements,
    inputsByQuery,
    request: jest.fn(() => {
      const inputs: Record<string, unknown> = {};
      const request = {
        input: jest.fn((name: string, _type: unknown, value: unknown) => {
          inputs[name] = value;
          return request;
        }),
        query: jest.fn(async (statement: string) => {
          statements.push(statement);
          inputsByQuery.push({ ...inputs });
          if (statement.includes('FROM Roles r')) return { recordset: [{ granted: 1 }] };
          if (statement.includes('FROM UserYardAccess')) return { recordset: allowYardAccess ? [{ allowed: 1 }] : [] };
          if (statement.includes('FROM Invoices')) {
            return { recordset: [{ entity_id: 10, entity_ref: 'INV-001', yard_id: 5, customer_id: 20 }] };
          }
          if (statement.includes('FROM DocumentLifecycle dl')) {
            return { recordset: [{ lifecycle_id: 1, document_type: 'invoice', document_id: 10, document_number: 'INV-001', yard_id: 5 }] };
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
  beforeEach(() => jest.clearAllMocks());

  it('denies an invoice activity request before querying DocumentLifecycle when yard access is denied', async () => {
    const db = makeDb({ allowYardAccess: false });
    mockedGetDb.mockResolvedValue(db);

    const response = await route.GET(makeRequest('http://localhost/api/documents/activity?document_number=INV-001'));

    expect(response.status).toBe(403);
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
    expect(db.statements.find(statement => statement.includes('FROM DocumentLifecycle dl'))).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/documents-activity-access.test.ts
```

Expected before implementation: the denial test fails because `DocumentLifecycle` is queried before derived yard access.

- [ ] **Step 3: Update existing derived-yard access expectations**

In `src/app/api/__tests__/derived-yard-access.test.ts`, replace the current document activity post-query expectation with resolver-first expectations:

```ts
expect(db.statements.find(statement => statement.includes('FROM Invoices'))).toBeTruthy();
expect(db.statements.some(statement => statement.includes('FROM DocumentLifecycle dl'))).toBe(false);
expect(db.yardAccessChecks).toEqual([5]);
```

Keep entity timeline tests unchanged because they already resolve entity scope before timeline query.

- [ ] **Step 4: Run the derived-yard test and confirm the old behavior is captured**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/derived-yard-access.test.ts
```

Expected before implementation: the adjusted document activity test fails until the route uses the resolver-first helper.

---

## Task 2: Add Document Activity Resolver Helper

**Files:**

- Create `src/lib/documentActivityAccess.ts`
- Create `src/lib/__tests__/documentActivityAccess.test.ts`
- Modify `src/lib/entityAccessResolver.ts` only if a missing entity mapping is required.

- [ ] **Step 1: Add unit tests for document type normalization**

Create `src/lib/__tests__/documentActivityAccess.test.ts`:

```ts
import {
  inferDocumentActivityType,
  normalizeDocumentActivityType,
  resolveDocumentActivityEntityLocator,
} from '../documentActivityAccess';

describe('document activity access helper', () => {
  it.each([
    ['INV-001', 'invoice'],
    ['RCP-001', 'receipt'],
    ['REC-001', 'receipt'],
    ['CN-001', 'credit_note'],
    ['EIR-001', 'eir'],
  ])('infers %s as %s', (documentNumber, expected) => {
    expect(inferDocumentActivityType(documentNumber)).toBe(expected);
  });

  it.each([
    ['invoice', 'invoice'],
    ['receipt', 'receipt'],
    ['tax_receipt', 'receipt'],
    ['credit_note', 'credit_note'],
    ['credit-note', 'credit_note'],
    ['eir', 'eir'],
  ])('normalizes %s as %s', (input, expected) => {
    expect(normalizeDocumentActivityType(input)).toBe(expected);
  });

  it('maps invoice documents to invoice entity resolver locators', () => {
    expect(resolveDocumentActivityEntityLocator({
      documentType: 'invoice',
      documentId: 10,
      documentNumber: 'INV-001',
    })).toEqual({
      entityType: 'invoice',
      entityId: 10,
      entityRef: 'INV-001',
      lifecycleDocumentType: 'invoice',
    });
  });

  it('maps EIR documents to the EIR resolver locator', () => {
    expect(resolveDocumentActivityEntityLocator({
      documentType: 'eir',
      documentId: null,
      documentNumber: 'EIR-001',
    })).toEqual({
      entityType: 'eir',
      entityId: null,
      entityRef: 'EIR-001',
      lifecycleDocumentType: 'eir',
    });
  });

  it('keeps receipt and credit note lifecycle types but resolves their related invoice by document id or number', () => {
    expect(resolveDocumentActivityEntityLocator({
      documentType: 'receipt',
      documentId: 15,
      documentNumber: 'RCP-001',
    })).toMatchObject({
      entityType: 'invoice',
      lifecycleDocumentType: 'receipt',
    });

    expect(resolveDocumentActivityEntityLocator({
      documentType: 'credit_note',
      documentId: 16,
      documentNumber: 'CN-001',
    })).toMatchObject({
      entityType: 'invoice',
      lifecycleDocumentType: 'credit_note',
    });
  });
});
```

- [ ] **Step 2: Run the helper tests and confirm failure**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/lib/__tests__/documentActivityAccess.test.ts
```

Expected before implementation: module not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/documentActivityAccess.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import type { RequestActor } from '@/lib/apiAuth';
import {
  isEntityAccessResponse,
  requireResolvedEntityYardAccess,
  resolveEntityScope,
  type EntityDb,
  type EntityScope,
  type EntityType,
} from '@/lib/entityAccessResolver';

export type DocumentActivityType = 'invoice' | 'receipt' | 'credit_note' | 'eir';

export type DocumentActivityLocator = {
  entityType: EntityType;
  entityId: number | null;
  entityRef: string | null;
  lifecycleDocumentType: DocumentActivityType;
};

export function inferDocumentActivityType(documentNumber: string | null | undefined): DocumentActivityType | null {
  const value = documentNumber?.trim().toUpperCase() || '';
  if (value.startsWith('EIR')) return 'eir';
  if (value.startsWith('INV')) return 'invoice';
  if (value.startsWith('CN')) return 'credit_note';
  if (value.startsWith('REC') || value.startsWith('RCP')) return 'receipt';
  return null;
}

export function normalizeDocumentActivityType(value: string | null | undefined): DocumentActivityType | null {
  const normalized = value?.trim().toLowerCase().replace(/-/g, '_') || '';
  if (normalized === 'tax_receipt') return 'receipt';
  if (normalized === 'invoice' || normalized === 'receipt' || normalized === 'credit_note' || normalized === 'eir') {
    return normalized;
  }
  return null;
}

export function resolveDocumentActivityEntityLocator({
  documentType,
  documentId,
  documentNumber,
}: {
  documentType: DocumentActivityType;
  documentId: number | null;
  documentNumber: string | null;
}): DocumentActivityLocator {
  if (documentType === 'eir') {
    return {
      entityType: 'eir',
      entityId: documentId,
      entityRef: documentNumber,
      lifecycleDocumentType: 'eir',
    };
  }

  return {
    entityType: 'invoice',
    entityId: documentType === 'invoice' ? documentId : null,
    entityRef: documentType === 'invoice' ? documentNumber : null,
    lifecycleDocumentType: documentType,
  };
}

async function resolveReceiptOrCreditNoteInvoiceScope({
  db,
  documentType,
  documentId,
  documentNumber,
}: {
  db: EntityDb;
  documentType: 'receipt' | 'credit_note';
  documentId: number | null;
  documentNumber: string | null;
}): Promise<EntityScope | NextResponse> {
  const result = await db.request()
    .input('documentType', sql.NVarChar(30), documentType)
    .input('documentId', sql.Int, documentId)
    .input('documentNumber', sql.NVarChar(80), documentNumber)
    .query(`
      SELECT TOP 1
        COALESCE(related_document_id, document_id) AS invoice_id,
        COALESCE(related_document_number, document_number) AS invoice_number
      FROM DocumentLifecycle
      WHERE document_type = @documentType
        AND (
          (@documentId IS NOT NULL AND document_id = @documentId)
          OR (@documentNumber IS NOT NULL AND document_number = @documentNumber)
        )
      ORDER BY created_at DESC, lifecycle_id DESC
    `);

  const row = result.recordset[0] as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบรายการเอกสารที่ต้องการดู Activity Feed' }, { status: 404 });
  }

  return resolveEntityScope({
    db,
    entityType: 'invoice',
    entityId: Number(row.invoice_id) || null,
    entityRef: typeof row.invoice_number === 'string' ? row.invoice_number : null,
  });
}

export async function requireDocumentActivityAccess({
  request,
  db,
  actor,
  documentType,
  documentId,
  documentNumber,
}: {
  request: NextRequest;
  db: EntityDb;
  actor: RequestActor;
  documentType: DocumentActivityType;
  documentId: number | null;
  documentNumber: string | null;
}) {
  const locator = resolveDocumentActivityEntityLocator({ documentType, documentId, documentNumber });
  const scope = documentType === 'receipt' || documentType === 'credit_note'
    ? await resolveReceiptOrCreditNoteInvoiceScope({ db, documentType, documentId, documentNumber })
    : await resolveEntityScope({
      db,
      entityType: locator.entityType,
      entityId: locator.entityId,
      entityRef: locator.entityRef,
    });

  if (isEntityAccessResponse(scope)) return scope;

  const access = await requireResolvedEntityYardAccess({
    request,
    db,
    actor,
    scope,
    message: 'คุณไม่มีสิทธิ์ดู Activity Feed เอกสารของลานนี้',
  });
  if (access instanceof NextResponse) return access;

  return { scope, lifecycleDocumentType: locator.lifecycleDocumentType };
}
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/lib/__tests__/documentActivityAccess.test.ts
```

Expected: pass.

---

## Task 3: Refactor `/api/documents/activity`

**Files:**

- Modify `src/app/api/documents/activity/route.ts`
- Modify `src/app/api/__tests__/documents-activity-access.test.ts`
- Modify `src/app/api/__tests__/derived-yard-access.test.ts`

- [ ] **Step 1: Use the helper before querying lifecycle rows**

In `src/app/api/documents/activity/route.ts`, replace local `inferDocumentType` and post-query yard derivation with:

```ts
import {
  inferDocumentActivityType,
  normalizeDocumentActivityType,
  requireDocumentActivityAccess,
} from '@/lib/documentActivityAccess';
```

Then parse type as:

```ts
const requestedType = searchParams.get('document_type');
const documentType =
  normalizeDocumentActivityType(requestedType)
  || inferDocumentActivityType(documentNumber);
```

Add validation:

```ts
if (!documentType) {
  return NextResponse.json({ error: 'document_type นี้ยังไม่รองรับ Activity Feed' }, { status: 400 });
}
```

After `requireAnyPermission`:

```ts
const access = await requireDocumentActivityAccess({
  request,
  db,
  actor,
  documentType,
  documentId,
  documentNumber,
});
if (access instanceof NextResponse) return access;
```

Keep explicit `yard_id` check for callers that provide it:

```ts
if (yardId) {
  const yardAccess = await requireYardAccess(request, db, yardId);
  if (yardAccess instanceof NextResponse) return yardAccess;
}
```

Remove the post-query loop that derives yard IDs from `result.recordset`.

- [ ] **Step 2: Scope lifecycle query by canonical document type**

Keep the existing lifecycle query shape, but use the canonical `documentType` input:

```ts
.input('documentType', sql.VarChar(30), documentType)
```

Do not change the response object keys:

```ts
return NextResponse.json({
  document_type: documentType,
  document_id: documentId,
  document_number: documentNumber,
  events: formatDocumentActivity(result.recordset),
});
```

- [ ] **Step 3: Add receipt and credit note route tests**

Extend `src/app/api/__tests__/documents-activity-access.test.ts`:

```ts
it.each([
  ['receipt', 'RCP-001'],
  ['credit_note', 'CN-001'],
])('resolves %s activity through the related invoice before lifecycle query', async (documentType, documentNumber) => {
  const db = makeDb({ allowYardAccess: true });
  mockedGetDb.mockResolvedValue(db);

  const response = await route.GET(makeRequest(`http://localhost/api/documents/activity?document_type=${documentType}&document_number=${documentNumber}`));

  expect(response.status).toBe(200);
  expect(db.statements.find(statement => statement.includes('FROM DocumentLifecycle'))).toBeTruthy();
  expect(db.statements.find(statement => statement.includes('FROM Invoices'))).toBeTruthy();
});
```

Adjust the mock query handler so the first `DocumentLifecycle` query for receipt/credit-note related invoice returns:

```ts
{
  invoice_id: 10,
  invoice_number: 'INV-001',
}
```

- [ ] **Step 4: Run focused document activity tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/lib/__tests__/documentActivityAccess.test.ts src/app/api/__tests__/documents-activity-access.test.ts src/app/api/__tests__/derived-yard-access.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit P0**

Run:

```bash
git add src/lib/documentActivityAccess.ts src/lib/__tests__/documentActivityAccess.test.ts src/app/api/documents/activity/route.ts src/app/api/__tests__/documents-activity-access.test.ts src/app/api/__tests__/derived-yard-access.test.ts
git commit -m "Harden document activity access resolution"
```

---

## Task 4: Add Reusable Action Dialogs

**Files:**

- Create `src/components/ui/ActionConfirmDialog.tsx`
- Create `src/components/ui/ActionInputDialog.tsx`
- Create or modify `src/app/api/__tests__/ui-native-dialog-coverage.test.ts`

- [ ] **Step 1: Add source coverage for remaining native dialogs**

Create `src/app/api/__tests__/ui-native-dialog-coverage.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

const TARGETS = [
  'src/app/(dashboard)/settings/PortalAccessControl.tsx',
  'src/app/(dashboard)/gate/GateInTab.tsx',
  'src/app/(dashboard)/gate/GateOutTab.tsx',
  'src/app/(dashboard)/billing/page.tsx',
  'src/app/(dashboard)/billing/PaymentReconciliationTab.tsx',
  'src/app/billing/print/continuous/page.tsx',
  'src/app/(dashboard)/reefer/page.tsx',
  'src/app/(dashboard)/edi/page.tsx',
];

describe('native browser dialog cleanup', () => {
  it.each(TARGETS)('%s does not use native prompt/confirm dialogs', relativePath => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

    expect(source).not.toContain('window.prompt');
    expect(source).not.toContain('window.confirm');
  });
});
```

- [ ] **Step 2: Run the source coverage and confirm failure**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/ui-native-dialog-coverage.test.ts
```

Expected before implementation: failure on the current files that still contain native dialogs.

- [ ] **Step 3: Implement `ActionConfirmDialog`**

Create `src/components/ui/ActionConfirmDialog.tsx`:

```tsx
'use client';

import { AlertTriangle, X } from 'lucide-react';

type ActionConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ActionConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ActionConfirmDialogProps) {
  if (!open) return null;

  const confirmClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : tone === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700'
      : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div className="rounded-md bg-amber-50 p-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2 p-4">
          <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={`rounded-md px-3 py-2 text-sm font-medium text-white ${confirmClass} disabled:opacity-60`} onClick={onConfirm} disabled={loading}>
            {loading ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `ActionInputDialog`**

Create `src/components/ui/ActionInputDialog.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

export type ActionInputField = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea';
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
};

type ActionInputDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  fields: ActionInputField[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
};

export function ActionInputDialog({
  open,
  title,
  description,
  fields,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  loading = false,
  onSubmit,
  onCancel,
}: ActionInputDialogProps) {
  const initialValues = useMemo(() => Object.fromEntries(fields.map(field => [field.name, field.defaultValue || ''])), [fields]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    if (open) setValues(initialValues);
  }, [open, initialValues]);

  if (!open) return null;

  const canSubmit = fields.every(field => !field.required || values[field.name]?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <form
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit(values);
        }}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {fields.map(field => (
            <label key={field.name} className="block text-sm font-medium text-slate-700">
              {field.label}
              {field.type === 'textarea' ? (
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={field.placeholder}
                  value={values[field.name] || ''}
                  onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                  required={field.required}
                />
              ) : (
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={values[field.name] || ''}
                  onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                  required={field.required}
                />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60" disabled={loading || !canSubmit}>
            {loading ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Commit dialog primitives**

Run:

```bash
git add src/components/ui/ActionConfirmDialog.tsx src/components/ui/ActionInputDialog.tsx src/app/api/__tests__/ui-native-dialog-coverage.test.ts
git commit -m "Add reusable action dialogs"
```

---

## Task 5: Replace Native Dialog Call Sites

**Files:**

- Modify the eight call-site files listed in the File Map.
- Modify `src/app/api/__tests__/portal-access-control-ui.test.ts`.

- [ ] **Step 1: Replace Portal grant repair confirmation**

In `src/app/(dashboard)/settings/PortalAccessControl.tsx`:

1. Import `ActionConfirmDialog`.
2. Add state:

```tsx
const [repairDialogOpen, setRepairDialogOpen] = useState(false);
```

3. Replace:

```tsx
if (!window.confirm('ยืนยันซ่อมแซม portal grants จากผล preview ล่าสุด?')) return;
```

with a button that calls:

```tsx
setRepairDialogOpen(true);
```

4. Render:

```tsx
<ActionConfirmDialog
  open={repairDialogOpen}
  title="ซ่อมแซม Portal Grants"
  description="ระบบจะสร้าง grant ที่ขาดและปิด grant ที่ stale ตามผล preview ล่าสุด"
  confirmLabel="ซ่อมแซม"
  tone="warning"
  loading={loading}
  onCancel={() => setRepairDialogOpen(false)}
  onConfirm={() => {
    setRepairDialogOpen(false);
    void repairGrants();
  }}
/>
```

Update `src/app/api/__tests__/portal-access-control-ui.test.ts` so it expects `ActionConfirmDialog` and no longer expects `window.confirm`.

- [ ] **Step 2: Replace Gate In/Gate Out waive reason prompts**

Use `ActionInputDialog` in both Gate files.

For each file, add state:

```tsx
const [waiveDialog, setWaiveDialog] = useState<{
  open: boolean;
  chargeId: number | null;
}>({ open: false, chargeId: null });
```

Open the dialog instead of calling `window.prompt`:

```tsx
setWaiveDialog({ open: true, chargeId: charge.charge_id });
```

Render:

```tsx
<ActionInputDialog
  open={waiveDialog.open}
  title="ยกเว้นค่าใช้จ่าย"
  description="ระบุเหตุผลเพื่อเก็บเป็น audit trail"
  fields={[{ name: 'reason', label: 'เหตุผล', type: 'textarea', required: true }]}
  confirmLabel="ยืนยันยกเว้น"
  onCancel={() => setWaiveDialog({ open: false, chargeId: null })}
  onSubmit={({ reason }) => {
    if (waiveDialog.chargeId) {
      void handleWaiveCharge(waiveDialog.chargeId, reason.trim());
    }
    setWaiveDialog({ open: false, chargeId: null });
  }}
/>
```

- [ ] **Step 3: Replace Billing receive payment prompts**

In `src/app/(dashboard)/billing/page.tsx`, replace amount and reference prompts with one `ActionInputDialog` that submits:

```tsx
fields={[
  { name: 'amount', label: 'ยอดรับชำระ', type: 'number', defaultValue: String(balance), required: true },
  { name: 'payment_ref', label: 'เลขอ้างอิง / หมายเหตุ', type: 'text' },
]}
```

Validate before calling the existing receive-payment function:

```tsx
const amount = Number(values.amount);
if (!Number.isFinite(amount) || amount <= 0) {
  setError('ยอดรับชำระไม่ถูกต้อง');
  return;
}
```

- [ ] **Step 4: Replace continuous print reprint reason prompt**

In `src/app/billing/print/continuous/page.tsx`, use `ActionInputDialog` when `require_reprint_reason` is true. Keep the same print log behavior.

Required field:

```tsx
{ name: 'reason', label: 'เหตุผลในการพิมพ์ซ้ำ', type: 'textarea', required: true }
```

- [ ] **Step 5: Replace remaining prompts in Payment Reconciliation, Reefer, and EDI**

Use `ActionInputDialog` for:

- Invoice match ID + note in `PaymentReconciliationTab.tsx`.
- Reefer exception action/ignore reason in `reefer/page.tsx`.
- EDI approval/rejection/amendment notes in `edi/page.tsx`.

Keep existing API calls and payload fields unchanged.

- [ ] **Step 6: Run native dialog coverage**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/ui-native-dialog-coverage.test.ts src/app/api/__tests__/portal-access-control-ui.test.ts
```

Expected: pass.

- [ ] **Step 7: Browser smoke key dialogs**

With dev server running on port 3005:

1. Open `/settings?tab=portal-access`.
2. Click repair action and verify custom modal appears.
3. Open `/gate?tab=gate_in` and open a waive action if test data exists.
4. Open `/billing` and verify receive-payment action opens the new dialog if a pending invoice exists.

Expected: no native browser prompt/confirm appears.

- [ ] **Step 8: Commit P1**

Run:

```bash
git add src/components/ui src/app/(dashboard)/settings/PortalAccessControl.tsx src/app/(dashboard)/gate/GateInTab.tsx src/app/(dashboard)/gate/GateOutTab.tsx src/app/(dashboard)/billing/page.tsx src/app/(dashboard)/billing/PaymentReconciliationTab.tsx src/app/billing/print/continuous/page.tsx src/app/(dashboard)/reefer/page.tsx src/app/(dashboard)/edi/page.tsx src/app/api/__tests__/ui-native-dialog-coverage.test.ts src/app/api/__tests__/portal-access-control-ui.test.ts
git commit -m "Replace native action dialogs"
```

Use PowerShell quoting or `git add -A` if path parentheses make the command awkward.

---

## Task 6: Extract Gate Print-Return Draft Helper

**Files:**

- Create `src/app/(dashboard)/gate/hooks/useGatePrintReturnDraft.ts`
- Modify `src/app/(dashboard)/gate/GateInTab.tsx`
- Modify `src/app/(dashboard)/gate/GateOutTab.tsx`
- Modify `src/app/api/__tests__/continuous-print-ui.test.ts`
- Modify `src/app/api/__tests__/gate-in-workstation-ui.test.ts`

- [ ] **Step 1: Add a static characterization test for shared helper usage**

Extend `src/app/api/__tests__/continuous-print-ui.test.ts`:

```ts
it('Gate In and Gate Out use the shared print return draft helper', () => {
  const gateIn = fs.readFileSync(path.join(repoRoot, 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const gateOut = fs.readFileSync(path.join(repoRoot, 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

  expect(gateIn).toContain('useGatePrintReturnDraft');
  expect(gateOut).toContain('useGatePrintReturnDraft');
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/continuous-print-ui.test.ts
```

Expected before implementation: failure because the helper does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/app/(dashboard)/gate/hooks/useGatePrintReturnDraft.ts`:

```ts
'use client';

import { useCallback } from 'react';

type GatePrintDraftEnvelope<T> = {
  savedAt: number;
  payload: T;
};

const DEFAULT_TTL_MS = 60 * 60 * 1000;

function isStorageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function useGatePrintReturnDraft<T>({
  storageKey,
  ttlMs = DEFAULT_TTL_MS,
}: {
  storageKey: string;
  ttlMs?: number;
}) {
  const saveDraft = useCallback((payload: T) => {
    if (!isStorageAvailable()) return;
    const envelope: GatePrintDraftEnvelope<T> = { savedAt: Date.now(), payload };
    window.localStorage.setItem(storageKey, JSON.stringify(envelope));
  }, [storageKey]);

  const restoreDraft = useCallback((): T | null => {
    if (!isStorageAvailable()) return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      const envelope = JSON.parse(raw) as GatePrintDraftEnvelope<T>;
      if (!envelope?.savedAt || Date.now() - envelope.savedAt > ttlMs) {
        window.localStorage.removeItem(storageKey);
        return null;
      }
      return envelope.payload || null;
    } catch {
      window.localStorage.removeItem(storageKey);
      return null;
    }
  }, [storageKey, ttlMs]);

  const clearDraft = useCallback(() => {
    if (isStorageAvailable()) window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { saveDraft, restoreDraft, clearDraft };
}
```

- [ ] **Step 4: Refactor Gate In to use the helper**

In `GateInTab.tsx`, replace direct `localStorage.setItem/getItem/removeItem` for the print draft with:

```tsx
const gateInPrintDraft = useGatePrintReturnDraft<GateInPrintDraft>({
  storageKey: GATE_IN_PRINT_DRAFT_KEY,
});
```

Use:

```tsx
gateInPrintDraft.saveDraft(buildGateInPrintDraft());
const restored = gateInPrintDraft.restoreDraft();
gateInPrintDraft.clearDraft();
```

Do not change field names inside the draft payload.

- [ ] **Step 5: Refactor Gate Out to use the helper**

In `GateOutTab.tsx`, replace direct print-draft storage calls with:

```tsx
const gateOutPrintDraft = useGatePrintReturnDraft<GateOutPrintDraft>({
  storageKey: GATE_OUT_PRINT_DRAFT_KEY,
});
```

Keep existing cleanup points after successful release/offline submit.

- [ ] **Step 6: Run focused Gate print tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/continuous-print-ui.test.ts src/app/api/__tests__/gate-in-workstation-ui.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit P2**

Run:

```bash
git add src/app/(dashboard)/gate/hooks/useGatePrintReturnDraft.ts src/app/(dashboard)/gate/GateInTab.tsx src/app/(dashboard)/gate/GateOutTab.tsx src/app/api/__tests__/continuous-print-ui.test.ts src/app/api/__tests__/gate-in-workstation-ui.test.ts
git commit -m "Extract gate print return draft helper"
```

Use PowerShell quoting or `git add -A` if path parentheses make the command awkward.

---

## Task 7: Handoff And Verification

**Files:**

- Modify `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add a short entry under the latest change log:

```md
- **Document Activity resolver-first access**: `/api/documents/activity` now resolves invoice/EIR/receipt/credit-note scope through the shared entity access resolver before querying `DocumentLifecycle`, preventing cross-yard lifecycle reads when `yard_id` is omitted.
- **Native action dialog cleanup**: remaining `window.prompt`/`window.confirm` call sites were replaced with reusable custom action dialogs for repair, waive, receive-payment, reprint, reefer, EDI, and reconciliation flows.
- **Gate print-return helper**: Gate In and Gate Out share `useGatePrintReturnDraft` for receipt print return state, keeping billing/request data after returning from continuous receipt print.
```

Update Known Issues:

```md
| **Confirmation Dialogs** | Custom dialogs are used for action confirmation and required reason/input flows. Native `window.prompt`/`window.confirm` are covered by source tests. |
```

- [ ] **Step 2: Run focused verification**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/lib/__tests__/documentActivityAccess.test.ts src/app/api/__tests__/documents-activity-access.test.ts src/app/api/__tests__/derived-yard-access.test.ts src/app/api/__tests__/ui-native-dialog-coverage.test.ts src/app/api/__tests__/continuous-print-ui.test.ts src/app/api/__tests__/gate-in-workstation-ui.test.ts
```

Expected: all pass.

- [ ] **Step 3: Run static type and lint checks**

Run:

```bash
npx tsc --noEmit
npm run lint
```

Expected: both pass.

- [ ] **Step 4: Run full Jest when the focused checks pass**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand
```

Expected: full test suite passes.

- [ ] **Step 5: Commit docs and any final test updates**

Run:

```bash
git add DEVELOPER_HANDOFF.md docs/superpowers/plans/2026-06-03-cyms-next-security-ux-hardening.md
git commit -m "Document next CYMS hardening plan"
```

If this plan file was already committed before execution, include only `DEVELOPER_HANDOFF.md` and final test adjustments.

- [ ] **Step 6: Push**

Run:

```bash
git push origin master
```

---

## Acceptance Criteria

- `/api/documents/activity` no longer uses a broad lifecycle query to discover yard access when `yard_id` is omitted.
- Invoice and EIR document activity requests resolve through the shared `entityAccessResolver`.
- Receipt and credit-note document activity remains backward compatible by resolving to related invoice scope before lifecycle display.
- Unsupported document types fail closed with HTTP 400.
- If yard access is denied, `DocumentLifecycle` activity rows are not queried.
- No targeted UI files use `window.prompt` or `window.confirm`.
- Reprint reason, payment amount/reference, waive reason, EDI notes, reefer exception actions, and portal repair confirmation use custom dialogs.
- Gate In and Gate Out continue preserving billing/request state after receipt print return.
- `DEVELOPER_HANDOFF.md` matches the actual code state.
- Focused Jest, `npx tsc --noEmit`, `npm run lint`, and full Jest pass before completion is claimed.

---

## Self-Review

- **Spec coverage:** Covers the current actionable recommendations from the latest code/Handoff review: document activity resolver adoption, remaining native dialogs, and print-return draft maintainability.
- **Scope control:** Cookie-first auth, Driver/Trucking UI, and broad component decomposition are intentionally deferred because they are independent subsystems and should get separate plans.
- **No runtime DDL:** This plan adds no request-path schema changes and relies on the existing migration contract.
- **Data leakage prevention:** The highest-risk route in this wave is handled first with failing tests before implementation.
