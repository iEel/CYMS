# Customer Portal Reefer Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customer-facing Reefer module visibility controls so the Customer Portal shows the Reefer menu only when the customer/user is allowed and has relevant RF/reefer access, plus add UI settings for customer-level Reefer portal behavior.

**Architecture:** Reuse the existing Customer Portal policy stack: `Customers.portal_default_permission_scope` for customer defaults, `Users.customer_portal_role` for user actions, and `PortalEntityAccess` for per-entity visibility. Add a small portal capabilities endpoint for navigation decisions and keep `/api/portal/reefer` as the server-side enforcement point.

**Tech Stack:** Next.js App Router, React client components, TypeScript, MS SQL via `mssql`, Jest string/API tests.

---

## Existing Context

- Customer Master already stores `portal_enabled` and `portal_default_permission_scope`.
- Customer Master already has EIR field toggles such as `container_grade`, `damage_photos`, `seal_number`.
- Customer Portal user roles already live in `src/lib/customerPortalPermissions.ts`.
- Portal Reefer page exists at `src/app/(portal)/portal/reefer/page.tsx`.
- Portal Reefer API exists at `src/app/api/portal/reefer/route.ts`.
- Portal nav is static in `src/app/(portal)/layout.tsx`, so every customer sees `ตู้เย็น`.

## Desired Behavior

1. Internal admin can configure Reefer portal settings per customer in Customer Master.
2. Customer users get Reefer actions through `customer_portal_role`.
3. Portal navigation only shows `ตู้เย็น` when:
   - Customer Portal is enabled.
   - Customer module setting `modules.reefer` is enabled.
   - User role has `portal.reefer.view`.
   - Customer has at least one visible RF container or active `reefer_check` / `reefer_exception` grant.
4. Direct access to `/portal/reefer` remains safe:
   - No permission/module: friendly restricted state, no data.
   - Permission/module but no RF access: friendly empty state, no data.
5. `/api/portal/reefer` enforces the same rules server-side.
6. UI/PDF/photo/download features must read server policy, not infer locally.

## File Structure

- Modify `src/lib/customerPortalPermissions.ts`
  - Add Reefer portal actions.
  - Map actions to existing customer portal roles.

- Modify `src/app/api/settings/customers/route.ts`
  - Normalize and persist new `portal_default_permission_scope.modules` and `portal_default_permission_scope.reefer`.
  - Preserve backward compatibility for existing JSON.

- Modify `src/app/(dashboard)/settings/CustomerMaster.tsx`
  - Add Customer Portal module toggles.
  - Add Reefer-specific settings UI.

- Create `src/lib/portalCapabilities.ts`
  - Shared helpers to parse customer portal scope and compute portal capabilities from customer settings, user role, and grants.

- Create `src/app/api/portal/capabilities/route.ts`
  - Return visible portal modules for the logged-in customer user.

- Modify `src/app/(portal)/layout.tsx`
  - Load `/api/portal/capabilities`.
  - Hide/show nav items dynamically.

- Modify `src/app/api/portal/reefer/route.ts`
  - Require `portal.reefer.view`.
  - Check customer module setting and RF/reefer visibility before returning data.
  - Respect Reefer photo/history settings.

- Modify `src/app/(portal)/portal/reefer/page.tsx`
  - Handle `403` capability responses cleanly.
  - Show empty state when no RF access.
  - Prepare UI flags for photo/download/exception display.

- Modify `src/app/api/__tests__/customer-portal-defaults.test.ts`
  - Cover new module and Reefer scope normalization.

- Modify `src/app/api/__tests__/settings-users-customer-portal-role.test.ts`
  - Cover new Reefer role labels/actions.

- Modify `src/app/api/__tests__/reefer-ui.test.ts`
  - Cover dynamic nav and Reefer page capability handling.

- Create `src/app/api/__tests__/portal-capabilities.test.ts`
  - Cover menu visibility decisions.

