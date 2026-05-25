# CYMS Portal Access And EIR Visibility Design

## Goal

Harden CYMS customer-facing data visibility so every Container, Booking, Gate Transaction, EIR, Invoice, Statement, Document Bundle, Reefer Check, and Reefer Exception is shown only through explicit server-side grants and policy. The first implementation round focuses on backend policy, grant creation, public EIR leak prevention, and tests. Driver/Trucking UI and configurable policy UI are out of scope for this round.

## Current Repo Findings

The system already has the right foundation:

- `src/lib/portalEntityAccess.ts` inserts explicit `PortalEntityAccess` grants.
- `src/lib/portalAccess.ts` builds grant-based SQL for `container`, `booking`, `gate_transaction`, and `invoice`.
- `src/lib/portalGrantReconciler.ts` previews and repairs missing/stale grants from Bookings, BookingContainers, Containers, GateTransactions, and Invoices.
- Portal routes already use `x-customer-id` from proxy/session instead of accepting `customer_id` from query/body for visibility.
- `src/lib/eirPayload.ts` is the shared EIR master payload builder.
- `src/app/api/portal/eir/route.ts` and `src/app/api/portal/eir-pdf/route.ts` already check `PortalEntityAccess`.

Main gaps:

- `PortalEntityAccess` lacks `permission_scope`, `valid_from`, and `valid_until`.
- `PortalEntityType` is limited to `booking`, `container`, `gate_transaction`, and `invoice`.
- Customer users currently share one broad `customer` role; there is no customer-side action permission layer.
- `/eir/[id]` calls `/api/gate/eir`, and `proxy.ts` treats `/api/gate/eir` as public. That endpoint returns a full internal-style payload, so public QR can expose driver, truck, photos, damage detail, and other sensitive data.
- EIR JSON/PDF routes do not yet pass through a central field visibility helper.
- EIR view/download/print/public verification is not logged to a dedicated `EIRAccessLog`.

## Non-Goals For Round One

- No Driver Portal UI.
- No Trucking Portal UI.
- No configurable admin policy UI.
- No broad component redesign.
- No duplicate EIR records with divergent business data.

## Architecture

Round one introduces two explicit policy layers:

1. `PortalEntityAccess` remains the source of truth for whether a customer can see a specific entity.
2. `eirVisibility.ts` becomes the source of truth for which fields are visible for each EIR view type.

Business tables continue to describe business relationships. Grants describe actual portal visibility. Customer user permissions decide whether the logged-in user can perform the requested action.

Every customer-facing read must pass both checks:

- The session customer has an active, valid grant for the entity.
- The customer user has the action permission, such as `portal.eir.view` or `portal.invoice.download`.

Public EIR verification bypasses customer grants but is limited to the minimal public verification payload.

## Data Model Changes

### PortalEntityAccess

Extend the existing table backward compatibly:

- `permission_scope NVARCHAR(MAX) NULL`
- `valid_from DATETIME2 NULL`
- `valid_until DATETIME2 NULL`
- `updated_at DATETIME2 NULL`

Existing rows remain active and valid. If `permission_scope` is null, helpers apply the default scope for the `access_role`.

Example scope:

```json
{
  "view": true,
  "download": true,
  "dispute": false,
  "billing": false,
  "eir": {
    "fields": {
      "container_grade": false,
      "damage_summary": true,
      "damage_photos": true
    }
  },
  "maskSensitiveFields": true
}
```

Extend entity usage to include:

- `eir`
- `statement`
- `document_bundle`
- `reefer_check`
- `reefer_exception`

### EIRAccessLog

Create a dedicated table:

- `access_id BIGINT IDENTITY PRIMARY KEY`
- `eir_number NVARCHAR(80) NOT NULL`
- `gate_transaction_id INT NULL`
- `user_id INT NULL`
- `customer_id INT NULL`
- `view_type NVARCHAR(40) NOT NULL`
- `action NVARCHAR(30) NOT NULL`
- `ip_address NVARCHAR(100) NULL`
- `user_agent NVARCHAR(500) NULL`
- `accessed_at DATETIME2 NOT NULL DEFAULT GETDATE()`

