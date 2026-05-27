# CYMS Read Policy Hardening And Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining read-side data leakage risks, tighten Portal EIR/Gate policy, move runtime permission seeding out of read requests, make internal jobs auth-safe, and reduce frontend maintenance risk without changing business behavior.

**Architecture:** Keep the existing `proxy.ts` + `apiAuth.ts` model, but require route-level permission checks for sensitive read APIs. Keep `PortalEntityAccess` as the portal source of truth, but stop using broad container visibility as an implicit EIR/Gate detail grant. Runtime cleanup should extract shared service helpers so schedulers and API routes call the same code path instead of calling public API endpoints.

**Tech Stack:** Next.js 16 App Router, TypeScript, MS SQL via `mssql`, Jest, ESLint, existing `requirePermission` / `requireAnyPermission` / `requireYardAccess` helpers.

---

## File Structure

### API Hardening

- Modify `src/app/api/containers/detail/route.ts`  
  Add `requireAnyPermission` and `requireYardAccess` before returning lifecycle, billing, booking, EDI, and approval data.
- Modify `src/app/api/containers/timeline/route.ts`  
  Add container-derived yard guard and read permission.
- Modify `src/app/api/dashboard/route.ts`  
  Add `reports.view` permission before dashboard analytics.
- Modify `src/app/api/search/route.ts`  
  Add read permission in addition to the existing yard guard.
- Modify `src/app/api/reports/dwell/route.ts`, `src/app/api/reports/gate/route.ts`, `src/app/api/reports/mnr/route.ts`  
  Add `reports.view` permission before report queries.
- Modify `src/app/api/mnr/eor-pdf/route.ts`  
  Add `mnr.eor.create`, `mnr.eor.update`, `mnr.eor.approve`, or `reports.view` permission and derive yard before returning PDF data.
- Modify `src/app/api/documents/activity/route.ts`, `src/app/api/documents/consistency/route.ts`, `src/app/api/documents/lifecycle/route.ts`  
  Add document/report/audit permission checks.
- Modify `src/app/api/audit-trail/readable/route.ts`  
  Add `audit_trail.read`.
- Modify `src/app/api/boxtech/route.ts`  
  Add gate/yard read permission and rate-sensitive guard before BoxTech lookups.
- Modify `src/app/api/customers/360/route.ts`  
  Add `reports.view`, `billing.invoice.create`, or `settings.manage` depending on method.
- Modify `src/app/api/entity-timeline/route.ts`  
  Add read permission and entity-derived yard guard where possible.
- Modify `src/app/api/integrations/logs/route.ts`, `src/app/api/integrations/mapping/route.ts`  
  Add `integration.logs.view` for reads and `settings.manage` for mapping mutations.
- Modify `src/app/api/operations/stream/route.ts`  
  Add `yard.slot.move` or `yard.location.assign` before opening SSE.
- Modify `src/app/api/settings/data-quality/route.ts`, `src/app/api/settings/sop/route.ts`, `src/app/api/settings/status-model/route.ts`  
  Add `settings.manage` for config reads/mutations.
- Modify `src/app/api/yard/stats/route.ts`  
  Add `reports.view`, `yard.location.assign`, or `yard.slot.move` before stats.
- Create `src/app/api/__tests__/read-api-permission-hardening.test.ts`  
  Static coverage for remaining sensitive read routes.
- Create runtime tests in existing API test style for the most sensitive routes:
  - `src/app/api/__tests__/container-detail-permissions.test.ts`
  - `src/app/api/__tests__/portal-eir-exact-grants.test.ts`
  - `src/app/api/__tests__/read-route-runtime-permissions.test.ts`

### Portal EIR/Gate Policy

- Modify `src/lib/portalAccess.ts`  
  Split exact entity grant checks from fallback visibility helpers.
- Modify `src/app/api/portal/eir/route.ts`  
  Require exact EIR or Gate Transaction grant by default.
- Modify `src/app/api/portal/eir-pdf/route.ts`  
  Use the same exact grant policy as JSON.
- Modify `src/app/api/portal/document-bundle/route.ts`  
  Prevent full EIR/Gate document bundle from being unlocked by container visibility only.
- Modify `src/app/api/portal/timeline/route.ts`  
  Allow container fallback only for summary rows, not full EIR/Gate detail payloads.
- Modify `src/lib/__tests__/portalAccess.test.ts`  
  Add exact/fallback SQL expectations.

### RBAC Seed Cleanup

- Create `src/lib/rbacSeeds.ts`  
  Move role, permission, grant seed data and `syncGranularRbac()` out of `GET /api/settings/permissions`.
- Modify `src/app/api/settings/permissions/route.ts`  
  Make `GET` read-only and keep `PUT` as manual role-permission toggle.
- Create `src/app/api/settings/permissions/sync/route.ts`  
  Add explicit `POST` sync endpoint, restricted to `yard_manager`, with audit log.
- Modify `DEVELOPER_HANDOFF.md`  
  Document that permission sync is explicit and no longer runs during read.

### Internal Scheduler Cleanup

- Create `src/lib/bookingSummaryJob.ts`  
  Move booking summary email logic behind a helper.
- Modify `src/app/api/cron/booking-summary/route.ts`  
  Require `settings.manage` for manual trigger and call the helper.
- Modify `src/lib/bookingScheduler.ts`  
  Call the helper directly instead of fetching `/api/cron/booking-summary`.
- Create `src/lib/codecoSendJob.ts`  
  Extract CODECO send behavior from `src/app/api/edi/codeco/send/route.ts`.
- Modify `src/app/api/edi/codeco/send/route.ts`  
  Keep route auth, then call the helper.
- Modify `src/lib/ediScheduler.ts`  
  Call the helper directly instead of fetching the protected API route.

