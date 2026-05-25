# Portal Access UI UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing admin/operator UI so Customer Portal access policy is manageable from Settings and Gate In shows the business relationship plus Portal Visibility Preview before creating grants.

**Architecture:** Keep field-level visibility policy out of Gate In. Settings owns customer defaults, customer-user roles, and per-grant field scope; Gate In only captures business context and previews which `PortalEntityAccess` grants will be created. Existing backend policy remains source of truth: `PortalEntityAccess`, `customerPortalPermissions`, `portalGrantRules`, and `eirVisibility`.

**Tech Stack:** Next.js App Router, React/TypeScript, MS SQL via `mssql`, Jest static/API tests, existing `logAudit`, `requireRole`, `requirePermission`, `applyPortalGrants`, `buildGatePartyGrants`, `defaultPortalPermissionScope`.

---

## File Structure

- Modify `src/app/(dashboard)/settings/UsersSettings.tsx`: add `customer_portal_role` selector for users with `role_code === 'customer'`, plus action preview badges.
- Modify `src/app/api/settings/users/route.ts`: select, insert, and update `Users.customer_portal_role`; audit role changes.
- Modify `src/app/(dashboard)/settings/CustomerMaster.tsx`: add Customer Portal enabled/default visibility section and field-level EIR defaults.
- Modify `src/app/api/settings/customers/route.ts`: read/write `portal_enabled` and `portal_default_permission_scope` on `Customers`.
- Modify `scripts/migrate-runtime-core-schema.js`: add backward-compatible `Customers.portal_enabled` and `Customers.portal_default_permission_scope`.
- Modify `src/lib/schema.sql`: document the new `Customers` columns.
- Create `src/app/(dashboard)/settings/PortalAccessControl.tsx`: admin page for grant listing, field-scope toggle, and reconcile preview/repair.
- Modify `src/app/(dashboard)/settings/page.tsx`: add a Settings tab for Portal Access.
- Create `src/app/api/portal/grants/route.ts`: admin-only list endpoint for `PortalEntityAccess` grants.
- Modify `src/app/api/portal/grants/field-scope/route.ts`: keep current API, ensure it accepts an audit reason and returns the updated grant.
- Modify `src/lib/portalGrantRules.ts`: allow customer default scope merge when creating new grants.
- Modify `src/app/api/gate/visibility-preview/route.ts`: internal endpoint that resolves Gate In form context into preview grants without writing.
- Modify `src/app/(dashboard)/gate/GateInTab.tsx`: add Booking selector, party summary, selected IDs, and Portal Visibility Preview panel.
- Modify `src/app/api/edi/bookings/route.ts`: enrich lookup/search responses with party fields and customer names.
- Modify `src/app/api/gate/route.ts`: accept/send `trucking_company_id`, `driver_user_id`, and resolved booking party IDs from Gate In.
- Modify `DEVELOPER_HANDOFF.md`: document the new UI surfaces, migration, and operator flow.

---

### Task 1: Customer Portal Role in Users UI

**Files:**
- Modify: `src/app/api/settings/users/route.ts`
- Modify: `src/app/(dashboard)/settings/UsersSettings.tsx`
- Test: `src/app/api/__tests__/settings-users-customer-portal-role.test.ts`

- [ ] **Step 1: Write failing API/static tests**

Create `src/app/api/__tests__/settings-users-customer-portal-role.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('settings users customer portal role wiring', () => {
  const apiSource = fs.readFileSync(path.join(process.cwd(), 'src/app/api/settings/users/route.ts'), 'utf8');
  const uiSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/UsersSettings.tsx'), 'utf8');

  it('selects and persists Users.customer_portal_role', () => {
    expect(apiSource).toContain('u.customer_portal_role');
    expect(apiSource).toContain('customerPortalRole');
    expect(apiSource).toContain('customer_portal_role = @customerPortalRole');
  });

  it('shows customer portal role selector only for customer users', () => {
    expect(uiSource).toContain('customer_portal_role');
    expect(uiSource).toContain('CUSTOMER_PORTAL_ROLES');
    expect(uiSource).toContain(\"form.role_code === 'customer'\");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- settings-users-customer-portal-role.test.ts --runInBand
```

Expected: FAIL because `UsersSettings.tsx` has no `customer_portal_role` UI and the API does not select/persist it yet.

- [ ] **Step 3: Update settings users API**

In `src/app/api/settings/users/route.ts`:

```ts
const CUSTOMER_PORTAL_ROLES = new Set([
  'customer_admin',
  'operations_user',
  'booking_user',
  'billing_user',
  'document_user',
  'trucking_coordinator',
  'driver_user',
  'read_only_viewer',
]);

function normalizeCustomerPortalRole(roleCode: string, value: unknown) {
  if (roleCode !== 'customer') return null;
  const role = typeof value === 'string' && CUSTOMER_PORTAL_ROLES.has(value)
    ? value
    : 'customer_admin';
  return role;
}
```

Update GET select/group:

```sql
u.customer_id, u.customer_portal_role, u.failed_login_count, ...
```

Update POST insert:

