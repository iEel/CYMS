# CYMS Runtime Policy And Maintainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden CYMS read-path security and maintainability by removing runtime schema probing from request handlers, centralizing entity access resolution, clarifying offline operation policy, and reducing the next set of oversized Gate/Yard components without changing user-facing workflows.

**Architecture:** Keep business behavior intact. Move schema capability assumptions into a shared helper and migration contract, route all cross-entity reads through a shared resolver, and split large UI components into focused panels/hooks that preserve existing state ownership. Offline behavior becomes an explicit allowlist instead of incidental `offlineFetch` usage.

**Tech Stack:** Next.js App Router, React, TypeScript, MS SQL Server, existing Jest test setup, existing `scripts/migrate-runtime-core-schema.js`, existing audit/access helpers.

---

## Current Evidence From Handoff And Code

`DEVELOPER_HANDOFF.md` already records recent hardening work: attachment center access, CODECO guard, upload/auth enforcement, Gate Out and Billing/Booking decomposition, migration ledger, Document Template preview UX, and full verification passing at the last checkpoint.

The next risks are now mostly policy drift and request-path maintainability:

- Runtime schema probes still exist in read API handlers:
  - `src/app/api/containers/detail/route.ts` checks `OBJECT_ID(...)` for `BillingClearances`, `Bookings`, `BookingContainers`, `EDIEndpoints`, `EDISendLog`, and `ApprovalReviews`.
  - `src/app/api/audit-trail/readable/route.ts` checks `OBJECT_ID('BillingClearances', 'U')`.
  - `src/app/api/reports/reconciliation/route.ts` checks `COL_LENGTH('GateTransactions', 'billing_clearance_id')`.
- Large files still slow future feature work:
  - `src/app/(dashboard)/gate/GateInTab.tsx` ~1,288 lines.
  - `src/app/(dashboard)/yard/YardPageClient.tsx` ~1,216 lines.
  - `src/components/yard/ContainerDetailModal.tsx` ~1,195 lines.
  - `src/app/(dashboard)/reports/page.tsx`, `billing/page.tsx`, `mnr/page.tsx`, `booking/page.tsx`, `portal/bookings/page.tsx`, `GateOutTab.tsx`, and `reefer/page.tsx` remain above 1,000 lines.
- Direct party/customer input still appears in business mutation routes and should be normalized through one resolver:
  - `src/app/api/mnr/route.ts` uses `body.customer_id` and `body.billing_customer_id || body.customer_id`.
  - `src/app/api/edi/bookings/route.ts` maps booking/customer fields in multiple places.
  - `src/app/api/billing/invoices/route.ts` handles invoice customer fields directly.
- Offline queue exists (`src/lib/offlineQueue.ts`), but feature routes mix direct `fetch` and `offlineFetch` without a visible operation policy. Gate final mutations use `offlineFetch`, while billing/invoice/customer lookups and financial mutations remain direct fetches.

---

## Task 1: Add Runtime Schema Capability Contract

**Goal:** Stop request handlers from asking SQL Server which tables/columns exist on every request. Runtime schema should be a deployment/migration contract, not route logic.

**Files:**

- Create `src/lib/schemaCapabilities.ts`.
- Add tests in `src/lib/__tests__/schemaCapabilities.test.ts`.
- Extend `src/app/api/__tests__/no-runtime-ddl.test.ts` or create `src/app/api/__tests__/runtime-schema-probes.test.ts`.

**Steps:**

- [x] Write tests for a small capability helper that exposes stable booleans for deployed runtime features:
  - `billingClearances`
  - `bookingContainers`
  - `ediSendLog`
  - `approvalReviews`
  - `gateBillingClearanceId`
- [x] Implement `src/lib/schemaCapabilities.ts` with no database query in request path.
- [x] Add a guard test that scans runtime API route files for `OBJECT_ID(` and `COL_LENGTH(`.
- [x] Allow those strings only in migrations, schema tests, or explicit schema tooling.
- [x] Document that missing schema is a migration/deploy issue, not a per-request branch.

**Acceptance Criteria:**

- Runtime API handlers no longer need table/column existence SQL probes.
- A failing migration causes an obvious route error or capability assertion, not silent partial data.
- Test coverage prevents new request-path schema probes from creeping back in.

---