Actions:

- `view`
- `download`
- `print`
- `public_verify`

### Customer Portal User Permissions

Use existing `Users.customer_id` as the customer binding. Add a lightweight role field:

- `Users.customer_portal_role NVARCHAR(40) NULL`

Default existing customer users to `customer_admin`.

Supported customer portal roles:

- `customer_admin`
- `operations_user`
- `booking_user`
- `billing_user`
- `document_user`
- `trucking_coordinator`
- `driver_user`
- `read_only_viewer`

Supported actions:

- `portal.container.view`
- `portal.booking.view`
- `portal.booking.create`
- `portal.document.download`
- `portal.invoice.view`
- `portal.invoice.download`
- `portal.dispute.create`
- `portal.eir.view`
- `portal.eir.download`
- `portal.eir.grade.view`
- `portal.trucking.view`
- `portal.driver.view`

The first implementation should use a fixed role-to-action map in code. A configurable policy UI is a later phase.

### Booking Multi-Party Fields

Add optional fields while keeping `Bookings.customer_id` as backward-compatible `booking_customer`:

- `booking_customer_id`
- `shipping_line_id`
- `forwarder_id`
- `shipper_id`
- `consignee_id`
- `trucking_company_id`
- `bill_to_customer_id`
- `created_by_customer_user_id`

Existing logic continues to work when only `customer_id` exists.

### Gate Transaction Driver/Trucking Fields

Add optional fields if missing:

- `GateTransactions.trucking_company_id`
- `GateTransactions.driver_user_id`

Use these only for backend grants and policy in round one.

## EIR Visibility Policy

Create `src/lib/eirVisibility.ts`.

Core functions:

- `resolveEirViewType(actor, eir, accessGrant)`
- `buildEirViewPayload(masterPayload, options)`
- `canViewContainerGrade(context)`
- `maskTruckPlate(value)`
- `maskPhone(value)`
- `maskPersonName(value)`
- `copyTypeLabel(viewType)`

View types:

- `internal`
- `customer`
- `shipping_line`
- `booking_customer`
- `billing`
- `trucking`
- `driver`
- `public`
- `auditor`

Public view must include only:

- `eir_number`
- `container_number`
- `transaction_type`
- `gate_datetime`
- `yard_name` / depot
- `document_status`
- `container_condition`
- `damage_summary`
- `version_no` when available

Public view must hide:

- `container_grade`
- `driver_name`
- `driver_phone`
- full `truck_plate`
- signatures
- damage photos
- full damage detail
- invoice/billing/clearance
- internal notes
- customer sensitive data
- audit log

Customer view must be grant-based and omit internal/billing-sensitive fields unless both grant scope and customer role allow the action.

Container grade visibility is field-level:

- The EIR master payload keeps `container_grade` and `container_grade_label`.
- Public EIR never shows `container_grade`.
- Driver and trucking views never show `container_grade`.
- Internal, Surveyor, Yard Manager, Supervisor, and Auditor views can show `container_grade` according to internal RBAC.
- Customer Portal hides `container_grade` by default.
- Customer Portal shows `container_grade` only when both conditions are true:
  - The customer user has action `portal.eir.grade.view`.
  - The active `PortalEntityAccess.permission_scope` allows `eir.fields.container_grade = true`.
- PDF/print must use the same sanitized payload as JSON. A grade hidden in JSON must also be hidden in PDF/print.

Internal view can include the full master payload, still respecting internal RBAC for billing fields where routes already enforce permissions.

Driver/trucking views are backend-only in this phase. Driver grants are scoped to their own gate job/EIR only. Trucking grants are scoped to assigned booking/job only and can expire with `valid_until`.

