# CYMS Portal EIR Access Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Customer Portal and EIR visibility so portal data is grant-based, public EIR is minimal, customer actions are permission checked, and driver/trucking access is modeled in backend policy without adding new UI.

**Architecture:** Keep `PortalEntityAccess` as the source of truth for item visibility, add `eirVisibility.ts` as the central EIR field policy, and route all EIR JSON/PDF/public responses through sanitized payloads. Business tables create grants; customer user role permissions authorize actions; public EIR gets only verification fields.

**Tech Stack:** Next.js App Router API routes, TypeScript, MS SQL via `mssql`, Jest static/API tests, existing `proxy.ts` JWT header forwarding, `logAudit`, `eirPayload`, `eirPdfGenerator`.

---

## File Structure

- Create `src/lib/eirVisibility.ts`: EIR view type resolution, field masking, `canViewContainerGrade`, and sanitized payload builder.
- Create `src/lib/eirAccessLog.ts`: shared EIR view/download/print/public verification logger.
- Create `src/lib/customerPortalPermissions.ts`: fixed customer portal role-to-action map and `requirePortalAction`.
- Create `src/lib/portalGrantRules.ts`: business-event grant helpers for booking, booking containers, gate/EIR/container, invoices, and reefer.
- Create `src/app/api/public/eir/route.ts`: public sanitized EIR verification endpoint.
- Create `src/app/api/portal/grants/field-scope/route.ts`: narrow admin-only grant field scope updater for future UI and audited grade visibility toggles.
- Modify `src/proxy.ts`: remove `/api/gate/eir` from public APIs and allow `/api/public/eir`.
- Modify `src/lib/portalAccess.ts`: extend entity types, valid-window SQL, grant scope query helpers.
- Modify `src/lib/portalEntityAccess.ts`: accept scope/windows and update existing grants.
- Modify `src/lib/portalGrantReconciler.ts`: expected grants include EIR/reefer/new party fields/scope/windows.
- Modify `src/lib/eirPayload.ts`: keep master grade fields and add document status/version fields when available.
- Modify `src/lib/eirPdfGenerator.ts`: accept sanitized optional grade fields and copy labels.
- Modify `src/app/api/gate/eir/route.ts`: internal-only, permission checked, sanitized internal view, access log.
- Modify `src/app/api/portal/eir/route.ts`: portal action + grant + sanitized customer view + access log.
- Modify `src/app/api/portal/eir-pdf/route.ts`: portal download permission + sanitized PDF + access log.
- Modify `src/app/eir/[id]/EIRPublicView.tsx`: call public endpoint and render minimal public payload only.
- Modify grant source routes: `src/app/api/edi/bookings/route.ts`, `src/app/api/portal/bookings/route.ts`, `src/app/api/bookings/containers/route.ts`, `src/app/api/gate/route.ts`, `src/app/api/billing/invoices/route.ts`, `src/app/api/reefer/checks/route.ts`, `src/app/api/reefer/exceptions/route.ts`.
- Modify portal action routes: `src/app/api/portal/invoices/route.ts`, `src/app/api/portal/invoice-pdf/route.ts`, `src/app/api/portal/document-bundle/route.ts`, `src/app/api/portal/disputes/route.ts`, `src/app/api/portal/bookings/documents/route.ts`, `src/app/api/portal/bookings/amendments/route.ts`, `src/app/api/portal/statement/route.ts`, `src/app/api/portal/reefer/route.ts`.
- Modify schema references: `scripts/migrate-runtime-core-schema.js`, `scripts/setup-db.js`, `src/lib/schema.sql`.
- Modify `DEVELOPER_HANDOFF.md`: document the final schema, routes, policies, migration, and verification.

---

### Task 1: P0 EIR Visibility Unit Tests

**Files:**
- Create: `src/lib/__tests__/eirVisibility.test.ts`
- Create: `src/app/api/__tests__/eir-public-policy.test.ts`

- [ ] **Step 1: Write failing unit tests for field masking**

```ts
// src/lib/__tests__/eirVisibility.test.ts
import {
  buildEirViewPayload,
  canViewContainerGrade,
  maskPersonName,
  maskPhone,
  maskTruckPlate,
} from '../eirVisibility';

const master = {
  eir_number: 'EIR-IN-2026-000001',
  transaction_type: 'gate_in',
  date: '2026-05-25T08:00:00.000Z',
  container_number: 'ONEU1234567',
  yard_name: 'Main Yard',
  document_status: 'valid',
  container_condition: 'damage',
  container_grade: 'C',
  container_grade_label: 'Grade C',
  driver_name: 'Somchai Driver',
  driver_phone: '0812345678',
  truck_plate: '70-1234',
  seal_number: 'SEAL-1',
  booking_ref: 'BK-001',
  damage_report: {
    condition_grade: 'C',
    inspector_notes: 'internal note',
    points: [{ side: 'left', type: 'dent', severity: 'major', note: 'dent', photo: '/uploads/dent.jpg' }],
    photo_evidence: [{ url: '/uploads/front.jpg', category: 'front', label: 'Front' }],
  },
  billing_clearance: { status: 'cleared' },
  internal_note: 'hold reason',
  invoice_amount: 1200,
};

describe('eirVisibility', () => {
  it('masks helper fields deterministically', () => {
    expect(maskPhone('0812345678')).toBe('081****678');
    expect(maskTruckPlate('70-1234')).toBe('70-****');
    expect(maskPersonName('Somchai Driver')).toBe('Somchai D.');
  });

  it('public EIR returns minimal verification fields and hides grade', () => {
    const payload = buildEirViewPayload(master, { viewType: 'public' });
    expect(payload).toMatchObject({
      eir_number: 'EIR-IN-2026-000001',
      container_number: 'ONEU1234567',
      transaction_type: 'gate_in',
      yard_name: 'Main Yard',
      document_status: 'valid',
      container_condition: 'damage',
    });
    expect(payload).not.toHaveProperty('container_grade');
    expect(payload).not.toHaveProperty('driver_name');
    expect(payload).not.toHaveProperty('truck_plate');
    expect(payload).not.toHaveProperty('damage_report');
    expect(payload).not.toHaveProperty('invoice_amount');
  });

  it('customer default does not see container_grade', () => {
    const payload = buildEirViewPayload(master, {
      viewType: 'customer',
      permissions: new Set(['portal.eir.view']),
      accessGrant: { permission_scope: { view: true, eir: { fields: { container_grade: false } } } },
    });
    expect(payload).not.toHaveProperty('container_grade');
  });

  it('customer with action but closed grant scope still does not see grade', () => {
    expect(canViewContainerGrade({
      viewType: 'customer',
      permissions: new Set(['portal.eir.grade.view']),
      accessGrant: { permission_scope: { eir: { fields: { container_grade: false } } } },
    })).toBe(false);
  });

  it('customer sees grade only with action and grant field scope', () => {
    const payload = buildEirViewPayload(master, {
      viewType: 'customer',
      permissions: new Set(['portal.eir.view', 'portal.eir.grade.view']),
      accessGrant: { permission_scope: { eir: { fields: { container_grade: true } } } },
    });
    expect(payload).toMatchObject({ container_grade: 'C', container_grade_label: 'Grade C' });
  });

  it('internal sees grade while trucking and driver do not', () => {
    expect(buildEirViewPayload(master, { viewType: 'internal' })).toHaveProperty('container_grade', 'C');
    expect(buildEirViewPayload(master, { viewType: 'trucking' })).not.toHaveProperty('container_grade');
    expect(buildEirViewPayload(master, { viewType: 'driver' })).not.toHaveProperty('container_grade');
  });
});
```

- [ ] **Step 2: Write failing API policy tests**