## Task 2: Remove Runtime Schema Probes From Read Routes

**Goal:** Replace existing `OBJECT_ID`/`COL_LENGTH` usage in API routes with the helper from Task 1 or stable schema assumptions.

**Files:**

- `src/app/api/containers/detail/route.ts`
- `src/app/api/audit-trail/readable/route.ts`
- `src/app/api/reports/reconciliation/route.ts`
- Relevant API tests under `src/app/api/__tests__/`

**Steps:**

- [x] Refactor `containers/detail/route.ts` to build billing, booking, EDI, and approval sections without inline table existence probes.
- [x] Refactor `audit-trail/readable/route.ts` to stop probing `BillingClearances` inside the readable audit query.
- [x] Refactor `reports/reconciliation/route.ts` to remove `COL_LENGTH('GateTransactions', 'billing_clearance_id')`.
- [x] Keep all SQL parameterized.
- [x] Add focused route tests that assert the expected query behavior without embedding schema probes.
- [x] Run the runtime-probe guard test.

**Acceptance Criteria:**

- `rg "OBJECT_ID|COL_LENGTH" src/app/api src/lib` returns only approved schema tooling/tests.
- Container detail, readable audit trail, and reconciliation report still return their current sections.
- No route uses runtime DDL or runtime schema discovery.

---

## Task 3: Create Shared Entity Access Resolver

**Goal:** Centralize how CYMS resolves “this entity belongs to which yard/customer/job” before routes read attachments, activity, audit trail, or detail data.

**Files:**

- Create `src/lib/entityAccessResolver.ts`.
- Add `src/lib/__tests__/entityAccessResolver.test.ts`.
- Refactor `src/lib/attachmentAccess.ts` to use the resolver where practical.

**Proposed API:**

```ts
type EntityType =
  | 'container'
  | 'booking'
  | 'invoice'
  | 'statement'
  | 'gate_transaction'
  | 'eir'
  | 'repair_order'
  | 'eor'
  | 'reefer_check'
  | 'reefer_exception';

type EntityScope = {
  entityType: EntityType;
  entityId?: string | number;
  entityRef?: string;
  yardId?: number | null;
  customerId?: number | null;
  containerId?: number | null;
  containerNumber?: string | null;
  bookingId?: number | null;
  invoiceId?: number | null;
};
```

**Steps:**

- [x] Write tests for parsing entity locators from route query/body.
- [x] Write tests for resolving yard/customer scope by entity type.
- [x] Implement `resolveEntityScope(pool, locator)`.
- [x] Implement `requireResolvedEntityYardAccess(pool, actor, locator, action)`.
- [x] Refactor attachment access checks to use the resolver instead of maintaining a separate entity mapping.
- [x] Keep resolver behavior default deny when an entity cannot be resolved.

**Acceptance Criteria:**

- Attachment, audit, timeline, and future document routes can share one access resolution layer.
- Unknown entity types and unresolved entity IDs fail closed.
- Resolver tests cover container, booking, invoice, gate transaction/EIR, repair order/EOR, and reefer entities.

---

## Task 4: Apply Resolver To Cross-Entity Read Routes

**Goal:** Ensure sensitive read routes resolve access before running broad detail/activity queries.

**Files:**

- `src/app/api/entity-timeline/route.ts`
- `src/app/api/audit-trail/readable/route.ts`
- `src/app/api/containers/detail/route.ts`
- `src/app/api/documents/activity/route.ts` if present/applicable
- Route tests under `src/app/api/__tests__/`

**Steps:**

- [x] Identify routes that accept `entity_type`, `entity_id`, `container_id`, `booking_id`, or document refs.
- [x] Add resolver-based yard/customer checks before loading broad entity data for `entity-timeline` and `audit-trail/readable`.
- [x] Preserve internal admin/staff access behavior for the routes touched in this slice.
- [x] Preserve customer portal default-deny behavior where the route is portal-facing.
- [x] Add tests for denied derived-yard reads before timeline/audit queries run.
- [x] Add tests that valid same-yard staff still get the expected response.
- [ ] Apply the resolver to `documents/activity` after document type normalization covers receipt/credit note flows.

**Acceptance Criteria:**

- Cross-entity reads share consistent access behavior.
- Routes do not rely on duplicated ad hoc entity lookup SQL.
- Tests protect against cross-yard or cross-customer data leakage.