### Frontend Maintainability

- Modify `src/app/(dashboard)/layout.tsx`  
  Guard auth fetch monkey patch against double patch during HMR.
- Modify `src/app/(portal)/layout.tsx`  
  Guard auth fetch monkey patch against double patch during HMR.
- Modify `src/lib/authFetch.ts`  
  Export a single `installAuthFetchPatch()` helper used by both layouts.
- Create `src/app/(dashboard)/gate/components/GateInContainerSection.tsx`
- Create `src/app/(dashboard)/gate/components/GateInBusinessRelationshipSection.tsx`
- Create `src/app/(dashboard)/gate/components/GateInDriverSection.tsx`
- Create `src/app/(dashboard)/gate/components/GateInInspectionSection.tsx`
- Create `src/app/(dashboard)/gate/components/GateOutSearchSection.tsx`
- Create `src/app/(dashboard)/gate/components/GateOutReleaseRequestSection.tsx`
- Modify `src/app/(dashboard)/gate/GateInTab.tsx` and `src/app/(dashboard)/gate/GateOutTab.tsx`  
  Extract sections without changing behavior.

---

## Permission Map

Use these route-level permissions unless a stricter existing permission is already present:

```ts
const READ_ROUTE_PERMISSION_MAP = {
  containerDetail: [
    'gate.in',
    'gate.out',
    'yard.location.assign',
    'yard.slot.move',
    'billing.invoice.create',
    'billing.payment.receive',
    'mnr.eor.create',
    'mnr.eor.update',
    'reports.view',
  ],
  containerTimeline: ['gate.in', 'gate.out', 'yard.location.assign', 'yard.slot.move', 'reports.view'],
  dashboard: ['reports.view'],
  search: ['gate.in', 'gate.out', 'booking.manage', 'billing.invoice.create', 'yard.location.assign', 'yard.slot.move', 'reports.view'],
  reports: ['reports.view'],
  eorPdf: ['mnr.eor.create', 'mnr.eor.update', 'mnr.eor.approve', 'reports.view'],
  documents: ['audit_trail.read', 'reports.view', 'document_templates.view', 'billing.invoice.create', 'billing.payment.receive'],
  integrations: ['integration.logs.view', 'settings.manage'],
  yardStats: ['reports.view', 'yard.location.assign', 'yard.slot.move'],
  boxtech: ['gate.in', 'gate.out', 'yard.location.assign', 'yard.slot.move'],
  settingsRead: ['settings.manage'],
};
```

---

## Task 1: Add Static Coverage For Remaining Sensitive Read APIs

**Files:**
- Create: `src/app/api/__tests__/read-api-permission-hardening.test.ts`

- [ ] **Step 1: Write the failing static coverage test**

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

const sensitiveReadRoutes = [
  'src/app/api/audit-trail/readable/route.ts',
  'src/app/api/boxtech/route.ts',
  'src/app/api/containers/detail/route.ts',
  'src/app/api/containers/timeline/route.ts',
  'src/app/api/customers/360/route.ts',
  'src/app/api/dashboard/route.ts',
  'src/app/api/documents/activity/route.ts',
  'src/app/api/documents/consistency/route.ts',
  'src/app/api/documents/lifecycle/route.ts',
  'src/app/api/entity-timeline/route.ts',
  'src/app/api/integrations/logs/route.ts',
  'src/app/api/integrations/mapping/route.ts',
  'src/app/api/mnr/eor-pdf/route.ts',
  'src/app/api/operations/stream/route.ts',
  'src/app/api/reports/dwell/route.ts',
  'src/app/api/reports/gate/route.ts',
  'src/app/api/reports/mnr/route.ts',
  'src/app/api/search/route.ts',
  'src/app/api/settings/data-quality/route.ts',
  'src/app/api/settings/sop/route.ts',
  'src/app/api/settings/status-model/route.ts',
  'src/app/api/yard/stats/route.ts',
];