- Modify `DEVELOPER_HANDOFF.md`
  - Document Customer Portal Reefer settings, capability endpoint, and run commands.

---

### Task 1: Extend Portal Permission Actions

**Files:**
- Modify: `src/lib/customerPortalPermissions.ts`
- Test: `src/app/api/__tests__/settings-users-customer-portal-role.test.ts`

- [ ] **Step 1: Add failing test expectations**

Add assertions to `settings-users-customer-portal-role.test.ts`:

```ts
it('includes reefer actions in customer portal roles', () => {
  const permissions = fs.readFileSync(path.join(process.cwd(), 'src/lib/customerPortalPermissions.ts'), 'utf8');
  const uiSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/UsersSettings.tsx'), 'utf8');

  expect(permissions).toContain("'portal.reefer.view'");
  expect(permissions).toContain("'portal.reefer.download'");
  expect(permissions).toContain("'portal.reefer.exception.view'");
  expect(permissions).toContain("'portal.reefer.exception.dispute'");
  expect(uiSource).toContain('ดูตู้เย็น');
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```powershell
npm test -- src/app/api/__tests__/settings-users-customer-portal-role.test.ts --runInBand
```

Expected: FAIL because Reefer actions are not in the action union or UI role labels.

- [ ] **Step 3: Add Reefer actions to portal action union**

In `src/lib/customerPortalPermissions.ts`, extend `PortalAction` and `ALL_PORTAL_ACTIONS`:

```ts
  | 'portal.reefer.view'
  | 'portal.reefer.download'
  | 'portal.reefer.exception.view'
  | 'portal.reefer.exception.dispute'
```

Add to `ALL_PORTAL_ACTIONS`:

```ts
  'portal.reefer.view',
  'portal.reefer.download',
  'portal.reefer.exception.view',
  'portal.reefer.exception.dispute',
```

- [ ] **Step 4: Map Reefer actions to roles**

Use this policy:

```ts
customer_admin: ALL_PORTAL_ACTIONS,
operations_user: [
  'portal.container.view',
  'portal.booking.view',
  'portal.document.download',
  'portal.eir.view',
  'portal.eir.download',
  'portal.trucking.view',
  'portal.reefer.view',
  'portal.reefer.exception.view',
],
document_user: [
  'portal.container.view',
  'portal.booking.view',
  'portal.document.download',
  'portal.eir.view',
  'portal.eir.download',
  'portal.reefer.view',
  'portal.reefer.download',
],
read_only_viewer: [
  'portal.container.view',
  'portal.booking.view',
  'portal.invoice.view',
  'portal.eir.view',
  'portal.trucking.view',
  'portal.driver.view',
  'portal.reefer.view',
  'portal.reefer.exception.view',
],
```

Do not give `billing_user` Reefer by default unless it also needs operation visibility.

- [ ] **Step 5: Update Settings Users role labels**

In `src/app/(dashboard)/settings/UsersSettings.tsx`, update role action labels:

```ts
{ code: 'operations_user', label: 'Operations', actions: ['ดูตู้', 'ดู Booking', 'ดู EIR', 'ดูตู้เย็น'] },
{ code: 'document_user', label: 'Document', actions: ['ดาวน์โหลด EIR/Bundle', 'ดาวน์โหลด Temperature Log'] },
{ code: 'read_only_viewer', label: 'Read-only', actions: ['ดูข้อมูลที่ได้รับ grant', 'ดูตู้เย็นถ้ามีสิทธิ์'] },
```

- [ ] **Step 6: Run focused test**

Run:

```powershell
npm test -- src/app/api/__tests__/settings-users-customer-portal-role.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/customerPortalPermissions.ts src/app/(dashboard)/settings/UsersSettings.tsx src/app/api/__tests__/settings-users-customer-portal-role.test.ts
git commit -m "Add customer portal reefer actions"
```

---

### Task 2: Add Customer-Level Portal Module and Reefer Settings

**Files:**
- Modify: `src/app/api/settings/customers/route.ts`
- Modify: `src/app/(dashboard)/settings/CustomerMaster.tsx`
- Test: `src/app/api/__tests__/customer-portal-defaults.test.ts`

- [ ] **Step 1: Add failing customer defaults test**

Add assertions:

```ts
it('renders module and reefer portal settings in customer master', () => {
  expect(ui).toContain('เปิดเมนูตู้เย็น Reefer ให้ลูกค้า');
  expect(ui).toContain('แสดงรูปหลักฐานอุณหภูมิ');
  expect(ui).toContain('แสดง Reefer Exception');
  expect(ui).toContain('ดาวน์โหลด Temperature Log');
  expect(ui).toContain('ให้ลูกค้าสอบถาม Reefer Exception');
});