```ts
// src/app/api/__tests__/eir-public-policy.test.ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('EIR public policy', () => {
  it('/api/gate/eir is not listed as a public API path', () => {
    const proxy = fs.readFileSync(path.join(root, 'src/proxy.ts'), 'utf8');
    expect(proxy).not.toMatch(/PUBLIC_API_PATHS[\s\S]*['"]\/api\/gate\/eir['"]/);
    expect(proxy).toContain("'/api/public/eir'");
  });

  it('/eir public page fetches the public sanitized endpoint', () => {
    const page = fs.readFileSync(path.join(root, 'src/app/eir/[id]/EIRPublicView.tsx'), 'utf8');
    expect(page).toContain('/api/public/eir');
    expect(page).not.toContain('/api/gate/eir');
    expect(page).not.toContain('Photo Evidence');
    expect(page).not.toContain('damagePoints.map');
  });

  it('public endpoint builds public view payload and logs public verification', () => {
    const route = fs.readFileSync(path.join(root, 'src/app/api/public/eir/route.ts'), 'utf8');
    expect(route).toContain("viewType: 'public'");
    expect(route).toContain('buildEirViewPayload');
    expect(route).toContain("action: 'public_verify'");
  });
});
```

- [ ] **Step 3: Run tests to verify RED**

Run:

```powershell
npm test -- src/lib/__tests__/eirVisibility.test.ts src/app/api/__tests__/eir-public-policy.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because `eirVisibility.ts` and `/api/public/eir/route.ts` do not exist and `/eir/[id]` still calls `/api/gate/eir`.

- [ ] **Step 4: Commit RED tests**

```powershell
git add src/lib/__tests__/eirVisibility.test.ts src/app/api/__tests__/eir-public-policy.test.ts
git commit -m "Add EIR visibility policy tests"
```

---

### Task 2: P0 Implement `eirVisibility.ts`

**Files:**
- Create: `src/lib/eirVisibility.ts`
- Test: `src/lib/__tests__/eirVisibility.test.ts`

- [ ] **Step 1: Add implementation**

```ts
// src/lib/eirVisibility.ts
export type EIRViewType =
  | 'internal'
  | 'customer'
  | 'shipping_line'
  | 'booking_customer'
  | 'billing'
  | 'trucking'
  | 'driver'
  | 'public'
  | 'auditor';

export interface PortalScope {
  view?: boolean;
  download?: boolean;
  dispute?: boolean;
  billing?: boolean;
  eir?: {
    fields?: {
      container_grade?: boolean;
      damage_summary?: boolean;
      damage_photos?: boolean;
    };
  };
  maskSensitiveFields?: boolean;
}

export interface EIRVisibilityGrant {
  access_role?: string | null;
  permission_scope?: PortalScope | string | null;
}

export interface EIRVisibilityContext {
  viewType: EIRViewType;
  accessGrant?: EIRVisibilityGrant | null;
  permissions?: Set<string>;
}

type AnyPayload = Record<string, unknown>;