---

## Task 5: Decompose Gate In UI Without Behavior Changes

**Goal:** Reduce `GateInTab.tsx` complexity while preserving the current Gate In workflow, business relationship fields, and Portal Visibility Preview behavior.

**Files:**

- Modify `src/app/(dashboard)/gate/GateInTab.tsx`.
- Create:
  - `src/app/(dashboard)/gate/hooks/useGateInBookingContext.ts`
  - `src/app/(dashboard)/gate/hooks/useGateInBillingContext.ts`
  - `src/app/(dashboard)/gate/hooks/useGateInVisibilityPreview.ts`
  - `src/app/(dashboard)/gate/components/GateInContainerSection.tsx`
  - `src/app/(dashboard)/gate/components/GateInBusinessRelationshipSection.tsx`
  - `src/app/(dashboard)/gate/components/GateInDriverSection.tsx`
  - `src/app/(dashboard)/gate/components/GateInEvidenceSection.tsx`
  - `src/app/(dashboard)/gate/components/GateInSubmitSection.tsx`

**Steps:**

- [ ] Add characterization tests or component-level smoke tests for visible Gate In fields.
- [ ] Extract booking/customer lookup state into `useGateInBookingContext`.
- [ ] Extract billing and clearance state into `useGateInBillingContext`.
- [ ] Extract grant preview derivation into `useGateInVisibilityPreview`.
- [ ] Move container fields into `GateInContainerSection`.
- [ ] Move owner/billing/party fields into `GateInBusinessRelationshipSection`.
- [ ] Move driver/truck fields into `GateInDriverSection`.
- [ ] Move photo/signature/evidence controls into `GateInEvidenceSection`.
- [ ] Keep final submit payload assembled in the parent until tests prove safe extraction.
- [ ] Verify no visual regression in desktop and responsive widths.

**Acceptance Criteria:**

- `GateInTab.tsx` is significantly smaller and easier to navigate.
- Gate In still supports booking selector, SOC/COC, owner, bill-to, trucking, driver/truck context, and Portal Visibility Preview.
- No data model, grant, or submit behavior changes are introduced by the decomposition.

---

## Task 6: Decompose Container Detail And Yard Page

**Goal:** Continue reducing the highest-friction yard files after Gate In.

**Files:**

- Modify `src/components/yard/ContainerDetailModal.tsx`.
- Modify `src/app/(dashboard)/yard/YardPageClient.tsx`.
- Create focused panels/hooks under:
  - `src/components/yard/detail/`
  - `src/app/(dashboard)/yard/components/`
  - `src/app/(dashboard)/yard/hooks/`

**Steps:**

- [ ] Split `ContainerDetailModal` into overview, lifecycle, EIR/documents, billing, M&R, reefer, and activity panels.
- [ ] Keep modal tab state and data fetching stable.
- [ ] Split `YardPageClient` into toolbar/filter state, container data hook, 3D scene shell, and list/detail panels.
- [ ] Keep 3D canvas rendering and current navigation behavior unchanged.
- [ ] Add smoke tests for opening a container detail modal and switching key panels.
- [ ] Use Browser to inspect `/yard` after frontend changes.

**Acceptance Criteria:**

- Container detail and Yard page become easier to edit without changing UX.
- `/yard` still loads, renders the 3D yard, and opens detail panels.
- Existing tests and lint still pass.

---

## Task 7: Define Offline Operation Policy

**Goal:** Make offline capability explicit so financial/policy actions are not accidentally queued while gate/field operations remain resilient.

**Files:**

- Create `src/lib/offlineOperationPolicy.ts`.
- Update `src/lib/offlineQueue.ts`.
- Update relevant UI in:
  - `src/app/(dashboard)/gate/GateInTab.tsx`
  - `src/app/(dashboard)/gate/GateOutTab.tsx`
  - `src/app/(dashboard)/reefer/page.tsx`
  - yard audit UI if present
- Add `src/lib/__tests__/offlineOperationPolicy.test.ts`.

**Policy Draft:**

Offline queue allowed:

- Gate In submit
- Gate Out release submit
- Gate Out pickup request
- Reefer check capture
- Yard audit/checklist capture

Offline queue blocked:

- Invoice creation
- Payment capture
- Billing clearance approval
- Portal visibility/policy changes
- Customer master changes
- Document template publish/import

