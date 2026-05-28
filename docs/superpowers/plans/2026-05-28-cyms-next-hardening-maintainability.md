# CYMS Next Hardening And Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining high-risk read/export surfaces, improve verification from source checks to runtime/browser checks, and reduce the next largest maintainability bottlenecks without changing business behavior.

**Architecture:** Keep the current Next.js API route pattern and existing RBAC helpers. Add small focused policy helpers only where the existing helpers do not express the resource being protected, then add regression tests before implementation. UI changes should preserve the current pages while extracting sections and improving navigation/preview clarity.

**Tech Stack:** Next.js 16 App Router, TypeScript, MS SQL via `mssql`, Jest, ESLint, existing CYMS RBAC helpers, optional Playwright/browser smoke scripts using the existing `scripts/e2e-smoke.mjs` pattern.

---

## Scope And Order

This plan is split into independently shippable slices. Execute in order unless the user explicitly asks for one slice only.

1. P0: Attachment Center access control.
2. P1: CODECO export permission and `/api/auth/me` token hardening.
3. P2: Browser/E2E smoke coverage for the highest-risk flows.
4. P3: Continue component decomposition for Gate Out, Billing, Booking.
5. P4: Migration ledger and dry-run readiness.
6. P5: Document Template preview UX cleanup.
7. Handoff, verification, commit, push.

Each task should be committed separately.

---

## File Map

- Modify `src/app/api/attachments/route.ts`: enforce server-side permission for `GET` and keep server-derived actor for `POST`.
- Create `src/lib/attachmentAccess.ts`: map attachment entity types to internal permission and optional yard/entity checks.
- Modify `src/lib/rbacSeeds.ts`: add dedicated attachment view/upload permissions.
- Create `src/app/api/__tests__/attachment-access.test.ts`: route-level behavior tests for protected attachment reads/writes.
- Modify `src/app/api/__tests__/api-auth-coverage.test.ts`: add method-level or route-specific coverage so `GET` cannot be masked by guarded `POST`.
- Modify `src/app/api/edi/codeco/route.ts`: require integration export/send permission before generating JSON/CSV/EDIFACT.
- Create or modify `src/app/api/__tests__/edi-codeco-permissions.test.ts`: assert CODECO export requires permission and yard access.
- Modify `src/app/api/auth/me/route.ts`: stop returning raw JWT token to client session payload.
- Create or modify `src/app/api/__tests__/auth-me-session.test.ts`: assert `/api/auth/me` restores session without `token`.
- Modify `scripts/e2e-smoke.mjs`: add smoke checks for login restore, EIR public/portal visibility, document template preview, and core route response codes.
- Create `src/app/api/__tests__/e2e-smoke-script-coverage.test.ts` or extend `e2e-smoke-script.test.ts`: keep script coverage honest.
- Modify `src/app/(dashboard)/gate/GateOutTab.tsx`: extract state and panels in small steps.
- Create files under `src/app/(dashboard)/gate/hooks/` and `src/app/(dashboard)/gate/components/`.
- Modify `src/app/(dashboard)/billing/page.tsx`: extract document/action center panels after Gate Out is stable.
- Modify `src/app/(dashboard)/booking/page.tsx`: extract booking import/create forms.
- Create `scripts/migration-ledger.mjs` or integrate into `scripts/migrate-runtime-core-schema.js`: record migration execution.
- Modify `src/lib/schema.sql`: add `SchemaMigrations` if not present.
- Modify `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`: replace one-way preview navigation with a clearer preview drawer/link flow.
- Modify `src/app/billing/print/continuous/page.tsx`: show a consistent back link and template/version metadata.
- Update `DEVELOPER_HANDOFF.md`: summarize completed slices and verification.

---

## Task 1: P0 Attachment Center Access Tests

**Files:**
- Create: `src/app/api/__tests__/attachment-access.test.ts`
- Modify: `src/app/api/__tests__/api-auth-coverage.test.ts`

- [ ] **Step 1: Write failing tests for unauthenticated attachment GET**