describe('sensitive read APIs require route-level authorization', () => {
  it.each(sensitiveReadRoutes)('%s uses a server-side permission or role guard', (relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    expect(source).toMatch(/\b(requirePermission|requireAnyPermission|requireRole)\s*\(/);
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/read-api-permission-hardening.test.ts
```

Expected: FAIL for routes that only call `requireYardAccess` or have no route-level guard.

- [ ] **Step 3: Commit only the failing test**

```bash
git add src/app/api/__tests__/read-api-permission-hardening.test.ts
git commit -m "test: cover sensitive read API permissions"
```

---

## Task 2: Harden Container Detail And Timeline APIs

**Files:**
- Modify: `src/app/api/containers/detail/route.ts`
- Modify: `src/app/api/containers/timeline/route.ts`
- Create: `src/app/api/__tests__/container-detail-permissions.test.ts`

- [ ] **Step 1: Write runtime tests for unauthorized container detail**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../containers/detail/route';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

describe('/api/containers/detail permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 before DB queries when read permission is missing', async () => {
    mockedRequireAnyPermission.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }));

    const response = await GET(new NextRequest('http://localhost/api/containers/detail?container_id=1'));

    expect(response.status).toBe(403);
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('checks yard access after loading the container yard', async () => {
    mockedRequireAnyPermission.mockResolvedValue({ userId: 7, role: 'gate_clerk' });
    mockedRequireYardAccess.mockResolvedValue(NextResponse.json({ error: 'yard denied' }, { status: 403 }));

    const query = jest.fn()
      .mockResolvedValueOnce({ recordset: [{ container_id: 1, container_number: 'ONEU1234567', yard_id: 9 }] });
    mockedGetDb.mockResolvedValue({
      request: () => ({
        input: jest.fn().mockReturnThis(),
        query,
      }),
    });

    const response = await GET(new NextRequest('http://localhost/api/containers/detail?container_id=1'));

    expect(mockedRequireYardAccess).toHaveBeenCalledWith(expect.any(NextRequest), expect.anything(), 9, expect.any(String));
    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/container-detail-permissions.test.ts
```

Expected: FAIL because `containers/detail` currently reads DB before permission and yard checks.

- [ ] **Step 3: Add permission guard before DB connection**

In `src/app/api/containers/detail/route.ts`, add imports:

```ts
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';
```

At the start of `GET` after validating `container_id`, add:

```ts
const db = await getDb();
const actor = await requireAnyPermission(
  request,
  db,
  [
    'gate.in',
    'gate.out',
    'yard.location.assign',
    'yard.slot.move',
    'billing.invoice.create',
    'billing.payment.receive',
    'mnr.eor.create',
    'mnr.eor.update',
    'reports.view',
  ],
  'คุณไม่มีสิทธิ์ดูรายละเอียดตู้'
);
if (actor instanceof NextResponse) return actor;
```

After the first container query and before any gate, invoice, clearance, booking, EDI, or approval query, add:

```ts
const yardAccess = await requireYardAccess(
  request,
  db,
  container.yard_id,
  'คุณไม่มีสิทธิ์ดูรายละเอียดตู้ของลานนี้'
);
if (yardAccess instanceof NextResponse) return yardAccess;
```

Do not keep a second `const db = await getDb()` lower in the function.

- [ ] **Step 4: Apply the same pattern to `containers/timeline`**

Use this permission set:

```ts
[
  'gate.in',
  'gate.out',
  'yard.location.assign',
  'yard.slot.move',
  'reports.view',
]
```

Derive `yard_id` from the requested container before returning timeline rows.

- [ ] **Step 5: Run focused tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/container-detail-permissions.test.ts src/app/api/__tests__/read-api-permission-hardening.test.ts
```

Expected: PASS for container detail/timeline coverage.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/containers/detail/route.ts src/app/api/containers/timeline/route.ts src/app/api/__tests__/container-detail-permissions.test.ts src/app/api/__tests__/read-api-permission-hardening.test.ts
git commit -m "Harden container detail read APIs"
```

---

## Task 3: Harden Dashboard, Search, Reports, Yard Stats, And Operations Stream

**Files:**
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/api/search/route.ts`
- Modify: `src/app/api/reports/dwell/route.ts`
- Modify: `src/app/api/reports/gate/route.ts`
- Modify: `src/app/api/reports/mnr/route.ts`
- Modify: `src/app/api/yard/stats/route.ts`
- Modify: `src/app/api/operations/stream/route.ts`
- Create: `src/app/api/__tests__/read-route-runtime-permissions.test.ts`

- [ ] **Step 1: Write runtime tests for representative read routes**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { GET as dashboardGET } from '../dashboard/route';
import { GET as searchGET } from '../search/route';
import { requireAnyPermission } from '@/lib/apiAuth';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedGetDb = getDb as jest.Mock;

describe('read route permission runtime checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAnyPermission.mockResolvedValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
  });

  it('dashboard returns 403 before analytics queries when reports permission is missing', async () => {
    const response = await dashboardGET(new NextRequest('http://localhost/api/dashboard?yard_id=1'));

    expect(response.status).toBe(403);
    expect(mockedGetDb).not.toHaveBeenCalled();
  });

  it('global search returns 403 before search queries when read permission is missing', async () => {
    const response = await searchGET(new NextRequest('http://localhost/api/search?q=ONEU&yard_id=1'));

    expect(response.status).toBe(403);
    expect(mockedGetDb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/read-route-runtime-permissions.test.ts
```

Expected: FAIL where routes open DB before a permission guard.

- [ ] **Step 3: Add route-level guards**

Add this to dashboard and reports before DB work:

```ts
const actor = await requirePermission(request, db, 'reports.view', 'คุณไม่มีสิทธิ์ดูรายงาน');
if (actor instanceof NextResponse) return actor;
```

For global search, add:

```ts
const actor = await requireAnyPermission(
  request,
  db,
  ['gate.in', 'gate.out', 'booking.manage', 'billing.invoice.create', 'yard.location.assign', 'yard.slot.move', 'reports.view'],
  'คุณไม่มีสิทธิ์ค้นหาข้อมูลในระบบ'
);
if (actor instanceof NextResponse) return actor;
```

For `yard/stats`, add:

```ts
const actor = await requireAnyPermission(
  request,
  db,
  ['reports.view', 'yard.location.assign', 'yard.slot.move'],
  'คุณไม่มีสิทธิ์ดูสถิติลาน'
);
if (actor instanceof NextResponse) return actor;
```

For `operations/stream`, add:

```ts
const actor = await requireAnyPermission(
  request,
  db,
  ['yard.slot.move', 'yard.location.assign'],
  'คุณไม่มีสิทธิ์ดูงานปฏิบัติการลาน'
);
if (actor instanceof NextResponse) return actor;
```

- [ ] **Step 4: Run focused tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/read-route-runtime-permissions.test.ts src/app/api/__tests__/read-api-permission-hardening.test.ts src/app/api/__tests__/yard-access-guard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dashboard/route.ts src/app/api/search/route.ts src/app/api/reports/dwell/route.ts src/app/api/reports/gate/route.ts src/app/api/reports/mnr/route.ts src/app/api/yard/stats/route.ts src/app/api/operations/stream/route.ts src/app/api/__tests__/read-route-runtime-permissions.test.ts
git commit -m "Harden dashboard search and report read APIs"
```

---

## Task 4: Harden Document, Integration, BoxTech, Customer 360, Entity Timeline, Audit, And M&R PDF Reads

**Files:**
- Modify: `src/app/api/audit-trail/readable/route.ts`
- Modify: `src/app/api/boxtech/route.ts`
- Modify: `src/app/api/customers/360/route.ts`
- Modify: `src/app/api/documents/activity/route.ts`
- Modify: `src/app/api/documents/consistency/route.ts`
- Modify: `src/app/api/documents/lifecycle/route.ts`
- Modify: `src/app/api/entity-timeline/route.ts`
- Modify: `src/app/api/integrations/logs/route.ts`
- Modify: `src/app/api/integrations/mapping/route.ts`
- Modify: `src/app/api/mnr/eor-pdf/route.ts`
- Modify: `src/app/api/settings/data-quality/route.ts`
- Modify: `src/app/api/settings/sop/route.ts`
- Modify: `src/app/api/settings/status-model/route.ts`
- Modify: `src/app/api/__tests__/read-api-permission-hardening.test.ts`

- [ ] **Step 1: Add permission guards by route group**

Use these guards:

```ts
await requirePermission(request, db, 'audit_trail.read', 'คุณไม่มีสิทธิ์ดู Audit Trail');
await requireAnyPermission(request, db, ['gate.in', 'gate.out', 'yard.location.assign', 'yard.slot.move'], 'คุณไม่มีสิทธิ์ดึงข้อมูล BoxTech');
await requireAnyPermission(request, db, ['reports.view', 'billing.invoice.create', 'settings.manage'], 'คุณไม่มีสิทธิ์ดู Customer 360');
await requireAnyPermission(request, db, ['audit_trail.read', 'reports.view', 'document_templates.view', 'billing.invoice.create', 'billing.payment.receive'], 'คุณไม่มีสิทธิ์ดูเอกสาร');
await requireAnyPermission(request, db, ['integration.logs.view', 'settings.manage'], 'คุณไม่มีสิทธิ์ดูข้อมูล Integration');
await requireAnyPermission(request, db, ['mnr.eor.create', 'mnr.eor.update', 'mnr.eor.approve', 'reports.view'], 'คุณไม่มีสิทธิ์ดูเอกสาร EOR');
await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ดูการตั้งค่าระบบ');
```

Return immediately when the guard returns `NextResponse`.

- [ ] **Step 2: Add yard guard where route has `yard_id` or can derive yard**

Use:

```ts
const yardAccess = await requireYardAccess(request, db, yardId, 'คุณไม่มีสิทธิ์ดูข้อมูลของลานนี้');
if (yardAccess instanceof NextResponse) return yardAccess;
```

For `mnr/eor-pdf`, derive `yard_id` from the EOR/M&R record before rendering PDF.

- [ ] **Step 3: Run static and existing focused tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/read-api-permission-hardening.test.ts src/app/api/__tests__/api-auth-coverage.test.ts src/app/api/__tests__/yard-access-guard.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/audit-trail/readable/route.ts src/app/api/boxtech/route.ts src/app/api/customers/360/route.ts src/app/api/documents/activity/route.ts src/app/api/documents/consistency/route.ts src/app/api/documents/lifecycle/route.ts src/app/api/entity-timeline/route.ts src/app/api/integrations/logs/route.ts src/app/api/integrations/mapping/route.ts src/app/api/mnr/eor-pdf/route.ts src/app/api/settings/data-quality/route.ts src/app/api/settings/sop/route.ts src/app/api/settings/status-model/route.ts src/app/api/__tests__/read-api-permission-hardening.test.ts
git commit -m "Harden remaining sensitive read APIs"
```

---

## Task 5: Tighten Portal EIR And Gate Detail Visibility To Exact Grants

**Files:**
- Modify: `src/lib/portalAccess.ts`
- Modify: `src/lib/__tests__/portalAccess.test.ts`
- Modify: `src/app/api/portal/eir/route.ts`
- Modify: `src/app/api/portal/eir-pdf/route.ts`
- Modify: `src/app/api/portal/document-bundle/route.ts`
- Modify: `src/app/api/portal/timeline/route.ts`
- Create: `src/app/api/__tests__/portal-eir-exact-grants.test.ts`

- [ ] **Step 1: Write portal access SQL tests**

```ts
import {
  portalEirVisibilitySql,
  portalGateVisibilitySql,
} from '@/lib/portalAccess';

describe('portal EIR and Gate exact grants', () => {
  it('EIR visibility does not include container fallback by default', () => {
    const sql = portalEirVisibilitySql('g', 'c');

    expect(sql).toContain("pea.entity_type = 'eir'");
    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).not.toContain("pea.entity_type = 'container'");
  });

  it('Gate visibility does not include container fallback by default', () => {
    const sql = portalGateVisibilitySql('g', 'c');

    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).not.toContain("pea.entity_type = 'container'");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/lib/__tests__/portalAccess.test.ts
```

Expected: FAIL because `portalGateVisibilitySql()` currently ORs container visibility.

- [ ] **Step 3: Split exact grant helpers from fallback helpers**

Replace the existing Gate/EIR helpers with:

```ts
export function portalGateExactVisibilitySql(gateAlias = 'g') {
  return portalEntityAccessSql('gate_transaction', `${gateAlias}.transaction_id`, `${gateAlias}.eir_number`);
}

export function portalEirExactVisibilitySql(gateAlias = 'g') {
  return `(
    ${portalEntityAccessSql('eir', `${gateAlias}.transaction_id`, `${gateAlias}.eir_number`)}
    OR ${portalGateExactVisibilitySql(gateAlias)}
  )`;
}

export function portalGateVisibilitySql(gateAlias = 'g', containerAlias = 'c', options: { allowContainerFallback?: boolean } = {}) {
  if (!options.allowContainerFallback) {
    return portalGateExactVisibilitySql(gateAlias);
  }

  return `(
    ${portalGateExactVisibilitySql(gateAlias)}
    OR ${portalContainerVisibilitySql(containerAlias)}
  )`;
}

export function portalEirVisibilitySql(gateAlias = 'g', containerAlias = 'c', options: { allowContainerFallback?: boolean } = {}) {
  if (!options.allowContainerFallback) {
    return portalEirExactVisibilitySql(gateAlias);
  }

  return `(
    ${portalEirExactVisibilitySql(gateAlias)}
    OR ${portalContainerVisibilitySql(containerAlias)}
  )`;
}
```

- [ ] **Step 4: Update portal detail/document routes**

Use `portalEirVisibilitySql('g', 'c')` without fallback in:

```ts
src/app/api/portal/eir/route.ts
src/app/api/portal/eir-pdf/route.ts
```

Use exact Gate/EIR grants for document bundle downloads. Allow container fallback only for summary timeline rows with:

```ts
portalGateVisibilitySql('g', 'c', { allowContainerFallback: true })
```

Only use that fallback when the response omits driver, signature, billing, photos, and full damage detail.

- [ ] **Step 5: Write API leakage tests**

```ts
describe('portal EIR exact grant policy', () => {
  it('does not authorize EIR detail from container grant only', () => {
    const sql = portalEirVisibilitySql('g', 'c');
    expect(sql).not.toMatch(/entity_type\s*=\s*'container'/);
  });

  it('keeps explicit fallback opt-in for summary timelines', () => {
    const sql = portalGateVisibilitySql('g', 'c', { allowContainerFallback: true });
    expect(sql).toMatch(/entity_type\s*=\s*'container'/);
  });
});
```

- [ ] **Step 6: Run focused tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/lib/__tests__/portalAccess.test.ts src/app/api/__tests__/portal-eir-exact-grants.test.ts src/app/api/__tests__/portal-eir-visibility.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/portalAccess.ts src/lib/__tests__/portalAccess.test.ts src/app/api/portal/eir/route.ts src/app/api/portal/eir-pdf/route.ts src/app/api/portal/document-bundle/route.ts src/app/api/portal/timeline/route.ts src/app/api/__tests__/portal-eir-exact-grants.test.ts
git commit -m "Tighten portal EIR and gate grants"
```

---

## Task 6: Move RBAC Seed Sync Out Of GET Permissions

**Files:**
- Create: `src/lib/rbacSeeds.ts`
- Modify: `src/app/api/settings/permissions/route.ts`
- Create: `src/app/api/settings/permissions/sync/route.ts`
- Create: `src/app/api/__tests__/permissions-sync.test.ts`

- [ ] **Step 1: Extract seed data and sync function**

Create `src/lib/rbacSeeds.ts` with:

```ts
import sql from 'mssql';

export const ROLE_SEEDS = [
  { code: 'yard_manager', name: 'ผู้จัดการลาน / Admin' },
  { code: 'supervisor', name: 'Supervisor / ผู้อนุมัติ' },
  { code: 'gate_clerk', name: 'Gate Clerk / พนักงานประตู' },
  { code: 'surveyor', name: 'Surveyor / พนักงานตรวจสภาพ' },
  { code: 'yard_planner', name: 'Yard Planner / ผู้วางแผนลาน' },
  { code: 'rs_driver', name: 'คนขับรถยก' },
  { code: 'billing_officer', name: 'Billing / บัญชีการเงิน' },
  { code: 'customer', name: 'ลูกค้า' },
];

export const PERMISSION_SEEDS = [
  { code: 'gate.in', module: 'gate', action: 'gate_in', description: 'ทำ Gate In และบันทึกรับตู้เข้าลาน' },
  { code: 'gate.out', module: 'gate', action: 'gate_out', description: 'ทำ Gate Out และปล่อยตู้ออกจากลาน' },
  { code: 'reports.view', module: 'reports', action: 'view', description: 'ดูรายงานและส่งออก Excel' },
  { code: 'audit_trail.read', module: 'audit_trail', action: 'read', description: 'ดูประวัติการใช้งานและ audit trail' },
  { code: 'settings.manage', module: 'settings', action: 'manage', description: 'ตั้งค่าระบบ' },
  { code: 'permissions.manage', module: 'settings', action: 'permissions_manage', description: 'จัดการสิทธิ์และ role ของผู้ใช้งาน', risk: 'high' },
];

export const ROLE_GRANTS: Record<string, string[]> = {
  gate_clerk: ['gate.in', 'gate.out'],
  supervisor: ['gate.in', 'gate.out', 'reports.view', 'audit_trail.read'],
};

export async function syncGranularRbac(db: sql.ConnectionPool) {
  for (const role of ROLE_SEEDS) {
    await db.request()
      .input('code', sql.NVarChar(50), role.code)
      .input('name', sql.NVarChar(100), role.name)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = @code)
          INSERT INTO Roles (role_code, role_name) VALUES (@code, @name)
        ELSE
          UPDATE Roles SET role_name = @name WHERE role_code = @code
      `);
  }

  for (const perm of PERMISSION_SEEDS) {
    await db.request()
      .input('code', sql.NVarChar(100), perm.code)
      .input('module', sql.NVarChar(50), perm.module)
      .input('action', sql.NVarChar(50), perm.action)
      .input('description', sql.NVarChar(255), perm.description)
      .input('riskLevel', sql.NVarChar(20), 'risk' in perm ? perm.risk || null : null)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_code = @code)
          INSERT INTO Permissions (permission_code, module, action, description, risk_level)
          VALUES (@code, @module, @action, @description, @riskLevel)
        ELSE
          UPDATE Permissions
          SET module = @module,
              action = @action,
              description = @description,
              risk_level = @riskLevel
          WHERE permission_code = @code
      `);
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_GRANTS)) {
    for (const permissionCode of permissionCodes) {
      await db.request()
        .input('roleCode', sql.NVarChar(50), roleCode)
        .input('permissionCode', sql.NVarChar(100), permissionCode)
        .query(`
          INSERT INTO RolePermissions (role_id, permission_id)
          SELECT r.role_id, p.permission_id
          FROM Roles r
          CROSS JOIN Permissions p
          WHERE r.role_code = @roleCode
            AND p.permission_code = @permissionCode
            AND NOT EXISTS (
              SELECT 1
              FROM RolePermissions rp
              WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
            )
        `);
    }
  }

  await db.request().query(`
    INSERT INTO RolePermissions (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM Roles r
    CROSS JOIN Permissions p
    WHERE r.role_code = 'yard_manager'
      AND NOT EXISTS (
        SELECT 1
        FROM RolePermissions rp
        WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
      )
  `);
}
```

When implementing, move the full current seed arrays from `settings/permissions/route.ts`; do not keep the shortened sample above.

- [ ] **Step 2: Remove sync from `GET /api/settings/permissions`**

Delete this line from `GET`:

```ts
await ensureGranularRbac(db);
```

Keep role and permission reads unchanged.

- [ ] **Step 3: Add explicit sync endpoint**

Create `src/app/api/settings/permissions/sync/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireRole } from '@/lib/apiAuth';
import { syncGranularRbac } from '@/lib/rbacSeeds';

export async function POST(request: NextRequest) {
  const actor = requireRole(request, ['yard_manager'], 'เฉพาะ Yard Manager เท่านั้นที่ sync สิทธิ์ได้');
  if (actor instanceof NextResponse) return actor;

  try {
    const db = await getDb();
    await syncGranularRbac(db);
    await logAudit({
      userId: actor.userId,
      action: 'permissions_seed_sync',
      entityType: 'permission',
      details: { source: 'settings_permissions_sync' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST permissions sync error:', error);
    return NextResponse.json({ error: 'ไม่สามารถ sync สิทธิ์ได้' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write tests**

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('permissions sync endpoint', () => {
  it('does not run RBAC seed sync from GET permissions', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/settings/permissions/route.ts'), 'utf8');

    const getBlock = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function PUT'));
    expect(getBlock).not.toContain('syncGranularRbac');
    expect(getBlock).not.toContain('ensureGranularRbac');
  });

  it('has an explicit POST sync endpoint', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/settings/permissions/sync/route.ts'), 'utf8');

    expect(source).toContain('export async function POST');
    expect(source).toContain('requireRole');
    expect(source).toContain('syncGranularRbac');
    expect(source).toContain('logAudit');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/permissions-sync.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rbacSeeds.ts src/app/api/settings/permissions/route.ts src/app/api/settings/permissions/sync/route.ts src/app/api/__tests__/permissions-sync.test.ts
git commit -m "Move RBAC seed sync out of permissions read"
```

---

## Task 7: Refactor Internal Schedulers Away From Protected API Fetches

**Files:**
- Create: `src/lib/bookingSummaryJob.ts`
- Modify: `src/app/api/cron/booking-summary/route.ts`
- Modify: `src/lib/bookingScheduler.ts`
- Create: `src/lib/codecoSendJob.ts`
- Modify: `src/app/api/edi/codeco/send/route.ts`
- Modify: `src/lib/ediScheduler.ts`
- Create: `src/app/api/__tests__/scheduler-internal-jobs.test.ts`

- [ ] **Step 1: Add static test that schedulers do not call local API routes**

```ts
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('internal schedulers call helpers instead of protected API endpoints', () => {
  it('booking scheduler does not fetch cron API', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/lib/bookingScheduler.ts'), 'utf8');
    expect(source).not.toContain("fetch('/api/cron/booking-summary");
    expect(source).not.toContain('fetch("/api/cron/booking-summary');
  });

  it('EDI scheduler does not fetch CODECO send API', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/lib/ediScheduler.ts'), 'utf8');
    expect(source).not.toContain('/api/edi/codeco/send');
  });
});
```

- [ ] **Step 2: Extract booking summary helper**

Create `src/lib/bookingSummaryJob.ts`:

```ts
export interface BookingSummaryJobResult {
  success: boolean;
  sent: number;
  skipped: number;
  errors: string[];
}

export async function runBookingSummaryJob(): Promise<BookingSummaryJobResult> {
  return {
    success: true,
    sent: 0,
    skipped: 0,
    errors: [],
  };
}
```

Move the existing booking summary logic from `src/app/api/cron/booking-summary/route.ts` into this helper. Do not commit the skeleton return shown above; the committed helper must return the exact result object currently produced by the route.

- [ ] **Step 3: Protect manual cron route**

In `src/app/api/cron/booking-summary/route.ts`, require:

```ts
const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ส่ง Booking summary');
if (actor instanceof NextResponse) return actor;
```

Then call:

```ts
const result = await runBookingSummaryJob();
return NextResponse.json(result);
```

- [ ] **Step 4: Update booking scheduler**

Replace local API fetch with:

```ts
import { runBookingSummaryJob } from '@/lib/bookingSummaryJob';

await runBookingSummaryJob();
```

- [ ] **Step 5: Extract CODECO send helper**

Create `src/lib/codecoSendJob.ts`:

```ts
export interface CodecoSendJobInput {
  yardId: number;
  endpointId?: number;
  triggeredByUserId?: number;
  source: 'manual_api' | 'scheduler';
}

export interface CodecoSendJobResult {
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}

export async function runCodecoSendJob(input: CodecoSendJobInput): Promise<CodecoSendJobResult> {
  void input;
  return {
    success: true,
    sent: 0,
    failed: 0,
    errors: [],
  };
}
```

Move CODECO send behavior from `src/app/api/edi/codeco/send/route.ts` into this helper without changing SQL, audit, or transport semantics.

- [ ] **Step 6: Update API and scheduler to use helper**

In the API route, keep `requirePermission(request, db, 'integration.send')` and `requireYardAccess`, then call:

```ts
const result = await runCodecoSendJob({
  yardId,
  endpointId,
  triggeredByUserId: actor.userId,
  source: 'manual_api',
});
```

In `src/lib/ediScheduler.ts`, call:

```ts
await runCodecoSendJob({
  yardId,
  endpointId,
  source: 'scheduler',
});
```

- [ ] **Step 7: Run tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/scheduler-internal-jobs.test.ts src/app/api/__tests__/edi-api-hardening.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bookingSummaryJob.ts src/app/api/cron/booking-summary/route.ts src/lib/bookingScheduler.ts src/lib/codecoSendJob.ts src/app/api/edi/codeco/send/route.ts src/lib/ediScheduler.ts src/app/api/__tests__/scheduler-internal-jobs.test.ts
git commit -m "Route schedulers through internal job helpers"
```

---

## Task 8: Centralize Auth Fetch Patch And Prevent HMR Double Wrapping

**Files:**
- Modify: `src/lib/authFetch.ts`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(portal)/layout.tsx`
- Create: `src/lib/__tests__/authFetch.test.ts`

- [ ] **Step 1: Add install helper**

Append to `src/lib/authFetch.ts`:

```ts
const PATCH_MARKER = Symbol.for('cyms.authFetchPatched');
const ORIGINAL_FETCH = Symbol.for('cyms.originalFetch');

type PatchedWindow = Window & {
  [PATCH_MARKER]?: boolean;
  [ORIGINAL_FETCH]?: typeof window.fetch;
};

export function installAuthFetchPatch(win: Window = window) {
  const patchedWindow = win as PatchedWindow;
  if (patchedWindow[PATCH_MARKER]) return;

  const originalFetch = patchedWindow[ORIGINAL_FETCH] || win.fetch.bind(win);
  patchedWindow[ORIGINAL_FETCH] = originalFetch;

  win.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('cyms_token');
    const headers = new Headers(init?.headers);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return originalFetch(input, { ...init, headers });
  };

  patchedWindow[PATCH_MARKER] = true;
}
```

- [ ] **Step 2: Update layouts**

Replace direct `window.fetch = ...` code in both layouts with:

```ts
import { installAuthFetchPatch } from '@/lib/authFetch';

useEffect(() => {
  installAuthFetchPatch(window);
}, []);
```

- [ ] **Step 3: Add tests**

```ts
import { installAuthFetchPatch } from '@/lib/authFetch';

describe('installAuthFetchPatch', () => {
  it('does not wrap fetch twice', async () => {
    const originalFetch = jest.fn().mockResolvedValue(new Response('{}'));
    const win = {
      fetch: originalFetch,
      localStorage: {
        getItem: jest.fn().mockReturnValue('token-1'),
      },
    } as unknown as Window;

    installAuthFetchPatch(win);
    const once = win.fetch;
    installAuthFetchPatch(win);

    expect(win.fetch).toBe(once);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/lib/__tests__/authFetch.test.ts
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authFetch.ts src/app/(dashboard)/layout.tsx src/app/(portal)/layout.tsx src/lib/__tests__/authFetch.test.ts
git commit -m "Centralize authenticated fetch patch"
```

---

## Task 9: Split Gate In And Gate Out Components Without Behavior Changes

**Files:**
- Create: `src/app/(dashboard)/gate/components/GateInContainerSection.tsx`
- Create: `src/app/(dashboard)/gate/components/GateInBusinessRelationshipSection.tsx`
- Create: `src/app/(dashboard)/gate/components/GateInDriverSection.tsx`
- Create: `src/app/(dashboard)/gate/components/GateInInspectionSection.tsx`
- Create: `src/app/(dashboard)/gate/components/GateOutSearchSection.tsx`
- Create: `src/app/(dashboard)/gate/components/GateOutReleaseRequestSection.tsx`
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`

- [ ] **Step 1: Extract `GateInContainerSection`**

Create a component with props that are already state values in `GateInTab.tsx`:

```tsx
interface GateInContainerSectionProps {
  containerNumber: string;
  size: string;
  type: string;
  shippingLine: string;
  tareWeightKg: string;
  maxGrossWeightKg: string;
  sealNumber: string;
  isLaden: boolean;
  isSoc: boolean;
  onContainerNumberChange: (value: string) => void;
  onSizeChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onShippingLineChange: (value: string) => void;
  onTareWeightKgChange: (value: string) => void;
  onMaxGrossWeightKgChange: (value: string) => void;
  onSealNumberChange: (value: string) => void;
  onIsLadenChange: (value: boolean) => void;
  onIsSocChange: (value: boolean) => void;
}

export function GateInContainerSection(props: GateInContainerSectionProps) {
  return (
    <section aria-label="ข้อมูลตู้">
      {/*
        Copy the current JSX block headed by "ข้อมูลตู้" from GateInTab.tsx here,
        then replace direct state variables with the explicit props above.
      */}
    </section>
  );
}
```

Before committing, the section body must contain the copied `ข้อมูลตู้` JSX and must not contain the orienting comment above.

- [ ] **Step 2: Extract remaining Gate In sections**

Use the same pattern:

```tsx
export function GateInBusinessRelationshipSection() {
  return <section aria-label="เจ้าของตู้และความสัมพันธ์ทางธุรกิจ" />;
}

export function GateInDriverSection() {
  return <section aria-label="ข้อมูลคนขับและรถ" />;
}

export function GateInInspectionSection() {
  return <section aria-label="ตรวจสภาพตู้" />;
}
```

For each component, copy the matching section block from `GateInTab.tsx`, keep the same labels/classes/handlers, and replace state references with explicit props. Do not move API calls in this task.

- [ ] **Step 3: Extract Gate Out search and release request sections**

Use:

```tsx
export function GateOutSearchSection() {
  return <section aria-label="ค้นหาตู้ในลาน" />;
}

export function GateOutReleaseRequestSection() {
  return <section aria-label="คำขอดึงตู้และปล่อยออก" />;
}
```

For each component, copy the matching section block from `GateOutTab.tsx`, keep the same labels/classes/handlers, and replace state references with explicit props. Do not change the two-phase Gate Out flow.

- [ ] **Step 4: Verify type and lint**

```bash
npx tsc --noEmit --pretty false
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/gate/GateInTab.tsx src/app/(dashboard)/gate/GateOutTab.tsx src/app/(dashboard)/gate/components/GateInContainerSection.tsx src/app/(dashboard)/gate/components/GateInBusinessRelationshipSection.tsx src/app/(dashboard)/gate/components/GateInDriverSection.tsx src/app/(dashboard)/gate/components/GateInInspectionSection.tsx src/app/(dashboard)/gate/components/GateOutSearchSection.tsx src/app/(dashboard)/gate/components/GateOutReleaseRequestSection.tsx
git commit -m "Split gate workflow sections"
```

---

## Task 10: Update Handoff And Run Full Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Add a new update section at the top of Handoff**

Add:

```md
### อัปเดตล่าสุด: Read-side Policy Hardening + Portal Exact EIR Grants + Runtime Cleanup (27 พ.ค. 2569)

รอบนี้ปิดความเสี่ยงฝั่ง read API และ portal document visibility ที่ยังเหลือจาก hardening queue:

- Read-side API เช่น container detail/timeline, dashboard, search, reports, documents, M&R PDF, BoxTech, integrations และ yard stats เพิ่ม route-level permission guard ก่อน query ข้อมูลสำคัญ
- Portal EIR/Gate detail เปลี่ยนเป็น exact grant policy โดยไม่ใช้ container visibility เป็น fallback สำหรับ detail/PDF; container fallback เหลือเฉพาะ summary ที่ sanitize แล้ว
- Permissions GET ไม่ sync seed หรือ mutate RBAC อีกต่อไป; เพิ่ม explicit sync endpoint พร้อม audit log
- Scheduler เรียก internal job helper แทนการ fetch protected API endpoint
- Auth fetch patch ใช้ helper กลางและกัน HMR double wrapping
- Gate In/Gate Out เริ่ม split เป็น section components โดยไม่เปลี่ยน business behavior

Verification:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/read-api-permission-hardening.test.ts src/app/api/__tests__/container-detail-permissions.test.ts src/app/api/__tests__/read-route-runtime-permissions.test.ts src/app/api/__tests__/portal-eir-exact-grants.test.ts src/app/api/__tests__/permissions-sync.test.ts src/app/api/__tests__/scheduler-internal-jobs.test.ts src/lib/__tests__/authFetch.test.ts
npx tsc --noEmit --pretty false
npm run lint
npm test -- --cacheDirectory .tmp\jest --runInBand
```
```

- [ ] **Step 2: Run focused verification**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/read-api-permission-hardening.test.ts src/app/api/__tests__/container-detail-permissions.test.ts src/app/api/__tests__/read-route-runtime-permissions.test.ts src/app/api/__tests__/portal-eir-exact-grants.test.ts src/app/api/__tests__/permissions-sync.test.ts src/app/api/__tests__/scheduler-internal-jobs.test.ts src/lib/__tests__/authFetch.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full verification**

```bash
npx tsc --noEmit --pretty false
npm run lint
npm test -- --cacheDirectory .tmp\jest --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit Handoff and final fixes**

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Document read policy hardening follow-up"
```

- [ ] **Step 5: Push**

```bash
git push origin codex/api-permission-hardening
```

Expected: push succeeds.

---

## Execution Order

1. Task 1: failing static coverage  
2. Task 2: container detail/timeline  
3. Task 3: dashboard/search/reports/yard stats/operations stream  
4. Task 4: document/integration/boxtech/customer/audit/M&R/settings reads  
5. Task 5: Portal exact EIR/Gate grants  
6. Task 6: RBAC seed cleanup  
7. Task 7: scheduler helpers  
8. Task 8: auth fetch patch cleanup  
9. Task 9: Gate component split  
10. Task 10: handoff, full verification, push

Commit after every task. If a task causes broad test drift, stop and fix the focused failure before continuing.

---

## Acceptance Criteria

1. Sensitive read APIs have route-level permission guards, not only proxy or yard guard.
2. Sensitive read APIs that expose yard-scoped data call `requireYardAccess` before returning data.
3. `containers/detail` no longer returns billing, booking, EDI, approval, or driver data without server-side permission.
4. Portal EIR JSON and PDF require exact `eir` or `gate_transaction` grants by default.
5. Portal container visibility no longer unlocks full EIR/Gate detail or PDF unless a route explicitly opts into sanitized summary fallback.
6. `GET /api/settings/permissions` is read-only.
7. RBAC seed sync is explicit, restricted to `yard_manager`, and audit logged.
8. Internal schedulers do not fetch local protected API endpoints.
9. Dashboard and portal layouts do not double-wrap `window.fetch` during HMR.
10. Gate In and Gate Out are split into focused section components without changing user-facing behavior.
11. `DEVELOPER_HANDOFF.md` documents the changes and verification commands.
12. Focused Jest tests pass.
13. `npx tsc --noEmit --pretty false` passes.
14. `npm run lint` passes.
15. Full `npm test -- --cacheDirectory .tmp\jest --runInBand` passes.