Admin grade visibility toggle is allowed only as a field-level grant update, not a general policy UI. If implemented in Customer Master, the label is `แสดงเกรดตู้ใน EIR ให้ลูกค้า`. Every enable/disable must write an audit log event with customer, entity scope, old value, new value, actor, and reason when supplied.

## Route Policy

### `/api/gate/eir`

Change from public to internal-only:

- Remove it from `PUBLIC_API_PATHS` in `proxy.ts`.
- Require authenticated actor.
- Require internal EIR/Gate permission.
- Build master payload through `eirPayload.ts`.
- Return `buildEirViewPayload(..., viewType: 'internal')`.
- Log `EIRAccessLog` action `view`.

### Public EIR Endpoint

Add `GET /api/public/eir?eir_number=...` or `GET /api/eir/public?eir_number=...`.

- Keep this endpoint public.
- Query only by `eir_number`.
- Build master payload.
- Return `buildEirViewPayload(..., viewType: 'public')`.
- Log `EIRAccessLog` action `public_verify`.

### `/eir/[id]`

Update the page to call the public endpoint only.

- Do not call `/api/gate/eir`.
- Render only sanitized public fields.
- Do not render photo gallery, damage detail, driver/truck identity, signatures, or billing data.

### `/api/portal/eir`

- Continue to require `PortalEntityAccess`.
- Require customer action `portal.eir.view`.
- Resolve view type from grant role, such as `shipping_line`, `booking_customer`, `billing`, `trucking`, or `customer`.
- Return sanitized payload.
- Log action `view`.

### `/api/portal/eir-pdf`

- Continue to require `PortalEntityAccess`.
- Require `portal.eir.download`.
- Generate PDF from sanitized customer payload.
- Add copy label, normally `Customer Copy`.
- Do not include `container_grade` unless the same request would see it in `/api/portal/eir`.
- Log action `download`.

### EIR PDF/Print

Extend `generateEIRPDF` data with:

- `copy_type_label`
- `document_status`
- `version_no`
- optional `container_grade` and `container_grade_label` from sanitized payload only

Labels:

- `Internal Copy`
- `Customer Copy`
- `Driver Copy`
- `Public Verification Copy`

## Portal Grant Creation Rules

### Booking Create/Update

Use `Bookings.customer_id` as `booking_customer` for existing flows.

When optional multi-party fields exist, create grants:

- `shipping_line_id` -> `booking`, role `shipping_line`
- `booking_customer_id` or `customer_id` -> `booking`, role `booking_customer`
- `forwarder_id` -> `booking`, role `forwarder`
- `shipper_id` -> `booking`, role `shipper`
- `consignee_id` -> `booking`, role `consignee`
- `trucking_company_id` -> `booking`, role `trucking`, limited operation scope
- `bill_to_customer_id` -> later invoice grants only, unless booking visibility is explicitly needed

### BookingContainers

Propagate booking grants to the linked container:

- Shipping line/owner/customer parties get container grants.
- Trucking grants receive a limited scope and optional `valid_until`.

### GateTransactions

Create grants for:

- `gate_transaction`
- `eir`
- `container`

Grant parties:

- `container_owner_id` -> `owner` or `shipping_line`
- booking customer from linked booking -> `booking_customer`
- `billing_customer_id` -> `billing` on gate/EIR only, invoice access remains invoice-specific
- `trucking_company_id` -> `trucking`, limited and expiring
- `driver_user_id` -> `driver`, limited to the gate job/EIR

### Invoices

Create invoice grants only for invoice customer / bill-to party.

No automatic invoice visibility for users who only have container or booking grants.

### Reefer

Create `reefer_check` and `reefer_exception` grants from existing container/booking visibility, using the same role-based default scope as the source grant and keeping `container_grade` hidden unless the source grant already allows it.

## Reconciler

Extend `src/lib/portalGrantReconciler.ts`:

- Include expected grants for new entity types and multi-party booking fields.
- Include `permission_scope`, `valid_from`, and `valid_until`.
- Preview missing/stale grants.
- Repair missing grants.
- Deactivate stale grants only for managed source tables.
- Log audit event for repair.
- Restrict API to `yard_manager`.

## Test Strategy

Add tests before implementation for:

- Public EIR does not include driver name, phone, full truck plate, signatures, photos, invoice, billing, or full damage detail.
- `/api/gate/eir` is no longer public.
- `/eir/[id]` fetches the public sanitized endpoint.
- Customer A cannot open customer B EIR/data.
- Customer EIR must pass `PortalEntityAccess`.
- Billing user can view/download invoice.
- Operations user cannot view/download invoice.
- Trucking grant sees only related job/EIR.
- Driver grant sees only their own job/EIR.
- PDF uses the same sanitized payload policy as JSON.
- Public EIR does not include `container_grade`.
- Customer Portal default EIR does not include `container_grade`.
- Customer user with `portal.eir.grade.view` but no `permission_scope.eir.fields.container_grade` still cannot see `container_grade`.
- Customer user with both `portal.eir.grade.view` and `permission_scope.eir.fields.container_grade = true` can see `container_grade`.
- Internal EIR can include `container_grade`.
- Trucking and driver EIR views do not include `container_grade`.
- Portal EIR PDF does not include `container_grade` without full permission.
- Portal EIR PDF includes `container_grade` when both user permission and grant field scope allow it.
- EIRAccessLog is written for view/download/print/public_verify.
- Reconcile preview/repair handles missing/stale grants and audit log.

Full verification for completion:

- `npm test -- --runInBand --cacheDirectory ./.next/jest-cache`
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- Run `node scripts/migrate-runtime-core-schema.js`

## Implementation Order

### P0: Public EIR Leak Prevention

1. Add failing tests for public EIR masking and `/api/gate/eir` internal-only behavior.
2. Add `eirVisibility.ts`.
3. Add public EIR endpoint.
4. Remove `/api/gate/eir` from public API paths.
5. Update `/eir/[id]` to call the public endpoint.

### P1: EIR Access Logging And PDF Policy

1. Add `EIRAccessLog` migration.
2. Add `logEirAccess`.
3. Route `/api/gate/eir`, `/api/portal/eir`, and `/api/portal/eir-pdf` through `eirVisibility.ts`.
4. Add PDF copy labels.

### P2: Portal Grant And User Action Policy

1. Extend `PortalEntityAccess` schema/helper.
2. Add customer portal role field and fixed role/action map.
3. Add `portal.eir.grade.view`.
4. Add `requirePortalAction`.
5. Add field-scope support for `permission_scope.eir.fields.container_grade`.
6. Apply to portal EIR, invoice, document bundle, dispute, booking create, and download routes.

### P3: Write-Time Grants

1. Add optional booking multi-party fields.
2. Extend booking grant creation.
3. Extend BookingContainers propagation.
4. Extend GateTransactions grants for `eir`, trucking, and driver.
5. Keep invoice grants bill-to only.
6. Add reefer check/exception grants.

### P4: Reconcile And Completion

1. Extend `portalGrantReconciler.ts`.
2. Add leak-prevention and role/action tests.
3. Run full verification.
4. Update `DEVELOPER_HANDOFF.md`.

## Risks And Guardrails

- Public QR must be minimal by default.
- Customer portal remains default deny.
- SQL must stay parameterized.
- No runtime DDL in routes.
- Existing grants remain valid after migration.
- Null `permission_scope` must map to safe defaults.
- Null `permission_scope` must not expose `container_grade` to Customer Portal.
- Driver/trucking grants are backend-only until UI is built.
- Invoice visibility must never be inferred from container visibility.
- UI and PDF must never decide grade visibility themselves; they consume sanitized backend payloads only.