Create `src/app/api/__tests__/attachment-access.test.ts` with tests that mock `getDb`, `requireAnyPermission`, and the attachment route.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/attachments/route';
import { requireAnyPermission, requireRequestActor } from '@/lib/apiAuth';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requireRequestActor: jest.fn(),
}));
jest.mock('@/lib/attachmentCenter', () => ({
  ensureAttachmentCenter: jest.fn(),
  logAttachment: jest.fn().mockResolvedValue({ attachment_id: 9 }),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequireRequestActor = requireRequestActor as jest.Mock;

function makeDb(rows: unknown[] = []) {
  const query = jest.fn().mockResolvedValue({ recordset: rows });
  const input = jest.fn().mockReturnThis();
  return { request: jest.fn(() => ({ input, query })) };
}

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe('/api/attachments access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDb.mockResolvedValue(makeDb());
  });

  it('GET denies when actor lacks attachment read permission', async () => {
    mockedRequireAnyPermission.mockResolvedValue(NextResponse.json({ error: 'denied' }, { status: 403 }));

    const response = await GET(req('http://localhost/api/attachments?entity_type=eir&entity_number=EIR-1'));

    expect(response.status).toBe(403);
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.arrayContaining(['documents.attachment.view']),
      expect.any(String),
    );
  });

  it('GET returns attachments only after permission passes', async () => {
    const db = makeDb([{ attachment_id: 1, file_url: '/uploads/eir/a.jpg' }]);
    mockedGetDb.mockResolvedValue(db);
    mockedRequireAnyPermission.mockResolvedValue({ userId: 7, role: 'yard_manager' });

    const response = await GET(req('http://localhost/api/attachments?entity_type=eir&entity_number=EIR-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.attachments).toHaveLength(1);
  });

  it('POST still uses a server-derived actor', async () => {
    mockedRequireRequestActor.mockReturnValue({ userId: 7, role: 'yard_manager' });

    const response = await POST(req('http://localhost/api/attachments', {
      method: 'POST',
      body: JSON.stringify({ entity_type: 'eir', entity_number: 'EIR-1', file_url: '/uploads/eir/a.jpg' }),
    }));

    expect(response.status).toBe(200);
    expect(mockedRequireRequestActor).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing attachment test**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/attachment-access.test.ts
```

Expected before implementation: first test fails because `GET` does not call `requireAnyPermission`.

- [ ] **Step 3: Strengthen source coverage so guarded POST cannot mask unguarded GET**

Modify `src/app/api/__tests__/api-auth-coverage.test.ts` by adding a route-specific assertion:

```ts
it('attachments GET has its own permission guard before returning file URLs', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/attachments/route.ts'), 'utf8');
  const getBody = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function POST'));

  expect(getBody).toMatch(/\brequireAnyPermission\s*\(/);
  expect(getBody.indexOf('requireAnyPermission')).toBeGreaterThan(-1);
  expect(getBody.indexOf('requireAnyPermission')).toBeLessThan(getBody.indexOf('SELECT attachment_id'));
});
```

- [ ] **Step 4: Run the coverage test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/api-auth-coverage.test.ts
```

Expected before implementation: new test fails.

---

## Task 2: P0 Attachment Center Access Implementation

**Files:**
- Create: `src/lib/attachmentAccess.ts`
- Modify: `src/app/api/attachments/route.ts`
- Modify: `src/lib/rbacSeeds.ts`
- Test: `src/app/api/__tests__/attachment-access.test.ts`

- [ ] **Step 1: Add dedicated attachment permissions to RBAC seeds**

Modify `PERMISSION_SEEDS` in `src/lib/rbacSeeds.ts`:

```ts
{ code: 'documents.attachment.view', module: 'documents', action: 'attachment_view', description: 'ดูเอกสารแนบของรายการที่มีสิทธิ์' },
{ code: 'documents.attachment.upload', module: 'documents', action: 'attachment_upload', description: 'อัปโหลดหรือผูกเอกสารแนบกับรายการที่มีสิทธิ์' },
```

Add these grants:

```ts
gate_clerk: ['documents.attachment.view', 'documents.attachment.upload']
surveyor: ['documents.attachment.view', 'documents.attachment.upload']
billing_officer: ['documents.attachment.view']
supervisor: ['documents.attachment.view', 'documents.attachment.upload']
yard_manager: all permissions through the existing all-permission flow
```

Follow the current `ROLE_GRANTS` style. Do not add a runtime seed call to any GET route.

- [ ] **Step 2: Add a small attachment access helper**

Create `src/lib/attachmentAccess.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import type { ConnectionPool } from 'mssql';
import { requireAnyPermission, requirePermission } from '@/lib/apiAuth';

export async function requireAttachmentView(request: NextRequest, db: ConnectionPool) {
  return requireAnyPermission(
    request,
    db,
    [
      'documents.attachment.view',
      'gate.eir.print',
      'survey.inspect',
      'mnr.eor.create',
      'mnr.eor.update',
      'billing.invoice.create',
      'reports.view',
    ],
    'คุณไม่มีสิทธิ์ดูเอกสารแนบ',
  );
}

export async function requireAttachmentUpload(request: NextRequest, db: ConnectionPool) {
  return requirePermission(
    request,
    db,
    'documents.attachment.upload',
    'คุณไม่มีสิทธิ์อัปโหลดเอกสารแนบ',
  );
}

export function isAttachmentAuthResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
```

- [ ] **Step 3: Guard attachment GET and POST**

Modify `src/app/api/attachments/route.ts`.

At imports:

```ts
import { requireAttachmentUpload, requireAttachmentView, isAttachmentAuthResponse } from '@/lib/attachmentAccess';
```

In `GET`, immediately after `const db = await getDb();`:

```ts
const actor = await requireAttachmentView(request, db);
if (isAttachmentAuthResponse(actor)) return actor;
```

In `POST`, replace `requireRequestActor(request)` with:

```ts
const actor = await requireAttachmentUpload(request, db);
if (isAttachmentAuthResponse(actor)) return actor;
```

Use `actor.userId` for `uploadedBy`.

- [ ] **Step 4: Run attachment tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/attachment-access.test.ts src/app/api/__tests__/api-auth-coverage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit P0**

Run:

```bash
git add src/app/api/attachments/route.ts src/lib/attachmentAccess.ts src/lib/rbacSeeds.ts src/app/api/__tests__/attachment-access.test.ts src/app/api/__tests__/api-auth-coverage.test.ts
git commit -m "Harden attachment center access"
```

---

## Task 3: P1 CODECO Export Permission

**Files:**
- Modify: `src/app/api/edi/codeco/route.ts`
- Create: `src/app/api/__tests__/edi-codeco-permissions.test.ts`

- [ ] **Step 1: Write failing CODECO permission test**

Create `src/app/api/__tests__/edi-codeco-permissions.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('/api/edi/codeco permissions', () => {
  it('requires integration permission before CODECO export', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/edi/codeco/route.ts'), 'utf8');

    expect(source).toMatch(/\brequireAnyPermission\s*\(/);
    expect(source).toContain('integration.send');
    expect(source.indexOf('requireAnyPermission')).toBeLessThan(source.indexOf('SELECT g.transaction_id'));
  });

  it('keeps yard access guard for CODECO export', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/edi/codeco/route.ts'), 'utf8');

    expect(source).toMatch(/\brequireYardAccess\s*\(/);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/edi-codeco-permissions.test.ts
```

Expected before implementation: first test fails.

- [ ] **Step 3: Add CODECO export permission**

Modify `src/app/api/edi/codeco/route.ts`.

Import:

```ts
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';
```

After `const db = await getDb();` and before SQL query construction:

```ts
const actor = await requireAnyPermission(
  request,
  db,
  ['integration.send', 'integration.logs.view'],
  'คุณไม่มีสิทธิ์ export CODECO',
);
if (actor instanceof NextResponse) return actor;
```

Keep the existing `requireYardAccess` call. The permission guard must run before data is queried.

- [ ] **Step 4: Run CODECO and yard guard tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/edi-codeco-permissions.test.ts src/app/api/__tests__/yard-access-guard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit P1 CODECO**

Run:

```bash
git add src/app/api/edi/codeco/route.ts src/app/api/__tests__/edi-codeco-permissions.test.ts
git commit -m "Require permission for CODECO export"
```

---

## Task 4: P1 Stop Returning Raw JWT From `/api/auth/me`

**Files:**
- Modify: `src/app/api/auth/me/route.ts`
- Create: `src/app/api/__tests__/auth-me-session.test.ts`

- [ ] **Step 1: Write failing session response test**

Create `src/app/api/__tests__/auth-me-session.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('/api/auth/me session payload', () => {
  it('does not return the raw JWT token to client JSON', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/auth/me/route.ts'), 'utf8');

    expect(source).not.toMatch(/\btoken,\s*\/\/ ส่ง token กลับไปให้ client/);
    expect(source).not.toMatch(/\btoken\s*:/);
  });

  it('still reads token from httpOnly cookie or proxy header', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/auth/me/route.ts'), 'utf8');

    expect(source).toContain("request.headers.get('x-cyms-token')");
    expect(source).toContain("request.cookies.get('cyms_token')");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/auth-me-session.test.ts
```

Expected before implementation: first test fails.

- [ ] **Step 3: Remove token from session JSON**

Modify `src/app/api/auth/me/route.ts`.

Replace:

```ts
      customerId: (payload.customerId as number) || null,
      token, // ส่ง token กลับไปให้ client เก็บใน state
```

With:

```ts
      customerId: (payload.customerId as number) || null,
```

If client code requires `session.token`, update the client to use cookie-backed API calls and `installAuthFetchPatch()` instead of storing token.

- [ ] **Step 4: Search for client token dependency**

Run:

```bash
rg -n "session\\.token|user\\.token|token:" src/app src/components src/lib -g "*.ts" -g "*.tsx"
```

Expected: no required UI flow depends on `/api/auth/me` returning `token`. If there are references, update them to rely on existing auth headers/cookie behavior.

- [ ] **Step 5: Run auth and auth fetch tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/auth-me-session.test.ts src/lib/__tests__/authFetch.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit auth hardening**

Run:

```bash
git add src/app/api/auth/me/route.ts src/app/api/__tests__/auth-me-session.test.ts
git commit -m "Stop returning raw token from auth session"
```

---

## Task 5: P2 E2E Smoke Coverage

**Files:**
- Modify: `scripts/e2e-smoke.mjs`
- Modify: `src/app/api/__tests__/e2e-smoke-script.test.ts`

- [ ] **Step 1: Extend smoke script coverage test**

Modify `src/app/api/__tests__/e2e-smoke-script.test.ts`:

```ts
it('covers high-risk browser flows', () => {
  const script = fs.readFileSync(path.join(repoRoot, 'scripts/e2e-smoke.mjs'), 'utf8');

  expect(script).toContain('/api/auth/me');
  expect(script).toContain('/eir/');
  expect(script).toContain('/portal/containers');
  expect(script).toContain('/settings?tab=document-templates');
  expect(script).toContain('/billing/print/continuous');
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/e2e-smoke-script.test.ts
```

Expected before script update: new assertions fail if the flows are not present.

- [ ] **Step 3: Add smoke checks**

Modify `scripts/e2e-smoke.mjs` using the existing script style. Add checks:

```js
await check('auth restore endpoint', '/api/auth/me', [200, 401]);
await check('public EIR verification page', '/eir/SMOKE-EIR-NOT-FOUND', [200, 404]);
await check('portal containers page requires auth or renders', '/portal/containers', [200, 302, 401, 403]);
await check('document template manager page', '/settings?tab=document-templates', [200, 302, 401, 403]);
await check('continuous print sample preview', '/billing/print/continuous?preview=sample&type=tax_invoice_receipt', [200, 302, 401, 403]);
```

Use the script's current helper names. Do not introduce Playwright dependency unless the repo already has it. This is a smoke script, not a full browser automation suite.

- [ ] **Step 4: Run smoke script tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/e2e-smoke-script.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run local smoke only if dev server is running**

Run:

```bash
npm run test:e2e:smoke
```

Expected with dev server on port 3005: PASS or only documented auth-expected status codes. If dev server is not running, do not claim this check passed.

- [ ] **Step 6: Commit E2E smoke coverage**

Run:

```bash
git add scripts/e2e-smoke.mjs src/app/api/__tests__/e2e-smoke-script.test.ts
git commit -m "Expand high-risk smoke coverage"
```

---

## Task 6: P3 Gate Out Decomposition

**Files:**
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`
- Create: `src/app/(dashboard)/gate/hooks/useGateOutSearch.ts`
- Create: `src/app/(dashboard)/gate/hooks/useGateOutVisibilityPreview.ts`
- Create: `src/app/(dashboard)/gate/components/GateOutStatusRail.tsx`
- Test: existing `src/app/api/__tests__/gate-out-workstation-ui.test.ts`
- Test: existing `src/app/api/__tests__/gate-out-business-context-ui.test.ts`

- [ ] **Step 1: Add source-structure test**

Modify `src/app/api/__tests__/gate-out-workstation-ui.test.ts`:

```ts
it('keeps Gate Out search and visibility preview in focused hooks', () => {
  const gateOut = read('src/app/(dashboard)/gate/GateOutTab.tsx');

  expect(gateOut).toContain('useGateOutSearch');
  expect(gateOut).toContain('useGateOutVisibilityPreview');
  expect(gateOut.length).toBeLessThan(52000);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/gate-out-workstation-ui.test.ts
```

Expected before extraction: hook assertions fail.

- [ ] **Step 3: Extract search state to `useGateOutSearch`**

Create `src/app/(dashboard)/gate/hooks/useGateOutSearch.ts` with a hook that owns:

```ts
export interface GateOutSearchResult {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchLoading: boolean;
  searchError: string;
  searchResults: unknown[];
  runSearch: () => Promise<void>;
  resetSearch: () => void;
}
```

Move only search state/effects from `GateOutTab.tsx`. Do not move submit/release business mutations in this task.

- [ ] **Step 4: Extract visibility preview state to `useGateOutVisibilityPreview`**

Create `src/app/(dashboard)/gate/hooks/useGateOutVisibilityPreview.ts` with:

```ts
export interface PortalVisibilityPreviewRow {
  customer_id: number;
  customer_name: string;
  access_role: string;
  entity_type?: string;
}
```

The hook should accept selected booking/container context and return:

```ts
{
  visibilityPreview,
  visibilityPreviewLoading,
  visibilityPreviewError,
  refreshVisibilityPreview,
  clearVisibilityPreview,
}
```

- [ ] **Step 5: Extract status rail UI**

Create `src/app/(dashboard)/gate/components/GateOutStatusRail.tsx` for billing/booking/evidence/approval/next action cards. Keep presentational props only.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/gate-out-workstation-ui.test.ts src/app/api/__tests__/gate-out-business-context-ui.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Gate Out decomposition**

Run:

```bash
git add "src/app/(dashboard)/gate/GateOutTab.tsx" "src/app/(dashboard)/gate/hooks" "src/app/(dashboard)/gate/components/GateOutStatusRail.tsx" src/app/api/__tests__/gate-out-workstation-ui.test.ts
git commit -m "Extract gate out workflow hooks"
```

---

## Task 7: P3 Billing And Booking Decomposition Plan Slice

**Files:**
- Modify: `src/app/(dashboard)/billing/page.tsx`
- Create: `src/app/(dashboard)/billing/components/BillingDocumentActions.tsx`
- Create: `src/app/(dashboard)/billing/components/BillingStatementHistory.tsx`
- Modify: `src/app/(dashboard)/booking/page.tsx`
- Create: `src/app/(dashboard)/booking/components/BookingCreateForm.tsx`
- Create: `src/app/(dashboard)/booking/components/BookingImportTemplatePanel.tsx`

- [ ] **Step 1: Add source-structure tests**

Create `src/app/api/__tests__/large-page-decomposition.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('large dashboard page decomposition', () => {
  it('billing page delegates document actions and statement history', () => {
    const source = read('src/app/(dashboard)/billing/page.tsx');

    expect(source).toContain('BillingDocumentActions');
    expect(source).toContain('BillingStatementHistory');
  });

  it('booking page delegates create form and import template panel', () => {
    const source = read('src/app/(dashboard)/booking/page.tsx');

    expect(source).toContain('BookingCreateForm');
    expect(source).toContain('BookingImportTemplatePanel');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/large-page-decomposition.test.ts
```

Expected before extraction: FAIL.

- [ ] **Step 3: Extract billing document action panel**

Create `BillingDocumentActions.tsx` with props for existing print, statement, and continuous-form actions. Keep all API calls in the parent for this slice unless moving them reduces duplication without changing behavior.

- [ ] **Step 4: Extract billing statement history panel**

Create `BillingStatementHistory.tsx` with props for statement rows, loading/error state, and callback handlers. Preserve the same button labels and routes.

- [ ] **Step 5: Extract booking create form**

Create `BookingCreateForm.tsx`. Move only JSX and controlled form props from `booking/page.tsx`. Keep submit handler in parent.

- [ ] **Step 6: Extract booking import template panel**

Create `BookingImportTemplatePanel.tsx`. Include template download/import instructions and import controls. Keep parse/upload behavior unchanged.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/large-page-decomposition.test.ts src/app/api/__tests__/booking-business-context-ui.test.ts src/app/api/__tests__/continuous-print-ui.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit decomposition**

Run:

```bash
git add "src/app/(dashboard)/billing/page.tsx" "src/app/(dashboard)/billing/components" "src/app/(dashboard)/booking/page.tsx" "src/app/(dashboard)/booking/components" src/app/api/__tests__/large-page-decomposition.test.ts
git commit -m "Split billing and booking page panels"
```

---

## Task 8: P4 Migration Ledger

**Files:**
- Modify: `src/lib/schema.sql`
- Modify: `scripts/migrate-runtime-core-schema.js`
- Create: `src/app/api/__tests__/migration-ledger.test.ts`

- [ ] **Step 1: Write migration ledger test**

Create `src/app/api/__tests__/migration-ledger.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('runtime core migration ledger', () => {
  it('declares SchemaMigrations in schema and migration script', () => {
    const schema = fs.readFileSync(path.join(repoRoot, 'src/lib/schema.sql'), 'utf8');
    const migration = fs.readFileSync(path.join(repoRoot, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    expect(schema).toMatch(/CREATE TABLE SchemaMigrations/i);
    expect(migration).toMatch(/SchemaMigrations/i);
    expect(migration).toMatch(/migration_key/i);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/migration-ledger.test.ts
```

Expected before implementation: FAIL.

- [ ] **Step 3: Add SchemaMigrations table to schema**

Add to `src/lib/schema.sql`:

```sql
CREATE TABLE SchemaMigrations (
  migration_key NVARCHAR(150) NOT NULL PRIMARY KEY,
  migration_name NVARCHAR(255) NOT NULL,
  checksum NVARCHAR(128) NULL,
  applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  applied_by NVARCHAR(100) NULL,
  status NVARCHAR(30) NOT NULL DEFAULT 'applied'
);
```

- [ ] **Step 4: Add ledger creation and record to runtime migration script**

In `scripts/migrate-runtime-core-schema.js`, add an early block:

```js
await pool.request().query(`
  IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SchemaMigrations')
  CREATE TABLE SchemaMigrations (
    migration_key NVARCHAR(150) NOT NULL PRIMARY KEY,
    migration_name NVARCHAR(255) NOT NULL,
    checksum NVARCHAR(128) NULL,
    applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    applied_by NVARCHAR(100) NULL,
    status NVARCHAR(30) NOT NULL DEFAULT 'applied'
  )
`);
```

At the end of successful migration:

```js
await pool.request()
  .input('migrationKey', sql.NVarChar(150), 'runtime-core-schema')
  .input('migrationName', sql.NVarChar(255), 'Runtime Core Schema')
  .query(`
    MERGE SchemaMigrations AS target
    USING (SELECT @migrationKey AS migration_key, @migrationName AS migration_name) AS source
      ON target.migration_key = source.migration_key
    WHEN MATCHED THEN
      UPDATE SET migration_name = source.migration_name, applied_at = SYSUTCDATETIME(), status = 'applied'
    WHEN NOT MATCHED THEN
      INSERT (migration_key, migration_name, status)
      VALUES (source.migration_key, source.migration_name, 'applied');
  `);
```

- [ ] **Step 5: Run migration ledger test**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/migration-ledger.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit migration ledger**

Run:

```bash
git add src/lib/schema.sql scripts/migrate-runtime-core-schema.js src/app/api/__tests__/migration-ledger.test.ts
git commit -m "Add schema migration ledger"
```

---

## Task 9: P5 Document Template Preview UX Cleanup

**Files:**
- Modify: `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`
- Modify: `src/app/billing/print/continuous/page.tsx`
- Modify: `src/app/api/__tests__/document-template-designer-ui.test.ts`
- Modify: `src/app/api/__tests__/continuous-print-ui.test.ts`

- [ ] **Step 1: Add source tests for safer preview UX**

Modify `src/app/api/__tests__/document-template-designer-ui.test.ts`:

```ts
it('opens preview with a return path and template identity', () => {
  const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

  expect(manager).toContain('returnTo');
  expect(manager).toContain('templateId');
  expect(manager).toContain('versionNo');
});
```

Modify `src/app/api/__tests__/continuous-print-ui.test.ts`:

```ts
it('continuous print preview exposes a clear back action', () => {
  const source = read('src/app/billing/print/continuous/page.tsx');

  expect(source).toContain('กลับไป Document Templates');
  expect(source).toContain('returnTo');
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/continuous-print-ui.test.ts
```

Expected before implementation: FAIL.

- [ ] **Step 3: Add return path to preview params**

In `DocumentTemplateManager.tsx`, update preview params:

```ts
returnTo: '/settings?tab=document-templates',
templateId: String(selectedTemplate.template_id),
versionNo: String(editingVersion.version_no),
```

Use the existing `previewParams()` function and keep `preview=sample|real` behavior unchanged.

- [ ] **Step 4: Add back action and template/version metadata to print page**

In `src/app/billing/print/continuous/page.tsx`, parse:

```ts
const returnTo = searchParams.get('returnTo') || '/settings?tab=document-templates';
```

Add a button/link in the print toolbar:

```tsx
<a href={returnTo} className="rounded bg-white px-4 py-2 text-sm font-semibold text-slate-900">
  กลับไป Document Templates
</a>
```

Show template/version in the non-print toolbar only:

```tsx
<p className="text-xs text-slate-300">
  Template {searchParams.get('templateId') || '-'} / v{searchParams.get('versionNo') || '-'}
</p>
```

- [ ] **Step 5: Run preview UX tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/continuous-print-ui.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit preview UX cleanup**

Run:

```bash
git add "src/app/(dashboard)/settings/DocumentTemplateManager.tsx" src/app/billing/print/continuous/page.tsx src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/continuous-print-ui.test.ts
git commit -m "Clarify document template preview navigation"
```

---

## Task 10: Handoff And Final Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add a new top update section to `DEVELOPER_HANDOFF.md` with:

- Attachment Center access hardening.
- CODECO export permission.
- Auth session no longer returning raw token.
- E2E smoke additions.
- Component decomposition slices completed.
- Migration ledger.
- Document Template preview UX cleanup.
- Migration instructions if `SchemaMigrations` was added.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/attachment-access.test.ts src/app/api/__tests__/api-auth-coverage.test.ts src/app/api/__tests__/edi-codeco-permissions.test.ts src/app/api/__tests__/auth-me-session.test.ts src/app/api/__tests__/e2e-smoke-script.test.ts src/app/api/__tests__/gate-out-workstation-ui.test.ts src/app/api/__tests__/gate-out-business-context-ui.test.ts src/app/api/__tests__/large-page-decomposition.test.ts src/app/api/__tests__/migration-ledger.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/continuous-print-ui.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run global verification**

Run:

```bash
npm run lint
npx tsc --noEmit --pretty false
npm test -- --cacheDirectory .tmp\jest --runInBand
```

Expected:

- ESLint exits 0.
- TypeScript exits 0.
- Jest exits 0.

- [ ] **Step 4: Commit handoff**

Run:

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Update handoff for next hardening slice"
```

- [ ] **Step 5: Push branch**

Run:

```bash
git push origin codex/api-permission-hardening
```

Expected: remote branch updated.

---

## Self-Review

- Spec coverage: covers all previously recommended follow-ups: attachment leak risk, CODECO permission, token response hardening, E2E smoke coverage, component size reduction, migration ledger, and Document Template preview UX.
- Placeholder scan: no unresolved placeholder markers remain. Each task has explicit files, commands, expected results, and commit messages.
- Type consistency: helper/function names are defined in the tasks before use. Permissions added in Task 2 are referenced by route/tests in the same task.
- Scope check: this is a multi-slice plan. Each slice is independently testable and committable, so it can be executed incrementally without waiting for the whole roadmap.
