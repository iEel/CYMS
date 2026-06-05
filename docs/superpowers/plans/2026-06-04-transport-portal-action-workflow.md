# Transport Portal Action Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Transport Portal from a read-only job list into a safe operational workflow where trucking coordinators and assigned drivers can confirm jobs, mark arrival, report issues, attach pickup proof, and review activity without exposing billing or unrelated customer data.

**Architecture:** Keep `/transport` as a separate customer-facing transport surface. Reuse `requireTransportPortalActor()`, `GateOutRequests`, `GateTransactions`, existing upload/auth plumbing, and sanitized EIR views. Add transport action tables plus one action endpoint; actions are scoped by the current session actor and never accept `customer_id` from request body or query.

**Tech Stack:** Next.js App Router, React, TypeScript, MS SQL Server, `mssql`, Zod, existing proxy auth headers, existing `/api/uploads`, Jest, ESLint, TypeScript.

---

## Scope

### In Scope

- Transport actions for `gate_out_request` jobs:
  - `confirm_job`
  - `mark_arrived`
  - `report_issue`
  - `add_proof`
- Activity log visible to the same transport actor who can see the job.
- Proof attachment URL logging after the file is uploaded through the existing `/api/uploads`.
- UI action buttons on transport job cards.
- Activity drawer/modal for a selected transport job.
- Tests preventing driver/trucking data leakage.
- Handoff update.

### Out Of Scope

- Driver-created release or yard release approval.
- Billing, invoice, payment, or credit information in Transport Portal.
- GPS tracking.
- QR gate pass.
- Driver self-service booking.
- Configurable policy UI.

## File Map

### Create

- `src/app/api/transport/actions/route.ts`  
  POST action endpoint for confirm, arrival, issue, and proof.

- `src/app/api/transport/activity/route.ts`  
  GET endpoint for a job activity timeline.

- `src/components/transport/TransportActionDialog.tsx`  
  Small dialog for issue notes and proof upload.

- `src/components/transport/TransportActivityDrawer.tsx`  
  Job activity timeline overlay.

- `src/app/api/__tests__/transport-actions.test.ts`  
  API tests for actions, status transitions, and policy.

- `src/app/api/__tests__/transport-activity.test.ts`  
  API tests for activity timeline access.

### Modify

- `scripts/migrate-runtime-core-schema.js`  
  Add `TransportJobActivities` and `TransportJobProofs`.

- `src/lib/schema.sql`  
  Document the same tables for reference schema.

- `src/lib/transportPortalAccess.ts`  
  Add action names and helper logic for transport job resolution.

- `src/app/api/transport/jobs/route.ts`  
  Include `availableActions`, `proofCount`, and `lastActivityAt`.

- `src/components/transport/types.ts`  
  Add transport action, proof, and activity types.

- `src/components/transport/TransportDashboard.tsx`  
  Wire action dialog, activity drawer, refresh after action.

- `src/components/transport/TransportJobCard.tsx`  
  Add action buttons and activity entry point.

- `src/components/transport/TransportStatusPills.tsx`  
  Add labels/styles for `confirmed` and `issue_reported`.

- `src/app/api/__tests__/transport-jobs.test.ts`  
  Extend read API assertions for new action metadata without billing leakage.

- `src/app/api/__tests__/transport-portal-ui.test.ts`  
  Static UI guard for new workflow buttons and no billing terms.

- `DEVELOPER_HANDOFF.md`  
  Add phase completion notes, migration command, limitations, and test commands.

---

## Data Model

### TransportJobActivities

```sql
CREATE TABLE TransportJobActivities (
  activity_id BIGINT PRIMARY KEY IDENTITY(1,1),
  job_source NVARCHAR(40) NOT NULL,
  job_id INT NOT NULL,
  action NVARCHAR(40) NOT NULL,
  previous_status NVARCHAR(40) NULL,
  new_status NVARCHAR(40) NULL,
  note NVARCHAR(1000) NULL,
  proof_url NVARCHAR(500) NULL,
  actor_user_id INT NULL,
  actor_customer_id INT NULL,
  actor_mode NVARCHAR(20) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
```

### TransportJobProofs

