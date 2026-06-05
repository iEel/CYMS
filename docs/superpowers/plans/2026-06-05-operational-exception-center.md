# Operational Exception Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a central Operational Exception Center that lets staff see, assign, resolve, ignore, and deep-link operational exceptions from reconciliation, reefer, supervisor review, and transport workflows without duplicating the existing source systems.

**Architecture:** Reuse existing exception sources as source-of-truth: `/api/reports/reconciliation`, `ReeferExceptions`, `ApprovalReviews`, and `GateOutRequests`/`TransportJobActivities`. Add a normalized exception read model plus a thin action layer that reuses `ReconciliationActions` for generic assignment/resolution state and delegates source-owned actions to existing workflows where they already exist. Keep schema changes minimal: add RBAC permissions only, with all DDL in migration/schema scripts.

**Tech Stack:** Next.js App Router, React/TypeScript, MS SQL via `mssql`, existing CYMS RBAC helpers, Jest static/API tests, existing audit helper, existing dashboard layout/Tailwind.

---

## Current Code Context

- Existing reconciliation issue engine lives in `src/app/api/reports/reconciliation/route.ts`.
- Existing action overlay lives in `src/lib/reconciliationActions.ts` and table `ReconciliationActions`.
- Existing reefer exception workflow lives in `src/app/api/reefer/exceptions/route.ts`, `src/lib/reeferExceptions.ts`, and `src/lib/reeferEscalation.ts`.
- Existing supervisor approval inbox lives in `src/app/api/approval-reviews/route.ts`, `src/lib/approvalReview.ts`, and `src/app/(dashboard)/supervisor-review/page.tsx`.
- Existing transport worklist lives in `src/app/api/transport/jobs/route.ts`, `src/app/api/transport/actions/route.ts`, and `src/lib/transportPortalAccess.ts`.
- Existing operations UI lives in `src/app/(dashboard)/operations/page.tsx`; it is already large, so new exception UI should live in focused components under `src/components/operations/`.
- Existing dashboard already shows a small exception summary from `/api/reports/reconciliation`; after this work it should deep-link users to the new center.

## Design Decisions

1. Do not create a new duplicate exception table in this MVP.
2. Use `ReconciliationActions` as the generic action overlay by namespacing issue codes:
   - `reconciliation.gate_missing_eir`
   - `reefer.temperature_out_of_range`
   - `approval.pending_review`
   - `transport.issue_reported`
3. Source records remain authoritative for native workflow status:
   - Reefer: `ReeferExceptions.status`
   - Approval: `ApprovalReviews.status`
   - Transport: `GateOutRequests.status` and `TransportJobActivities`
   - Reconciliation: generated query result plus `ReconciliationActions`
4. The Operational Exception Center can perform generic actions (`assign`, `acknowledge`, `resolve`, `ignore`, `reopen`) only when safe:
   - Reconciliation: write to `ReconciliationActions`.
   - Reefer: call a shared helper that updates `ReeferExceptions`.
   - Approval: show deep link to Supervisor Review; do not approve/reject from this center in MVP.
   - Transport: show deep link and allow generic `assign/acknowledge` overlay; transport state changes remain in Transport Portal/Gate flow.
5. Add dedicated RBAC permissions:
   - `operations.exceptions.view`
   - `operations.exceptions.manage`
6. Default grants:
   - `yard_manager`: view/manage
   - `supervisor`: view/manage
   - `yard_planner`: view
   - `billing_officer`: view
   - `surveyor`: view
7. The UI must be an action center, not another dashboard-only report:
   - summary cards
   - filters
   - dense table/list
   - action drawer
   - deep links to source screens
   - SLA age and owner role visible

## File Structure

### New Files

- `src/lib/reconciliationIssueRegistry.ts`
  - Owns reconciliation issue definitions, metadata decoration, issue execution, and loading action records.
  - Extracted from `src/app/api/reports/reconciliation/route.ts`.

- `src/lib/operationalExceptionActions.ts`
  - Wraps `ReconciliationActions` as a generic namespaced action overlay.
  - Provides `loadOperationalActionRecords()` and `upsertOperationalAction()`.

- `src/lib/operationalExceptions.ts`
  - Defines `OperationalExceptionItem`, `OperationalExceptionSummary`, filters, source adapters, and summary builder.

- `src/app/api/operations/exceptions/route.ts`
  - `GET`: returns normalized operational exceptions.
  - `PATCH`: updates safe action state and delegates reefer updates to shared helper.

- `src/components/operations/OperationalExceptionCenter.tsx`
  - Main UI shell for exception center.

- `src/components/operations/OperationalExceptionSummary.tsx`
  - Compact metrics for open/critical/warning/SLA overdue/assigned.

- `src/components/operations/OperationalExceptionFilters.tsx`
  - Source/severity/status/assigned/search filters.

- `src/components/operations/OperationalExceptionTable.tsx`
  - Dense scan-friendly list with quick actions and source deep links.

- `src/components/operations/OperationalExceptionActionDialog.tsx`
  - Existing native dialog style for resolve/ignore/assign reason.

- `src/lib/__tests__/reconciliationIssueRegistry.test.ts`
- `src/lib/__tests__/operationalExceptions.test.ts`
- `src/app/api/__tests__/operations-exceptions.test.ts`
- `src/app/api/__tests__/operations-exception-center-ui.test.ts`

### Modified Files

- `src/app/api/reports/reconciliation/route.ts`
  - Use `reconciliationIssueRegistry.ts` to avoid duplicate issue definitions.

- `src/app/api/reefer/exceptions/route.ts`
  - Extract reusable status update logic into helper if needed.

- `src/lib/reeferExceptions.ts`
  - Add `updateReeferExceptionAction()` or equivalent pure helper that API routes can share.

- `src/app/(dashboard)/operations/page.tsx`
  - Add `exceptions` tab and render `OperationalExceptionCenter`.

- `src/components/layout/Sidebar.tsx`
  - Allow Operations menu for `operations.exceptions.view` even if user lacks yard move permissions.

- `src/lib/rbacSeeds.ts`
  - Add new permissions and default role grants.

- `scripts/migrate-runtime-core-schema.js`
  - Insert new permissions and default role grants.

- `src/lib/schema.sql`
  - Keep permission seed/schema documentation aligned if applicable in this repo.

- `DEVELOPER_HANDOFF.md`
  - Document new Operational Exception Center behavior, permissions, and limitations.

---

## Task 1: Add RBAC Permissions For Exception Center

**Files:**
- Modify: `src/lib/rbacSeeds.ts`
- Modify: `scripts/migrate-runtime-core-schema.js`
- Modify: `src/components/layout/Sidebar.tsx`
- Test: `src/app/api/__tests__/operations-exceptions.test.ts`

- [x] **Step 1: Write failing permission seed assertions**

Create or extend `src/app/api/__tests__/operations-exceptions.test.ts` with static checks:

```ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Operational exception center RBAC', () => {
  it('seeds dedicated operations exception permissions', () => {
    const seeds = fs.readFileSync(path.join(root, 'src/lib/rbacSeeds.ts'), 'utf8');
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    expect(seeds).toContain('operations.exceptions.view');
    expect(seeds).toContain('operations.exceptions.manage');
    expect(migration).toContain('operations.exceptions.view');
    expect(migration).toContain('operations.exceptions.manage');
  });

  it('lets the Operations menu appear for exception-center-only users', () => {
    const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(sidebar).toContain('operations.exceptions.view');
    expect(sidebar).toContain(\"href: '/operations'\");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exceptions.test.ts
```

Expected: FAIL because the new permission codes are not seeded yet.

- [x] **Step 3: Add permissions to RBAC seed**

Modify `src/lib/rbacSeeds.ts` permission list with:

```ts
{ code: 'operations.exceptions.view', module: 'operations', action: 'exceptions_view', description: 'ดูศูนย์รวม exception งานปฏิบัติการ' },
{ code: 'operations.exceptions.manage', module: 'operations', action: 'exceptions_manage', description: 'มอบหมาย รับทราบ ปิด หรือ ignore exception งานปฏิบัติการ', risk: 'medium' },
```

Add default role mappings:

```ts
yard_manager: [
  'operations.exceptions.view',
  'operations.exceptions.manage',
],
supervisor: [
  'operations.exceptions.view',
  'operations.exceptions.manage',
],
yard_planner: [
  'operations.exceptions.view',
],
billing_officer: [
  'operations.exceptions.view',
],
surveyor: [
  'operations.exceptions.view',
],
```