```ts
.input('customerPortalRole', sql.NVarChar, normalizeCustomerPortalRole(body.role_code, body.customer_portal_role))
```

```sql
INSERT INTO Users (..., customer_id, customer_portal_role, password_changed_at)
VALUES (..., @customerId, @customerPortalRole, GETDATE())
```

Update PUT set:

```sql
customer_id = @customerId,
customer_portal_role = @customerPortalRole,
updated_at = GETDATE()
```

Audit details should include:

```ts
details: {
  full_name: body.full_name,
  role_code: body.role_code,
  customer_portal_role: normalizeCustomerPortalRole(body.role_code, body.customer_portal_role),
  status: body.status,
}
```

- [ ] **Step 4: Update Users UI**

In `src/app/(dashboard)/settings/UsersSettings.tsx`, extend `UserData` and form state:

```ts
customer_portal_role?: string | null;
```

```ts
customer_portal_role: 'customer_admin',
```

Add role definitions:

```ts
const CUSTOMER_PORTAL_ROLES = [
  { code: 'customer_admin', label: 'Customer Admin', actions: ['ทุกสิทธิ์ของบริษัท'] },
  { code: 'operations_user', label: 'Operations', actions: ['ดูตู้', 'ดู Booking', 'ดู EIR'] },
  { code: 'booking_user', label: 'Booking', actions: ['สร้าง/ติดตาม Booking'] },
  { code: 'billing_user', label: 'Billing', actions: ['ดู Invoice', 'ดาวน์โหลดเอกสารบัญชี'] },
  { code: 'document_user', label: 'Document', actions: ['ดาวน์โหลด EIR/Bundle'] },
  { code: 'trucking_coordinator', label: 'Trucking Coordinator', actions: ['ดูงานรถที่เกี่ยวข้อง'] },
  { code: 'driver_user', label: 'Driver', actions: ['ดูงาน/EIR ของตัวเอง'] },
  { code: 'read_only_viewer', label: 'Read-only', actions: ['ดูข้อมูลที่ได้รับ grant'] },
];
```

When role changes away from `customer`, reset:

```ts
setForm({
  ...form,
  role_code: e.target.value,
  customer_id: e.target.value !== 'customer' ? null : form.customer_id,
  customer_portal_role: e.target.value !== 'customer' ? 'customer_admin' : form.customer_portal_role,
});
```

Render below company selector when `form.role_code === 'customer'`:

```tsx
<div className="md:col-span-2 rounded-xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-900/10">
  <label className="block text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
    Customer Portal Role
  </label>
  <select
    value={form.customer_portal_role}
    onChange={e => setForm({ ...form, customer_portal_role: e.target.value })}
    className="h-11 w-full px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
  >
    {CUSTOMER_PORTAL_ROLES.map(role => <option key={role.code} value={role.code}>{role.label}</option>)}
  </select>
  <div className="mt-2 flex flex-wrap gap-1.5">
    {(CUSTOMER_PORTAL_ROLES.find(role => role.code === form.customer_portal_role)?.actions || []).map(action => (
      <span key={action} className="rounded-full bg-white px-2 py-1 text-[10px] text-violet-600 dark:bg-slate-800">
        {action}
      </span>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- settings-users-customer-portal-role.test.ts --runInBand
npm run lint
```

Expected: PASS.

Commit:

```powershell
git add src/app/api/settings/users/route.ts src/app/(dashboard)/settings/UsersSettings.tsx src/app/api/__tests__/settings-users-customer-portal-role.test.ts
git commit -m "Add customer portal role controls"
```

---

### Task 2: Customer Master Portal Defaults

**Files:**
- Modify: `scripts/migrate-runtime-core-schema.js`
- Modify: `src/lib/schema.sql`
- Modify: `src/app/api/settings/customers/route.ts`
- Modify: `src/app/(dashboard)/settings/CustomerMaster.tsx`
- Test: `src/app/api/__tests__/customer-portal-defaults.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/__tests__/customer-portal-defaults.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('customer portal defaults', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'scripts/migrate-runtime-core-schema.js'), 'utf8');
  const api = fs.readFileSync(path.join(process.cwd(), 'src/app/api/settings/customers/route.ts'), 'utf8');
  const ui = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/CustomerMaster.tsx'), 'utf8');

  it('adds customer portal default columns through migration', () => {
    expect(migration).toContain(\"COL_LENGTH('Customers', 'portal_enabled')\");
    expect(migration).toContain(\"COL_LENGTH('Customers', 'portal_default_permission_scope')\");
  });

  it('reads and writes portal defaults in customer settings API', () => {
    expect(api).toContain('portal_enabled');
    expect(api).toContain('portal_default_permission_scope');
    expect(api).toContain('customer_portal_visibility_update');
  });

  it('renders EIR field visibility toggles in customer master', () => {
    expect(ui).toContain('Customer Portal');
    expect(ui).toContain('แสดงเกรดตู้ใน EIR ให้ลูกค้า');
    expect(ui).toContain('damage_photos');
    expect(ui).toContain('truck_plate_full');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- customer-portal-defaults.test.ts --runInBand
```

Expected: FAIL because `Customers` does not yet expose portal defaults in UI/API.