```sql
CREATE TABLE TransportJobProofs (
  proof_id BIGINT PRIMARY KEY IDENTITY(1,1),
  job_source NVARCHAR(40) NOT NULL,
  job_id INT NOT NULL,
  proof_type NVARCHAR(40) NOT NULL,
  file_url NVARCHAR(500) NOT NULL,
  note NVARCHAR(1000) NULL,
  uploaded_by_user_id INT NULL,
  uploaded_by_customer_id INT NULL,
  created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
```

### Indexes

```sql
CREATE INDEX IX_TransportJobActivities_Job
  ON TransportJobActivities (job_source, job_id, created_at DESC);

CREATE INDEX IX_TransportJobProofs_Job
  ON TransportJobProofs (job_source, job_id, created_at DESC);
```

---

## Status And Action Rules

### Statuses

- `requested`: job created and visible to transport.
- `pending`: existing legacy/request status, treated like `requested`.
- `confirmed`: driver or trucking coordinator accepted the job.
- `at_gate`: driver or trucking coordinator marked arrival at yard.
- `issue_reported`: transport reported a problem; internal Gate still controls release.
- `released`: internal Gate released the container and issued EIR.
- `completed`: historical completed job.
- `cancelled`: cancelled job.
- `rejected`: rejected request.

### Allowed Transitions

```ts
const transportStatusTransitions = {
  confirm_job: {
    from: ['requested', 'pending', 'issue_reported'],
    to: 'confirmed',
  },
  mark_arrived: {
    from: ['requested', 'pending', 'confirmed', 'issue_reported'],
    to: 'at_gate',
  },
  report_issue: {
    from: ['requested', 'pending', 'confirmed', 'at_gate'],
    to: 'issue_reported',
  },
  add_proof: {
    from: ['requested', 'pending', 'confirmed', 'at_gate', 'issue_reported'],
    to: null,
  },
} as const;
```

`released`, `completed`, `cancelled`, and `rejected` are immutable from Transport Portal.

---

## Task 1: Add Migration Tables

**Files:**
- Modify: `scripts/migrate-runtime-core-schema.js`
- Modify: `src/lib/schema.sql`
- Test: `src/app/api/__tests__/transport-actions.test.ts`

- [ ] **Step 1: Write the failing migration static test**

Add this test case to `src/app/api/__tests__/transport-actions.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Transport action migration', () => {
  it('creates transport activity and proof tables outside request handlers', () => {
    const migration = read('scripts/migrate-runtime-core-schema.js');
    const schema = read('src/lib/schema.sql');
    const runtimeRoutes = [
      'src/app/api/transport/actions/route.ts',
      'src/app/api/transport/activity/route.ts',
      'src/app/api/transport/jobs/route.ts',
    ]
      .filter((file) => fs.existsSync(path.join(process.cwd(), file)))
      .map(read)
      .join('\n');

    expect(migration).toContain("OBJECT_ID('TransportJobActivities'");
    expect(migration).toContain("OBJECT_ID('TransportJobProofs'");
    expect(migration).toContain('IX_TransportJobActivities_Job');
    expect(migration).toContain('IX_TransportJobProofs_Job');
    expect(schema).toContain('TransportJobActivities');
    expect(schema).toContain('TransportJobProofs');
    expect(runtimeRoutes).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(runtimeRoutes).not.toMatch(/\bALTER\s+TABLE\b/i);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/app/api/__tests__/transport-actions.test.ts --runInBand
```

Expected: FAIL because the transport tables are not in the migration/schema yet.

- [ ] **Step 3: Add migration DDL to the canonical migration script**

Add a new `runStep(pool, 'Transport portal action workflow', ...)` block in `scripts/migrate-runtime-core-schema.js` after the Gate Out durable request/session step:

```sql
IF OBJECT_ID('TransportJobActivities', 'U') IS NULL
BEGIN
  CREATE TABLE TransportJobActivities (
    activity_id BIGINT PRIMARY KEY IDENTITY(1,1),
    job_source NVARCHAR(40) NOT NULL,
    job_id INT NOT NULL,
    action NVARCHAR(40) NOT NULL,
    previous_status NVARCHAR(40) NULL,
    new_status NVARCHAR(40) NULL,
    note NVARCHAR(1000) NULL,
    proof_url NVARCHAR(500) NULL,
    actor_user_id INT NULL,
    actor_customer_id INT NULL,
    actor_mode NVARCHAR(20) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END;

IF OBJECT_ID('TransportJobProofs', 'U') IS NULL
BEGIN
  CREATE TABLE TransportJobProofs (
    proof_id BIGINT PRIMARY KEY IDENTITY(1,1),
    job_source NVARCHAR(40) NOT NULL,
    job_id INT NOT NULL,
    proof_type NVARCHAR(40) NOT NULL,
    file_url NVARCHAR(500) NOT NULL,
    note NVARCHAR(1000) NULL,
    uploaded_by_user_id INT NULL,
    uploaded_by_customer_id INT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('TransportJobActivities')
    AND name = 'IX_TransportJobActivities_Job'
)
  CREATE INDEX IX_TransportJobActivities_Job
    ON TransportJobActivities (job_source, job_id, created_at DESC);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('TransportJobProofs')
    AND name = 'IX_TransportJobProofs_Job'
)
  CREATE INDEX IX_TransportJobProofs_Job
    ON TransportJobProofs (job_source, job_id, created_at DESC);
```

- [ ] **Step 4: Add schema reference DDL**

Add matching `TransportJobActivities` and `TransportJobProofs` table definitions to `src/lib/schema.sql`.

- [ ] **Step 5: Run the test**

Run:

```bash
npm test -- src/app/api/__tests__/transport-actions.test.ts --runInBand
```

Expected: PASS for the migration test.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-runtime-core-schema.js src/lib/schema.sql src/app/api/__tests__/transport-actions.test.ts
git commit -m "Add transport action workflow schema"
```

---

## Task 2: Extend Transport Access Helper For Actions

**Files:**
- Modify: `src/lib/transportPortalAccess.ts`
- Test: `src/lib/__tests__/transportPortalAccess.test.ts`

- [ ] **Step 1: Write helper tests for new actions**

Add tests to `src/lib/__tests__/transportPortalAccess.test.ts` proving:

```ts
expect(source).toContain("'transport.jobs.action'");
expect(source).toContain("'transport.activity.view'");
expect(source).toContain('resolveTransportJobId');
expect(source).toContain('assertTransportJobSource');
```

Also add direct behavior tests for:

```ts
expect(resolveTransportJobId('request-88')).toEqual({
  source: 'gate_out_request',
  id: 88,
});
expect(resolveTransportJobId('gate-99')).toEqual({
  source: 'gate_transaction',
  id: 99,
});
expect(resolveTransportJobId('request-x')).toBeNull();
expect(resolveTransportJobId('invoice-1')).toBeNull();
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm test -- src/lib/__tests__/transportPortalAccess.test.ts --runInBand
```

Expected: FAIL because the action names and helpers do not exist yet.

- [ ] **Step 3: Add action types and job id parser**

Add to `src/lib/transportPortalAccess.ts`:

```ts
export type TransportPortalAction =
  | 'transport.jobs.view'
  | 'transport.eir.view'
  | 'transport.jobs.action'
  | 'transport.activity.view';

export type TransportJobSource = 'gate_out_request' | 'gate_transaction';

export function resolveTransportJobId(value: unknown): { source: TransportJobSource; id: number } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(request|gate)-([1-9]\d*)$/);
  if (!match) return null;
  return {
    source: match[1] === 'request' ? 'gate_out_request' : 'gate_transaction',
    id: Number(match[2]),
  };
}

export function assertTransportJobSource(
  job: { source: TransportJobSource; id: number },
  allowed: TransportJobSource[],
) {
  return allowed.includes(job.source);
}
```

Update the `transportActionAllowed` check to allow all four actions.

- [ ] **Step 4: Run helper tests**

Run:

```bash
npm test -- src/lib/__tests__/transportPortalAccess.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transportPortalAccess.ts src/lib/__tests__/transportPortalAccess.test.ts
git commit -m "Extend transport portal action policy"
```

---

## Task 3: Add Transport Actions API

**Files:**
- Create: `src/app/api/transport/actions/route.ts`
- Modify: `src/app/api/__tests__/transport-actions.test.ts`

- [ ] **Step 1: Write route tests**

Add tests in `src/app/api/__tests__/transport-actions.test.ts` for:

Add these helpers near the top of the test file:

```ts
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;

type QueryResult = { recordset: unknown[] };

function q(recordset: unknown[]): QueryResult {
  return { recordset };
}