Keep existing permissions in each role; add these codes to the arrays rather than replacing arrays.

- [x] **Step 4: Add migration permission seed**

Modify `scripts/migrate-runtime-core-schema.js` in the RBAC permission section:

```sql
IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_code = 'operations.exceptions.view')
  INSERT INTO Permissions (permission_code, module, action, description, requires_approval, approval_permission_code, risk_level)
  VALUES ('operations.exceptions.view', 'operations', 'exceptions_view', N'ดูศูนย์รวม exception งานปฏิบัติการ', 0, NULL, 'medium');

IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_code = 'operations.exceptions.manage')
  INSERT INTO Permissions (permission_code, module, action, description, requires_approval, approval_permission_code, risk_level)
  VALUES ('operations.exceptions.manage', 'operations', 'exceptions_manage', N'มอบหมาย รับทราบ ปิด หรือ ignore exception งานปฏิบัติการ', 0, NULL, 'medium');
```

Add role grants using the existing `INSERT INTO RolePermissions ... SELECT` style in the migration:

```sql
INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM Roles r
JOIN Permissions p ON p.permission_code IN ('operations.exceptions.view', 'operations.exceptions.manage')
WHERE r.role_code IN ('yard_manager', 'supervisor')
  AND NOT EXISTS (
    SELECT 1 FROM RolePermissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  );

INSERT INTO RolePermissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM Roles r
JOIN Permissions p ON p.permission_code = 'operations.exceptions.view'
WHERE r.role_code IN ('yard_planner', 'billing_officer', 'surveyor')
  AND NOT EXISTS (
    SELECT 1 FROM RolePermissions rp
    WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  );
```

- [x] **Step 5: Update sidebar visibility**

Modify Operations item in `src/components/layout/Sidebar.tsx`:

```ts
{
  label: 'ปฏิบัติการ',
  href: '/operations',
  icon: <Truck size={20} />,
  roles: ['yard_manager', 'supervisor', 'yard_planner', 'rs_driver', 'surveyor', 'billing_officer'],
  permissions: ['yard.slot.move', 'yard.location.assign', 'operations.exceptions.view'],
},
```

- [x] **Step 6: Run focused test**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exceptions.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/lib/rbacSeeds.ts scripts/migrate-runtime-core-schema.js src/components/layout/Sidebar.tsx src/app/api/__tests__/operations-exceptions.test.ts
git commit -m "Add operational exception center permissions"
```

---

## Task 2: Extract Reconciliation Issue Registry

**Files:**
- Create: `src/lib/reconciliationIssueRegistry.ts`
- Modify: `src/app/api/reports/reconciliation/route.ts`
- Test: `src/lib/__tests__/reconciliationIssueRegistry.test.ts`

- [x] **Step 1: Write failing registry test**

Create `src/lib/__tests__/reconciliationIssueRegistry.test.ts`:

```ts
import {
  RECONCILIATION_ISSUE_DEFINITIONS,
  decorateReconciliationIssue,
  buildReconciliationIssueResponse,
} from '../reconciliationIssueRegistry';

