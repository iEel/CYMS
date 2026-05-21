# CYMS Hardening And UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining CYMS security/workflow gaps found in the code audit and add focused operator UX improvements without large unrelated rewrites.

**Architecture:** Add small shared backend guards first, then apply them to high-risk routes before adding workflow features. Each topic is independently testable and committed separately: permission/actor, yard scope, approval gates, portal grant reconciliation, offline outbox, and targeted UX/maintainability.

**Tech Stack:** Next.js App Router route handlers, TypeScript, MS SQL Server via `mssql`, Jest, Tailwind CSS, existing `AuthProvider`, `ToastProvider`, and `offlineQueue`.

---

### Task 1: API Permission And Actor Guard

**Files:**
- Modify: `src/lib/apiAuth.ts`
- Modify: high-risk API routes in `src/app/api`
- Test: `src/app/api/__tests__/api-auth-coverage.test.ts`

- [x] **Step 1: Write failing coverage tests**

Create a static Jest test that fails if high-risk mutation routes still use `body.user_id`, `body.approved_by`, `body.uploaded_by`, or omit an actor guard. Include `billing/clearance`, `billing/invoices`, `gate`, `mnr`, `approval-reviews`, `yard/audit-log`, and `attachments`.

- [x] **Step 2: Run test and verify RED**

Run: `npm test -- src/app/api/__tests__/api-auth-coverage.test.ts --runInBand`

Expected: fail because current routes still accept actor ids from body and lack uniform guards.

- [x] **Step 3: Implement shared helpers**

Add helper functions in `apiAuth.ts`: `requireActor`, `requirePermissionOrRole`, and optional `actorIdOrNull` using proxy headers only.

- [x] **Step 4: Apply to high-risk mutation routes**

Change each route to derive `userId` / `approvedBy` / `uploadedBy` from the authenticated actor. Keep business payload fields from body, but never trust body for the actor.

- [x] **Step 5: Verify GREEN**

Run the targeted static test, then `npm run lint`.

- [x] **Step 6: Update handoff and commit**

Document the P0 actor cleanup in `DEVELOPER_HANDOFF.md`, commit as `Harden API actor attribution`, and push.

### Task 2: Yard Access Guard

**Files:**
- Modify: `src/lib/apiAuth.ts`
- Modify: yard-scoped routes in `src/app/api`
- Test: `src/app/api/__tests__/yard-access-guard.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for `requireYardAccess` behavior: allowed yard returns actor; unauthorized yard returns 403; missing yard returns 400 for routes that require an explicit yard.

- [ ] **Step 2: Implement guard**

Add `requireYardAccess(request, db, yardId)` that checks `UserYardAccess` unless actor is `yard_manager`.

- [ ] **Step 3: Replace unsafe default yard flows**

Remove server-side mutation reliance on `yard_id || 1` from critical routes. Require explicit yard or actor default only after checking the user has access.

- [ ] **Step 4: Verify, document, commit**

Run targeted tests, lint, and update handoff. Commit as `Enforce API yard access`.

### Task 3: Hard Approval Gates

**Files:**
- Modify: `src/lib/approvalReview.ts`
- Modify: `src/app/api/approval-reviews/route.ts`
- Modify: risky routes that currently only soft-log approval reviews
- Test: `src/lib/__tests__/approvalReview.test.ts`

- [ ] **Step 1: Write failing tests**

Test that risky actions create a pending approval request and do not mutate the target entity until approved when policy requires hard approval.

- [ ] **Step 2: Implement approval gate helper**

Add `requireApprovalForAction` returning either `approved`, `pending`, or `forbidden`, with audit-safe response payload.

- [ ] **Step 3: Apply to risky actions**

Apply hard gates to credit note, waive charge, release hold, grade override, and edit paid invoice.

- [ ] **Step 4: Verify, document, commit**

Run targeted tests, lint/build as needed, update handoff, commit `Add hard approval gates`.

### Task 4: Portal Grant Reconciler

**Files:**
- Create: `src/lib/portalGrantReconciler.ts`
- Create/Modify: `src/app/api/portal/grants/reconcile/route.ts` or admin settings route
- Test: `src/lib/__tests__/portalGrantReconciler.test.ts`

- [ ] **Step 1: Write failing tests**

Test missing booking/container/invoice grants and stale inactive grants detection.

- [ ] **Step 2: Implement reconciler**

Build SQL that previews missing/stale grants and can repair them using existing source-of-truth tables.

- [ ] **Step 3: Add admin-only API**

Expose preview and repair actions to yard managers only, with audit logging.

- [ ] **Step 4: Verify, document, commit**

Run tests, lint, update handoff, commit `Add portal grant reconciler`.

### Task 5: Offline Outbox UX

**Files:**
- Modify: `src/lib/offlineQueue.ts`
- Create: `src/components/offline/OfflineOutbox.tsx`
- Modify: layout/topbar or dashboard to expose outbox
- Test: `src/lib/__tests__/offlineQueue.test.ts`

- [ ] **Step 1: Write failing tests**

Test queue listing, retry, conflict status retention, and remove/clear behavior.

- [ ] **Step 2: Extend queue API**

Add exported `retryQueuedRequest`, `markConflict`, and `clearSynced` helpers.

- [ ] **Step 3: Build UI**

Add operator outbox with queued/synced/conflict filters, retry, discard, and conflict details.

- [ ] **Step 4: Verify, document, commit**

Run tests, lint/build, update handoff, commit `Add offline outbox`.

### Task 6: Focused UX And Maintainability

**Files:**
- Modify: gate/billing/yard components only where needed
- Create small hooks/components for repeated status panels
- Test: targeted tests when logic moves to libs

- [ ] **Step 1: Gate sticky decision bar**

Add a sticky action/status bar summarizing billing, booking, inspection/photo completeness, and supervisor state.

- [ ] **Step 2: Billing collector workbench**

Promote AR dunning from copy-only to logged contact attempts and promise-to-pay notes.

- [ ] **Step 3: Yard move recommendation action**

Let move recommendations create a work order directly with prefilled target slot.

- [ ] **Step 4: Portal visibility reason**

Show why a portal item is visible: owner, billing, booking, invoice, or gate grant.

- [ ] **Step 5: Verification and handoff**

Run lint/build/full tests, update `DEVELOPER_HANDOFF.md`, commit `Polish operator workflows`, and push.
