# Driver / Trucking Portal UI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan.

**Goal:** Add a transport-facing portal MVP where trucking coordinators and assigned drivers can view only their own operational jobs and sanitized EIR data.

**Architecture:** Reuse the existing auth, `Users.customer_id`, customer portal roles, `PortalEntityAccess`, gate transaction fields, and `eirVisibility.ts`. Add a separate `/transport` portal shell and transport APIs instead of overloading `/portal`. Trucking access is company-scoped through `customer_id` plus trucking grants/relationships. Driver access is user-scoped through `GateTransactions.driver_user_id` and `GateOutRequests.driver_user_id`.

**Tech Stack:** Next.js App Router, React, TypeScript, MS SQL Server, existing auth/proxy headers, `customerPortalPermissions.ts`, `PortalEntityAccess`, Jest, ESLint, `tsc`.

## Current Context

The backend policy already has several pieces required for this phase:

- `customerPortalPermissions.ts` already defines `trucking_coordinator`, `driver_user`, `portal.trucking.view`, and `portal.driver.view`.
- `GateTransactions` already has `trucking_company_id` and `driver_user_id`.
- `eirVisibility.ts` already supports `trucking` and `driver` view types.
- `PortalEntityAccess` supports trucking/driver-style roles in grant generation.

Important gaps to close:

- `/api/auth/me` and the login client do not currently expose/use `customer_portal_role`, so transport users cannot be routed cleanly.
- `/portal` is customer-portal oriented and should not become a mixed customer/trucking/driver UX.
- Gate staff UI currently does not reliably assign a real `driver_user_id`, so a driver portal cannot be exact without adding an assignment path.
- `GateOutRequests` needs transport assignment fields so pickup requests can appear before final gate/EIR completion.
- Driver visibility must not rely only on `PortalEntityAccess.customer_id`; driver is a user-level relationship.

## Decisions

1. Add a separate `/transport` portal.
   - `trucking_coordinator` lands on `/transport`.
   - `driver_user` lands on `/transport`.
   - Normal customer users still land on `/portal`.

2. Keep Customer Portal and Transport Portal separate in UI.
   - Customer Portal: containers, bookings, invoices, reefer, customer EIR.
   - Transport Portal: pickup/release jobs, assigned driver jobs, sanitized EIR Driver/Trucking Copy.

3. Use fixed server-side policy.
   - No configurable transport policy UI in this MVP.
   - No `customer_id` from query/body for visibility.

4. Driver access is user-specific.
   - Driver sees only jobs where `driver_user_id = session.userId`.
   - Driver does not see billing, invoices, inventory lists, internal notes, or jobs for other drivers.

5. Trucking access is company-specific.
   - Trucking coordinator sees jobs where the session customer is the trucking company through booking/gate/request relationship or active trucking grant.
   - Trucking coordinator does not see invoice/billing/internal notes.

## File Map

Likely files to add:

- `src/lib/portalRouting.ts`
- `src/lib/transportPortalAccess.ts`
- `src/app/(transport)/layout.tsx`
- `src/app/(transport)/transport/page.tsx`
- `src/app/(transport)/transport/jobs/[id]/page.tsx`
- `src/app/api/transport/capabilities/route.ts`
- `src/app/api/transport/jobs/route.ts`
- `src/app/api/transport/eir/route.ts`
- `src/app/api/settings/customers/drivers/route.ts`
- `src/components/transport/TransportDashboard.tsx`
- `src/components/transport/TransportJobCard.tsx`
- `src/components/transport/TransportJobDetail.tsx`
- `src/components/transport/TransportEirModal.tsx`
- `src/components/transport/TransportStatusPills.tsx`

Likely files to update:

- `src/app/login/page.tsx`
- `src/app/api/auth/me/route.ts`
- `src/types/*` or wherever `AuthSession` is defined
- `src/lib/customerPortalPermissions.ts`
- `src/lib/schema.sql`
- `scripts/migrate-runtime-core-schema.js`
- `src/app/api/gate/route.ts`
- `src/app/api/gate/out-requests/route.ts`
- `src/app/(dashboard)/gate/GateInTab.tsx`
- `src/app/(dashboard)/gate/GateOutTab.tsx`
- `src/app/(dashboard)/gate/GateInDriverSection.tsx`
- `src/app/(dashboard)/gate/GateOutReleaseRequestSection.tsx`
- `DEVELOPER_HANDOFF.md`