it('normalizes portal module and reefer defaults in customer settings API', () => {
  expect(api).toContain('modules');
  expect(api).toContain('reefer');
  expect(api).toContain('show_photo_evidence');
  expect(api).toContain('show_exceptions');
  expect(api).toContain('download_temperature_log');
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```powershell
npm test -- src/app/api/__tests__/customer-portal-defaults.test.ts --runInBand
```

Expected: FAIL because module and Reefer scope do not exist yet.

- [ ] **Step 3: Extend `PortalDefaultPermissionScope` in CustomerMaster**

Use this shape:

```ts
type PortalDefaultPermissionScope = {
  view: boolean;
  download: boolean;
  modules: {
    containers: boolean;
    bookings: boolean;
    invoices: boolean;
    documents: boolean;
    reefer: boolean;
  };
  reefer: {
    show_temperature_history: boolean;
    show_photo_evidence: boolean;
    show_exceptions: boolean;
    download_temperature_log: boolean;
    allow_exception_dispute: boolean;
  };
  eir: {
    fields: {
      container_grade: boolean;
      damage_summary: boolean;
      damage_photos: boolean;
      seal_number: boolean;
      driver_name: boolean;
      truck_plate_full: boolean;
      billing_clearance: boolean;
      invoice_amount: boolean;
      internal_note: boolean;
    };
  };
  maskSensitiveFields: boolean;
};
```

- [ ] **Step 4: Update default portal scope in CustomerMaster**

Use:

```ts
const defaultPortalPermissionScope: PortalDefaultPermissionScope = {
  view: true,
  download: true,
  modules: {
    containers: true,
    bookings: true,
    invoices: true,
    documents: true,
    reefer: false,
  },
  reefer: {
    show_temperature_history: true,
    show_photo_evidence: true,
    show_exceptions: true,
    download_temperature_log: false,
    allow_exception_dispute: false,
  },
  eir: {
    fields: {
      container_grade: false,
      damage_summary: true,
      damage_photos: true,
      seal_number: true,
      driver_name: false,
      truck_plate_full: false,
      billing_clearance: false,
      invoice_amount: false,
      internal_note: false,
    },
  },
  maskSensitiveFields: true,
};
```

- [ ] **Step 5: Update CustomerMaster normalize function**

Merge existing data with defaults:

```ts
function normalizePortalDefaultScope(input: Customer['portal_default_permission_scope']): PortalDefaultPermissionScope {
  const fields = input?.eir?.fields || defaultPortalPermissionScope.eir.fields;
  return {
    ...defaultPortalPermissionScope,
    ...input,
    modules: {
      ...defaultPortalPermissionScope.modules,
      ...input?.modules,
    },
    reefer: {
      ...defaultPortalPermissionScope.reefer,
      ...input?.reefer,
    },
    eir: {
      fields: {
        ...defaultPortalPermissionScope.eir.fields,
        ...fields,
        internal_note: false,
      },
    },
    maskSensitiveFields: true,
  };
}
```

- [ ] **Step 6: Add module toggles UI**

Under the existing `Customer Portal` block, add a subsection:

```tsx
<div className="mt-4 rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
  <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">เมนูที่เปิดให้ลูกค้าเห็น</p>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
    {[
      ['containers', 'ตู้คอนเทนเนอร์'],
      ['bookings', 'Booking'],
      ['invoices', 'ใบแจ้งหนี้'],
      ['documents', 'เอกสาร'],
      ['reefer', 'เปิดเมนูตู้เย็น Reefer ให้ลูกค้า'],
    ].map(([key, label]) => (
      <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
        <input
          type="checkbox"
          checked={Boolean(form.portal_default_permission_scope.modules[key as keyof typeof form.portal_default_permission_scope.modules])}
          onChange={e => setForm(prev => ({
            ...prev,
            portal_default_permission_scope: {
              ...prev.portal_default_permission_scope,
              modules: {
                ...prev.portal_default_permission_scope.modules,
                [key]: e.target.checked,
              },
            },
          }))}
          className="accent-blue-600"
        />
        <span>{label}</span>
      </label>
    ))}
  </div>
</div>
```

- [ ] **Step 7: Add Reefer settings UI**

Add a subsection shown when `modules.reefer` is true:

```tsx
{form.portal_default_permission_scope.modules.reefer && (
  <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
    <p className="mb-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">การตั้งค่าตู้ Reefer ฝั่งลูกค้า</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {[
        ['show_temperature_history', 'แสดงประวัติอุณหภูมิ'],
        ['show_photo_evidence', 'แสดงรูปหลักฐานอุณหภูมิ'],
        ['show_exceptions', 'แสดง Reefer Exception'],
        ['download_temperature_log', 'ดาวน์โหลด Temperature Log'],
        ['allow_exception_dispute', 'ให้ลูกค้าสอบถาม Reefer Exception'],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 rounded-lg border border-white/70 bg-white/80 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60">
          <input
            type="checkbox"
            checked={Boolean(form.portal_default_permission_scope.reefer[key as keyof typeof form.portal_default_permission_scope.reefer])}
            onChange={e => setForm(prev => ({
              ...prev,
              portal_default_permission_scope: {
                ...prev.portal_default_permission_scope,
                reefer: {
                  ...prev.portal_default_permission_scope.reefer,
                  [key]: e.target.checked,
                },
              },
            }))}
            className="accent-cyan-600"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 8: Mirror normalization in settings API**

In `src/app/api/settings/customers/route.ts`, update `normalizePortalDefaultScope()` to preserve old payloads and add:

```ts
modules: {
  containers: true,
  bookings: true,
  invoices: true,
  documents: true,
  reefer: false,
},
reefer: {
  show_temperature_history: true,
  show_photo_evidence: true,
  show_exceptions: true,
  download_temperature_log: false,
  allow_exception_dispute: false,
},
```

Ensure `internal_note` remains forced false.

- [ ] **Step 9: Run focused test**

Run:

```powershell
npm test -- src/app/api/__tests__/customer-portal-defaults.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/app/api/settings/customers/route.ts src/app/(dashboard)/settings/CustomerMaster.tsx src/app/api/__tests__/customer-portal-defaults.test.ts
git commit -m "Add customer portal reefer settings"
```

---

### Task 3: Add Portal Capabilities Endpoint

**Files:**
- Create: `src/lib/portalCapabilities.ts`
- Create: `src/app/api/portal/capabilities/route.ts`
- Test: `src/app/api/__tests__/portal-capabilities.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `src/app/api/__tests__/portal-capabilities.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;

function makeRequest() {
  return new NextRequest('http://localhost/api/portal/capabilities', {
    headers: { 'x-customer-id': '42', 'x-user-id': '7' },
  });
}

function q(recordset: unknown[]) {
  return { recordset };
}

function mockDb(queue: Array<{ recordset: unknown[] }>, role = 'customer_admin') {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn(async (statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Users')) return q([{ customer_portal_role: role }]);
    return queue.shift() || q([]);
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

describe('GET /api/portal/capabilities', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides reefer when customer module is disabled', async () => {
    const route = await import('../portal/capabilities/route');
    const db = mockDb([
      q([{ portal_enabled: true, portal_default_permission_scope: JSON.stringify({ modules: { reefer: false } }) }]),
      q([{ rf_count: 2, reefer_grant_count: 1 }]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modules.reefer.visible).toBe(false);
    expect(body.modules.reefer.reason).toBe('module_disabled');
  });

  it('shows reefer when module, user action, and RF access exist', async () => {
    const route = await import('../portal/capabilities/route');
    const db = mockDb([
      q([{ portal_enabled: true, portal_default_permission_scope: JSON.stringify({ modules: { reefer: true } }) }]),
      q([{ rf_count: 1, reefer_grant_count: 0 }]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modules.reefer.visible).toBe(true);
    expect(body.modules.reefer.reason).toBe('available');
    expect(db.queries.join('\n')).toContain('PortalEntityAccess');
  });

  it('hides reefer when user role lacks portal.reefer.view', async () => {
    const route = await import('../portal/capabilities/route');
    const db = mockDb([
      q([{ portal_enabled: true, portal_default_permission_scope: JSON.stringify({ modules: { reefer: true } }) }]),
      q([{ rf_count: 1, reefer_grant_count: 0 }]),
    ], 'billing_user');
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.modules.reefer.visible).toBe(false);
    expect(body.modules.reefer.reason).toBe('user_permission_missing');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-capabilities.test.ts --runInBand
```

Expected: FAIL because route/helper do not exist.

- [ ] **Step 3: Create `src/lib/portalCapabilities.ts`**

Implement:

```ts
import type { CustomerPortalRole } from '@/lib/customerPortalPermissions';
import { hasPortalAction } from '@/lib/customerPortalPermissions';

export interface PortalScope {
  modules?: {
    containers?: boolean;
    bookings?: boolean;
    invoices?: boolean;
    documents?: boolean;
    reefer?: boolean;
  };
  reefer?: {
    show_temperature_history?: boolean;
    show_photo_evidence?: boolean;
    show_exceptions?: boolean;
    download_temperature_log?: boolean;
    allow_exception_dispute?: boolean;
  };
}

export interface ReeferAccessCounts {
  rfCount: number;
  reeferGrantCount: number;
}

export function parsePortalScope(value: unknown): PortalScope {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as PortalScope;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as PortalScope : {};
  } catch {
    return {};
  }
}

export function isPortalModuleEnabled(scope: PortalScope, moduleName: keyof NonNullable<PortalScope['modules']>) {
  const modules = scope.modules || {};
  if (moduleName === 'reefer') return modules.reefer === true;
  return modules[moduleName] !== false;
}

export function resolveReeferCapability(args: {
  portalEnabled: boolean;
  scope: PortalScope;
  role: CustomerPortalRole;
  counts: ReeferAccessCounts;
}) {
  if (!args.portalEnabled) return { visible: false, reason: 'portal_disabled' };
  if (!isPortalModuleEnabled(args.scope, 'reefer')) return { visible: false, reason: 'module_disabled' };
  if (!hasPortalAction(args.role, 'portal.reefer.view')) return { visible: false, reason: 'user_permission_missing' };
  if (args.counts.rfCount <= 0 && args.counts.reeferGrantCount <= 0) return { visible: false, reason: 'no_reefer_access' };
  return { visible: true, reason: 'available' };
}
```

- [ ] **Step 4: Create capabilities route**

Create `src/app/api/portal/capabilities/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { getPortalCustomerId, portalContainerVisibilitySql } from '@/lib/portalAccess';
import { requirePortalAction } from '@/lib/customerPortalPermissions';
import { parsePortalScope, resolveReeferCapability } from '@/lib/portalCapabilities';

export async function GET(request: NextRequest) {
  const cid = getPortalCustomerId(request);
  if (cid instanceof NextResponse) return cid;

  const db = await getDb();
  const actor = await requirePortalAction(request, db, 'portal.container.view');
  if (actor instanceof NextResponse) return actor;

  const customer = await db.request()
    .input('cid', sql.Int, cid)
    .query(`
      SELECT ISNULL(portal_enabled, 1) AS portal_enabled, portal_default_permission_scope
      FROM Customers
      WHERE customer_id = @cid
    `);

  const customerRow = customer.recordset[0];
  const scope = parsePortalScope(customerRow?.portal_default_permission_scope);

  const counts = await db.request()
    .input('cid', sql.Int, cid)
    .query(`
      SELECT
        SUM(CASE WHEN c.container_id IS NOT NULL THEN 1 ELSE 0 END) AS rf_count,
        (
          SELECT COUNT(1)
          FROM PortalEntityAccess pea
          WHERE pea.customer_id = @cid
            AND pea.entity_type IN ('reefer_check', 'reefer_exception')
            AND pea.is_active = 1
            AND (pea.valid_from IS NULL OR pea.valid_from <= GETDATE())
            AND (pea.valid_until IS NULL OR pea.valid_until >= GETDATE())
        ) AS reefer_grant_count
      FROM Containers c
      WHERE c.type = 'RF'
        AND ${portalContainerVisibilitySql('c')}
    `);

  const countRow = counts.recordset[0] || {};
  const reefer = resolveReeferCapability({
    portalEnabled: customerRow?.portal_enabled !== false && customerRow?.portal_enabled !== 0,
    scope,
    role: actor.customerPortalRole,
    counts: {
      rfCount: Number(countRow.rf_count || 0),
      reeferGrantCount: Number(countRow.reefer_grant_count || 0),
    },
  });

  return NextResponse.json({
    modules: {
      reefer,
    },
    settings: {
      reefer: scope.reefer || {},
    },
  });
}
```

- [ ] **Step 5: Run capability tests**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-capabilities.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/portalCapabilities.ts src/app/api/portal/capabilities/route.ts src/app/api/__tests__/portal-capabilities.test.ts
git commit -m "Add portal capability checks for reefer"
```

---

### Task 4: Make Portal Navigation Capability-Aware

**Files:**
- Modify: `src/app/(portal)/layout.tsx`
- Test: `src/app/api/__tests__/reefer-ui.test.ts`

- [ ] **Step 1: Update failing UI test**

Change the existing portal navigation test so it expects capability loading:

```ts
expect(layout).toContain('/api/portal/capabilities');
expect(layout).toContain('capabilities?.modules?.reefer?.visible');
expect(layout).toContain("href: '/portal/reefer'");
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```powershell
npm test -- src/app/api/__tests__/reefer-ui.test.ts --runInBand
```

Expected: FAIL because layout does not call capabilities yet.

- [ ] **Step 3: Add capability state in PortalLayout**

Add types and state:

```ts
interface PortalCapabilities {
  modules?: {
    reefer?: {
      visible: boolean;
      reason: string;
    };
  };
}

const [capabilities, setCapabilities] = useState<PortalCapabilities | null>(null);
```

- [ ] **Step 4: Load capabilities after customer session is available**

Add effect:

```ts
useEffect(() => {
  if (!session || session.role !== 'customer') return;

  let mounted = true;
  fetch('/api/portal/capabilities')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (mounted) setCapabilities(data);
    })
    .catch(() => {
      if (mounted) setCapabilities({ modules: { reefer: { visible: false, reason: 'load_failed' } } });
    });

  return () => { mounted = false; };
}, [session]);
```

- [ ] **Step 5: Filter nav items**

Change static nav item definition to include optional capability:

```ts
const navItems = [
  { label: 'ภาพรวม', href: '/portal', icon: <LayoutDashboard size={18} /> },
  { label: 'ตู้คอนเทนเนอร์', href: '/portal/containers', icon: <Package size={18} /> },
  { label: 'ตู้เย็น', href: '/portal/reefer', icon: <Thermometer size={18} />, capability: 'reefer' as const },
  { label: 'ใบแจ้งหนี้', href: '/portal/invoices', icon: <FileText size={18} /> },
  { label: 'Booking', href: '/portal/bookings', icon: <ClipboardList size={18} /> },
];

const visibleNavItems = navItems.filter(item => {
  if (item.capability === 'reefer') return capabilities?.modules?.reefer?.visible === true;
  return true;
});
```

Use `visibleNavItems` in both mobile and desktop nav.

- [ ] **Step 6: Run focused test**

Run:

```powershell
npm test -- src/app/api/__tests__/reefer-ui.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/app/(portal)/layout.tsx src/app/api/__tests__/reefer-ui.test.ts
git commit -m "Hide portal reefer menu by capability"
```

---

### Task 5: Enforce Reefer Module Policy in Portal Reefer API and Page

**Files:**
- Modify: `src/app/api/portal/reefer/route.ts`
- Modify: `src/app/(portal)/portal/reefer/page.tsx`
- Test: `src/app/api/__tests__/reefer-api.test.ts`
- Test: `src/app/api/__tests__/reefer-ui.test.ts`

- [ ] **Step 1: Add failing API expectations**

In `reefer-api.test.ts`, add:

```ts
it('requires the portal reefer action and customer reefer module before returning RF data', async () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/portal/reefer/route.ts'), 'utf8');
  expect(source).toContain("'portal.reefer.view'");
  expect(source).toContain('parsePortalScope');
  expect(source).toContain('resolveReeferCapability');
  expect(source).toContain('show_photo_evidence');
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run:

```powershell
npm test -- src/app/api/__tests__/reefer-api.test.ts --runInBand
```

Expected: FAIL until the route is updated.

- [ ] **Step 3: Update route permission**

Change:

```ts
const portalActor = await requirePortalAction(request, db, 'portal.container.view');
```

To:

```ts
const portalActor = await requirePortalAction(request, db, 'portal.reefer.view');
```

- [ ] **Step 4: Load customer portal scope in route**

Before querying RF containers, add:

```ts
const customerResult = await db.request()
  .input('cid', sql.Int, cid)
  .query(`
    SELECT ISNULL(portal_enabled, 1) AS portal_enabled, portal_default_permission_scope
    FROM Customers
    WHERE customer_id = @cid
  `);

const customerRow = customerResult.recordset[0];
const portalScope = parsePortalScope(customerRow?.portal_default_permission_scope);
```

- [ ] **Step 5: Apply module policy before returning data**

Use the helper after counts or via a capability precheck. If module is disabled:

```ts
if (!isPortalModuleEnabled(portalScope, 'reefer')) {
  return NextResponse.json({ error: 'ไม่เปิดใช้งานเมนูตู้เย็นสำหรับบัญชีนี้', items: [], history: [] }, { status: 403 });
}
```

- [ ] **Step 6: Respect photo evidence setting**

When returning `latest_photo_url` and history `photo_url`, only expose them when:

```ts
const canShowPhotoEvidence = portalScope.reefer?.show_photo_evidence !== false;
```

Map records before JSON response:

```ts
const items = result.recordset.map(row => ({
  ...row,
  latest_photo_url: canShowPhotoEvidence ? row.latest_photo_url : null,
}));

const history = historyResult.recordset.map(row => ({
  ...row,
  photo_url: canShowPhotoEvidence ? row.photo_url : null,
}));
```

- [ ] **Step 7: Update page restricted state**

In `src/app/(portal)/portal/reefer/page.tsx`, add error state:

```ts
const [error, setError] = useState<string | null>(null);
```

In `loadData()`:

```ts
const res = await fetch('/api/portal/reefer');
const data = await res.json().catch(() => ({}));
if (!res.ok) {
  setError(data.error || 'ไม่สามารถเปิดหน้าตู้เย็นได้');
  setItems([]);
  return;
}
setError(null);
setItems(data.items || []);
```

Render before table:

```tsx
{error && (
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
    {error}
  </div>
)}
```

- [ ] **Step 8: Run focused tests**

Run:

```powershell
npm test -- src/app/api/__tests__/reefer-api.test.ts src/app/api/__tests__/reefer-ui.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/app/api/portal/reefer/route.ts src/app/(portal)/portal/reefer/page.tsx src/app/api/__tests__/reefer-api.test.ts src/app/api/__tests__/reefer-ui.test.ts
git commit -m "Enforce portal reefer visibility policy"
```

---

### Task 6: Update Handoff and Run Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add an entry under Customer Portal / Reefer:

```md
- [x] **Customer Portal Reefer Settings** — Customer Master now supports module-level portal settings including `modules.reefer` and Reefer-specific visibility controls (`show_temperature_history`, `show_photo_evidence`, `show_exceptions`, `download_temperature_log`, `allow_exception_dispute`). Portal navigation calls `/api/portal/capabilities` and hides `/portal/reefer` unless the customer module is enabled, the user has `portal.reefer.view`, and the customer has RF/reefer grants.
```

Add verification commands:

```md
- `npm test -- src/app/api/__tests__/portal-capabilities.test.ts src/app/api/__tests__/customer-portal-defaults.test.ts src/app/api/__tests__/settings-users-customer-portal-role.test.ts src/app/api/__tests__/reefer-api.test.ts src/app/api/__tests__/reefer-ui.test.ts --runInBand`
- `npm run lint`
- `npx tsc --noEmit`
```

- [ ] **Step 2: Run targeted tests**

Run:

```powershell
npm test -- src/app/api/__tests__/portal-capabilities.test.ts src/app/api/__tests__/customer-portal-defaults.test.ts src/app/api/__tests__/settings-users-customer-portal-role.test.ts src/app/api/__tests__/reefer-api.test.ts src/app/api/__tests__/reefer-ui.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS or only pre-existing warnings. Fix warnings introduced by this work.

- [ ] **Step 4: Run TypeScript check**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add DEVELOPER_HANDOFF.md
git commit -m "Document portal reefer settings"
```

---

## Manual QA

1. Login as internal yard manager.
2. Go to `Settings > ลูกค้า`.
3. Edit a customer.
4. Confirm `Customer Portal` contains:
   - `เปิดเมนูตู้เย็น Reefer ให้ลูกค้า`
   - `แสดงประวัติอุณหภูมิ`
   - `แสดงรูปหลักฐานอุณหภูมิ`
   - `แสดง Reefer Exception`
   - `ดาวน์โหลด Temperature Log`
   - `ให้ลูกค้าสอบถาม Reefer Exception`
5. Save customer.
6. Login as customer user with `operations_user`.
7. If the customer has no RF/reefer grant, confirm the Reefer menu is hidden.
8. Give the customer a visible RF container grant.
9. Confirm the Reefer menu appears.
10. Open `/portal/reefer`.
11. Confirm only that customer’s RF containers appear.
12. Disable `แสดงรูปหลักฐานอุณหภูมิ`.
13. Confirm photo links no longer appear in `/portal/reefer`.

## Commit Sequence

1. `Add customer portal reefer actions`
2. `Add customer portal reefer settings`
3. `Add portal capability checks for reefer`
4. `Hide portal reefer menu by capability`
5. `Enforce portal reefer visibility policy`
6. `Document portal reefer settings`

## Push

After all commits and verification:

```powershell
git push origin codex-portal-access-ui-ux
```