describe('reconciliationIssueRegistry', () => {
  it('exports the existing issue definitions without changing issue codes', () => {
    expect(RECONCILIATION_ISSUE_DEFINITIONS.map(issue => issue.code)).toEqual([
      'gate_missing_eir',
      'gate_missing_billing_clearance',
      'invoice_open_overdue',
      'booking_over_received',
      'booking_over_released',
      'mnr_completed_without_invoice',
      'edi_failed',
      'customer_credit_over_limit',
    ]);
  });

  it('decorates issue metadata from data quality rules', () => {
    const meta = decorateReconciliationIssue('customer_credit_over_limit', 'Fallback', 'warning');

    expect(meta.title).toBeTruthy();
    expect(meta.owner_role).toBeTruthy();
    expect(meta.recommended_action).toBeTruthy();
  });

  it('builds open and closed counts from action overlay', () => {
    const response = buildReconciliationIssueResponse({
      issue: {
        code: 'invoice_open_overdue',
        title: 'Open invoice',
        severity: 'warning',
        owner_role: 'Billing',
        recommended_action: 'ติดตามชำระเงิน',
        message: 'Open invoice',
        count: 2,
        rows: [
          { entity_id: 1, reference: 'INV-1', created_at: '2026-06-01T00:00:00.000Z' },
          { entity_id: 2, reference: 'INV-2', created_at: '2026-06-02T00:00:00.000Z' },
        ],
        unavailable: false,
      },
      actions: [
        {
          issue_code: 'invoice_open_overdue',
          entity_id: 1,
          status: 'resolved',
        },
      ],
      includeClosed: false,
      now: new Date('2026-06-05T00:00:00.000Z'),
    });

    expect(response.count).toBe(1);
    expect(response.raw_count).toBe(2);
    expect(response.closed_count).toBe(1);
    expect(response.rows[0].entity_id).toBe(2);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/lib/__tests__/reconciliationIssueRegistry.test.ts
```

Expected: FAIL because `reconciliationIssueRegistry.ts` does not exist.

- [x] **Step 3: Create registry module**

Create `src/lib/reconciliationIssueRegistry.ts` by moving the existing issue-definition code out of `src/app/api/reports/reconciliation/route.ts`.

The exported API should be:

```ts
import sql from 'mssql';
import { getDataQualityRule } from '@/lib/dataQualityRules';
import {
  applyReconciliationActions,
  type ReconciliationActionRecord,
  type ReconciliationIssueRow,
} from '@/lib/reconciliationActions';

export type ReconciliationSeverity = 'info' | 'warning' | 'critical';

export interface ReconciliationIssueDefinition {
  code: string;
  title: string;
  severity: ReconciliationSeverity;
  query: string;
}

export interface ReconciliationIssueResult {
  code: string;
  title: string;
  severity: ReconciliationSeverity;
  owner_role: string;
  recommended_action: string;
  message: string;
  count: number;
  rows: ReconciliationIssueRow[];
  unavailable: boolean;
  error?: string;
}

export function decorateReconciliationIssue(
  code: string,
  fallbackTitle: string,
  fallbackSeverity: ReconciliationSeverity,
) {
  const rule = getDataQualityRule(code);
  return {
    title: rule?.title || fallbackTitle,
    severity: rule?.severity || fallbackSeverity,
    owner_role: rule?.ownerRole || 'Operations',
    recommended_action: rule?.recommendedAction || 'ตรวจสอบรายการนี้',
    message: rule?.message || fallbackTitle,
  };
}

export const RECONCILIATION_ISSUE_DEFINITIONS: ReconciliationIssueDefinition[] = [
  {
    code: 'gate_missing_eir',
    title: 'Gate transaction missing EIR',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        g.gate_id AS entity_id,
        g.transaction_type,
        g.container_number,
        c.container_number AS container_master_number,
        g.created_at,
        'Gate #' + CAST(g.gate_id AS NVARCHAR(20)) AS reference
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      WHERE g.yard_id = @yardId
        AND (g.eir_number IS NULL OR LTRIM(RTRIM(g.eir_number)) = '')
      ORDER BY g.created_at DESC
    `,
  },
  {
    code: 'gate_missing_billing_clearance',
    title: 'Gate transaction missing billing clearance',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        g.gate_id AS entity_id,
        g.transaction_type,
        ISNULL(g.container_number, c.container_number) AS container_number,
        g.eir_number,
        g.created_at,
        'Gate #' + CAST(g.gate_id AS NVARCHAR(20)) AS reference
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      WHERE g.yard_id = @yardId
        AND g.billing_clearance_id IS NULL
      ORDER BY g.created_at DESC
    `,
  },
  {
    code: 'invoice_open_overdue',
    title: 'Open or overdue invoice',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        i.invoice_id AS entity_id,
        i.invoice_number AS reference,
        c.customer_name,
        ct.container_number,
        i.status,
        ISNULL(i.balance_amount, i.grand_total) AS outstanding_amount,
        DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) AS overdue_days,
        i.created_at
      FROM Invoices i
      LEFT JOIN Customers c ON i.customer_id = c.customer_id
      LEFT JOIN Containers ct ON i.container_id = ct.container_id
      WHERE i.yard_id = @yardId
        AND i.status IN ('issued', 'overdue')
        AND ISNULL(i.balance_amount, i.grand_total) > 0
      ORDER BY overdue_days DESC, i.created_at
    `,
  },
  {
    code: 'booking_over_received',
    title: 'Booking over received',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        b.booking_id AS entity_id,
        b.booking_number AS reference,
        b.container_count,
        util.received_count,
        util.released_count,
        b.status,
        b.created_at
      FROM Bookings b
      OUTER APPLY (
        SELECT
          COUNT(CASE WHEN bc.status IN ('received', 'released') THEN 1 END) AS received_count,
          COUNT(CASE WHEN bc.status = 'released' THEN 1 END) AS released_count
        FROM BookingContainers bc
        WHERE bc.booking_id = b.booking_id
      ) util
      WHERE b.yard_id = @yardId
        AND b.status <> 'cancelled'
        AND util.received_count > ISNULL(b.container_count, 0)
      ORDER BY b.created_at DESC
    `,
  },
  {
    code: 'booking_over_released',
    title: 'Booking over released',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        b.booking_id AS entity_id,
        b.booking_number AS reference,
        b.container_count,
        util.received_count,
        util.released_count,
        b.status,
        b.created_at
      FROM Bookings b
      OUTER APPLY (
        SELECT
          COUNT(CASE WHEN bc.status IN ('received', 'released') THEN 1 END) AS received_count,
          COUNT(CASE WHEN bc.status = 'released' THEN 1 END) AS released_count
        FROM BookingContainers bc
        WHERE bc.booking_id = b.booking_id
      ) util
      WHERE b.yard_id = @yardId
        AND b.status <> 'cancelled'
        AND util.released_count > ISNULL(b.container_count, 0)
      ORDER BY b.created_at DESC
    `,
  },
  {
    code: 'mnr_completed_without_invoice',
    title: 'Completed M&R without invoice',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        r.eor_id AS entity_id,
        r.eor_number AS reference,
        c.container_number,
        ISNULL(r.actual_cost, r.estimated_cost) AS amount,
        r.status,
        r.completed_at,
        r.created_at
      FROM RepairOrders r
      LEFT JOIN Containers c ON r.container_id = c.container_id
      WHERE r.yard_id = @yardId
        AND r.status = 'completed'
        AND ISNULL(r.invoice_id, 0) = 0
        AND ISNULL(r.actual_cost, r.estimated_cost) > 0
      ORDER BY ISNULL(r.completed_at, r.created_at) DESC
    `,
  },
  {
    code: 'edi_failed',
    title: 'Failed integration message',
    severity: 'warning',
    query: `
      SELECT TOP (@limit)
        log_id AS entity_id,
        integration_type AS reference,
        endpoint_name,
        status,
        retry_count,
        error_message,
        created_at
      FROM IntegrationLogs
      WHERE yard_id = @yardId
        AND status IN ('failed', 'retrying')
      ORDER BY created_at DESC
    `,
  },
  {
    code: 'customer_credit_over_limit',
    title: 'Customer credit over limit',
    severity: 'critical',
    query: `
      SELECT TOP (@limit)
        c.customer_id AS entity_id,
        c.customer_name AS reference,
        ISNULL(c.credit_limit, 0) AS credit_limit,
        ISNULL(SUM(CASE WHEN i.status IN ('issued', 'overdue')
          THEN ISNULL(i.balance_amount, i.grand_total) ELSE 0 END), 0) AS outstanding_amount,
        MAX(CASE WHEN i.status IN ('issued', 'overdue')
          THEN DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) ELSE 0 END) AS oldest_overdue_days
      FROM Customers c
      LEFT JOIN Invoices i ON i.customer_id = c.customer_id AND i.yard_id = @yardId
      WHERE ISNULL(c.credit_limit, 0) > 0
      GROUP BY c.customer_id, c.customer_name, c.credit_limit
      HAVING ISNULL(SUM(CASE WHEN i.status IN ('issued', 'overdue')
        THEN ISNULL(i.balance_amount, i.grand_total) ELSE 0 END), 0) > ISNULL(c.credit_limit, 0)
      ORDER BY outstanding_amount DESC
    `,
  },
];

export async function runReconciliationIssue(
  db: sql.ConnectionPool,
  yardId: number,
  limit: number,
  definition: ReconciliationIssueDefinition,
): Promise<ReconciliationIssueResult> {
  const meta = decorateReconciliationIssue(definition.code, definition.title, definition.severity);
  try {
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('limit', sql.Int, limit)
      .query(definition.query);

    return {
      code: definition.code,
      ...meta,
      count: result.recordset.length,
      rows: result.recordset,
      unavailable: false,
    };
  } catch (error) {
    return {
      code: definition.code,
      ...meta,
      count: 0,
      rows: [],
      unavailable: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function loadReconciliationActionRecords(
  db: sql.ConnectionPool,
  yardId: number,
): Promise<ReconciliationActionRecord[]> {
  try {
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT
          action_id,
          issue_code,
          entity_id,
          entity_ref,
          status,
          reason,
          assigned_to,
          updated_at
        FROM ReconciliationActions
        WHERE yard_id = @yardId
      `);

    return result.recordset as ReconciliationActionRecord[];
  } catch {
    return [];
  }
}

export function buildReconciliationIssueResponse({
  issue,
  actions,
  includeClosed,
  now = new Date(),
}: {
  issue: ReconciliationIssueResult;
  actions: ReconciliationActionRecord[];
  includeClosed: boolean;
  now?: Date;
}) {
  if (issue.unavailable) return issue;
  const rawRows = issue.rows;
  const rows = applyReconciliationActions({
    issueCode: issue.code,
    rows: rawRows,
    actions,
    includeClosed,
    now,
  });
  return {
    ...issue,
    raw_count: rawRows.length,
    closed_count: rawRows.length - rows.length,
    count: rows.length,
    rows,
  };
}
```

- [x] **Step 4: Update reconciliation route to use registry**

Modify `src/app/api/reports/reconciliation/route.ts`:

```ts
import {
  RECONCILIATION_ISSUE_DEFINITIONS,
  buildReconciliationIssueResponse,
  loadReconciliationActionRecords,
  runReconciliationIssue,
} from '@/lib/reconciliationIssueRegistry';
```

Remove the local `Severity`, `IssueDefinition`, `decorateIssue`, `runIssue`, `loadActionRecords`, and `ISSUE_DEFINITIONS` definitions from the route.

In `GET`, replace the loop:

```ts
const issues = [];
for (const definition of RECONCILIATION_ISSUE_DEFINITIONS) {
  issues.push(await runReconciliationIssue(db, yardId, limit, definition));
}
const actions = await loadReconciliationActionRecords(db, yardId);
const enrichedIssues = issues.map((issue) => buildReconciliationIssueResponse({
  issue,
  actions,
  includeClosed,
}));
```

- [x] **Step 5: Run focused registry and existing reports tests**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/lib/__tests__/reconciliationIssueRegistry.test.ts src/app/api/__tests__/reports.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/lib/reconciliationIssueRegistry.ts src/app/api/reports/reconciliation/route.ts src/lib/__tests__/reconciliationIssueRegistry.test.ts
git commit -m "Extract reconciliation issue registry"
```

---

## Task 3: Build Normalized Operational Exception Model

**Files:**
- Create: `src/lib/operationalExceptionActions.ts`
- Create: `src/lib/operationalExceptions.ts`
- Test: `src/lib/__tests__/operationalExceptions.test.ts`

- [x] **Step 1: Write failing unit tests**

Create `src/lib/__tests__/operationalExceptions.test.ts`:

```ts
import {
  buildOperationalIssueCode,
  normalizeReconciliationException,
  normalizeReeferException,
  normalizeApprovalException,
  normalizeTransportException,
  summarizeOperationalExceptions,
} from '../operationalExceptions';

describe('operationalExceptions', () => {
  it('namespaces issue codes by source', () => {
    expect(buildOperationalIssueCode('reefer', 'out_of_range')).toBe('reefer.out_of_range');
  });

  it('normalizes reconciliation rows into operational exceptions', () => {
    const item = normalizeReconciliationException({
      issue: {
        code: 'invoice_open_overdue',
        title: 'Open invoice',
        severity: 'warning',
        owner_role: 'Billing',
        recommended_action: 'ติดตามชำระเงิน',
      },
      row: {
        entity_id: 7,
        reference: 'INV-7',
        customer_name: 'ACME',
        action_status: 'open',
        sla_age_days: 4,
        deep_link: '/billing?invoice_id=7',
      },
    });

    expect(item.exception_id).toBe('reconciliation.invoice_open_overdue:7');
    expect(item.source).toBe('reconciliation');
    expect(item.status).toBe('open');
    expect(item.href).toBe('/billing?invoice_id=7');
    expect(item.context.customer_name).toBe('ACME');
  });

  it('normalizes reefer exception severity and SLA context', () => {
    const item = normalizeReeferException({
      exception_id: 3,
      container_number: 'RFPU1234567',
      severity: 'critical',
      status: 'open',
      reason: 'out_of_range',
      recommended_action: 'ตรวจปลั๊ก',
      created_at: '2026-06-05T01:00:00.000Z',
      escalation_breached: true,
      escalation_age_minutes: 180,
    });

    expect(item.exception_id).toBe('reefer.out_of_range:3');
    expect(item.severity).toBe('critical');
    expect(item.sla_breached).toBe(true);
    expect(item.href).toContain('/reefer');
  });

  it('keeps approval exception as deep-link action only', () => {
    const item = normalizeApprovalException({
      review_id: 9,
      permission_code: 'billing.waive.approve',
      entity_type: 'billing_clearance',
      entity_id: 22,
      status: 'pending_review',
      reason: 'waive request',
      requested_by_name: 'Gate User',
      created_at: '2026-06-05T01:00:00.000Z',
    });

    expect(item.source).toBe('approval');
    expect(item.allowed_actions).toEqual(['open_detail']);
    expect(item.href).toBe('/supervisor-review?review_id=9');
  });

  it('normalizes transport attention jobs', () => {
    const item = normalizeTransportException({
      request_id: 12,
      status: 'issue_reported',
      container_number: 'TLLU1234567',
      booking_number: 'BK-1',
      attention_reason: 'รูปหลักฐานไม่ครบ',
      requested_at: '2026-06-05T01:00:00.000Z',
    });

    expect(item.source).toBe('transport');
    expect(item.entity_ref).toBe('TLLU1234567');
    expect(item.allowed_actions).toContain('acknowledge');
  });

  it('summarizes exception counts by severity and source', () => {
    const summary = summarizeOperationalExceptions([
      { source: 'reefer', severity: 'critical', status: 'open', sla_breached: true } as never,
      { source: 'reconciliation', severity: 'warning', status: 'open' } as never,
      { source: 'transport', severity: 'info', status: 'ignored' } as never,
    ]);

    expect(summary.total_open).toBe(2);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(1);
    expect(summary.sla_breached).toBe(1);
    expect(summary.by_source.reefer).toBe(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/lib/__tests__/operationalExceptions.test.ts
```

Expected: FAIL because model files do not exist.

- [x] **Step 3: Implement operational action wrapper**

Create `src/lib/operationalExceptionActions.ts`:

```ts
import sql from 'mssql';
import type { ReconciliationActionRecord, ReconciliationActionStatus } from '@/lib/reconciliationActions';
import type { RequestActor } from '@/lib/apiAuth';

export type OperationalExceptionActionStatus = ReconciliationActionStatus | 'acknowledged';

export interface OperationalActionUpsertInput {
  yardId: number;
  issueCode: string;
  entityId?: number | null;
  entityRef?: string | null;
  status: ReconciliationActionStatus;
  reason?: string | null;
  assignedTo?: string | null;
  actor: RequestActor;
}

export async function loadOperationalActionRecords(
  db: sql.ConnectionPool,
  yardId: number,
): Promise<ReconciliationActionRecord[]> {
  const result = await db.request()
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT
        action_id,
        issue_code,
        entity_id,
        entity_ref,
        status,
        reason,
        assigned_to,
        updated_at
      FROM ReconciliationActions
      WHERE yard_id = @yardId
    `);

  return result.recordset as ReconciliationActionRecord[];
}

export async function upsertOperationalAction(
  db: sql.ConnectionPool,
  input: OperationalActionUpsertInput,
) {
  const result = await db.request()
    .input('yardId', sql.Int, input.yardId)
    .input('issueCode', sql.NVarChar(80), input.issueCode)
    .input('entityId', sql.Int, input.entityId ?? null)
    .input('entityRef', sql.NVarChar(150), input.entityRef ?? null)
    .input('status', sql.NVarChar(20), input.status)
    .input('reason', sql.NVarChar(500), input.reason || null)
    .input('assignedTo', sql.NVarChar(100), input.assignedTo || null)
    .input('actorId', sql.Int, input.actor.userId)
    .query(`
      MERGE ReconciliationActions WITH (HOLDLOCK) AS target
      USING (
        SELECT
          @yardId AS yard_id,
          @issueCode AS issue_code,
          @entityId AS entity_id,
          @entityRef AS entity_ref
      ) AS source
      ON target.yard_id = source.yard_id
        AND target.issue_code = source.issue_code
        AND ISNULL(target.entity_id, -1) = ISNULL(source.entity_id, -1)
        AND ISNULL(target.entity_ref, '') = ISNULL(source.entity_ref, '')
      WHEN MATCHED THEN
        UPDATE SET
          status = @status,
          reason = @reason,
          assigned_to = @assignedTo,
          updated_by = @actorId,
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (
          yard_id, issue_code, entity_id, entity_ref, status,
          reason, assigned_to, created_by, updated_by, created_at, updated_at
        )
        VALUES (
          @yardId, @issueCode, @entityId, @entityRef, @status,
          @reason, @assignedTo, @actorId, @actorId, GETDATE(), GETDATE()
        )
      OUTPUT INSERTED.action_id;
    `);

  return result.recordset[0]?.action_id || null;
}
```

- [x] **Step 4: Implement operational exception model**

Create `src/lib/operationalExceptions.ts`:

```ts
import type { ReconciliationActionStatus } from '@/lib/reconciliationActions';

export type OperationalExceptionSource = 'reconciliation' | 'reefer' | 'approval' | 'transport';
export type OperationalExceptionSeverity = 'info' | 'warning' | 'critical';
export type OperationalExceptionStatus = ReconciliationActionStatus | 'in_progress' | 'pending_review' | 'acknowledged';
export type OperationalExceptionAction = 'assign' | 'acknowledge' | 'resolve' | 'ignore' | 'reopen' | 'open_detail';

export interface OperationalExceptionItem {
  exception_id: string;
  source: OperationalExceptionSource;
  issue_code: string;
  title: string;
  message: string;
  severity: OperationalExceptionSeverity;
  status: OperationalExceptionStatus;
  yard_id?: number | null;
  entity_type: string;
  entity_id?: number | string | null;
  entity_ref?: string | null;
  owner_role?: string | null;
  assigned_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  sla_age_days?: number;
  sla_age_minutes?: number;
  sla_breached?: boolean;
  recommended_action?: string | null;
  href: string;
  allowed_actions: OperationalExceptionAction[];
  context: Record<string, unknown>;
}

export interface OperationalExceptionSummary {
  total_open: number;
  critical: number;
  warning: number;
  info: number;
  sla_breached: number;
  by_source: Record<OperationalExceptionSource, number>;
}

export function buildOperationalIssueCode(source: OperationalExceptionSource, code: string) {
  return `${source}.${code}`;
}

function asString(value: unknown, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function asIsoString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function normalizeReconciliationException({
  issue,
  row,
}: {
  issue: {
    code: string;
    title: string;
    severity: OperationalExceptionSeverity;
    owner_role?: string;
    recommended_action?: string;
  };
  row: Record<string, unknown>;
}): OperationalExceptionItem {
  const entityId = row.entity_id ?? null;
  const entityRef = row.reference ? String(row.reference) : null;
  return {
    exception_id: `${buildOperationalIssueCode('reconciliation', issue.code)}:${String(entityId ?? entityRef ?? 'unknown')}`,
    source: 'reconciliation',
    issue_code: buildOperationalIssueCode('reconciliation', issue.code),
    title: issue.title,
    message: issue.title,
    severity: issue.severity,
    status: asString(row.action_status, 'open') as OperationalExceptionStatus,
    entity_type: 'reconciliation_issue',
    entity_id: entityId as number | string | null,
    entity_ref: entityRef,
    owner_role: issue.owner_role || 'Operations',
    assigned_to: row.action_assigned_to ? String(row.action_assigned_to) : null,
    created_at: asIsoString(row.created_at),
    updated_at: asIsoString(row.action_updated_at),
    sla_age_days: Number(row.sla_age_days || 0),
    recommended_action: issue.recommended_action || null,
    href: asString(row.deep_link, '/reports?tab=reconciliation'),
    allowed_actions: ['assign', 'resolve', 'ignore', 'open_detail'],
    context: row,
  };
}

export function normalizeReeferException(row: Record<string, unknown>): OperationalExceptionItem {
  const reason = asString(row.reason, 'exception');
  const exceptionId = Number(row.exception_id);
  return {
    exception_id: `${buildOperationalIssueCode('reefer', reason)}:${exceptionId}`,
    source: 'reefer',
    issue_code: buildOperationalIssueCode('reefer', reason),
    title: `Reefer ${reason}`,
    message: asString(row.recommended_action, reason),
    severity: asString(row.severity, 'warning') as OperationalExceptionSeverity,
    status: asString(row.status, 'open') as OperationalExceptionStatus,
    yard_id: Number(row.yard_id || 0) || null,
    entity_type: 'reefer_exception',
    entity_id: exceptionId,
    entity_ref: row.container_number ? String(row.container_number) : null,
    owner_role: 'Reefer',
    assigned_to: row.assigned_to_user_id ? String(row.assigned_to_user_id) : null,
    created_at: asIsoString(row.created_at),
    updated_at: asIsoString(row.updated_at),
    sla_age_minutes: Number(row.escalation_age_minutes || 0),
    sla_breached: Boolean(row.escalation_breached),
    recommended_action: row.recommended_action ? String(row.recommended_action) : null,
    href: `/reefer?exception_id=${exceptionId}`,
    allowed_actions: ['assign', 'acknowledge', 'resolve', 'ignore', 'open_detail'],
    context: row,
  };
}

export function normalizeApprovalException(row: Record<string, unknown>): OperationalExceptionItem {
  const reviewId = Number(row.review_id);
  return {
    exception_id: `${buildOperationalIssueCode('approval', 'pending_review')}:${reviewId}`,
    source: 'approval',
    issue_code: buildOperationalIssueCode('approval', 'pending_review'),
    title: `รออนุมัติ ${asString(row.permission_code, 'approval')}`,
    message: asString(row.reason, 'มีรายการรอ Supervisor Review'),
    severity: 'warning',
    status: asString(row.status, 'pending_review') as OperationalExceptionStatus,
    yard_id: Number(row.yard_id || 0) || null,
    entity_type: 'approval_review',
    entity_id: reviewId,
    entity_ref: row.entity_type ? String(row.entity_type) : null,
    owner_role: 'Supervisor',
    created_at: asIsoString(row.created_at),
    updated_at: asIsoString(row.reviewed_at),
    recommended_action: 'เปิด Supervisor Review เพื่อตรวจและอนุมัติ',
    href: `/supervisor-review?review_id=${reviewId}`,
    allowed_actions: ['open_detail'],
    context: row,
  };
}

export function normalizeTransportException(row: Record<string, unknown>): OperationalExceptionItem {
  const requestId = Number(row.request_id);
  const reason = asString(row.attention_reason || row.status, 'attention');
  return {
    exception_id: `${buildOperationalIssueCode('transport', reason)}:${requestId}`,
    source: 'transport',
    issue_code: buildOperationalIssueCode('transport', reason),
    title: 'Transport job needs attention',
    message: reason,
    severity: reason === 'issue_reported' ? 'warning' : 'info',
    status: asString(row.status, 'open') as OperationalExceptionStatus,
    yard_id: Number(row.yard_id || 0) || null,
    entity_type: 'gate_out_request',
    entity_id: requestId,
    entity_ref: row.container_number ? String(row.container_number) : null,
    owner_role: 'Transport',
    created_at: asIsoString(row.requested_at),
    updated_at: asIsoString(row.updated_at),
    recommended_action: 'ตรวจสอบงานขนส่งหรือหลักฐานที่คนขับส่งเข้ามา',
    href: `/transport?job=request-${requestId}`,
    allowed_actions: ['assign', 'acknowledge', 'open_detail'],
    context: row,
  };
}

export function summarizeOperationalExceptions(items: OperationalExceptionItem[]): OperationalExceptionSummary {
  const openItems = items.filter(item => !['resolved', 'ignored'].includes(item.status));
  return {
    total_open: openItems.length,
    critical: openItems.filter(item => item.severity === 'critical').length,
    warning: openItems.filter(item => item.severity === 'warning').length,
    info: openItems.filter(item => item.severity === 'info').length,
    sla_breached: openItems.filter(item => item.sla_breached).length,
    by_source: {
      reconciliation: openItems.filter(item => item.source === 'reconciliation').length,
      reefer: openItems.filter(item => item.source === 'reefer').length,
      approval: openItems.filter(item => item.source === 'approval').length,
      transport: openItems.filter(item => item.source === 'transport').length,
    },
  };
}
```

- [x] **Step 5: Run focused unit tests**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/lib/__tests__/operationalExceptions.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/lib/operationalExceptionActions.ts src/lib/operationalExceptions.ts src/lib/__tests__/operationalExceptions.test.ts
git commit -m "Add operational exception normalization"
```

---

## Task 4: Add Operational Exceptions API

**Files:**
- Create: `src/app/api/operations/exceptions/route.ts`
- Modify: `src/lib/reeferExceptions.ts`
- Modify: `src/app/api/reefer/exceptions/route.ts`
- Test: `src/app/api/__tests__/operations-exceptions.test.ts`

- [x] **Step 1: Extend failing API tests**

Extend `src/app/api/__tests__/operations-exceptions.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Operational exceptions API source', () => {
  it('exists and requires yard access plus exception permissions', () => {
    const route = fs.readFileSync(path.join(root, 'src/app/api/operations/exceptions/route.ts'), 'utf8');

    expect(route).toContain('requireYardAccess');
    expect(route).toContain('operations.exceptions.view');
    expect(route).toContain('operations.exceptions.manage');
    expect(route).not.toContain('customer_id');
  });

  it('reads the expected source tables without runtime DDL', () => {
    const route = fs.readFileSync(path.join(root, 'src/app/api/operations/exceptions/route.ts'), 'utf8');

    expect(route).toContain('ReeferExceptions');
    expect(route).toContain('ApprovalReviews');
    expect(route).toContain('GateOutRequests');
    expect(route).not.toMatch(/OBJECT_ID|COL_LENGTH|ALTER TABLE|CREATE TABLE/i);
  });

  it('uses parameterized inputs for filters and action updates', () => {
    const route = fs.readFileSync(path.join(root, 'src/app/api/operations/exceptions/route.ts'), 'utf8');

    expect(route).toContain(\".input('yardId'\");
    expect(route).toContain(\".input('status'\");
    expect(route).toContain(\".input('source'\");
    expect(route).toContain(\".input('actorId'\");
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exceptions.test.ts
```

Expected: FAIL because route does not exist yet.

- [x] **Step 3: Add shared reefer update helper**

Modify `src/lib/reeferExceptions.ts` to expose source-owned update logic:

```ts
import sql from 'mssql';
import type { RequestActor } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';

export async function updateReeferExceptionAction({
  db,
  exceptionId,
  action,
  note,
  assignedToUserId,
  actor,
}: {
  db: sql.ConnectionPool;
  exceptionId: number;
  action: string;
  note?: string | null;
  assignedToUserId?: number | null;
  actor: RequestActor;
}) {
  const scope = await db.request()
    .input('exceptionId', sql.Int, exceptionId)
    .query('SELECT TOP 1 yard_id, status FROM ReeferExceptions WHERE exception_id = @exceptionId');

  const current = scope.recordset[0];
  if (!current) return { error: 'not_found' as const };

  const nextStatus = nextReeferExceptionStatus(current.status, action);
  if (!nextStatus) return { error: 'invalid_transition' as const, yardId: current.yard_id };

  const result = await db.request()
    .input('exceptionId', sql.Int, exceptionId)
    .input('status', sql.NVarChar(30), nextStatus)
    .input('resolutionNote', sql.NVarChar(1000), note || null)
    .input('assignedToUserId', sql.Int, assignedToUserId || null)
    .input('actorUserId', sql.Int, actor.userId)
    .query(`
      UPDATE ReeferExceptions
      SET status = @status,
          resolution_note = COALESCE(@resolutionNote, resolution_note),
          assigned_to_user_id = COALESCE(@assignedToUserId, assigned_to_user_id),
          acknowledged_by_user_id = CASE WHEN @status = 'in_progress' THEN @actorUserId ELSE acknowledged_by_user_id END,
          acknowledged_at = CASE WHEN @status = 'in_progress' THEN GETDATE() ELSE acknowledged_at END,
          resolved_by_user_id = CASE WHEN @status IN ('resolved', 'ignored') THEN @actorUserId ELSE resolved_by_user_id END,
          resolved_at = CASE WHEN @status IN ('resolved', 'ignored') THEN GETDATE() ELSE resolved_at END,
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE exception_id = @exceptionId
    `);

  await logAudit({
    userId: actor.userId,
    yardId: current.yard_id,
    action: `reefer_exception_${action}`,
    entityType: 'reefer_exception',
    entityId: exceptionId,
    details: { status: nextStatus, note: note || null },
  });

  return { exception: result.recordset[0], yardId: current.yard_id };
}
```

Update `src/app/api/reefer/exceptions/route.ts` to use this helper after yard/permission checks. Keep the portal grant refresh already in the route.

- [x] **Step 4: Create API route**

Create `src/app/api/operations/exceptions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requireAnyPermission, requireRequestActor, requireYardAccess } from '@/lib/apiAuth';
import {
  RECONCILIATION_ISSUE_DEFINITIONS,
  buildReconciliationIssueResponse,
  loadReconciliationActionRecords,
  runReconciliationIssue,
} from '@/lib/reconciliationIssueRegistry';
import {
  buildOperationalIssueCode,
  normalizeApprovalException,
  normalizeReconciliationException,
  normalizeReeferException,
  normalizeTransportException,
  summarizeOperationalExceptions,
  type OperationalExceptionItem,
  type OperationalExceptionSource,
} from '@/lib/operationalExceptions';
import { upsertOperationalAction } from '@/lib/operationalExceptionActions';
import { updateReeferExceptionAction } from '@/lib/reeferExceptions';

const VIEW_PERMISSIONS = ['operations.exceptions.view', 'operations.exceptions.manage', 'reports.view'];
const MANAGE_PERMISSIONS = ['operations.exceptions.manage'];
const SOURCES = new Set(['reconciliation', 'reefer', 'approval', 'transport']);
const ACTION_TO_STATUS = {
  resolve: 'resolved',
  ignore: 'ignored',
  reopen: 'open',
  acknowledge: 'open',
  assign: 'open',
} as const;

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function filterItems(
  items: OperationalExceptionItem[],
  filters: { source?: string | null; status?: string | null; severity?: string | null; search?: string | null },
) {
  const search = filters.search?.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.source && item.source !== filters.source) return false;
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.severity && filters.severity !== 'all' && item.severity !== filters.severity) return false;
    if (!search) return true;
    return [
      item.title,
      item.message,
      item.entity_ref,
      item.owner_role,
      item.recommended_action,
    ].some(value => String(value || '').toLowerCase().includes(search));
  });
}

async function loadReconciliationItems(db: sql.ConnectionPool, yardId: number, limit: number, includeClosed: boolean) {
  const issues = [];
  for (const definition of RECONCILIATION_ISSUE_DEFINITIONS) {
    issues.push(await runReconciliationIssue(db, yardId, limit, definition));
  }
  const actions = await loadReconciliationActionRecords(db, yardId);
  return issues.flatMap((issue) => {
    const enriched = buildReconciliationIssueResponse({ issue, actions, includeClosed });
    if (enriched.unavailable) return [];
    return enriched.rows.map(row => normalizeReconciliationException({ issue: enriched, row }));
  });
}

async function loadReeferItems(db: sql.ConnectionPool, yardId: number, includeClosed: boolean) {
  const result = await db.request()
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT TOP 200
        e.*,
        c.container_number,
        rc.measured_temp_c,
        rc.set_point_c,
        rc.checked_at
      FROM ReeferExceptions e
      JOIN Containers c ON c.container_id = e.container_id
      LEFT JOIN ReeferTemperatureChecks rc ON rc.check_id = e.check_id
      WHERE e.yard_id = @yardId
        AND (@includeClosed = 1 OR e.status NOT IN ('resolved', 'ignored'))
      ORDER BY
        CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
        e.created_at DESC
    `)
    .catch(async () => ({ recordset: [] as Record<string, unknown>[] }));

  return result.recordset.map(normalizeReeferException);
}

async function loadApprovalItems(db: sql.ConnectionPool, yardId: number, includeClosed: boolean) {
  const result = await db.request()
    .input('yardId', sql.Int, yardId)
    .input('includeClosed', sql.Bit, includeClosed ? 1 : 0)
    .query(`
      SELECT TOP 200
        ar.*,
        requester.full_name AS requested_by_name
      FROM ApprovalReviews ar
      LEFT JOIN Users requester ON requester.user_id = ar.requested_by
      WHERE ar.yard_id = @yardId
        AND (@includeClosed = 1 OR ar.status = 'pending_review')
      ORDER BY ar.created_at DESC
    `)
    .catch(async () => ({ recordset: [] as Record<string, unknown>[] }));

  return result.recordset.map(normalizeApprovalException);
}

async function loadTransportItems(db: sql.ConnectionPool, yardId: number, includeClosed: boolean) {
  const result = await db.request()
    .input('yardId', sql.Int, yardId)
    .input('includeClosed', sql.Bit, includeClosed ? 1 : 0)
    .query(`
      SELECT TOP 200
        gor.request_id,
        gor.yard_id,
        gor.status,
        gor.booking_ref AS booking_number,
        gor.requested_at,
        gor.updated_at,
        c.container_number,
        CASE
          WHEN gor.status = 'issue_reported' THEN 'issue_reported'
          WHEN gor.status = 'pending' THEN N'รอดำเนินการ'
          WHEN DATEDIFF(HOUR, gor.requested_at, GETDATE()) >= 12
            AND gor.status IN ('requested', 'moving', 'at_gate') THEN N'งานขอดึงตู้ค้างเกิน 12 ชั่วโมง'
          ELSE NULL
        END AS attention_reason
      FROM GateOutRequests gor
      LEFT JOIN Containers c ON c.container_id = gor.container_id
      WHERE gor.yard_id = @yardId
        AND (
          gor.status IN ('issue_reported', 'pending')
          OR (
            DATEDIFF(HOUR, gor.requested_at, GETDATE()) >= 12
            AND gor.status IN ('requested', 'moving', 'at_gate')
          )
          OR @includeClosed = 1
        )
      ORDER BY gor.requested_at DESC
    `)
    .catch(async () => ({ recordset: [] as Record<string, unknown>[] }));

  return result.recordset
    .filter(row => row.attention_reason || includeClosed)
    .map(normalizeTransportException);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parsePositiveInt(searchParams.get('yard_id'));
    if (!yardId) return NextResponse.json({ error: 'ต้องระบุ yard_id' }, { status: 400 });

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requireAnyPermission(request, db, VIEW_PERMISSIONS, 'คุณไม่มีสิทธิ์ดู Operational Exception Center');
    if (actor instanceof NextResponse) return actor;

    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const search = searchParams.get('search');
    const includeClosed = searchParams.get('include_closed') === '1';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200);

    const requestedSource = source && SOURCES.has(source) ? source as OperationalExceptionSource : null;
    const items = [
      ...(!requestedSource || requestedSource === 'reconciliation' ? await loadReconciliationItems(db, yardId, limit, includeClosed) : []),
      ...(!requestedSource || requestedSource === 'reefer' ? await loadReeferItems(db, yardId, includeClosed) : []),
      ...(!requestedSource || requestedSource === 'approval' ? await loadApprovalItems(db, yardId, includeClosed) : []),
      ...(!requestedSource || requestedSource === 'transport' ? await loadTransportItems(db, yardId, includeClosed) : []),
    ];

    const filtered = filterItems(items, { source, status, severity, search });
    return NextResponse.json({
      yard_id: yardId,
      generated_at: new Date().toISOString(),
      summary: summarizeOperationalExceptions(filtered),
      exceptions: filtered,
    });
  } catch (error) {
    console.error('GET operational exceptions error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด Operational Exception Center ได้' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = requireRequestActor(request);
  if (actor instanceof NextResponse) return actor;

  try {
    const body = await request.json();
    const yardId = parsePositiveInt(body.yard_id);
    const source = typeof body.source === 'string' ? body.source : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const entityId = parsePositiveInt(body.entity_id);
    const entityRef = typeof body.entity_ref === 'string' ? body.entity_ref.trim() : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null;
    const assignedTo = typeof body.assigned_to === 'string' ? body.assigned_to.trim() : null;

    if (!yardId || !SOURCES.has(source) || !code || !Object.keys(ACTION_TO_STATUS).includes(action)) {
      return NextResponse.json({ error: 'ข้อมูล action ไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const permission = await requireAnyPermission(request, db, MANAGE_PERMISSIONS, 'คุณไม่มีสิทธิ์จัดการ exception');
    if (permission instanceof NextResponse) return permission;

    if (source === 'approval') {
      return NextResponse.json({ error: 'รายการ approval ต้องจัดการที่ Supervisor Review' }, { status: 409 });
    }

    if (source === 'reefer' && entityId) {
      const reeferAction = action === 'acknowledge' ? 'acknowledge' : action;
      const updated = await updateReeferExceptionAction({
        db,
        exceptionId: entityId,
        action: reeferAction,
        note: reason,
        assignedToUserId: null,
        actor,
      });
      if ('error' in updated) {
        return NextResponse.json({ error: 'ไม่สามารถอัปเดต Reefer Exception ได้' }, { status: 400 });
      }
      return NextResponse.json({ success: true, exception: updated.exception });
    }

    const status = ACTION_TO_STATUS[action as keyof typeof ACTION_TO_STATUS];
    const actionId = await upsertOperationalAction(db, {
      yardId,
      issueCode: buildOperationalIssueCode(source as OperationalExceptionSource, code),
      entityId,
      entityRef,
      status,
      reason,
      assignedTo,
      actor,
    });

    await logAudit({
      userId: actor.userId,
      yardId,
      action: `operational_exception_${action}`,
      entityType: 'operational_exception',
      entityId: actionId,
      details: { source, code, entity_id: entityId, entity_ref: entityRef, reason, assigned_to: assignedTo },
    });

    return NextResponse.json({ success: true, action_id: actionId, status });
  } catch (error) {
    console.error('PATCH operational exception error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต exception ได้' }, { status: 500 });
  }
}
```

When implementing, correct any TypeScript issues around `.catch()` return types by introducing small helper functions if needed; do not leave broad `any` casts.

- [x] **Step 5: Run API source tests**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exceptions.test.ts src/app/api/__tests__/reefer-exceptions.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/app/api/operations/exceptions/route.ts src/lib/reeferExceptions.ts src/app/api/reefer/exceptions/route.ts src/app/api/__tests__/operations-exceptions.test.ts
git commit -m "Add operational exceptions API"
```

---

## Task 5: Add Operations UI Tab And Components

**Files:**
- Create: `src/components/operations/OperationalExceptionCenter.tsx`
- Create: `src/components/operations/OperationalExceptionSummary.tsx`
- Create: `src/components/operations/OperationalExceptionFilters.tsx`
- Create: `src/components/operations/OperationalExceptionTable.tsx`
- Create: `src/components/operations/OperationalExceptionActionDialog.tsx`
- Modify: `src/app/(dashboard)/operations/page.tsx`
- Test: `src/app/api/__tests__/operations-exception-center-ui.test.ts`

- [x] **Step 1: Write failing static UI tests**

Create `src/app/api/__tests__/operations-exception-center-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Operational Exception Center UI', () => {
  it('adds an exceptions tab to Operations without bloating the page with implementation details', () => {
    const page = fs.readFileSync(path.join(root, 'src/app/(dashboard)/operations/page.tsx'), 'utf8');

    expect(page).toContain(\"'exceptions'\");
    expect(page).toContain('OperationalExceptionCenter');
    expect(page.length).toBeLessThan(36000);
  });

  it('renders expected filter/action affordances in focused components', () => {
    const center = fs.readFileSync(path.join(root, 'src/components/operations/OperationalExceptionCenter.tsx'), 'utf8');
    const filters = fs.readFileSync(path.join(root, 'src/components/operations/OperationalExceptionFilters.tsx'), 'utf8');
    const table = fs.readFileSync(path.join(root, 'src/components/operations/OperationalExceptionTable.tsx'), 'utf8');

    expect(center).toContain('/api/operations/exceptions');
    expect(filters).toContain('source');
    expect(filters).toContain('severity');
    expect(filters).toContain('status');
    expect(table).toContain('allowed_actions');
    expect(table).toContain('open_detail');
  });
});
```

- [x] **Step 2: Run UI test to verify failure**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exception-center-ui.test.ts
```

Expected: FAIL because UI components do not exist.

- [x] **Step 3: Create UI types inside main component**

Create `src/components/operations/OperationalExceptionCenter.tsx` with local UI types:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import OperationalExceptionSummary from './OperationalExceptionSummary';
import OperationalExceptionFilters from './OperationalExceptionFilters';
import OperationalExceptionTable from './OperationalExceptionTable';
import OperationalExceptionActionDialog from './OperationalExceptionActionDialog';

export interface OperationalExceptionItem {
  exception_id: string;
  source: 'reconciliation' | 'reefer' | 'approval' | 'transport';
  issue_code: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  status: string;
  entity_type: string;
  entity_id?: number | string | null;
  entity_ref?: string | null;
  owner_role?: string | null;
  assigned_to?: string | null;
  sla_age_days?: number;
  sla_age_minutes?: number;
  sla_breached?: boolean;
  recommended_action?: string | null;
  href: string;
  allowed_actions: Array<'assign' | 'acknowledge' | 'resolve' | 'ignore' | 'reopen' | 'open_detail'>;
  context: Record<string, unknown>;
}

export interface OperationalExceptionSummaryData {
  total_open: number;
  critical: number;
  warning: number;
  info: number;
  sla_breached: number;
  by_source: Record<string, number>;
}

export interface ExceptionFilters {
  source: string;
  status: string;
  severity: string;
  search: string;
  includeClosed: boolean;
}

export default function OperationalExceptionCenter() {
  const { session, hasPermission } = useAuth();
  const { showToast } = useToast();
  const yardId = session?.activeYardId || 1;
  const canManage = hasPermission('operations.exceptions.manage');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OperationalExceptionItem[]>([]);
  const [summary, setSummary] = useState<OperationalExceptionSummaryData | null>(null);
  const [filters, setFilters] = useState<ExceptionFilters>({
    source: 'all',
    status: 'open',
    severity: 'all',
    search: '',
    includeClosed: false,
  });
  const [dialog, setDialog] = useState<{
    item: OperationalExceptionItem;
    action: 'assign' | 'acknowledge' | 'resolve' | 'ignore' | 'reopen';
  } | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ yard_id: String(yardId), limit: '100' });
    if (filters.source !== 'all') params.set('source', filters.source);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.severity !== 'all') params.set('severity', filters.severity);
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.includeClosed) params.set('include_closed', '1');
    return params.toString();
  }, [yardId, filters]);

  const loadExceptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operations/exceptions?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setItems(data.exceptions || []);
      setSummary(data.summary || null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'โหลด exception ไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, showToast]);

  useEffect(() => {
    void loadExceptions();
  }, [loadExceptions]);

  const submitAction = async (reason: string, assignedTo: string) => {
    if (!dialog) return;
    const code = dialog.item.issue_code.replace(`${dialog.item.source}.`, '');
    const res = await fetch('/api/operations/exceptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yard_id: yardId,
        source: dialog.item.source,
        code,
        action: dialog.action,
        entity_id: dialog.item.entity_id,
        entity_ref: dialog.item.entity_ref,
        reason,
        assigned_to: assignedTo,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'อัปเดต exception ไม่สำเร็จ', 'error');
      return;
    }
    setDialog(null);
    showToast('อัปเดต exception แล้ว', 'success');
    await loadExceptions();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle size={18} /> Operational Exception Center
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            รวมงานผิดปกติจาก Gate, Billing, Reefer, Transport และ Supervisor Review
          </p>
        </div>
        <button
          type="button"
          onClick={loadExceptions}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <OperationalExceptionSummary summary={summary} loading={loading} />
      <OperationalExceptionFilters filters={filters} onChange={setFilters} />
      <OperationalExceptionTable
        items={items}
        loading={loading}
        canManage={canManage}
        onAction={(item, action) => {
          if (action === 'open_detail') {
            window.location.href = item.href;
            return;
          }
          setDialog({ item, action });
        }}
      />
      <OperationalExceptionActionDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
        onSubmit={submitAction}
      />
    </section>
  );
}
```

- [x] **Step 4: Create focused UI subcomponents**

Create the four subcomponents with plain, dense operational UI:

- `OperationalExceptionSummary.tsx`
  - Shows `Open`, `Critical`, `Warning`, `SLA breach`, `Reefer`, `Transport`.

- `OperationalExceptionFilters.tsx`
  - Uses `<select>` for source/severity/status.
  - Uses an input for search.
  - Uses a checkbox/toggle for include closed.

- `OperationalExceptionTable.tsx`
  - Uses a real table on desktop and stacked rows on mobile.
  - Columns: severity, source, entity, title, owner, SLA age, assigned, actions.
  - Primary action is deep-link; manage actions are secondary.

- `OperationalExceptionActionDialog.tsx`
  - Use existing app style similar to `src/components/ui/ActionInputDialog.tsx`.
  - Requires reason for `resolve` and `ignore`.
  - Allows `assigned_to` for `assign`.

- [x] **Step 5: Add Operations tab**

Modify `src/app/(dashboard)/operations/page.tsx`:

```tsx
import OperationalExceptionCenter from '@/components/operations/OperationalExceptionCenter';
```

Extend active tab:

```tsx
const [activeTab, setActiveTab] = useState<'queue' | 'create' | 'shifting' | 'exceptions'>('queue');
```

Add permission:

```tsx
const canViewExceptions = hasAnyPermission(['operations.exceptions.view', 'operations.exceptions.manage']);
```

Add tab:

```tsx
{ id: 'exceptions' as const, label: 'Exception Center', icon: <AlertTriangle size={14} />, allowed: canViewExceptions },
```

Render:

```tsx
{effectiveTab === 'exceptions' && canViewExceptions && (
  <OperationalExceptionCenter />
)}
```

- [x] **Step 6: Run UI static test**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exception-center-ui.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/components/operations src/app/\\(dashboard\\)/operations/page.tsx src/app/api/__tests__/operations-exception-center-ui.test.ts
git commit -m "Add operational exception center UI"
```

On PowerShell, stage the operations page with:

```powershell
git add -- 'src/app/(dashboard)/operations/page.tsx'
```

---

## Task 6: Deep Links, Dashboard Entry, And Reports Handoff

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/reports/page.tsx`
- Modify: `DEVELOPER_HANDOFF.md`
- Test: `src/app/api/__tests__/operations-exception-center-ui.test.ts`

- [x] **Step 1: Extend static tests for entry points**

Add to `src/app/api/__tests__/operations-exception-center-ui.test.ts`:

```ts
it('links dashboard and reports exception summaries to the operations exception center', () => {
  const dashboard = fs.readFileSync(path.join(root, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8');
  const reports = fs.readFileSync(path.join(root, 'src/app/(dashboard)/reports/page.tsx'), 'utf8');

  expect(dashboard).toContain('/operations?tab=exceptions');
  expect(reports).toContain('/operations?tab=exceptions');
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exception-center-ui.test.ts
```

Expected: FAIL until links are added.

- [x] **Step 3: Add dashboard link**

In `src/app/(dashboard)/dashboard/page.tsx`, add a visible action near the existing Exception Dashboard:

```tsx
<a
  href="/operations?tab=exceptions"
  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
>
  เปิด Exception Center <ExternalLink size={12} />
</a>
```

- [x] **Step 4: Add reports link**

In `src/app/(dashboard)/reports/page.tsx`, add the same link near the Reconciliation action area:

```tsx
<a
  href="/operations?tab=exceptions"
  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
>
  เปิด Exception Center <ExternalLink size={14} />
</a>
```

- [x] **Step 5: Update handoff**

Add a section near the top of `DEVELOPER_HANDOFF.md`:

```md
## Latest Update — Operational Exception Center

- เพิ่มศูนย์รวม Operational Exception Center ที่หน้า `/operations?tab=exceptions`
- API ใหม่ `/api/operations/exceptions` รวมรายการจาก reconciliation, ReeferExceptions, ApprovalReviews และ GateOutRequests/Transport attention
- ใช้ `ReconciliationActions` เป็น generic action overlay โดย namespace issue code ตาม source เช่น `reconciliation.invoice_open_overdue`, `transport.issue_reported`
- เพิ่ม permission `operations.exceptions.view` และ `operations.exceptions.manage`
- Approval Review ใน MVP เป็น deep-link ไป `/supervisor-review` ยังไม่ approve/reject จาก Exception Center โดยตรง
- Reefer actions ใช้ helper เดียวกับ `/api/reefer/exceptions` เพื่อไม่ให้สถานะ workflow แยกกัน
- ไม่มี runtime DDL ใน API route; permission seed อยู่ใน migration กลาง
```

- [x] **Step 6: Run focused UI test**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/operations-exception-center-ui.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add DEVELOPER_HANDOFF.md src/app/api/__tests__/operations-exception-center-ui.test.ts
git add -- 'src/app/(dashboard)/dashboard/page.tsx' 'src/app/(dashboard)/reports/page.tsx'
git commit -m "Link exception summaries to action center"
```

---

## Task 7: Verification And Browser Smoke

**Files:**
- No code files unless verification finds issues.

- [x] **Step 1: Run focused tests**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/lib/__tests__/reconciliationIssueRegistry.test.ts src/lib/__tests__/operationalExceptions.test.ts src/app/api/__tests__/operations-exceptions.test.ts src/app/api/__tests__/operations-exception-center-ui.test.ts src/app/api/__tests__/reefer-exceptions.test.ts src/app/api/__tests__/reports.test.ts
```

Expected: PASS.

- [x] **Step 2: Run no runtime DDL guard**

Run:

```bash
npm test -- --runInBand --cacheDirectory ./tmp/jest-cache --runTestsByPath src/app/api/__tests__/no-runtime-ddl.test.ts
```

Expected: PASS.

- [x] **Step 3: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: exits `0`.

- [x] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: exits `0`.

- [x] **Step 5: Run production build** (`npm run build`; sandbox build needed elevated access to update `.next`)

Run:

```bash
npm run build:clean
```

Expected: exits `0`. If `.next` deletion hits Windows permission issues, stop and inspect locks before escalating.

- [x] **Step 6: Browser smoke**

Open:

```text
http://localhost:3005/operations?tab=exceptions
```

Verify:

- The Operations page shows an `Exception Center` tab.
- Summary metrics render without overlap on desktop.
- Filters are usable and do not resize the table awkwardly.
- Empty state is clear when there are no exceptions.
- Rows show deep links and actions when seeded data exists.
- Manage actions are hidden/disabled for users without `operations.exceptions.manage`.

- [ ] **Step 7: Commit verification fixes if any**

If verification required small fixes:

```bash
git add <changed-files>
git commit -m "Polish operational exception center verification"
```

---

## Expected Acceptance Criteria

- `/operations?tab=exceptions` shows a central exception center.
- `/api/operations/exceptions` requires yard access and `operations.exceptions.view`.
- `PATCH /api/operations/exceptions` requires `operations.exceptions.manage`.
- Reconciliation issues still work in `/reports`; no issue definitions are duplicated.
- Reefer exception actions still update `ReeferExceptions` source state.
- Approval reviews deep-link to Supervisor Review and are not silently approved/rejected by the new center.
- Transport attention jobs appear from `GateOutRequests`.
- Generic assignment/resolve/ignore state writes to `ReconciliationActions` with namespaced issue codes.
- All new SQL is parameterized.
- No runtime DDL is added to API routes.
- `DEVELOPER_HANDOFF.md` documents behavior and limitations.
- Focused tests, no-runtime-DDL test, `tsc`, `lint`, and clean build pass before merge.

## Implementation Notes

- If the `ReconciliationActions.issue_code` column length is too short for namespaced issue codes, prefer short codes such as `op.recon.invoice_overdue` instead of altering schema in this MVP.
- Do not add customer-facing visibility here; this is internal staff workflow.
- Do not move approval approve/reject into this center during MVP. Keep approval authority in `/supervisor-review`.
- Do not duplicate reefer workflow state in `ReconciliationActions`; source-owned reefer status remains in `ReeferExceptions`.
- Keep UI dense and operational. Avoid a marketing-style dashboard or large decorative cards.