Likely tests to add/update:

- `src/lib/__tests__/portalRouting.test.ts`
- `src/lib/__tests__/transportPortalAccess.test.ts`
- `src/app/api/__tests__/auth-me-customer-portal-role.test.ts`
- `src/app/api/__tests__/transport-jobs.test.ts`
- `src/app/api/__tests__/transport-eir.test.ts`
- `src/app/api/__tests__/gate-out-requests-transport-assignment.test.ts`
- `src/app/api/__tests__/gate-in-party-grants.test.ts`
- `src/app/api/__tests__/gate-out-party-grants.test.ts`
- `src/components/__tests__/transport-portal-ui.test.tsx` or static tests matching current project style

## Task 1: Expose Customer Portal Role In Session

### Tests First

Add or update tests proving:

- `/api/auth/me` returns `customerPortalRole`.
- A normal customer role routes to `/portal`.
- `trucking_coordinator` routes to `/transport`.
- `driver_user` routes to `/transport`.
- Internal roles still route to `/dashboard`.

### Implementation

1. Add `src/lib/portalRouting.ts`.
2. Add a helper:

```ts
export function getDefaultPostLoginPath(session: {
  role?: string | null;
  customerPortalRole?: string | null;
}) {
  if (session.role === 'customer') {
    if (
      session.customerPortalRole === 'trucking_coordinator' ||
      session.customerPortalRole === 'driver_user'
    ) {
      return '/transport';
    }
    return '/portal';
  }
  return '/dashboard';
}
```

3. Update `/api/auth/me` to select and return `customer_portal_role`.
4. Update login redirect logic to use the helper.
5. Update the auth session type.

## Task 2: Add Transport Portal Access Helper

### Tests First

Add helper tests proving:

- Driver user with `portal.driver.view` is accepted.
- Driver user without permission is rejected.
- Trucking coordinator with `portal.trucking.view` is accepted.
- Normal customer user is rejected from transport portal.
- Internal staff cannot call transport customer APIs unless explicitly supported by a future admin impersonation flow.

### Implementation

Create `src/lib/transportPortalAccess.ts` with:

- `requireTransportPortalActor(request, db, action)`
- `buildTransportJobWhereClause(actor)` or query helper functions
- `isDriverActor(actor)`
- `isTruckingActor(actor)`

Actor shape:

```ts
type TransportPortalActor = {
  userId: number;
  customerId: number;
  customerPortalRole: 'trucking_coordinator' | 'driver_user';
  mode: 'trucking' | 'driver';
};
```

Policy:

- `driver_user`: requires `portal.driver.view`, job predicate must include `driver_user_id = @sessionUserId`.
- `trucking_coordinator`: requires `portal.trucking.view`, job predicate may use `trucking_company_id = @sessionCustomerId`, booking trucking company, or active `PortalEntityAccess` with `access_role = 'trucking'`.
- No policy should trust `customer_id` from query/body.

## Task 3: Extend GateOutRequests For Transport Assignment

### Tests First

Add tests proving:

- `GateOutRequests` migration includes `trucking_company_id`.
- `GateOutRequests` migration includes `driver_user_id`.
- Gate-out request create/update stores both fields when provided.
- Existing requests without those fields still work.

### Implementation

1. Update `src/lib/schema.sql`.
2. Update `scripts/migrate-runtime-core-schema.js`.
3. Add columns:

```sql
trucking_company_id INT NULL,
driver_user_id INT NULL
```

4. Add a narrow transport lookup index if compatible with current migration style:

```sql
IX_GateOutRequests_Transport
```

5. Backfill `trucking_company_id` from `Bookings.trucking_company_id` where possible.
6. Update `src/app/api/gate/out-requests/route.ts` to read/write these fields.

## Task 4: Add Staff-Side Driver Assignment

### Tests First

Add tests proving:

- Driver lookup only returns active customer users for the selected trucking company.
- Driver lookup only returns users with `customer_portal_role = 'driver_user'`.
- Gate In submit can carry `driver_user_id`.
- Gate Out request and Gate Out submit can carry `driver_user_id`.