function parseScope(scope: PortalScope | string | null | undefined): PortalScope {
  if (!scope) return {};
  if (typeof scope === 'object') return scope;
  try {
    const parsed = JSON.parse(scope);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function maskPhone(value: unknown) {
  const text = String(value || '').trim();
  if (text.length < 7) return text ? '***' : '';
  return `${text.slice(0, 3)}****${text.slice(-3)}`;
}

export function maskTruckPlate(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  const prefix = text.slice(0, Math.min(2, text.length));
  return `${prefix}-****`;
}

export function maskPersonName(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parts = text.split(/\s+/);
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`;
  return `${parts[0]} ${parts[1].slice(0, 1)}.`;
}

export function copyTypeLabel(viewType: EIRViewType) {
  if (viewType === 'public') return 'Public Verification Copy';
  if (viewType === 'driver') return 'Driver Copy';
  if (viewType === 'internal' || viewType === 'auditor') return 'Internal Copy';
  return 'Customer Copy';
}

export function canViewContainerGrade(context: EIRVisibilityContext) {
  if (context.viewType === 'public' || context.viewType === 'driver' || context.viewType === 'trucking') {
    return false;
  }
  if (context.viewType === 'internal' || context.viewType === 'auditor') return true;

  const permissions = context.permissions || new Set<string>();
  const scope = parseScope(context.accessGrant?.permission_scope);
  return permissions.has('portal.eir.grade.view') && scope.eir?.fields?.container_grade === true;
}

function damageSummary(master: AnyPayload) {
  const report = master.damage_report as { points?: unknown[] } | null | undefined;
  return {
    condition: master.container_condition || 'sound',
    damage_points: Array.isArray(report?.points) ? report.points.length : 0,
  };
}

export function buildEirViewPayload(master: AnyPayload, context: Partial<EIRVisibilityContext>) {
  const viewType = context.viewType || 'public';
  const base: AnyPayload = {
    eir_number: master.eir_number,
    container_number: master.container_number,
    transaction_type: master.transaction_type,
    gate_datetime: master.gate_datetime || master.date || master.created_at,
    date: master.date || master.created_at,
    yard_name: master.yard_name,
    yard_code: master.yard_code,
    document_status: master.document_status || 'valid',
    version_no: master.version_no || 1,
    container_condition: master.container_condition || 'sound',
    damage_summary: damageSummary(master),
    copy_type_label: copyTypeLabel(viewType),
  };

  if (canViewContainerGrade({ viewType, accessGrant: context.accessGrant, permissions: context.permissions })) {
    base.container_grade = master.container_grade;
    base.container_grade_label = master.container_grade_label || (master.container_grade ? `Grade ${master.container_grade}` : undefined);
  }

  if (viewType === 'public') return base;

  const operational: AnyPayload = {
    ...base,
    size: master.size,
    type: master.type,
    shipping_line: master.shipping_line,
    is_laden: master.is_laden,
    seal_number: master.seal_number,
    booking_ref: master.booking_ref,
  };

  if (viewType === 'driver') {
    return {
      ...operational,
      driver_name: master.driver_name,
      truck_plate: master.truck_plate,
    };
  }

  if (viewType === 'trucking') {
    return {
      ...operational,
      driver_name: master.driver_name ? maskPersonName(master.driver_name) : '',
      truck_plate: master.truck_plate,
    };
  }

  const customerPayload: AnyPayload = {
    ...operational,
    driver_name: master.driver_name ? maskPersonName(master.driver_name) : '',
    truck_plate: master.truck_plate ? maskTruckPlate(master.truck_plate) : '',
    damage_report: master.damage_report,
    notes: master.notes,
    company: master.company,
  };

  if (viewType === 'internal' || viewType === 'auditor') {
    return {
      ...master,
      copy_type_label: copyTypeLabel(viewType),
      document_status: master.document_status || 'valid',
      version_no: master.version_no || 1,
    };
  }

  return customerPayload;
}

export function resolveEirViewType(_actor: unknown, _eir: unknown, accessGrant?: EIRVisibilityGrant | null): EIRViewType {
  const role = accessGrant?.access_role;
  if (role === 'shipping_line') return 'shipping_line';
  if (role === 'booking_customer') return 'booking_customer';
  if (role === 'billing' || role === 'invoice_customer') return 'billing';
  if (role === 'trucking') return 'trucking';
  if (role === 'driver') return 'driver';
  return 'customer';
}
```

- [ ] **Step 2: Run unit tests to verify GREEN for helper**

Run:

```powershell
npm test -- src/lib/__tests__/eirVisibility.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 3: Commit helper**

```powershell
git add src/lib/eirVisibility.ts src/lib/__tests__/eirVisibility.test.ts
git commit -m "Add EIR visibility helper"
```

---

### Task 3: P0 Add Public EIR Endpoint And Lock Internal Route

**Files:**
- Create: `src/app/api/public/eir/route.ts`
- Modify: `src/proxy.ts`
- Modify: `src/app/eir/[id]/EIRPublicView.tsx`
- Modify: `src/app/api/gate/eir/route.ts`
- Test: `src/app/api/__tests__/eir-public-policy.test.ts`

- [ ] **Step 1: Create public endpoint**

```ts
// src/app/api/public/eir/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { buildEIRPayload, fetchCompanyProfile } from '@/lib/eirPayload';
import { buildEirViewPayload } from '@/lib/eirVisibility';
import { logEirAccess } from '@/lib/eirAccessLog';

export async function GET(request: NextRequest) {
  try {
    const eirNumber = new URL(request.url).searchParams.get('eir_number')?.trim();
    if (!eirNumber) return NextResponse.json({ error: 'eir_number required' }, { status: 400 });

    const db = await getDb();
    const result = await db.request()
      .input('eirNumber', sql.NVarChar, eirNumber)
      .query(`
        SELECT g.*, c.container_number, c.size, c.type, c.shipping_line, c.is_laden,
          c.tare_weight_kg, c.max_gross_weight_kg, c.container_grade,
          u.full_name as processed_by_name, y.yard_name, y.yard_code, z.zone_name
        FROM GateTransactions g
        JOIN Containers c ON g.container_id = c.container_id
        LEFT JOIN Users u ON g.processed_by = u.user_id
        LEFT JOIN Yards y ON g.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE g.eir_number = @eirNumber
      `);

    const row = result.recordset[0];
    if (!row) return NextResponse.json({ error: 'ไม่พบข้อมูล EIR' }, { status: 404 });

    const company = await fetchCompanyProfile(db);
    const master = buildEIRPayload(row, company);
    const eir = buildEirViewPayload(master, { viewType: 'public' });

    await logEirAccess({
      db,
      request,
      eirNumber: row.eir_number,
      gateTransactionId: row.transaction_id,
      viewType: 'public',
      action: 'public_verify',
    });

    return NextResponse.json({ eir });
  } catch (error) {
    console.error('❌ Public EIR error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูล EIR ได้' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Temporarily add `logEirAccess` stub so P0 compiles**

```ts
// src/lib/eirAccessLog.ts
import { NextRequest } from 'next/server';
import type { EIRViewType } from './eirVisibility';

export interface EirAccessLogDb {
  request(): {
    input(name: string, type: unknown, value: unknown): unknown;
    query(statement: string): Promise<unknown>;
  };
}

export async function logEirAccess(_params: {
  db: EirAccessLogDb;
  request: NextRequest;
  eirNumber: string;
  gateTransactionId?: number | null;
  userId?: number | null;
  customerId?: number | null;
  viewType: EIRViewType;
  action: 'view' | 'download' | 'print' | 'public_verify';
}) {
  return;
}
```

- [ ] **Step 3: Update proxy public API list**

In `src/proxy.ts`, change:

```ts
const PUBLIC_API_PATHS = [
  '/api/auth/',
  '/api/gate/eir',
];
```

to:

```ts
const PUBLIC_API_PATHS = [
  '/api/auth/',
  '/api/public/eir',
];
```

- [ ] **Step 4: Update `/eir/[id]` client**

In `src/app/eir/[id]/EIRPublicView.tsx`:

```ts
const res = await fetch(`/api/public/eir?eir_number=${encodeURIComponent(eirNumber)}`);
```

Remove the public photo gallery and damage point detail rendering. Render only:

```tsx
<MobileField label="EIR No." value={data.eir_number || '-'} />
<MobileField label="เลขตู้" value={data.container_number || '-'} />
<MobileField label="ประเภท" value={data.transaction_type === 'gate_in' ? 'Gate-In' : 'Gate-Out'} />
<MobileField label="วันที่" value={formatDateTime(data.gate_datetime || data.date)} />
<MobileField label="ลาน" value={data.yard_name || '-'} />
<MobileField label="สถานะเอกสาร" value={data.document_status || 'valid'} />
<MobileField label="ผลตรวจ" value={data.container_condition === 'damage' ? 'Damage' : 'Sound'} />
```

Do not render `container_grade`, `driver_name`, `truck_plate`, `seal_number`, `booking_ref`, photos, or `damage_report`.

- [ ] **Step 5: Make `/api/gate/eir` internal-only**

In `src/app/api/gate/eir/route.ts`, add:

```ts
import { requireAnyPermission } from '@/lib/apiAuth';
import { buildEIRPayload, fetchCompanyProfile, fetchEIRLifecycle } from '@/lib/eirPayload';
import { buildEirViewPayload } from '@/lib/eirVisibility';
```

Before querying:

```ts
const db = await getDb();
const actor = await requireAnyPermission(
  request,
  db,
  ['gate.eir.print', 'gate.transaction.create', 'reports.view'],
  'คุณไม่มีสิทธิ์ดู EIR ภายใน'
);
if (actor instanceof NextResponse) return actor;
```

Replace manual EIR object building with:

```ts
const company = await fetchCompanyProfile(db);
const master = buildEIRPayload(row, company);
const eirData = buildEirViewPayload(master, { viewType: 'internal' });
const lifecycle = await fetchEIRLifecycle(db, Number(row.transaction_id), row.eir_number);
return NextResponse.json({ eir: eirData, lifecycle });
```

- [ ] **Step 6: Run P0 tests**

Run:

```powershell
npm test -- src/lib/__tests__/eirVisibility.test.ts src/app/api/__tests__/eir-public-policy.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 7: Commit P0 leak fix**

```powershell
git add src/app/api/public/eir/route.ts src/lib/eirAccessLog.ts src/proxy.ts "src/app/eir/[id]/EIRPublicView.tsx" src/app/api/gate/eir/route.ts src/app/api/__tests__/eir-public-policy.test.ts
git commit -m "Harden public EIR visibility"
```

---

### Task 4: P1 Schema For EIR Logging And Portal Grant Scope

**Files:**
- Modify: `scripts/migrate-runtime-core-schema.js`
- Modify: `scripts/setup-db.js`
- Modify: `src/lib/schema.sql`
- Test: `src/app/api/__tests__/portal-access-schema.test.ts`

- [ ] **Step 1: Write failing schema static test**

```ts
// src/app/api/__tests__/portal-access-schema.test.ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Portal access schema hardening', () => {
  it('adds scoped PortalEntityAccess fields through migrations', () => {
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'permission_scope')");
    expect(migration).toContain('ALTER TABLE PortalEntityAccess ADD permission_scope NVARCHAR(MAX) NULL');
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'valid_from')");
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'valid_until')");
  });

  it('creates EIRAccessLog through migrations', () => {
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');
    expect(migration).toContain("OBJECT_ID('EIRAccessLog', 'U')");
    expect(migration).toContain('CREATE TABLE EIRAccessLog');
    expect(migration).toContain('public_verify');
  });

  it('adds customer portal role to Users', () => {
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');
    expect(migration).toContain("COL_LENGTH('Users', 'customer_portal_role')");
    expect(migration).toContain('customer_admin');
  });
});
```

- [ ] **Step 2: Run schema test to verify RED**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-access-schema.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL.

- [ ] **Step 3: Add migration block**

Add to `scripts/migrate-runtime-core-schema.js`:

```js
await runStep(pool, 'Portal access scoped policy fields', `
  IF OBJECT_ID('PortalEntityAccess', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('PortalEntityAccess', 'permission_scope') IS NULL
      ALTER TABLE PortalEntityAccess ADD permission_scope NVARCHAR(MAX) NULL;
    IF COL_LENGTH('PortalEntityAccess', 'valid_from') IS NULL
      ALTER TABLE PortalEntityAccess ADD valid_from DATETIME2 NULL;
    IF COL_LENGTH('PortalEntityAccess', 'valid_until') IS NULL
      ALTER TABLE PortalEntityAccess ADD valid_until DATETIME2 NULL;
    IF COL_LENGTH('PortalEntityAccess', 'updated_at') IS NULL
      ALTER TABLE PortalEntityAccess ADD updated_at DATETIME2 NULL;
  END;

  IF COL_LENGTH('Users', 'customer_portal_role') IS NULL
    ALTER TABLE Users ADD customer_portal_role NVARCHAR(40) NULL;

  UPDATE Users
  SET customer_portal_role = 'customer_admin'
  WHERE customer_id IS NOT NULL
    AND customer_portal_role IS NULL;
`);

await runStep(pool, 'EIR access log', `
  IF OBJECT_ID('EIRAccessLog', 'U') IS NULL
  BEGIN
    CREATE TABLE EIRAccessLog (
      access_id BIGINT PRIMARY KEY IDENTITY(1,1),
      eir_number NVARCHAR(80) NOT NULL,
      gate_transaction_id INT NULL,
      user_id INT NULL,
      customer_id INT NULL,
      view_type NVARCHAR(40) NOT NULL,
      action NVARCHAR(30) NOT NULL,
      ip_address NVARCHAR(100) NULL,
      user_agent NVARCHAR(500) NULL,
      accessed_at DATETIME2 NOT NULL DEFAULT GETDATE(),
      CONSTRAINT CK_EIRAccessLog_Action CHECK (action IN ('view', 'download', 'print', 'public_verify'))
    );
  END;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('EIRAccessLog') AND name = 'IX_EIRAccessLog_EIR')
    CREATE INDEX IX_EIRAccessLog_EIR ON EIRAccessLog (eir_number, accessed_at DESC);
`);
```

- [ ] **Step 4: Mirror schema in setup and schema reference**

Update `scripts/setup-db.js` `PortalEntityAccess` create SQL with:

```sql
permission_scope NVARCHAR(MAX) NULL,
valid_from DATETIME2 NULL,
valid_until DATETIME2 NULL,
```

Add table definition for `EIRAccessLog`.

Update `src/lib/schema.sql` with the same fields and table.

- [ ] **Step 5: Run schema tests**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-access-schema.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit schema**

```powershell
git add scripts/migrate-runtime-core-schema.js scripts/setup-db.js src/lib/schema.sql src/app/api/__tests__/portal-access-schema.test.ts
git commit -m "Add scoped portal access schema"
```

---

### Task 5: P1 Implement EIR Access Logging

**Files:**
- Modify: `src/lib/eirAccessLog.ts`
- Test: `src/app/api/__tests__/eir-access-log.test.ts`

- [ ] **Step 1: Write failing logger test**

```ts
// src/app/api/__tests__/eir-access-log.test.ts
import { NextRequest } from 'next/server';
import { logEirAccess } from '@/lib/eirAccessLog';

function makeDb() {
  const inputs: Record<string, unknown> = {};
  const input = jest.fn((name: string, _type: unknown, value: unknown) => {
    inputs[name] = value;
    return { input, query };
  });
  const query = jest.fn(async () => ({ recordset: [] }));
  return { db: { request: () => ({ input, query }) }, inputs, query };
}

describe('logEirAccess', () => {
  it('writes EIRAccessLog with request metadata', async () => {
    const { db, inputs, query } = makeDb();
    const request = new NextRequest('http://localhost/api/public/eir?eir_number=EIR-1', {
      headers: { 'user-agent': 'jest', 'x-forwarded-for': '10.0.0.5' },
    });

    await logEirAccess({
      db,
      request,
      eirNumber: 'EIR-1',
      gateTransactionId: 10,
      userId: 7,
      customerId: 42,
      viewType: 'customer',
      action: 'view',
    });

    expect(query.mock.calls[0][0]).toContain('INSERT INTO EIRAccessLog');
    expect(inputs).toMatchObject({
      eirNumber: 'EIR-1',
      gateTransactionId: 10,
      userId: 7,
      customerId: 42,
      viewType: 'customer',
      action: 'view',
      ipAddress: '10.0.0.5',
      userAgent: 'jest',
    });
  });
});
```

- [ ] **Step 2: Implement logger**

```ts
// src/lib/eirAccessLog.ts
import { NextRequest } from 'next/server';
import sql from 'mssql';
import type { EIRViewType } from './eirVisibility';

export interface EirAccessLogDbRequest {
  input(name: string, type: unknown, value: unknown): EirAccessLogDbRequest;
  query(statement: string): Promise<unknown>;
}

export interface EirAccessLogDb {
  request(): EirAccessLogDbRequest;
}

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
}

