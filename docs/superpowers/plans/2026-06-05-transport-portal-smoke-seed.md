# Transport Portal Smoke Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, idempotent transport portal smoke seed and smoke runner so the Driver/Trucking Portal can be verified end-to-end on a clean or recently cleared dev database without relying on real operational data.

**Architecture:** Add a deterministic smoke fixture module, a preview-first seed script, a transport smoke runner, focused tests, and handoff documentation. The seed creates only clearly named smoke customer/users/container/booking/gate-out request/grants, then the runner logs in as the smoke driver or trucking coordinator and exercises the transport job actions against the real API.

**Tech Stack:** Next.js app router, Node.js scripts, MS SQL via existing DB helpers, Jest, existing auth/session APIs, existing Transport Portal APIs, `DEVELOPER_HANDOFF.md`.

---

## Constraints And Safety Rules

- [ ] The seed must be preview-only by default and require `--confirm` before writing.
- [ ] The seed must never delete or modify real users, passwords, customers, containers, bookings, or gate jobs.
- [ ] The seed may create/update only deterministic smoke records whose usernames/codes/notes use the smoke prefix.
- [ ] The seed must be idempotent. Running it repeatedly should leave one usable smoke scenario.
- [ ] The seed must use parameterized SQL for all DB writes.
- [ ] The seed must not perform runtime DDL. Required schema must come from `scripts/migrate-runtime-core-schema.js`.
- [ ] The smoke users must be explicitly marked as dev/test users in script output and handoff docs.
- [ ] The transport portal scope remains backend and existing Transport Portal UI only. No new Driver/Trucking Portal redesign in this task.

## Task 1: Add Failing Tests For Smoke Seed Safety

**Files**
- `src/app/api/__tests__/transport-smoke-seed-script.test.ts`

**Steps**
- [ ] Create a Jest test file that reads the planned script sources as text.
- [ ] Assert `scripts/transport-smoke-fixture.cjs` exists and exports deterministic smoke constants.
- [ ] Assert `scripts/seed-transport-smoke.js` exists after implementation.
- [ ] Assert the seed script supports preview mode by default and `--confirm` for writes.
- [ ] Assert the seed script does not contain destructive broad statements such as `DELETE FROM Users`, `TRUNCATE TABLE Users`, `DELETE FROM Customers`, or `DELETE FROM Containers`.
- [ ] Assert the smoke constants include:
  - `SMOKE_PREFIX`
  - smoke trucking customer code
  - smoke driver username
  - smoke trucking coordinator username
  - smoke container number
  - smoke booking number

**Verification**
- [ ] Run and confirm the test fails before implementation:
  - `npm test -- --runInBand --runTestsByPath src/app/api/__tests__/transport-smoke-seed-script.test.ts`

**Commit**
- [ ] Commit message: `Add transport smoke seed safety tests`

## Task 2: Add Deterministic Transport Smoke Fixture Module

**Files**
- `scripts/transport-smoke-fixture.cjs`

**Steps**
- [ ] Add `SMOKE_PREFIX = 'SMOKE-TRANSPORT'`.
- [ ] Add smoke customer fixture:
  - code `SMK-TRUCK`
  - name `SMOKE TRANSPORT CO., LTD.`
  - `is_trucking = true`
  - `portal_enabled = true`
- [ ] Add smoke user fixtures:
  - `smoke_transport_trucking` with portal role `trucking_coordinator`
  - `smoke_transport_driver` with portal role `driver_user`
- [ ] Add smoke container fixture:
  - container number `SMKU2026001`
  - status `in_yard`
  - size `20`
  - type `GP`
- [ ] Add smoke booking fixture:
  - booking number `SMOKE-TRANSPORT-BK-001`
  - status `approved`
  - trucking company linked to the smoke trucking customer
- [ ] Add smoke gate-out request fixture:
  - status `requested`
  - driver linked to `smoke_transport_driver`
  - truck plate `SMK-1001`
  - notes starting with `SMOKE-TRANSPORT`
- [ ] Export a `buildPreviewRows()` helper that returns the exact entities the seed will create/update.
- [ ] Export an `isSmokeIdentifier(value)` helper for safety checks.

**Verification**
- [ ] Run:
  - `npm test -- --runInBand --runTestsByPath src/app/api/__tests__/transport-smoke-seed-script.test.ts`

**Commit**
- [ ] Commit message: `Add transport smoke fixture constants`

## Task 3: Implement Preview-First Transport Smoke Seed

**Files**
- `scripts/seed-transport-smoke.js`
- `public/uploads/smoke/transport-proof.jpg`

**Steps**
- [ ] Add CLI options:
  - default preview mode
  - `--confirm`
  - `--reset-smoke-job`
  - `--help`
- [ ] In preview mode, print all entities that would be created or updated and exit without DB writes.
- [ ] On `--confirm`, connect to MS SQL using the existing connection helpers/pattern used by project scripts.
- [ ] Check that required tables exist and print a clear migration instruction if missing:
  - `Users`
  - `Customers`
  - `Containers`
  - `Bookings`
  - `BookingContainers`
  - `GateOutRequests`
  - `PortalEntityAccess`
  - `TransportJobActivities`
  - `TransportJobProofs`