### Implementation

1. Add `src/app/api/settings/customers/drivers/route.ts`.
2. Query active users:

```sql
SELECT user_id, full_name, username, customer_id
FROM Users
WHERE customer_id = @truckingCompanyId
  AND role = 'customer'
  AND customer_portal_role = 'driver_user'
  AND is_active = 1
```

3. Add optional driver portal user selector to Gate In driver/truck section.
4. Add optional driver portal user selector to Gate Out release/request section.
5. Submit selected `driver_user_id` into gate transaction and gate-out request flows.
6. Keep field optional so yards can still operate when the actual driver portal account is not created yet.

## Task 5: Add Transport Jobs API

### Tests First

Add route tests proving:

- Trucking coordinator sees only company jobs.
- Driver sees only jobs assigned to their `user_id`.
- Driver cannot see another driver job under the same trucking company.
- Transport API never returns invoice amount, billing clearance, internal notes, credit hold reason, or unrelated customer inventory.
- Jobs include enough operational fields for mobile work: container number, booking number, request status, gate status, yard location, truck plate, driver name, requested time, and EIR availability.

### Implementation

Create `src/app/api/transport/jobs/route.ts`.

Return a compact payload:

```ts
{
  summary: {
    open: number;
    atGate: number;
    releasedToday: number;
    attention: number;
  };
  jobs: Array<{
    jobId: string;
    source: 'gate_out_request' | 'gate_transaction';
    status: string;
    containerNumber: string;
    bookingNumber?: string;
    transactionType?: 'gate_in' | 'gate_out';
    yardName?: string;
    yardSlot?: string;
    requestedAt?: string;
    gateDatetime?: string;
    driverName?: string;
    truckPlate?: string;
    eirNumber?: string;
    attentionReason?: string;
  }>;
}
```

Use parameterized SQL only.

## Task 6: Add Transport EIR API

### Tests First

Add tests proving:

- Driver EIR uses `driver` view type from `eirVisibility.ts`.
- Trucking EIR uses `trucking` view type.
- Driver cannot open EIR for another driver.
- Trucking company cannot open EIR for another trucking company.
- Response hides invoices, billing, internal note, full customer-sensitive fields, and container grade.
- EIR access log is written for view/download actions.

### Implementation

Create `src/app/api/transport/eir/route.ts`.

Behavior:

- Accept `eir_number` or `gate_transaction_id`.
- Resolve actor with `requireTransportPortalActor`.
- Fetch master EIR payload through the same existing EIR payload helper used by gate/portal routes.
- Apply:
  - `viewType = 'driver'` for driver users
  - `viewType = 'trucking'` for trucking coordinators
- Call `buildEirViewPayload()`.
- Call existing EIR access log helper.

## Task 7: Build Transport Portal UI

### Tests First

Add UI/static tests proving:

- `/transport` exists.
- Transport layout does not show customer invoice/container inventory nav.
- Driver copy text and job card labels are present.
- No billing labels appear in transport page source.

### Implementation

1. Add `src/app/(transport)/layout.tsx`.
   - Requires logged-in customer session.
   - Requires `customerPortalRole` of `trucking_coordinator` or `driver_user`.
   - Redirect normal customers to `/portal`.
   - Redirect internal roles to `/dashboard`.

2. Add `src/app/(transport)/transport/page.tsx`.

3. Add transport components:
   - `TransportDashboard`
   - `TransportJobCard`
   - `TransportJobDetail`
   - `TransportEirModal`
   - `TransportStatusPills`

4. UX shape:
   - Mobile-first list.
   - Top summary: today/open/attention/done.
   - Filters: all, open, at gate, completed, attention.
   - Job card: container, booking, yard/location, status, truck/driver, primary action.
   - Detail drawer/page: operational data, timeline, EIR button.

5. Driver mode:
   - Header: "งานของฉัน"
   - No company-wide inventory.
   - Show only assigned jobs.

6. Trucking mode:
   - Header: "งานขนส่ง"
   - Show jobs for company.
   - Show driver/truck context when available.

## Task 8: Add Transport Capabilities

### Tests First

Add tests proving:

- Driver gets `{ transport: { enabled: true, mode: 'driver' } }`.
- Trucking coordinator gets `{ transport: { enabled: true, mode: 'trucking' } }`.
- Normal customer gets disabled/403.

### Implementation

Add `src/app/api/transport/capabilities/route.ts`.

Keep this separate from `/api/portal/capabilities` to avoid making the existing Customer Portal navigation confusing.

## Task 9: Gate And Grant Rule Hardening

### Tests First

Add/update tests proving:

- Gate In with trucking company creates trucking grants.
- Gate In with driver user creates driver EIR/job access without leaking through customer inventory.
- Gate Out with trucking company creates trucking grants.
- Gate Out with driver user creates driver EIR/job access without leaking through customer inventory.
- Invoice grant remains bill-to only.

### Implementation

1. Review `portalGrantRules.ts` and gate route grant calls.
2. Keep existing `PortalEntityAccess` grants for trucking company.
3. Treat driver access as user-specific in transport APIs even if a legacy PEA driver grant exists.
4. Avoid expanding invoice access to trucking/driver.

## Task 10: Handoff And Verification

### Documentation

Update `DEVELOPER_HANDOFF.md` with:

- Transport Portal MVP routes.
- Driver/trucking security model.
- New schema fields and migration.
- Known limitations.
- Next phase recommendations.

### Verification Commands

Run focused tests first:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand src/lib/__tests__/portalRouting.test.ts
npm test -- --cacheDirectory .tmp\jest --runInBand src/lib/__tests__/transportPortalAccess.test.ts
npm test -- --cacheDirectory .tmp\jest --runInBand src/app/api/__tests__/transport-jobs.test.ts
npm test -- --cacheDirectory .tmp\jest --runInBand src/app/api/__tests__/transport-eir.test.ts
```

Run full verification before completion:

```powershell
npx tsc --noEmit
npm run lint
npm test -- --cacheDirectory .tmp\jest --runInBand
```

Optional browser smoke if dev server is available:

- Login as `trucking_coordinator`, confirm redirect to `/transport`.
- Login as `driver_user`, confirm redirect to `/transport`.
- Confirm `/transport` does not show billing/invoice navigation.
- Open an EIR from transport and verify Driver/Trucking copy is sanitized.

## Acceptance Criteria

1. `trucking_coordinator` and `driver_user` can reach `/transport`.
2. Normal customer portal users still reach `/portal`.
3. Internal staff still reach `/dashboard`.
4. Transport Portal UI is separate from Customer Portal UI.
5. Trucking coordinator sees only jobs linked to their trucking company.
6. Driver sees only jobs assigned to their own `Users.user_id`.
7. Driver cannot see another driver's job under the same trucking company.
8. Transport APIs do not accept `customer_id` from query/body for visibility.
9. Transport APIs do not return invoice amount, billing clearance, internal note, credit hold reason, or unrelated customer inventory.
10. Transport EIR uses `eirVisibility.ts`.
11. Driver EIR hides container grade, billing, internal notes, signatures not allowed by policy, and sensitive customer fields.
12. Trucking EIR hides invoice/billing/internal notes and container grade.
13. EIR access log is written for transport EIR view/download.
14. Gate In can optionally assign a driver portal user.
15. Gate Out request and Gate Out release can optionally assign a driver portal user.
16. `GateOutRequests` can store trucking and driver assignment.
17. Existing Customer Portal, Gate In, Gate Out, and EIR flows remain backward compatible.
18. `DEVELOPER_HANDOFF.md` is updated.
19. `tsc`, lint, and full Jest pass.

## Out Of Scope For This MVP

- Driver self check-in or QR pass creation.
- Driver document upload/photo capture.
- Trucking company user administration UI.
- Map navigation or live GPS.
- Public driver portal without login.
- Configurable transport visibility policy UI.
- Invoice/payment visibility for trucking/driver.
- Full mobile PWA offline queue for transport actions.

## Suggested Execution Order

1. Session/routing foundation.
2. Transport access helper.
3. GateOutRequests schema and API persistence.
4. Gate staff driver assignment UI/API.
5. Transport jobs API.
6. Transport EIR API.
7. Transport Portal UI.
8. Capabilities route and login polish.
9. Handoff and full verification.