export async function logEirAccess(params: {
  db: EirAccessLogDb;
  request: NextRequest;
  eirNumber: string;
  gateTransactionId?: number | null;
  userId?: number | null;
  customerId?: number | null;
  viewType: EIRViewType;
  action: 'view' | 'download' | 'print' | 'public_verify';
}) {
  try {
    await params.db.request()
      .input('eirNumber', sql.NVarChar, params.eirNumber)
      .input('gateTransactionId', sql.Int, params.gateTransactionId || null)
      .input('userId', sql.Int, params.userId || null)
      .input('customerId', sql.Int, params.customerId || null)
      .input('viewType', sql.NVarChar, params.viewType)
      .input('action', sql.NVarChar, params.action)
      .input('ipAddress', sql.NVarChar, clientIp(params.request))
      .input('userAgent', sql.NVarChar, params.request.headers.get('user-agent'))
      .query(`
        INSERT INTO EIRAccessLog (
          eir_number, gate_transaction_id, user_id, customer_id,
          view_type, action, ip_address, user_agent, accessed_at
        )
        VALUES (
          @eirNumber, @gateTransactionId, @userId, @customerId,
          @viewType, @action, @ipAddress, @userAgent, GETDATE()
        )
      `);
  } catch (error) {
    console.error('⚠️ EIR access log failed:', error);
  }
}
```

- [ ] **Step 3: Run logger test**

Run:

```powershell
npm test -- src/app/api/__tests__/eir-access-log.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 4: Commit logger**

```powershell
git add src/lib/eirAccessLog.ts src/app/api/__tests__/eir-access-log.test.ts
git commit -m "Add EIR access logging"
```

---

### Task 6: P2 Customer Portal Action Permissions

**Files:**
- Create: `src/lib/customerPortalPermissions.ts`
- Test: `src/lib/__tests__/customerPortalPermissions.test.ts`

- [ ] **Step 1: Write failing permission tests**

```ts
// src/lib/__tests__/customerPortalPermissions.test.ts
import { getCustomerPortalActions, hasPortalAction } from '../customerPortalPermissions';

describe('customer portal permissions', () => {
  it('customer_admin has all baseline portal actions including grade view', () => {
    const actions = getCustomerPortalActions('customer_admin');
    expect(actions).toContain('portal.eir.grade.view');
    expect(actions).toContain('portal.invoice.download');
  });

  it('operations_user cannot view invoice but can view EIR without grade', () => {
    expect(hasPortalAction('operations_user', 'portal.eir.view')).toBe(true);
    expect(hasPortalAction('operations_user', 'portal.invoice.view')).toBe(false);
    expect(hasPortalAction('operations_user', 'portal.eir.grade.view')).toBe(false);
  });

  it('billing_user can view/download invoices', () => {
    expect(hasPortalAction('billing_user', 'portal.invoice.view')).toBe(true);
    expect(hasPortalAction('billing_user', 'portal.invoice.download')).toBe(true);
  });

  it('driver_user is limited to driver access', () => {
    expect(hasPortalAction('driver_user', 'portal.driver.view')).toBe(true);
    expect(hasPortalAction('driver_user', 'portal.invoice.view')).toBe(false);
  });
});
```

- [ ] **Step 2: Implement role/action map**