- [ ] Ensure the customer role exists and use it for smoke portal users.
- [ ] Upsert the smoke trucking customer by customer code only.
- [ ] Upsert the smoke trucking coordinator user by username only.
- [ ] Upsert the smoke driver user by username only.
- [ ] Set known passwords only for these smoke usernames.
- [ ] Upsert the smoke container by exact container number.
- [ ] Upsert the smoke booking by exact booking number.
- [ ] Upsert the booking-container link.
- [ ] Upsert one smoke gate-out request tied to:
  - smoke container
  - smoke booking
  - smoke trucking customer
  - smoke driver user
- [ ] Create or refresh active `PortalEntityAccess` grants for:
  - booking role `trucking`
  - container role `trucking`
  - gate-out request role `trucking`
- [ ] If `--reset-smoke-job` is passed, reset only the smoke gate-out request and smoke transport activity/proof rows.
- [ ] Create a tiny smoke proof file at `public/uploads/smoke/transport-proof.jpg` if it does not exist.
- [ ] Print credentials, transport URL, and seeded job id.

**Verification**
- [ ] Run preview:
  - `node scripts/seed-transport-smoke.js`
- [ ] Run confirmed seed on local dev DB:
  - `node scripts/seed-transport-smoke.js --confirm --reset-smoke-job`
- [ ] Run the focused seed tests.

**Commit**
- [ ] Commit message: `Add transport portal smoke seed script`

## Task 4: Add Transport Portal Smoke Runner

**Files**
- `scripts/e2e-transport-smoke.mjs`
- `package.json`
- `src/app/api/__tests__/transport-smoke-runner.test.ts`

**Steps**
- [ ] Add a Node smoke runner using `fetch`.
- [ ] Read base URL from `CYMS_E2E_BASE_URL`, defaulting to `http://localhost:3005`.
- [ ] Read smoke usernames/passwords from the fixture module or environment variables.
- [ ] Log in as the smoke driver through `/api/auth/login`.
- [ ] Preserve the session cookie for subsequent requests.
- [ ] Call `/api/auth/me` and verify the user is a customer portal actor.
- [ ] Call `/api/transport/capabilities` and verify transport actions are enabled.
- [ ] Call `/api/transport/jobs` and find the seeded `request-<id>` job.
- [ ] Submit `confirm_job` through `/api/transport/actions`.
- [ ] Submit `add_proof` with `/uploads/smoke/transport-proof.jpg`.
- [ ] Submit `report_issue` with a smoke note.
- [ ] Submit `mark_arrived`.
- [ ] Call the transport activity/proof endpoint and assert the job recorded the actions.
- [ ] Add package scripts:
  - `seed:transport-smoke`
  - `test:e2e:transport`
- [ ] Add Jest tests that validate the smoke runner exists, targets only transport APIs, and package scripts are present.

**Verification**
- [ ] Run:
  - `npm test -- --runInBand --runTestsByPath src/app/api/__tests__/transport-smoke-runner.test.ts`
- [ ] With dev server running and seed applied, run:
  - `npm run test:e2e:transport`

**Commit**
- [ ] Commit message: `Add transport portal smoke runner`

## Task 5: Browser Smoke Checklist And Handoff Docs

**Files**
- `DEVELOPER_HANDOFF.md`

**Steps**
- [ ] Add a dated handoff entry for Transport Portal Smoke Seed.
- [ ] Document required setup:
  - `node scripts/migrate-runtime-core-schema.js`
  - `node scripts/seed-transport-smoke.js --confirm --reset-smoke-job`
  - `npm run test:e2e:transport`
- [ ] Document manual Browser smoke:
  - log in as `smoke_transport_driver`
  - open `/transport`
  - verify seeded container/job card appears
  - confirm job
  - add proof
  - report issue
  - mark arrived
- [ ] Document that smoke users and records are dev/test data only.
- [ ] Document that the seed does not create invoices, release containers, or issue EIR.
- [ ] Document cleanup:
  - use the existing business-data clear script when a full dev reset is needed
  - otherwise rerun seed with `--reset-smoke-job`

**Verification**
- [ ] Review `DEVELOPER_HANDOFF.md` for exact commands and no stale branch notes.

**Commit**
- [ ] Commit message: `Document transport portal smoke seed workflow`

## Task 6: Full Verification And Final Integration

**Commands**
- [ ] Focused Jest:
  - `npm test -- --runInBand --runTestsByPath src/app/api/__tests__/transport-smoke-seed-script.test.ts src/app/api/__tests__/transport-smoke-runner.test.ts`
- [ ] Transport-related Jest suites:
  - `npm test -- --runInBand --testPathPattern=transport`
- [ ] Lint:
  - `npm run lint`
- [ ] Build:
  - `npm run build`
- [ ] Local DB migration:
  - `node scripts/migrate-runtime-core-schema.js`
- [ ] Local smoke seed:
  - `node scripts/seed-transport-smoke.js --confirm --reset-smoke-job`
- [ ] Local smoke runner:
  - `npm run test:e2e:transport`
- [ ] Browser smoke with in-app browser:
  - `/login`
  - `/transport`
  - action flow for the seeded job

**Final Commit / Push**
- [ ] Commit any remaining docs or verification fixes.
- [ ] Push the current feature branch.
- [ ] If requested, merge into `master` or `main` after verification.

## Self-Review Checklist

- [ ] The plan creates usable test data even when the operational DB is empty after business-data cleanup.
- [ ] The seed is intentionally narrow and cannot wipe real business data.
- [ ] The smoke validates real transport auth, permissions, job listing, actions, activity, and proof behavior.
- [ ] The plan keeps Driver/Trucking Portal UI expansion out of scope.
- [ ] The plan updates handoff documentation with exact commands.
- [ ] The plan includes tests before implementation.