function makeDb(queue: QueryResult[]) {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    return Promise.resolve(queue.shift() || q([]));
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

function transportPost(pathname: string, body: Record<string, unknown>, userId = 21) {
  return new NextRequest(`http://localhost${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': String(userId),
    },
    body: JSON.stringify(body),
  });
}
```

```ts
it('lets an assigned driver confirm their own request job', async () => {
  const route = require('../transport/actions/route') as typeof import('../transport/actions/route');
  const db = makeDb([
    q([{ user_id: 21, customer_id: 44, role_code: 'customer', customer_portal_role: 'driver_user' }]),
    q([{ request_id: 88, status: 'requested', driver_user_id: 21, trucking_company_id: 44 }]),
    q([]),
    q([]),
  ]);
  mockedGetDb.mockResolvedValue(db);

  const res = await route.POST(transportPost('/api/transport/actions', {
    job_id: 'request-88',
    action: 'confirm_job',
  }, 21));

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ success: true, status: 'confirmed' });
  expect(db.queries.join('\n')).toContain("SET status = @newStatus");
  expect(db.queries.join('\n')).toContain('INSERT INTO TransportJobActivities');
  expect(db.queries.join('\n')).toContain('driver_user_id = @transportUserId');
});
```

Add tests that:

- Driver 21 cannot update a request assigned to driver 22.
- Trucking coordinator can update a request for the same `trucking_company_id`.
- `gate-99` jobs return 400 for actions because Transport Portal cannot mutate completed gate transactions.
- `released`, `completed`, `cancelled`, and `rejected` request statuses return 409.
- `report_issue` requires a non-empty note.
- `add_proof` requires a `proof_url` under `/uploads/`.
- The route source does not contain `Invoices`, `BillingClearances`, `invoice_amount`, or `billing_clearance`.

- [ ] **Step 2: Run failing route tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-actions.test.ts --runInBand
```

Expected: FAIL because `/api/transport/actions` does not exist yet.

- [ ] **Step 3: Implement the POST route**

Create `src/app/api/transport/actions/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { z } from 'zod';

import { getDb } from '@/lib/db';
import {
  buildTransportJobAccessSql,
  requireTransportPortalActor,
  resolveTransportJobId,
} from '@/lib/transportPortalAccess';

const actionSchema = z.object({
  job_id: z.string().min(1).max(80),
  action: z.enum(['confirm_job', 'mark_arrived', 'report_issue', 'add_proof']),
  note: z.string().trim().max(1000).optional().nullable(),
  proof_url: z.string().trim().max(500).optional().nullable(),
  proof_type: z.enum(['pickup', 'arrival', 'seal', 'other']).optional().default('pickup'),
});

const finalStatuses = new Set(['released', 'completed', 'cancelled', 'rejected']);

const nextStatusByAction: Record<string, string | null> = {
  confirm_job: 'confirmed',
  mark_arrived: 'at_gate',
  report_issue: 'issue_reported',
  add_proof: null,
};
```

Implement behavior:

- Get actor with `requireTransportPortalActor(request, db, 'transport.jobs.action')`.
- Parse `job_id` with `resolveTransportJobId`.
- Reject non-`gate_out_request` job sources with status 400.
- Use `buildTransportJobAccessSql(actor)` in the request lookup.
- Reject missing job with 404.
- Reject final statuses with 409.
- Require `note` for `report_issue`.
- Require `/uploads/` URL for `add_proof`.
- Update `GateOutRequests.status` only when action has a next status.
- Insert `TransportJobProofs` for `add_proof`.
- Insert `TransportJobActivities` for every action.
- Return `{ success: true, status, action }`.

Use only parameterized SQL inputs.

- [ ] **Step 4: Run route tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-actions.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transport/actions/route.ts src/app/api/__tests__/transport-actions.test.ts
git commit -m "Add transport portal job actions"
```

---

## Task 4: Add Transport Activity API

**Files:**
- Create: `src/app/api/transport/activity/route.ts`
- Create: `src/app/api/__tests__/transport-activity.test.ts`

- [ ] **Step 1: Write activity route tests**

Add tests for:

- Driver can view activity for their own `request-88`.
- Driver cannot view another driver request.
- Trucking coordinator can view same-company request activity.
- Activity API returns activity/proof rows but no invoice, billing, or internal fields.
- Activity API rejects invalid `job_id`.

Use these helpers at the top of `src/app/api/__tests__/transport-activity.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;

type QueryResult = { recordset: unknown[] };

function q(recordset: unknown[]): QueryResult {
  return { recordset };
}

function makeDb(queue: QueryResult[]) {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    return Promise.resolve(queue.shift() || q([]));
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

function transportGet(pathname: string, userId = 21) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: { 'x-user-id': String(userId) },
  });
}
```

The expected response shape:

```ts
{
  jobId: 'request-88',
  activities: [
    {
      activityId: 1,
      action: 'confirm_job',
      previousStatus: 'requested',
      newStatus: 'confirmed',
      note: null,
      proofUrl: null,
      actorMode: 'driver',
      createdAt: '2026-06-04T08:00:00.000Z',
    },
  ],
  proofs: [
    {
      proofId: 1,
      proofType: 'pickup',
      fileUrl: '/uploads/gate/2026-06/proof.jpg',
      note: 'container photo',
      createdAt: '2026-06-04T08:05:00.000Z',
    },
  ],
}
```

- [ ] **Step 2: Run failing activity tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-activity.test.ts --runInBand
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the GET route**

Create `src/app/api/transport/activity/route.ts`:

- Get `job_id` from search params.
- Get actor with `requireTransportPortalActor(request, db, 'transport.activity.view')`.
- Parse with `resolveTransportJobId`.
- Build an access-checked job existence query using `buildTransportJobAccessSql(actor)`.
- Fetch `TransportJobActivities` and `TransportJobProofs` by `job_source` and `job_id`.
- Return camelCase payload.

Do not include `AuditLog`, invoice, billing clearance, internal notes, customer inventory, or unrelated jobs.

- [ ] **Step 4: Run activity tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-activity.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/transport/activity/route.ts src/app/api/__tests__/transport-activity.test.ts
git commit -m "Add transport activity timeline API"
```

---

## Task 5: Add Action Metadata To Jobs API

**Files:**
- Modify: `src/app/api/transport/jobs/route.ts`
- Modify: `src/components/transport/types.ts`
- Modify: `src/app/api/__tests__/transport-jobs.test.ts`

- [ ] **Step 1: Write tests for action metadata**

Extend `src/app/api/__tests__/transport-jobs.test.ts` to expect:

```ts
expect(body.jobs[0]).toEqual(expect.objectContaining({
  availableActions: ['confirm_job', 'mark_arrived', 'report_issue', 'add_proof'],
  proofCount: 0,
}));
```

Add a second mocked row with `status: 'released'` and expect:

```ts
expect(body.jobs[1].availableActions).toEqual([]);
```

- [ ] **Step 2: Run failing jobs tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-jobs.test.ts --runInBand
```

Expected: FAIL because jobs do not include action metadata yet.

- [ ] **Step 3: Update types**

Add to `src/components/transport/types.ts`:

```ts
export type TransportAction = 'confirm_job' | 'mark_arrived' | 'report_issue' | 'add_proof';

export interface TransportJobActivity {
  activityId: number;
  action: TransportAction;
  previousStatus?: string | null;
  newStatus?: string | null;
  note?: string | null;
  proofUrl?: string | null;
  actorMode: 'driver' | 'trucking';
  createdAt?: string;
}

export interface TransportJobProof {
  proofId: number;
  proofType: 'pickup' | 'arrival' | 'seal' | 'other';
  fileUrl: string;
  note?: string | null;
  createdAt?: string;
}
```

Extend `TransportJob`:

```ts
availableActions: TransportAction[];
proofCount: number;
lastActivityAt?: string;
```

- [ ] **Step 4: Update jobs route**

Update `RequestJobs` query to left join an aggregate:

```sql
OUTER APPLY (
  SELECT COUNT(*) AS proof_count
  FROM TransportJobProofs tp
  WHERE tp.job_source = 'gate_out_request'
    AND tp.job_id = gor.request_id
) proofStats
OUTER APPLY (
  SELECT TOP 1 ta.created_at AS last_activity_at
  FROM TransportJobActivities ta
  WHERE ta.job_source = 'gate_out_request'
    AND ta.job_id = gor.request_id
  ORDER BY ta.created_at DESC
) activityStats
```

Return `proof_count` and `last_activity_at`.

Add helper:

```ts
function availableActionsForStatus(status: string, source: string) {
  const normalized = status.toLowerCase();
  if (source !== 'gate_out_request') return [];
  if (['released', 'completed', 'cancelled', 'rejected'].includes(normalized)) return [];
  return ['confirm_job', 'mark_arrived', 'report_issue', 'add_proof'];
}
```

- [ ] **Step 5: Run jobs tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-jobs.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/transport/jobs/route.ts src/components/transport/types.ts src/app/api/__tests__/transport-jobs.test.ts
git commit -m "Expose transport job action metadata"
```

---

## Task 6: Add Transport Action UI

**Files:**
- Create: `src/components/transport/TransportActionDialog.tsx`
- Create: `src/components/transport/TransportActivityDrawer.tsx`
- Modify: `src/components/transport/TransportDashboard.tsx`
- Modify: `src/components/transport/TransportJobCard.tsx`
- Modify: `src/components/transport/TransportStatusPills.tsx`
- Modify: `src/app/api/__tests__/transport-portal-ui.test.ts`

- [ ] **Step 1: Write static UI tests**

Extend `src/app/api/__tests__/transport-portal-ui.test.ts`:

```ts
expect(dashboard).toContain('/api/transport/actions');
expect(dashboard).toContain('/api/transport/activity');
expect(jobCard).toContain('confirm_job');
expect(jobCard).toContain('mark_arrived');
expect(jobCard).toContain('report_issue');
expect(jobCard).toContain('add_proof');
expect(dashboard).not.toContain('/api/billing');
expect(jobCard).not.toContain('invoice');
expect(jobCard).not.toContain('billing');
```

Read `TransportJobCard.tsx` in the test as `jobCard`.

```ts
const jobCard = readSource('src/components/transport/TransportJobCard.tsx');
```

- [ ] **Step 2: Run failing UI tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-portal-ui.test.ts --runInBand
```

Expected: FAIL because action UI files are not wired yet.

- [ ] **Step 3: Add status labels**

Update `src/components/transport/TransportStatusPills.tsx`:

```ts
confirmed: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
issue_reported: 'bg-rose-50 text-rose-700 ring-rose-200',
```

Labels:

```ts
confirmed: 'รับงานแล้ว',
issue_reported: 'แจ้งปัญหา',
```

- [ ] **Step 4: Add action dialog**

Create `TransportActionDialog.tsx` with props:

```ts
type Props = {
  action: TransportAction;
  job: TransportJob;
  onClose: () => void;
  onDone: () => void;
};
```

Behavior:

- `confirm_job`: submit without note.
- `mark_arrived`: submit without note.
- `report_issue`: require note.
- `add_proof`: file input converts file to base64 with `FileReader`, calls `/api/uploads` with `{ folder: 'gate', filename_prefix: 'transport_proof', data }`, then calls `/api/transport/actions` with `proof_url`.
- On success, call `onDone()`.
- On error, render the API error in a red inline alert.

- [ ] **Step 5: Add activity drawer**

Create `TransportActivityDrawer.tsx` with:

- Fetch `/api/transport/activity?job_id=${encodeURIComponent(job.jobId)}`.
- Render activities in newest-first order.
- Render proof links as `target="_blank"` with `rel="noreferrer"`.
- Show empty state: `ยังไม่มีประวัติการดำเนินการ`.

- [ ] **Step 6: Wire dashboard state**

Update `TransportDashboard.tsx`:

- Add `selectedAction`, `selectedJob`, `activityJob`, `actionBusy`.
- Add `performAction()` via `fetch('/api/transport/actions', { method: 'POST', ... })`.
- Refresh jobs after success by calling `loadData()`.
- Pass `onAction` and `onOpenActivity` to `TransportJobCard`.
- Render `TransportActionDialog` and `TransportActivityDrawer`.

- [ ] **Step 7: Add job card buttons**

Update `TransportJobCard.tsx`:

- Keep `ดู EIR`.
- Add action buttons only from `job.availableActions`.
- Recommended button labels:
  - `confirm_job`: `รับงาน`
  - `mark_arrived`: `ถึงลานแล้ว`
  - `report_issue`: `แจ้งปัญหา`
  - `add_proof`: `เพิ่มหลักฐาน`
- Add `ประวัติ` button.
- Keep layout mobile-first with wrapping buttons and no billing terms.

- [ ] **Step 8: Run UI tests**

Run:

```bash
npm test -- src/app/api/__tests__/transport-portal-ui.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/transport src/app/api/__tests__/transport-portal-ui.test.ts
git commit -m "Add transport portal action UI"
```

---

## Task 7: Full Transport Verification

**Files:**
- No source edits unless a verification failure points to a specific file.

- [ ] **Step 1: Run focused transport tests**

Run:

```bash
npm test -- src/lib/__tests__/transportPortalAccess.test.ts src/app/api/__tests__/transport-capabilities.test.ts src/app/api/__tests__/transport-jobs.test.ts src/app/api/__tests__/transport-eir.test.ts src/app/api/__tests__/transport-actions.test.ts src/app/api/__tests__/transport-activity.test.ts src/app/api/__tests__/transport-portal-ui.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no warnings introduced by this phase.

- [ ] **Step 3: Run TypeScript/build check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run full Jest**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit verification fixes**

If Step 1-4 required fixes, commit them:

```bash
git add <changed-files>
git commit -m "Verify transport portal action workflow"
```

If no files changed, do not create an empty commit.

---

## Task 8: Run Migration And Browser Smoke

**Files:**
- No source edits unless smoke exposes a bug.

- [ ] **Step 1: Run migration**

Run the canonical migration directly:

```bash
node scripts/migrate-runtime-core-schema.js
```

Expected: migration completes and logs the `Transport portal action workflow` step as applied or already satisfied.

- [ ] **Step 2: Start or reuse dev server**

Run:

```bash
npm run dev
```

Expected: local app is available at `http://127.0.0.1:3005`.

- [ ] **Step 3: Browser smoke**

Use Browser on:

```text
http://127.0.0.1:3005/transport
```

Verify:

- Trucking coordinator can see job list.
- Driver can see job list only for assigned jobs.
- Job card shows action buttons for non-final jobs.
- `รับงาน` updates status to `รับงานแล้ว`.
- `ถึงลานแล้ว` updates status to `อยู่หน้าด่าน`.
- `แจ้งปัญหา` requires note and shows issue status.
- `เพิ่มหลักฐาน` uploads through `/api/uploads` and records proof.
- `ประวัติ` shows activities and proof links.
- No invoice, billing, payment, credit hold, or internal note text appears.

- [ ] **Step 4: Commit smoke fixes**

If smoke required fixes:

```bash
git add <changed-files>
git commit -m "Polish transport portal action smoke flow"
```

If no files changed, do not create an empty commit.

---

## Task 9: Update Handoff

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Add handoff entry**

Add a `Transport Portal Action Workflow` entry with:

- New routes:
  - `/api/transport/actions`
  - `/api/transport/activity`
- New tables:
  - `TransportJobActivities`
  - `TransportJobProofs`
- Status transitions.
- Security policy:
  - driver scoped by `driver_user_id`
  - trucking scoped by `trucking_company_id` or active trucking grant
  - no billing/invoice/internal fields
- Migration command:
  - `node scripts/migrate-runtime-core-schema.js`
- Verification commands and results.
- Remaining limitations:
  - no GPS
  - no QR gate pass
  - no driver release
  - no billing visibility

- [ ] **Step 2: Review handoff for contradictions**

Search the handoff for older statements that say Transport Portal is read-only. Update them to say:

```text
Transport Portal supports limited job actions: confirm, arrived, issue report, proof upload. Gate/Internal still controls release and EIR issuance.
```

- [ ] **Step 3: Commit handoff**

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Document transport portal action workflow"
```

---

## Final Verification Before Push

- [ ] Run:

```bash
git status --short
```

Expected: only intentional files are changed before the final commit, then clean after commit.

- [ ] Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] Run:

```bash
npm run build
```

Expected: PASS.

- [ ] Push:

```bash
git push origin master
```

Expected: push succeeds.

---

## Self-Review

- Spec coverage: The plan covers backend schema, transport action policy, action API, activity API, job metadata, UI actions, verification, migration, browser smoke, and handoff.
- No-open-ended-step scan: Every task has concrete files, commands, expected outcomes, and implementation details.
- Type consistency: The action names are consistent across API, UI, tests, and status transition rules.
- Scope check: The plan is limited to Transport Portal action workflow MVP and deliberately excludes release, billing, GPS, QR, and configurable policy UI.