```ts
// src/lib/customerPortalPermissions.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

export type PortalAction =
  | 'portal.container.view'
  | 'portal.booking.view'
  | 'portal.booking.create'
  | 'portal.document.download'
  | 'portal.invoice.view'
  | 'portal.invoice.download'
  | 'portal.dispute.create'
  | 'portal.eir.view'
  | 'portal.eir.download'
  | 'portal.eir.grade.view'
  | 'portal.trucking.view'
  | 'portal.driver.view';

export type CustomerPortalRole =
  | 'customer_admin'
  | 'operations_user'
  | 'booking_user'
  | 'billing_user'
  | 'document_user'
  | 'trucking_coordinator'
  | 'driver_user'
  | 'read_only_viewer';

const ROLE_ACTIONS: Record<CustomerPortalRole, PortalAction[]> = {
  customer_admin: [
    'portal.container.view', 'portal.booking.view', 'portal.booking.create',
    'portal.document.download', 'portal.invoice.view', 'portal.invoice.download',
    'portal.dispute.create', 'portal.eir.view', 'portal.eir.download',
    'portal.eir.grade.view', 'portal.trucking.view', 'portal.driver.view',
  ],
  operations_user: ['portal.container.view', 'portal.booking.view', 'portal.eir.view'],
  booking_user: ['portal.container.view', 'portal.booking.view', 'portal.booking.create', 'portal.eir.view'],
  billing_user: ['portal.invoice.view', 'portal.invoice.download', 'portal.dispute.create', 'portal.document.download', 'portal.eir.view'],
  document_user: ['portal.document.download', 'portal.eir.view', 'portal.eir.download'],
  trucking_coordinator: ['portal.trucking.view', 'portal.container.view', 'portal.booking.view', 'portal.eir.view'],
  driver_user: ['portal.driver.view', 'portal.eir.view'],
  read_only_viewer: ['portal.container.view', 'portal.booking.view', 'portal.eir.view'],
};

export function normalizeCustomerPortalRole(value: unknown): CustomerPortalRole {
  return Object.prototype.hasOwnProperty.call(ROLE_ACTIONS, String(value || ''))
    ? String(value) as CustomerPortalRole
    : 'customer_admin';
}

export function getCustomerPortalActions(role: unknown) {
  return ROLE_ACTIONS[normalizeCustomerPortalRole(role)];
}

export function hasPortalAction(role: unknown, action: PortalAction) {
  return getCustomerPortalActions(role).includes(action);
}

interface PermissionDb {
  request(): {
    input(name: string, type: unknown, value: unknown): unknown;
    query(statement: string): Promise<{ recordset: Array<{ customer_portal_role?: string | null }> }>;
  };
}

export async function requirePortalAction(request: NextRequest, db: PermissionDb, action: PortalAction) {
  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const result = await db.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT TOP 1 customer_portal_role
      FROM Users
      WHERE user_id = @userId
        AND customer_id IS NOT NULL
        AND status = 'active'
    `);

  const role = normalizeCustomerPortalRole(result.recordset[0]?.customer_portal_role);
  if (!hasPortalAction(role, action)) {
    return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้' }, { status: 403 });
  }
  return { userId, customerPortalRole: role, actions: new Set(getCustomerPortalActions(role)) };
}
```

- [ ] **Step 3: Run permission tests**

Run:

```powershell
npm test -- src/lib/__tests__/customerPortalPermissions.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 4: Commit permission helper**

```powershell
git add src/lib/customerPortalPermissions.ts src/lib/__tests__/customerPortalPermissions.test.ts
git commit -m "Add customer portal action policy"
```

---

### Task 7: P2 Extend Portal Access Helpers

**Files:**
- Modify: `src/lib/portalAccess.ts`
- Modify: `src/lib/portalEntityAccess.ts`
- Test: `src/lib/__tests__/portalAccess.test.ts`
- Test: `src/lib/__tests__/portalEntityAccess.test.ts`

- [ ] **Step 1: Extend tests**

Add to `portalAccess.test.ts`:

```ts
it('supports EIR and reefer entity types with valid windows', () => {
  const sql = portalEntityAccessSql('eir', 'g.transaction_id', 'g.eir_number');
  expect(sql).toContain("pea.entity_type = 'eir'");
  expect(sql).toContain('(pea.valid_from IS NULL OR pea.valid_from <= GETDATE())');
  expect(sql).toContain('(pea.valid_until IS NULL OR pea.valid_until >= GETDATE())');
});
```

Add to `portalEntityAccess.test.ts`:

```ts
it('upserts permission scope and valid windows', async () => {
  const db = mockDb();
  await upsertPortalEntityAccess({
    db,
    customerId: 42,
    entityType: 'eir',
    entityRef: 'EIR-1',
    accessRole: 'booking_customer',
    sourceTable: 'GateTransactions',
    sourceId: 9,
    permissionScope: { view: true, eir: { fields: { container_grade: true } } },
    validUntil: new Date('2026-05-30T00:00:00.000Z'),
  });
  const sql = db.query.mock.calls[0][0];
  expect(sql).toContain('permission_scope');
  expect(sql).toContain('valid_until');
});
```

- [ ] **Step 2: Extend entity type and SQL valid-window checks**

In `src/lib/portalAccess.ts`:

```ts
export type PortalEntityType =
  | 'booking'
  | 'container'
  | 'gate_transaction'
  | 'eir'
  | 'invoice'
  | 'statement'
  | 'document_bundle'
  | 'reefer_check'
  | 'reefer_exception';
```

Add to every `PortalEntityAccess` predicate:

```sql
AND (pea.valid_from IS NULL OR pea.valid_from <= GETDATE())
AND (pea.valid_until IS NULL OR pea.valid_until >= GETDATE())
```

Add `portalEirVisibilitySql(gateAlias = 'g', containerAlias = 'c')`:

```ts
export function portalEirVisibilitySql(gateAlias = 'g', containerAlias = 'c') {
  return `(
    ${portalEntityAccessSql('eir', `${gateAlias}.transaction_id`, `${gateAlias}.eir_number`)}
    OR ${portalGateVisibilitySql(gateAlias, containerAlias)}
  )`;
}
```

- [ ] **Step 3: Extend grant upsert**

In `src/lib/portalEntityAccess.ts`, add fields:

```ts
permissionScope?: Record<string, unknown> | string | null;
validFrom?: Date | string | null;
validUntil?: Date | string | null;
```

Use a `MERGE`-style update:

```sql
IF EXISTS (...)
  UPDATE PortalEntityAccess
  SET source_table = @sourceTable,
      source_id = @sourceId,
      permission_scope = COALESCE(@permissionScope, permission_scope),
      valid_from = COALESCE(@validFrom, valid_from),
      valid_until = COALESCE(@validUntil, valid_until),
      updated_at = GETDATE()
  WHERE ...
ELSE
  INSERT INTO PortalEntityAccess (..., permission_scope, valid_from, valid_until)
  VALUES (..., @permissionScope, @validFrom, @validUntil)
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
npm test -- src/lib/__tests__/portalAccess.test.ts src/lib/__tests__/portalEntityAccess.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 5: Commit helper extensions**

```powershell
git add src/lib/portalAccess.ts src/lib/portalEntityAccess.ts src/lib/__tests__/portalAccess.test.ts src/lib/__tests__/portalEntityAccess.test.ts
git commit -m "Extend portal entity access policy"
```

---

### Task 8: P1/P2 Route EIR JSON And PDF Through Policy

**Files:**
- Modify: `src/app/api/portal/eir/route.ts`
- Modify: `src/app/api/portal/eir-pdf/route.ts`
- Modify: `src/lib/eirPdfGenerator.ts`
- Test: `src/app/api/__tests__/portal-eir-visibility.test.ts`

- [ ] **Step 1: Write API tests for customer grade policy and PDF policy**

```ts
// src/app/api/__tests__/portal-eir-visibility.test.ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Portal EIR visibility policy wiring', () => {
  it('portal EIR route requires portal action and uses eir visibility helper', () => {
    const route = fs.readFileSync(path.join(root, 'src/app/api/portal/eir/route.ts'), 'utf8');
    expect(route).toContain("requirePortalAction(request, db, 'portal.eir.view')");
    expect(route).toContain('portalEirVisibilitySql');
    expect(route).toContain('buildEirViewPayload');
    expect(route).toContain('resolveEirViewType');
    expect(route).toContain("action: 'view'");
  });

  it('portal EIR PDF uses sanitized payload and download action', () => {
    const route = fs.readFileSync(path.join(root, 'src/app/api/portal/eir-pdf/route.ts'), 'utf8');
    expect(route).toContain("requirePortalAction(request, db, 'portal.eir.download')");
    expect(route).toContain('buildEirViewPayload');
    expect(route).toContain('generateEIRPDF');
    expect(route).toContain("action: 'download'");
  });

  it('PDF generator prints copy label and only optional grade', () => {
    const generator = fs.readFileSync(path.join(root, 'src/lib/eirPdfGenerator.ts'), 'utf8');
    expect(generator).toContain('copy_type_label');
    expect(generator).toContain('container_grade_label');
  });
});
```

- [ ] **Step 2: Update portal EIR route**

In `src/app/api/portal/eir/route.ts`, import:

```ts
import { portalEirVisibilitySql } from '@/lib/portalAccess';
import { requirePortalAction } from '@/lib/customerPortalPermissions';
import { buildEirViewPayload, resolveEirViewType } from '@/lib/eirVisibility';
import { logEirAccess } from '@/lib/eirAccessLog';
```

After `db`:

```ts
const portalActor = await requirePortalAction(request, db, 'portal.eir.view');
if (portalActor instanceof NextResponse) return portalActor;
```

Select grant fields:

```sql
OUTER APPLY (
  SELECT TOP 1 pea.access_role, pea.permission_scope
  FROM PortalEntityAccess pea
  WHERE pea.customer_id = @cid
    AND pea.entity_type IN ('eir', 'gate_transaction', 'container')
    AND pea.is_active = 1
    AND (pea.valid_from IS NULL OR pea.valid_from <= GETDATE())
    AND (pea.valid_until IS NULL OR pea.valid_until >= GETDATE())
    AND (
      pea.entity_id IN (g.transaction_id, c.container_id)
      OR pea.entity_ref IN (g.eir_number, c.container_number)
    )
  ORDER BY CASE pea.entity_type WHEN 'eir' THEN 1 WHEN 'gate_transaction' THEN 2 ELSE 3 END
) grantInfo
```

Use:

```ts
const viewType = resolveEirViewType(portalActor, eir, {
  access_role: row.access_role,
  permission_scope: row.permission_scope,
});
const eir = buildEirViewPayload(master, {
  viewType,
  permissions: portalActor.actions,
  accessGrant: { access_role: row.access_role, permission_scope: row.permission_scope },
});
```

Log view with `logEirAccess`.

- [ ] **Step 3: Update portal PDF route**

Use the same query and sanitization as JSON. Pass sanitized payload to PDF:

```ts
const pdfBuffer = generateEIRPDF({
  ...eirData,
  date: new Date(row.created_at).toLocaleString('th-TH'),
});
```

Do not re-add grade after sanitization.

- [ ] **Step 4: Update PDF generator copy label**

Add to `EIRData`:

```ts
copy_type_label?: string;
document_status?: string;
version_no?: number;
container_grade_label?: string;
```

In title area:

```ts
doc.text(data.copy_type_label || 'Internal Copy', pw / 2, y, { align: 'center' });
```

Only add grade rows if `data.container_grade` exists.

- [ ] **Step 5: Run route wiring tests**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-eir-visibility.test.ts src/app/api/__tests__/portal-eir.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit route policy**

```powershell
git add src/app/api/portal/eir/route.ts src/app/api/portal/eir-pdf/route.ts src/lib/eirPdfGenerator.ts src/app/api/__tests__/portal-eir-visibility.test.ts src/app/api/__tests__/portal-eir.test.ts
git commit -m "Apply EIR visibility policy to portal routes"
```

---

### Task 9: P2 Apply Portal Actions To Existing Portal Routes

**Files:**
- Modify portal API routes listed in File Structure
- Test: `src/app/api/__tests__/portal-action-permissions.test.ts`

- [ ] **Step 1: Write static coverage test**

```ts
// src/app/api/__tests__/portal-action-permissions.test.ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const expectations: Array<[string, string]> = [
  ['src/app/api/portal/invoices/route.ts', 'portal.invoice.view'],
  ['src/app/api/portal/invoice-pdf/route.ts', 'portal.invoice.download'],
  ['src/app/api/portal/document-bundle/route.ts', 'portal.document.download'],
  ['src/app/api/portal/disputes/route.ts', 'portal.dispute.create'],
  ['src/app/api/portal/bookings/route.ts', 'portal.booking.create'],
  ['src/app/api/portal/bookings/documents/route.ts', 'portal.document.download'],
  ['src/app/api/portal/statement/route.ts', 'portal.invoice.view'],
  ['src/app/api/portal/reefer/route.ts', 'portal.container.view'],
];

describe('portal route action permissions', () => {
  it.each(expectations)('%s checks %s', (file, action) => {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    expect(src).toContain('requirePortalAction');
    expect(src).toContain(action);
  });
});
```

- [ ] **Step 2: Add `requirePortalAction` calls**

Pattern:

```ts
const db = await getDb();
const portalActor = await requirePortalAction(request, db, 'portal.invoice.view');
if (portalActor instanceof NextResponse) return portalActor;
```

Actions:

- invoices list and statement: `portal.invoice.view`
- invoice PDF: `portal.invoice.download`
- document bundle and booking documents download/list: `portal.document.download`
- disputes: `portal.dispute.create`
- booking POST: `portal.booking.create`
- booking GET/detail/amendments: `portal.booking.view`
- reefer list/history: `portal.container.view`

- [ ] **Step 3: Run portal action tests**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-action-permissions.test.ts src/lib/__tests__/customerPortalPermissions.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 4: Commit portal action checks**

```powershell
git add src/app/api/portal src/app/api/__tests__/portal-action-permissions.test.ts
git commit -m "Enforce customer portal action permissions"
```

---

### Task 10: P3 Grant Rule Helper And Write-Time Grants

**Files:**
- Create: `src/lib/portalGrantRules.ts`
- Modify: `src/app/api/edi/bookings/route.ts`
- Modify: `src/app/api/portal/bookings/route.ts`
- Modify: `src/app/api/bookings/containers/route.ts`
- Modify: `src/app/api/gate/route.ts`
- Modify: `src/app/api/billing/invoices/route.ts`
- Modify: `src/app/api/reefer/checks/route.ts`
- Modify: `src/app/api/reefer/exceptions/route.ts`
- Test: `src/lib/__tests__/portalGrantRules.test.ts`
- Test: update `src/app/api/__tests__/gate.test.ts`

- [ ] **Step 1: Write grant rule tests**

```ts
// src/lib/__tests__/portalGrantRules.test.ts
import {
  buildBookingPartyGrants,
  buildGatePartyGrants,
  defaultPortalPermissionScope,
} from '../portalGrantRules';

describe('portalGrantRules', () => {
  it('keeps customer_id as booking_customer and adds optional party grants', () => {
    expect(buildBookingPartyGrants({
      booking_id: 1,
      booking_number: 'BK-1',
      customer_id: 10,
      shipping_line_id: 11,
      trucking_company_id: 12,
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerId: 10, entityType: 'booking', accessRole: 'booking_customer' }),
      expect.objectContaining({ customerId: 11, entityType: 'booking', accessRole: 'shipping_line' }),
      expect.objectContaining({ customerId: 12, entityType: 'booking', accessRole: 'trucking' }),
    ]));
  });

  it('creates gate, eir, and container grants for owner, billing, trucking, and driver', () => {
    const grants = buildGatePartyGrants({
      transaction_id: 50,
      eir_number: 'EIR-50',
      container_id: 9,
      container_number: 'ONEU1234567',
      container_owner_id: 10,
      billing_customer_id: 11,
      trucking_company_id: 12,
      driver_user_id: 99,
    });
    expect(grants).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityType: 'eir', accessRole: 'owner' }),
      expect.objectContaining({ entityType: 'gate_transaction', accessRole: 'trucking' }),
      expect.objectContaining({ entityType: 'eir', accessRole: 'driver' }),
    ]));
  });

  it('defaults container grade to hidden in customer scopes', () => {
    expect(defaultPortalPermissionScope('booking_customer')).toMatchObject({
      eir: { fields: { container_grade: false } },
    });
  });
});
```

- [ ] **Step 2: Implement grant rules**

```ts
// src/lib/portalGrantRules.ts
import type { PortalEntityType } from './portalAccess';
import { upsertPortalEntityAccess, type PortalEntityAccessDb } from './portalEntityAccess';

export interface GrantRequest {
  customerId?: number | null;
  entityType: PortalEntityType;
  entityId?: number | null;
  entityRef?: string | null;
  accessRole: string;
  sourceTable: string;
  sourceId?: number | null;
  permissionScope?: Record<string, unknown>;
  validUntil?: Date | string | null;
}

export function defaultPortalPermissionScope(accessRole: string) {
  const base = {
    view: true,
    download: ['owner', 'booking_customer', 'shipping_line', 'billing', 'invoice_customer'].includes(accessRole),
    billing: ['billing', 'invoice_customer'].includes(accessRole),
    dispute: ['billing', 'invoice_customer'].includes(accessRole),
    eir: {
      fields: {
        container_grade: false,
        damage_summary: true,
        damage_photos: !['driver', 'trucking'].includes(accessRole),
      },
    },
    maskSensitiveFields: !['internal', 'auditor'].includes(accessRole),
  };
  return base;
}