**Steps:**

- [ ] Write tests for allowed and blocked operations.
- [ ] Add `canQueueOfflineOperation(operation, context)`.
- [ ] Add structured blocked reasons for UI text.
- [ ] Ensure `offlineFetch` requires an operation type for new usage.
- [ ] Show queued/synced/conflict only for allowed operational workflows.
- [ ] Keep financial and permission-changing actions online-only with clear disabled/error state.

**Acceptance Criteria:**

- Offline behavior is intentional and auditable.
- Billing, payment, and policy-changing actions cannot be queued by accident.
- Gate and Reefer field work still supports offline-first flow where already intended.

---

## Task 8: Add Business Party Resolver

**Goal:** Normalize party relationships before grants, billing, M&R, EDI booking creation, and gate transactions use them.

**Files:**

- Create `src/lib/businessPartyResolver.ts`.
- Add `src/lib/__tests__/businessPartyResolver.test.ts`.
- Refactor incrementally:
  - `src/app/api/mnr/route.ts`
  - `src/app/api/edi/bookings/route.ts`
  - `src/app/api/billing/invoices/route.ts`
  - `src/app/api/billing/gate-check/route.ts`
  - Gate routes only where low-risk

**Proposed API:**

```ts
type BusinessPartyContext = {
  bookingCustomerId?: number | null;
  billToCustomerId?: number | null;
  containerOwnerId?: number | null;
  shippingLineId?: number | null;
  forwarderId?: number | null;
  shipperId?: number | null;
  consigneeId?: number | null;
  truckingCompanyId?: number | null;
  legacyCustomerId?: number | null;
};
```

**Steps:**

- [x] Write tests for legacy `customer_id` mapping to `bookingCustomerId`.
- [x] Write tests for `billing_customer_id || customer_id` becoming `billToCustomerId`.
- [x] Write tests for multi-party customer roles staying separate.
- [x] Implement parsing and validation helpers that reject non-integer party IDs.
- [x] Apply to M&R route first, because it currently uses body party IDs directly.
- [x] Apply to EDI booking creation.
- [ ] Apply to EDI booking update.
- [ ] Apply to billing invoice creation so invoice grants remain bill-to only.
- [x] Keep all SQL parameterized.

**Acceptance Criteria:**

- Business party logic is not duplicated across routes.
- Legacy `customer_id` continues to work backward-compatibly.
- Invalid party IDs are rejected before SQL.
- Billing party remains separate from owner/booking party.

---

## Task 9: Handoff, Verification, And Integration

**Goal:** Keep the implementation auditable and safe to resume.

**Files:**

- `DEVELOPER_HANDOFF.md`
- Plan progress checkboxes in this file

**Steps:**

- [ ] Update `DEVELOPER_HANDOFF.md` with completed tasks, affected files, migration notes, and residual risks.
- [ ] Run focused tests for new helpers and touched routes.
- [ ] Run lint:

```powershell
npm run lint
```

- [ ] Run TypeScript:

```powershell
npx tsc --noEmit --pretty false
```

- [ ] Run full test suite if the focused suite passes:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand
```

- [ ] Use Browser for `/gate` and `/yard` smoke checks if frontend decomposition lands.
- [ ] Commit after each logical task or small group, matching the user’s preferred workflow.
- [ ] Push after each completed topic if requested during execution.

**Acceptance Criteria:**

- Handoff explains what changed and how to continue.
- Tests, lint, and typecheck results are recorded.
- Each commit is scoped to one topic.

---

## Suggested Execution Order

1. Task 1 and Task 2 first, because they reduce request-path schema risk.
2. Task 3 and Task 4 second, because access resolver centralization reduces future leakage risk.
3. Task 8 third if backend policy is the priority, because party resolution affects grants and billing correctness.
4. Task 7 fourth, because offline behavior should be explicit before more field workflows are added.
5. Task 5 and Task 6 last, because they are larger UI maintainability work and easier to verify after backend behavior is stable.

---

## Stop Points

Stop and ask before continuing if:

- A route still needs to support deployments without the latest migration.
- Existing tests encode conflicting behavior around missing optional tables.
- A business party fallback could expose invoice or EIR data to non-billing/non-granted parties.
- UI decomposition reveals mixed user edits in the same files.