- [ ] **Step 3: Add migration columns**

In `scripts/migrate-runtime-core-schema.js`, add a step near customer schema migrations:

```js
await runStep(pool, 'Customer portal default visibility columns', `
  IF COL_LENGTH('Customers', 'portal_enabled') IS NULL
    ALTER TABLE Customers ADD portal_enabled BIT NOT NULL CONSTRAINT DF_Customers_PortalEnabled DEFAULT 1;
  IF COL_LENGTH('Customers', 'portal_default_permission_scope') IS NULL
    ALTER TABLE Customers ADD portal_default_permission_scope NVARCHAR(MAX) NULL;
`);
```

In `src/lib/schema.sql`, add to `Customers`:

```sql
portal_enabled BIT NOT NULL DEFAULT 1,
portal_default_permission_scope NVARCHAR(MAX) NULL,
```

- [ ] **Step 4: Update customer settings API**

Add a default scope helper in `src/app/api/settings/customers/route.ts`:

```ts
function normalizePortalDefaultScope(input: unknown) {
  const source = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  const eir = typeof source.eir === 'object' && source.eir !== null ? source.eir as Record<string, unknown> : {};
  const fields = typeof eir.fields === 'object' && eir.fields !== null ? eir.fields as Record<string, unknown> : {};
  return {
    view: true,
    download: Boolean(source.download ?? true),
    eir: {
      fields: {
        container_grade: Boolean(fields.container_grade),
        damage_summary: fields.damage_summary !== false,
        damage_photos: fields.damage_photos !== false,
        seal_number: fields.seal_number !== false,
        driver_name: Boolean(fields.driver_name),
        truck_plate_full: Boolean(fields.truck_plate_full),
        billing_clearance: Boolean(fields.billing_clearance),
        invoice_amount: Boolean(fields.invoice_amount),
        internal_note: false,
      },
    },
    maskSensitiveFields: true,
  };
}
```

Select:

```sql
ISNULL(c.portal_enabled, 1) AS portal_enabled,
c.portal_default_permission_scope,
```

POST/PUT inputs:

```ts
.input('portalEnabled', sql.Bit, body.portal_enabled !== false)
.input('portalDefaultPermissionScope', sql.NVarChar, JSON.stringify(normalizePortalDefaultScope(body.portal_default_permission_scope)))
```

POST/PUT SQL fields:

```sql
portal_enabled,
portal_default_permission_scope
```

Audit action when these settings are present:

```ts
await logAudit({
  userId: auth.userId,
  yardId: body.yard_id,
  action: 'customer_portal_visibility_update',
  entityType: 'customer',
  entityId: customer_id,
  details: {
    portal_enabled: body.portal_enabled !== false,
    portal_default_permission_scope: normalizePortalDefaultScope(body.portal_default_permission_scope),
  },
});
```

- [ ] **Step 5: Update Customer Master UI**

Extend form:

```ts
portal_enabled: true,
portal_default_permission_scope: {
  view: true,
  download: true,
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
},
```

Add a portal settings section inside `FormFields()`:

```tsx
<div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-900/10">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-semibold text-slate-800 dark:text-white">Customer Portal</p>
      <p className="text-xs text-slate-500">ค่าเริ่มต้นสำหรับ grants ใหม่ของลูกค้ารายนี้</p>
    </div>
    <button
      type="button"
      onClick={() => setForm({ ...form, portal_enabled: !form.portal_enabled })}
      className={`h-9 rounded-lg px-3 text-xs font-semibold ${form.portal_enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}
    >
      {form.portal_enabled ? 'เปิดใช้งาน Portal' : 'ปิด Portal'}
    </button>
  </div>
  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
    {[
      ['container_grade', 'แสดงเกรดตู้ใน EIR ให้ลูกค้า'],
      ['damage_summary', 'แสดงสรุปผลตรวจสภาพ'],
      ['damage_photos', 'แสดงรูป Damage'],
      ['seal_number', 'แสดงเลขซีล'],
      ['driver_name', 'แสดงชื่อคนขับ'],
      ['truck_plate_full', 'แสดงทะเบียนเต็ม'],
      ['billing_clearance', 'แสดง Billing Clearance'],
      ['invoice_amount', 'แสดงยอด Invoice'],
      ['internal_note', 'แสดง Internal Note'],
    ].map(([key, label]) => (
      <label key={key} className="flex items-center gap-2 rounded-lg border border-white/70 bg-white/80 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60">
        <input
          type="checkbox"
          checked={Boolean(form.portal_default_permission_scope.eir.fields[key as keyof typeof form.portal_default_permission_scope.eir.fields])}
          onChange={e => setForm(prev => ({
            ...prev,
            portal_default_permission_scope: {
              ...prev.portal_default_permission_scope,
              eir: {
                ...prev.portal_default_permission_scope.eir,
                fields: {
                  ...prev.portal_default_permission_scope.eir.fields,
                  [key]: key === 'internal_note' ? false : e.target.checked,
                },
              },
            },
          }))}
          disabled={key === 'internal_note'}
          className="accent-blue-600"
        />
        <span>{label}</span>
      </label>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node scripts/migrate-runtime-core-schema.js
npm test -- customer-portal-defaults.test.ts --runInBand
npm run lint
```

Expected: migration succeeds and tests pass.

Commit:

```powershell
git add scripts/migrate-runtime-core-schema.js src/lib/schema.sql src/app/api/settings/customers/route.ts src/app/(dashboard)/settings/CustomerMaster.tsx src/app/api/__tests__/customer-portal-defaults.test.ts
git commit -m "Add customer portal default visibility settings"
```

---

### Task 3: Portal Access Control Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/PortalAccessControl.tsx`
- Create: `src/app/api/portal/grants/route.ts`
- Modify: `src/app/api/portal/grants/field-scope/route.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Test: `src/app/api/__tests__/portal-access-control-ui.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/__tests__/portal-access-control-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('portal access control UI', () => {
  const settingsPage = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/page.tsx'), 'utf8');

  it('adds a settings tab for portal access control', () => {
    expect(settingsPage).toContain('Portal Access');
    expect(settingsPage).toContain('PortalAccessControl');
  });

  it('has admin grants list API', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/portal/grants/route.ts'), 'utf8');
    expect(route).toContain('PortalEntityAccess');
    expect(route).toContain('requireRole');
    expect(route).toContain('yard_manager');
  });

  it('has field scope toggle and reconcile controls in UI', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/PortalAccessControl.tsx'), 'utf8');
    expect(ui).toContain('/api/portal/grants/reconcile');
    expect(ui).toContain('/api/portal/grants/field-scope');
    expect(ui).toContain('แสดงเกรดตู้ใน EIR ให้ลูกค้า');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- portal-access-control-ui.test.ts --runInBand
```

Expected: FAIL because the page/API do not exist yet.

- [ ] **Step 3: Create grants list API**

Create `src/app/api/portal/grants/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  const actor = requireRole(request, ['yard_manager'], 'เฉพาะ Yard Manager เท่านั้นที่ดูสิทธิ์ Customer Portal ได้');
  if (actor instanceof NextResponse) return actor;

  const { searchParams } = new URL(request.url);
  const customerId = Number(searchParams.get('customer_id') || 0);
  const entityType = searchParams.get('entity_type') || '';
  const active = searchParams.get('active') || '1';
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

  const db = await getDb();
  const req = db.request()
    .input('limit', sql.Int, limit)
    .input('customerId', sql.Int, Number.isFinite(customerId) && customerId > 0 ? customerId : null)
    .input('entityType', sql.NVarChar, entityType || null)
    .input('isActive', sql.Bit, active === 'all' ? null : active !== '0');

  const result = await req.query(`
    SELECT TOP (@limit)
      pea.access_id,
      pea.customer_id,
      c.customer_name,
      pea.entity_type,
      pea.entity_id,
      pea.entity_ref,
      pea.access_role,
      pea.source_table,
      pea.source_id,
      pea.permission_scope,
      pea.valid_from,
      pea.valid_until,
      pea.is_active,
      pea.created_at,
      pea.updated_at
    FROM PortalEntityAccess pea
    JOIN Customers c ON c.customer_id = pea.customer_id
    WHERE (@customerId IS NULL OR pea.customer_id = @customerId)
      AND (@entityType IS NULL OR pea.entity_type = @entityType)
      AND (@isActive IS NULL OR pea.is_active = @isActive)
    ORDER BY pea.updated_at DESC, pea.created_at DESC, pea.access_id DESC
  `);

  return NextResponse.json({ grants: result.recordset });
}
```

- [ ] **Step 4: Ensure field-scope route requires reason**

In `src/app/api/portal/grants/field-scope/route.ts`, require:

```ts
const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
if (!reason) {
  return NextResponse.json({ error: 'กรุณาระบุเหตุผลการเปลี่ยนสิทธิ์' }, { status: 400 });
}
```

Add `reason` into `logAudit.details`.

- [ ] **Step 5: Create Portal Access Control UI**

Create `src/app/(dashboard)/settings/PortalAccessControl.tsx` with these sections:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';

interface PortalGrantRow {
  access_id: number;
  customer_id: number;
  customer_name: string;
  entity_type: string;
  entity_ref?: string | null;
  entity_id?: number | null;
  access_role: string;
  permission_scope?: string | null;
  valid_until?: string | null;
  is_active: boolean;
}

export default function PortalAccessControl() {
  const { toast } = useToast();
  const [grants, setGrants] = useState<PortalGrantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconcile, setReconcile] = useState<{ missing?: unknown[]; stale?: unknown[] } | null>(null);
  const [reason, setReason] = useState('');

  const loadGrants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/grants?limit=200');
      const json = await res.json();
      setGrants(Array.isArray(json.grants) ? json.grants : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGrants(); }, [loadGrants]);

  const previewReconcile = async () => {
    const res = await fetch('/api/portal/grants/reconcile?mode=preview');
    const json = await res.json();
    setReconcile(json);
  };

  const repairReconcile = async () => {
    const res = await fetch('/api/portal/grants/reconcile', { method: 'POST' });
    const json = await res.json();
    setReconcile(json);
    toast(res.ok ? 'success' : 'error', res.ok ? 'ซ่อมแซม grants แล้ว' : json.error || 'ซ่อมแซม grants ไม่สำเร็จ');
    loadGrants();
  };

  const toggleGrade = async (grant: PortalGrantRow, enabled: boolean) => {
    const trimmed = reason.trim();
    if (!trimmed) {
      toast('warning', 'กรุณาระบุเหตุผล', 'ต้องมี audit log ทุกครั้งที่เปลี่ยน field visibility');
      return;
    }
    const res = await fetch('/api/portal/grants/field-scope', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_id: grant.access_id, field: 'container_grade', enabled, reason: trimmed }),
    });
    const json = await res.json();
    toast(res.ok ? 'success' : 'error', res.ok ? 'อัปเดตสิทธิ์เรียบร้อย' : json.error || 'อัปเดตไม่สำเร็จ');
    if (res.ok) loadGrants();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Portal Access</h2>
            <p className="text-xs text-slate-400">ตรวจสอบ grants, preview reconcile และตั้ง field-level EIR visibility</p>
          </div>
          <button onClick={loadGrants} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reload
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-700">PortalEntityAccess</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/30">
                <tr>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Grade</th>
                </tr>
              </thead>
              <tbody>
                {grants.map(grant => {
                  const scope = grant.permission_scope ? JSON.parse(grant.permission_scope) : {};
                  const gradeEnabled = Boolean(scope?.eir?.fields?.container_grade);
                  return (
                    <tr key={grant.access_id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2">{grant.customer_name}</td>
                      <td className="px-3 py-2 font-mono">{grant.entity_type}:{grant.entity_ref || grant.entity_id}</td>
                      <td className="px-3 py-2">{grant.access_role}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleGrade(grant, !gradeEnabled)}
                          className={`rounded-full px-2 py-1 ${gradeEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          แสดงเกรดตู้ใน EIR ให้ลูกค้า: {gradeEnabled ? 'On' : 'Off'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={14} /> Audit reason</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className="mt-2 h-20 w-full rounded-lg border p-2 text-xs" placeholder="เช่น ลูกค้าขอเห็น grade ตามสัญญา..." />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={14} /> Reconcile Grants</p>
            <div className="mt-3 flex gap-2">
              <button onClick={previewReconcile} className="rounded-lg border px-3 py-2 text-xs">Preview</button>
              <button onClick={repairReconcile} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white">Repair</button>
            </div>
            {reconcile && <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-100">{JSON.stringify(reconcile, null, 2)}</pre>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add Settings tab**

In `src/app/(dashboard)/settings/page.tsx`:

```ts
import PortalAccessControl from './PortalAccessControl';
```

Add tab:

```ts
{ id: 'portal-access', group: 'customer_finance', label: 'Portal Access', description: 'จัดการ grants และ field visibility ของ Customer Portal', keywords: 'portal grant visibility customer eir สิทธิ์', icon: <Shield size={18} />, color: '#0EA5E9', permission: 'settings.manage' },
```

Render:

```tsx
{effectiveTab === 'portal-access' && <PortalAccessControl />}
```

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test -- portal-access-control-ui.test.ts --runInBand
npm run lint
```

Expected: PASS.

Commit:

```powershell
git add src/app/(dashboard)/settings/PortalAccessControl.tsx src/app/(dashboard)/settings/page.tsx src/app/api/portal/grants/route.ts src/app/api/portal/grants/field-scope/route.ts src/app/api/__tests__/portal-access-control-ui.test.ts
git commit -m "Add portal access control settings UI"
```

---

### Task 4: Booking Selector and Business Context in Gate In

**Files:**
- Modify: `src/app/api/edi/bookings/route.ts`
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Test: `src/app/api/__tests__/gate-in-business-context-ui.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/__tests__/gate-in-business-context-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Gate In business context UI', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const bookings = fs.readFileSync(path.join(process.cwd(), 'src/app/api/edi/bookings/route.ts'), 'utf8');

  it('shows a real booking selector and party summary', () => {
    expect(gateIn).toContain('selectedBooking');
    expect(gateIn).toContain('เลือก Booking');
    expect(gateIn).toContain('Booking Customer');
    expect(gateIn).toContain('Forwarder');
    expect(gateIn).toContain('Consignee');
    expect(gateIn).toContain('Bill To Customer');
  });

  it('booking lookup returns party ids and names', () => {
    expect(bookings).toContain('booking_customer_id');
    expect(bookings).toContain('shipping_line_name');
    expect(bookings).toContain('forwarder_name');
    expect(bookings).toContain('bill_to_customer_name');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- gate-in-business-context-ui.test.ts --runInBand
```

Expected: FAIL because Gate In has only `Booking Ref` text input, not a full selector.

- [ ] **Step 3: Enrich booking lookup response**

In `src/app/api/edi/bookings/route.ts`, extend `bookingSummarySelect()`:

```sql
b.booking_customer_id,
b.shipping_line_id,
b.forwarder_id,
b.shipper_id,
b.consignee_id,
b.trucking_company_id,
b.bill_to_customer_id,
bookingCustomer.customer_name AS booking_customer_name,
shippingLine.customer_name AS shipping_line_name,
forwarder.customer_name AS forwarder_name,
shipper.customer_name AS shipper_name,
consignee.customer_name AS consignee_name,
trucking.customer_name AS trucking_company_name,
billTo.customer_name AS bill_to_customer_name,
```

Add joins wherever `bookingSummarySelect()` is used:

```sql
LEFT JOIN Customers bookingCustomer ON bookingCustomer.customer_id = COALESCE(b.booking_customer_id, b.customer_id)
LEFT JOIN Customers shippingLine ON shippingLine.customer_id = b.shipping_line_id
LEFT JOIN Customers forwarder ON forwarder.customer_id = b.forwarder_id
LEFT JOIN Customers shipper ON shipper.customer_id = b.shipper_id
LEFT JOIN Customers consignee ON consignee.customer_id = b.consignee_id
LEFT JOIN Customers trucking ON trucking.customer_id = b.trucking_company_id
LEFT JOIN Customers billTo ON billTo.customer_id = b.bill_to_customer_id
```

- [ ] **Step 4: Add Gate In booking selector state**

In `GateInTab.tsx` add:

```ts
interface GateBookingOption {
  booking_id: number;
  booking_number: string;
  customer_id?: number | null;
  booking_customer_id?: number | null;
  shipping_line_id?: number | null;
  forwarder_id?: number | null;
  shipper_id?: number | null;
  consignee_id?: number | null;
  trucking_company_id?: number | null;
  bill_to_customer_id?: number | null;
  booking_customer_name?: string | null;
  shipping_line_name?: string | null;
  forwarder_name?: string | null;
  shipper_name?: string | null;
  consignee_name?: string | null;
  trucking_company_name?: string | null;
  bill_to_customer_name?: string | null;
  vessel_name?: string | null;
  voyage_number?: string | null;
}

const [selectedBooking, setSelectedBooking] = useState<GateBookingOption | null>(null);
const [bookingSearch, setBookingSearch] = useState('');
const [bookingResults, setBookingResults] = useState<GateBookingOption[]>([]);
const [showBookingPicker, setShowBookingPicker] = useState(false);
```

Add helper:

```ts
const applyGateInBooking = (booking: GateBookingOption | null) => {
  setSelectedBooking(booking);
  setGateInForm(prev => ({ ...prev, booking_ref: booking?.booking_number || '' }));
  if (booking?.booking_customer_id || booking?.customer_id) setManualCustomerId(booking.booking_customer_id || booking.customer_id || null);
  if (booking?.bill_to_customer_id) setBillingCustomerId(booking.bill_to_customer_id);
  if (booking?.trucking_company_name) {
    setGateInForm(prev => ({ ...prev, truck_company: booking.trucking_company_name || prev.truck_company }));
    setTruckCompanySearch(booking.trucking_company_name || '');
  }
};

const searchBookings = async () => {
  const res = await fetch(`/api/edi/bookings?lookup=1&booking_number=${encodeURIComponent(bookingSearch)}&yard_id=${yardId}`);
  const json = await res.json();
  setBookingResults(json.booking ? [json.booking] : []);
};
```

- [ ] **Step 5: Render selector and party summary**

Replace the single `Booking Ref` field area with selector UI:

```tsx
<div className="md:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-900/10">
  <div className="flex items-center justify-between gap-2">
    <div>
      <label className={labelClass}>Booking</label>
      <p className="text-[10px] text-slate-400">เลือก Booking เพื่อดึง party และสร้าง grants ให้ถูกต้อง</p>
    </div>
    {selectedBooking && (
      <button onClick={() => applyGateInBooking(null)} className="text-xs text-slate-400 hover:text-rose-500">ไม่ใช้ Booking</button>
    )}
  </div>
  <div className="mt-2 flex gap-2">
    <input value={bookingSearch} onChange={e => setBookingSearch(e.target.value)} className={inputClass} placeholder="ค้นหา Booking No." />
    <button onClick={searchBookings} className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white">ค้นหา</button>
  </div>
  <div className="mt-2 space-y-1">
    {bookingResults.map(booking => (
      <button key={booking.booking_id} onClick={() => applyGateInBooking(booking)} className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs dark:bg-slate-800">
        <span className="font-mono font-semibold">{booking.booking_number}</span>
        <span className="ml-2 text-slate-400">{booking.booking_customer_name || '-'}</span>
      </button>
    ))}
  </div>
  {selectedBooking && (
    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
      <InfoMini label="Booking Customer" value={selectedBooking.booking_customer_name || '-'} />
      <InfoMini label="Shipping Line" value={selectedBooking.shipping_line_name || '-'} />
      <InfoMini label="Forwarder" value={selectedBooking.forwarder_name || '-'} />
      <InfoMini label="Shipper" value={selectedBooking.shipper_name || '-'} />
      <InfoMini label="Consignee" value={selectedBooking.consignee_name || '-'} />
      <InfoMini label="Trucking Company" value={selectedBooking.trucking_company_name || '-'} />
      <InfoMini label="Bill To Customer" value={selectedBooking.bill_to_customer_name || '-'} />
    </div>
  )}
</div>
```

Add local component:

```tsx
function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- gate-in-business-context-ui.test.ts --runInBand
npm run lint
```

Expected: PASS.

Commit:

```powershell
git add src/app/api/edi/bookings/route.ts src/app/(dashboard)/gate/GateInTab.tsx src/app/api/__tests__/gate-in-business-context-ui.test.ts
git commit -m "Add Gate In booking business context"
```

---

### Task 5: Portal Visibility Preview in Gate In

**Files:**
- Create: `src/app/api/gate/visibility-preview/route.ts`
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Test: `src/app/api/__tests__/gate-visibility-preview.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/__tests__/gate-visibility-preview.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Gate visibility preview', () => {
  it('has an internal preview endpoint using portal grant rules without writing grants', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/visibility-preview/route.ts'), 'utf8');
    expect(route).toContain('buildGatePartyGrants');
    expect(route).toContain('defaultPortalPermissionScope');
    expect(route).not.toContain('applyPortalGrants');
  });

  it('renders Portal Visibility Preview in Gate In', () => {
    const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
    expect(gateIn).toContain('Portal Visibility Preview');
    expect(gateIn).toContain('/api/gate/visibility-preview');
    expect(gateIn).toContain('accessRole');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- gate-visibility-preview.test.ts --runInBand
```

Expected: FAIL because the endpoint/panel do not exist yet.

- [ ] **Step 3: Create preview endpoint**

Create `src/app/api/gate/visibility-preview/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';
import { buildGatePartyGrants, defaultPortalPermissionScope } from '@/lib/portalGrantRules';

export async function POST(request: NextRequest) {
  const db = await getDb();
  const actor = await requirePermission(request, db, 'gate.in', 'คุณไม่มีสิทธิ์ดู Portal Visibility Preview');
  if (actor instanceof NextResponse) return actor;

  const body = await request.json();
  const grants = buildGatePartyGrants({
    transaction_id: 0,
    eir_number: body.eir_number || 'EIR-PREVIEW',
    container_id: body.container_id || 0,
    container_number: body.container_number,
    container_owner_id: body.container_owner_id,
    booking_customer_id: body.booking_customer_id,
    billing_customer_id: body.billing_customer_id,
    trucking_company_id: body.trucking_company_id,
    driver_user_id: body.driver_user_id,
    validUntil: body.valid_until || null,
  });

  const preview = grants.map(grant => ({
    customerId: grant.customerId,
    entityType: grant.entityType,
    entityRef: grant.entityRef,
    accessRole: grant.accessRole,
    sourceTable: grant.sourceTable,
    validUntil: grant.validUntil || null,
    permissionScope: grant.permissionScope || defaultPortalPermissionScope(grant.accessRole),
  }));

  return NextResponse.json({ preview });
}
```

- [ ] **Step 4: Add preview state and request in Gate In**

In `GateInTab.tsx`:

```ts
interface PortalVisibilityPreviewRow {
  customerId: number;
  entityType: string;
  entityRef?: string | null;
  accessRole: string;
  validUntil?: string | null;
  permissionScope?: Record<string, unknown>;
}

const [visibilityPreview, setVisibilityPreview] = useState<PortalVisibilityPreviewRow[]>([]);
const [visibilityPreviewLoading, setVisibilityPreviewLoading] = useState(false);

useEffect(() => {
  if (!gateInForm.container_number) {
    setVisibilityPreview([]);
    return;
  }
  const controller = new AbortController();
  setVisibilityPreviewLoading(true);
  fetch('/api/gate/visibility-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      container_number: gateInForm.container_number,
      container_owner_id: containerOwnerId,
      booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || manualCustomerId,
      billing_customer_id: billingCustomerId,
      trucking_company_id: selectedBooking?.trucking_company_id || null,
      driver_user_id: null,
    }),
  })
    .then(res => res.json())
    .then(json => setVisibilityPreview(Array.isArray(json.preview) ? json.preview : []))
    .catch(err => {
      if (err.name !== 'AbortError') console.error('visibility preview error', err);
    })
    .finally(() => setVisibilityPreviewLoading(false));
  return () => controller.abort();
}, [gateInForm.container_number, containerOwnerId, selectedBooking, manualCustomerId, billingCustomerId]);
```

- [ ] **Step 5: Render preview panel**

Render below owner/billing section:

```tsx
<div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold text-slate-800 dark:text-white">Portal Visibility Preview</p>
      <p className="text-[10px] text-slate-400">Gate In แสดงเฉพาะว่าจะสร้าง grant ให้ใคร ไม่ได้ตั้ง field policy รายครั้ง</p>
    </div>
    {visibilityPreviewLoading && <Loader2 size={14} className="animate-spin text-cyan-600" />}
  </div>
  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
    {visibilityPreview.length === 0 ? (
      <p className="text-xs text-slate-400">ยังไม่มี party ที่จะได้รับสิทธิ์</p>
    ) : visibilityPreview.map((row, index) => (
      <div key={`${row.customerId}-${row.entityType}-${row.accessRole}-${index}`} className="rounded-lg bg-white/80 p-2 text-xs dark:bg-slate-800/70">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Customer #{row.customerId}</p>
        <p className="mt-0.5 text-slate-400">{row.entityType} · {row.accessRole}</p>
        <p className="mt-1 text-[10px] text-slate-400">Grade default: hidden</p>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- gate-visibility-preview.test.ts --runInBand
npm run lint
```

Expected: PASS.

Commit:

```powershell
git add src/app/api/gate/visibility-preview/route.ts src/app/(dashboard)/gate/GateInTab.tsx src/app/api/__tests__/gate-visibility-preview.test.ts
git commit -m "Add Gate In portal visibility preview"
```

---

### Task 6: Gate In Grant IDs and Driver/Trucking Backend Plumbing

**Files:**
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Modify: `src/app/api/gate/route.ts`
- Test: `src/app/api/__tests__/gate-in-party-grants.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/__tests__/gate-in-party-grants.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Gate In party grants', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/route.ts'), 'utf8');

  it('sends selected party ids from Gate In to gate API', () => {
    expect(gateIn).toContain('booking_customer_id');
    expect(gateIn).toContain('trucking_company_id');
    expect(gateIn).toContain('driver_user_id');
  });

  it('gate API stores party ids and builds grants from them', () => {
    expect(route).toContain('trucking_company_id');
    expect(route).toContain('driver_user_id');
    expect(route).toContain('buildGatePartyGrants');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- gate-in-party-grants.test.ts --runInBand
```

Expected: FAIL until Gate In sends IDs consistently.

- [ ] **Step 3: Send selected party IDs from Gate In**

In the Gate In submit body, add:

```ts
booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || manualCustomerId || undefined,
trucking_company_id: selectedBooking?.trucking_company_id || customerList.find(c => c.customer_name === gateInForm.truck_company)?.customer_id || undefined,
driver_user_id: undefined,
```

Keep `truck_company` as display/free text for backward compatibility.

- [ ] **Step 4: Verify gate API prefers explicit IDs**

In `src/app/api/gate/route.ts`, ensure resolved values follow this order:

```ts
let resolvedBookingCustomerId = booking_customer_id || null;
...
booking_customer_id: resolvedBookingCustomerId,
billing_customer_id,
trucking_company_id,
driver_user_id,
```

No UI for driver portal is added in this task; `driver_user_id` remains backend-ready.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- gate-in-party-grants.test.ts --runInBand
npm run lint
```

Expected: PASS.

Commit:

```powershell
git add src/app/(dashboard)/gate/GateInTab.tsx src/app/api/gate/route.ts src/app/api/__tests__/gate-in-party-grants.test.ts
git commit -m "Wire Gate In party ids to portal grants"
```

---

### Task 7: Handoff and Full Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add a section:

```md
### Customer Portal Access UI/UX

- Settings > Users now supports `customer_portal_role` for customer users.
- Settings > Customer Master stores portal default visibility and field-level EIR defaults.
- Settings > Portal Access lists PortalEntityAccess grants, previews/repairs reconcile, and toggles EIR grade visibility with audit reason.
- Gate In captures booking/business parties and shows Portal Visibility Preview only; field-level policy remains in Settings.
- Gate In sends party IDs for booking_customer, billing, trucking, and future driver grants.

Default policy:
- Customer Portal does not see `container_grade` unless the user has `portal.eir.grade.view` and the grant scope enables `eir.fields.container_grade`.
- Public EIR never shows `container_grade`.
- Driver/trucking grants remain backend policy only; no Driver/Trucking Portal UI yet.
```

- [ ] **Step 2: Run migration and focused tests**

Run:

```powershell
node scripts/migrate-runtime-core-schema.js
npm test -- settings-users-customer-portal-role.test.ts customer-portal-defaults.test.ts portal-access-control-ui.test.ts gate-in-business-context-ui.test.ts gate-visibility-preview.test.ts gate-in-party-grants.test.ts --runInBand
```

Expected: migration succeeds and focused tests pass.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm test -- --runInBand
npx tsc --noEmit --pretty false
npm run lint
```

Expected:
- all Jest suites pass
- TypeScript exits with code 0
- lint exits with code 0

- [ ] **Step 4: Commit handoff**

```powershell
git add DEVELOPER_HANDOFF.md
git commit -m "Document portal access UI controls"
```

- [ ] **Step 5: Push all commits**

```powershell
git push origin master
```

---

## Rollout Notes

- Run `node scripts/migrate-runtime-core-schema.js` before using Customer Master portal defaults.
- Keep `container_grade` hidden by default for customer/public/driver/trucking views.
- Gate In is not a policy editor; it only previews grants derived from business context.
- Admin changes to field visibility must include reason and write audit log.
- Driver/Trucking Portal UI remains a later phase; this plan only keeps backend grants ready.

## Self-Review

- Spec coverage: Gate In business fields, Settings policy location, Customer Portal roles, field-level visibility, audit, and visibility preview all map to tasks above.
- Placeholder scan: No task uses unspecified future work as a required implementation step.
- Type consistency: `customer_portal_role`, `portal_default_permission_scope`, `PortalEntityAccess.permission_scope`, and `accessRole` names match existing backend conventions.