export function buildBookingPartyGrants(booking: Record<string, unknown>): GrantRequest[] {
  const bookingId = Number(booking.booking_id);
  const bookingNumber = String(booking.booking_number || '');
  const parties: Array<[unknown, string]> = [
    [booking.booking_customer_id || booking.customer_id, 'booking_customer'],
    [booking.shipping_line_id, 'shipping_line'],
    [booking.forwarder_id, 'forwarder'],
    [booking.shipper_id, 'shipper'],
    [booking.consignee_id, 'consignee'],
    [booking.trucking_company_id, 'trucking'],
  ];
  return parties
    .filter(([customerId]) => Number.isInteger(Number(customerId)) && Number(customerId) > 0)
    .map(([customerId, accessRole]) => ({
      customerId: Number(customerId),
      entityType: 'booking' as const,
      entityId: bookingId,
      entityRef: bookingNumber,
      accessRole,
      sourceTable: 'Bookings',
      sourceId: bookingId,
      permissionScope: defaultPortalPermissionScope(accessRole),
    }));
}

export function buildGatePartyGrants(gate: Record<string, unknown>): GrantRequest[] {
  const txId = Number(gate.transaction_id);
  const eirNumber = String(gate.eir_number || '');
  const containerId = Number(gate.container_id);
  const containerNumber = String(gate.container_number || '');
  const parties: Array<[unknown, string]> = [
    [gate.container_owner_id, 'owner'],
    [gate.booking_customer_id, 'booking_customer'],
    [gate.billing_customer_id, 'billing'],
    [gate.trucking_company_id, 'trucking'],
    [gate.driver_user_id, 'driver'],
  ];
  const grants: GrantRequest[] = [];
  for (const [customerId, accessRole] of parties) {
    if (!Number.isInteger(Number(customerId)) || Number(customerId) <= 0) continue;
    for (const entityType of ['gate_transaction', 'eir'] as const) {
      grants.push({
        customerId: Number(customerId),
        entityType,
        entityId: txId,
        entityRef: eirNumber,
        accessRole,
        sourceTable: 'GateTransactions',
        sourceId: txId,
        permissionScope: defaultPortalPermissionScope(accessRole),
      });
    }
    grants.push({
      customerId: Number(customerId),
      entityType: 'container',
      entityId: containerId,
      entityRef: containerNumber,
      accessRole,
      sourceTable: 'GateTransactions',
      sourceId: txId,
      permissionScope: defaultPortalPermissionScope(accessRole),
    });
  }
  return grants;
}

export async function applyPortalGrants(db: PortalEntityAccessDb, grants: GrantRequest[]) {
  for (const grant of grants) {
    await upsertPortalEntityAccess({ db, ...grant });
  }
}
```

- [ ] **Step 3: Add schema fields for booking/gate parties**

In migration:

```sql
IF COL_LENGTH('Bookings', 'booking_customer_id') IS NULL ALTER TABLE Bookings ADD booking_customer_id INT NULL;
IF COL_LENGTH('Bookings', 'shipping_line_id') IS NULL ALTER TABLE Bookings ADD shipping_line_id INT NULL;
IF COL_LENGTH('Bookings', 'forwarder_id') IS NULL ALTER TABLE Bookings ADD forwarder_id INT NULL;
IF COL_LENGTH('Bookings', 'shipper_id') IS NULL ALTER TABLE Bookings ADD shipper_id INT NULL;
IF COL_LENGTH('Bookings', 'consignee_id') IS NULL ALTER TABLE Bookings ADD consignee_id INT NULL;
IF COL_LENGTH('Bookings', 'trucking_company_id') IS NULL ALTER TABLE Bookings ADD trucking_company_id INT NULL;
IF COL_LENGTH('Bookings', 'bill_to_customer_id') IS NULL ALTER TABLE Bookings ADD bill_to_customer_id INT NULL;
IF COL_LENGTH('Bookings', 'created_by_customer_user_id') IS NULL ALTER TABLE Bookings ADD created_by_customer_user_id INT NULL;
IF COL_LENGTH('GateTransactions', 'trucking_company_id') IS NULL ALTER TABLE GateTransactions ADD trucking_company_id INT NULL;
IF COL_LENGTH('GateTransactions', 'driver_user_id') IS NULL ALTER TABLE GateTransactions ADD driver_user_id INT NULL;
```

- [ ] **Step 4: Replace direct grant calls with rule helper**

In booking routes, after insert/update:

```ts
await applyPortalGrants(db, buildBookingPartyGrants(booking));
```

In gate route, after insert:

```ts
await applyPortalGrants(db, buildGatePartyGrants({
  ...gateTransaction,
  container_number,
  booking_customer_id: linkedBooking?.customer_id || null,
  trucking_company_id,
  driver_user_id,
}));
```

In invoices route, keep invoice grants bill-to only. Do not create invoice grants from booking/container visibility.

In reefer checks/exceptions, create `reefer_check` / `reefer_exception` grants from the active container grants using source table `ReeferTemperatureChecks` or `ReeferExceptions`.

- [ ] **Step 5: Run grant tests**

Run:

```powershell
npm test -- src/lib/__tests__/portalGrantRules.test.ts src/app/api/__tests__/gate.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit write-time grants**

```powershell
git add src/lib/portalGrantRules.ts src/lib/__tests__/portalGrantRules.test.ts scripts/migrate-runtime-core-schema.js scripts/setup-db.js src/lib/schema.sql src/app/api/edi/bookings/route.ts src/app/api/portal/bookings/route.ts src/app/api/bookings/containers/route.ts src/app/api/gate/route.ts src/app/api/billing/invoices/route.ts src/app/api/reefer/checks/route.ts src/app/api/reefer/exceptions/route.ts
git commit -m "Expand portal grant creation rules"
```

---

### Task 11: P2 Admin Field Scope Audit Endpoint

**Files:**
- Create: `src/app/api/portal/grants/field-scope/route.ts`
- Test: `src/app/api/__tests__/portal-grant-field-scope.test.ts`

- [ ] **Step 1: Write failing route test**

```ts
// src/app/api/__tests__/portal-grant-field-scope.test.ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('portal grant field scope endpoint', () => {
  it('is yard_manager-only and audits container grade visibility changes', () => {
    const route = fs.readFileSync(path.join(root, 'src/app/api/portal/grants/field-scope/route.ts'), 'utf8');
    expect(route).toContain("['yard_manager']");
    expect(route).toContain('container_grade');
    expect(route).toContain('portal_grant_field_scope_update');
    expect(route).toContain('แสดงเกรดตู้ใน EIR ให้ลูกค้า');
  });
});
```

- [ ] **Step 2: Implement narrow backend endpoint**

```ts
// src/app/api/portal/grants/field-scope/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(request: NextRequest) {
  const actor = requireRole(request, ['yard_manager']);
  if (actor instanceof NextResponse) return actor;

  const body = await request.json();
  const accessId = parsePositiveInt(body.access_id);
  const enabled = body.field === 'container_grade' ? Boolean(body.enabled) : null;
  if (!accessId || enabled === null) {
    return NextResponse.json({ error: 'ข้อมูล field scope ไม่ถูกต้อง' }, { status: 400 });
  }

  const db = await getDb();
  const current = await db.request()
    .input('accessId', sql.BigInt, accessId)
    .query('SELECT TOP 1 * FROM PortalEntityAccess WHERE access_id = @accessId');
  const grant = current.recordset[0];
  if (!grant) return NextResponse.json({ error: 'ไม่พบ grant' }, { status: 404 });

  const scope = grant.permission_scope ? JSON.parse(grant.permission_scope) : { view: true };
  scope.eir = scope.eir || {};
  scope.eir.fields = scope.eir.fields || {};
  const oldValue = scope.eir.fields.container_grade === true;
  scope.eir.fields.container_grade = enabled;

  await db.request()
    .input('accessId', sql.BigInt, accessId)
    .input('permissionScope', sql.NVarChar(sql.MAX), JSON.stringify(scope))
    .query(`
      UPDATE PortalEntityAccess
      SET permission_scope = @permissionScope,
          updated_at = GETDATE()
      WHERE access_id = @accessId
    `);

  await logAudit({
    userId: actor.userId,
    action: 'portal_grant_field_scope_update',
    entityType: 'portal_entity_access',
    entityId: accessId,
    details: {
      label: 'แสดงเกรดตู้ใน EIR ให้ลูกค้า',
      field: 'eir.fields.container_grade',
      old_value: oldValue,
      new_value: enabled,
      customer_id: grant.customer_id,
      entity_type: grant.entity_type,
      entity_id: grant.entity_id,
      entity_ref: grant.entity_ref,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
    },
  });

  return NextResponse.json({ success: true, permission_scope: scope });
}
```

- [ ] **Step 3: Run endpoint test**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-grant-field-scope.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 4: Commit field-scope endpoint**

```powershell
git add src/app/api/portal/grants/field-scope/route.ts src/app/api/__tests__/portal-grant-field-scope.test.ts
git commit -m "Add audited portal grant field scope update"
```

---

### Task 12: P4 Reconciler Backfill Expansion

**Files:**
- Modify: `src/lib/portalGrantReconciler.ts`
- Modify: `src/lib/__tests__/portalGrantReconciler.test.ts`
- Modify: `src/app/api/__tests__/portal-grant-reconcile.test.ts`

- [ ] **Step 1: Extend reconciler tests**

Add assertions:

```ts
expect(sql).toContain('booking_customer_id');
expect(sql).toContain('shipping_line_id');
expect(sql).toContain('trucking_company_id');
expect(sql).toContain("CAST(N'eir' AS NVARCHAR(40)) AS entity_type");
expect(sql).toContain('permission_scope');
expect(sql).toContain('valid_until');
expect(sql).toContain('ReeferTemperatureChecks');
expect(sql).toContain('ReeferExceptions');
```

- [ ] **Step 2: Update expected grants SQL**

Add `RawExpectedGrants` unions for:

- `Bookings.booking_customer_id || customer_id`
- `Bookings.shipping_line_id`
- `Bookings.forwarder_id`
- `Bookings.shipper_id`
- `Bookings.consignee_id`
- `Bookings.trucking_company_id`
- `GateTransactions` as `eir`
- `GateTransactions.trucking_company_id`
- `GateTransactions.driver_user_id`
- `ReeferTemperatureChecks` as `reefer_check`
- `ReeferExceptions` as `reefer_exception`

Include:

```sql
CAST(N'{"view":true,"download":true,"eir":{"fields":{"container_grade":false,"damage_summary":true,"damage_photos":true}},"maskSensitiveFields":true}' AS NVARCHAR(MAX)) AS permission_scope
```

For trucking/driver grants include limited scope and `valid_until` when available.

- [ ] **Step 3: Update insert query**

Insert:

```sql
permission_scope,
valid_from,
valid_until
```

and select the expected values.

- [ ] **Step 4: Run reconciler tests**

Run:

```powershell
npm test -- src/lib/__tests__/portalGrantReconciler.test.ts src/app/api/__tests__/portal-grant-reconcile.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 5: Commit reconciler**

```powershell
git add src/lib/portalGrantReconciler.ts src/lib/__tests__/portalGrantReconciler.test.ts src/app/api/__tests__/portal-grant-reconcile.test.ts
git commit -m "Expand portal grant reconciler"
```

---

### Task 13: P4 Full Leak Prevention Tests

**Files:**
- Create: `src/app/api/__tests__/portal-data-leakage.test.ts`
- Test: `src/app/api/__tests__/portal-data-leakage.test.ts`

- [ ] **Step 1: Add static/API leakage tests**

```ts
// src/app/api/__tests__/portal-data-leakage.test.ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('portal data leakage prevention', () => {
  it('portal routes do not read customer_id from query/body for visibility', () => {
    const files = [
      'src/app/api/portal/containers/route.ts',
      'src/app/api/portal/bookings/route.ts',
      'src/app/api/portal/eir/route.ts',
      'src/app/api/portal/invoices/route.ts',
      'src/app/api/portal/document-bundle/route.ts',
    ];
    for (const file of files) {
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      expect(src).toContain('getPortalCustomerId(request)');
      expect(src).not.toContain("searchParams.get('customer_id')");
      expect(src).not.toContain('body.customer_id');
    }
  });

  it('invoice visibility uses invoice grants, not container grants', () => {
    const invoices = fs.readFileSync(path.join(root, 'src/app/api/portal/invoices/route.ts'), 'utf8');
    expect(invoices).toContain('portalInvoiceVisibilitySql');
    expect(invoices).not.toContain('portalContainerVisibilitySql');
  });

  it('driver/trucking roles never receive invoice grants in grant rules', () => {
    const rules = fs.readFileSync(path.join(root, 'src/lib/portalGrantRules.ts'), 'utf8');
    expect(rules).toContain("accessRole: 'driver'");
    expect(rules).toContain("accessRole: 'trucking'");
    expect(rules).not.toMatch(/entityType:\s*'invoice'[\s\S]{0,120}accessRole:\s*'driver'/);
    expect(rules).not.toMatch(/entityType:\s*'invoice'[\s\S]{0,120}accessRole:\s*'trucking'/);
  });
});
```

- [ ] **Step 2: Run leakage tests**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-data-leakage.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 3: Commit leakage tests**

```powershell
git add src/app/api/__tests__/portal-data-leakage.test.ts
git commit -m "Add portal leakage prevention tests"
```

---

### Task 14: Migration Run, Full Verification, Handoff

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Run migration**

Run:

```powershell
node scripts/migrate-runtime-core-schema.js
```

Expected: `Runtime schema migration complete.`

- [ ] **Step 2: Run focused tests**

Run:

```powershell
npm test -- src/lib/__tests__/eirVisibility.test.ts src/lib/__tests__/customerPortalPermissions.test.ts src/lib/__tests__/portalGrantRules.test.ts src/lib/__tests__/portalGrantReconciler.test.ts src/app/api/__tests__/eir-public-policy.test.ts src/app/api/__tests__/eir-access-log.test.ts src/app/api/__tests__/portal-eir-visibility.test.ts src/app/api/__tests__/portal-access-schema.test.ts src/app/api/__tests__/portal-action-permissions.test.ts src/app/api/__tests__/portal-data-leakage.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: all focused tests PASS.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm test -- --runInBand --cacheDirectory ./.next/jest-cache
npx tsc --noEmit --pretty false
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 4: Update `DEVELOPER_HANDOFF.md`**

Add/update sections:

- Public EIR now uses `/api/public/eir`.
- `/api/gate/eir` is internal-only.
- `eirVisibility.ts` controls all EIR field visibility.
- `container_grade` is hidden from public/customer/trucking/driver by default.
- Customer grade visibility requires `portal.eir.grade.view` plus `PortalEntityAccess.permission_scope.eir.fields.container_grade = true`.
- `EIRAccessLog` records view/download/print/public_verify.
- `PortalEntityAccess` has `permission_scope`, `valid_from`, and `valid_until`.
- Customer portal action roles use `Users.customer_portal_role`.
- Driver/Trucking backend grants are ready; UI is intentionally out of scope.
- Migration command and verification results.

- [ ] **Step 5: Commit handoff and verification state**

```powershell
git add DEVELOPER_HANDOFF.md
git commit -m "Document portal EIR access policy"
```

---

### Task 15: Final Push

**Files:** none

- [ ] **Step 1: Confirm clean status**

Run:

```powershell
git status -sb
```

Expected: no unstaged/untracked implementation files.

- [ ] **Step 2: Push**

Run:

```powershell
git push origin master
```

Expected: current branch pushes successfully.

- [ ] **Step 3: Final response**

Report:

- Schema changes.
- Helpers added.
- Routes adjusted.
- UI/PDF changes.
- Tests added.
- Migration command.
- `npm test`, `tsc`, and `lint` results.
- Any follow-up work, especially Driver/Trucking UI and configurable policy UI as later phases.
