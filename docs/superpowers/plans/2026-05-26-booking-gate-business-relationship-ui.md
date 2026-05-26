# Booking and Gate Business Relationship UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Booking, Gate In, and Gate Out consistently capture and display business relationship parties so PortalEntityAccess grants and EIR visibility are predictable.

**Architecture:** Booking becomes the primary source for party relationships. Gate In and Gate Out reuse Booking party data, allow safe operational overrides only where needed, and use one preview endpoint to show which portal grants will be created before submission. Field-level visibility policy remains in Settings and Customer Master, not in Gate screens.

**Tech Stack:** Next.js App Router, React 19, TypeScript, MS SQL via `mssql`, Jest with `ts-jest`, existing `portalGrantRules.ts`, existing Customer and Booking APIs.

---

## Scope Decisions

- Do not create configurable policy UI in Gate In or Gate Out.
- Do not create Driver/Trucking Portal UI in this phase.
- Do not remove the no-booking workflow. Gate In and Gate Out must still work without Booking.
- Keep field-level EIR visibility in Settings and Customer Master.
- Make Booking party fields the preferred source of truth when a Booking is selected.
- Use `customer_id` only for backward compatibility. New UI should use explicit party fields.

## Files And Responsibilities

- `src/app/(dashboard)/booking/page.tsx`  
  Add Business Relationship selectors, party summary in detail modal, and party-aware import/export template support.

- `src/app/(dashboard)/gate/GateInTab.tsx`  
  Add explicit Container Owner selector, auto-fill COC owner from selected Booking shipping line, show a cleaner Business Relationship section, and improve Portal Visibility Preview.

- `src/app/(dashboard)/gate/GateOutTab.tsx`  
  Add party-aware Booking summary, send party ids in Gate Out submit, add Portal Visibility Preview, and show owner/billing/trucking relationship clearly.

- `src/app/(dashboard)/gate/types.ts`  
  Extend `ContainerResult` and `GateOutBooking` with owner and Booking party fields.

- `src/app/api/edi/bookings/route.ts`  
  Ensure list/detail/lookup responses expose party ids and names consistently.

- `src/app/api/gate/visibility-preview/route.ts`  
  Accept optional `booking_id`, include Booking party grants in preview, dedupe, and return customer names.

- `src/app/api/gate/route.ts`  
  Verify Gate Out submit uses `container_owner_id`, `booking_customer_id`, `billing_customer_id`, `trucking_company_id`, and future `driver_user_id` consistently.

- Tests:
  - `src/app/api/__tests__/booking-business-context-ui.test.ts`
  - `src/app/api/__tests__/gate-in-business-context-ui.test.ts`
  - `src/app/api/__tests__/gate-out-business-context-ui.test.ts`
  - `src/app/api/__tests__/gate-visibility-preview.test.ts`
  - `src/app/api/__tests__/gate-out-party-grants.test.ts`

---

### Task 1: Booking Page Business Relationship UI

**Files:**
- Modify: `src/app/(dashboard)/booking/page.tsx`
- Test: `src/app/api/__tests__/booking-business-context-ui.test.ts`

- [ ] **Step 1: Write the failing UI test**

Create `src/app/api/__tests__/booking-business-context-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Booking business relationship UI', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/booking/page.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/edi/bookings/route.ts'), 'utf8');

  it('renders party selectors in the create booking form', () => {
    expect(page).toContain('Business Relationship');
    expect(page).toContain('Booking Customer');
    expect(page).toContain('Shipping Line / Container Owner');
    expect(page).toContain('Forwarder');
    expect(page).toContain('Shipper');
    expect(page).toContain('Consignee');
    expect(page).toContain('Trucking Company');
    expect(page).toContain('Bill To Customer');
  });

  it('submits explicit booking party ids', () => {
    expect(page).toContain('booking_customer_id: createForm.booking_customer_id || undefined');
    expect(page).toContain('shipping_line_id: createForm.shipping_line_id || undefined');
    expect(page).toContain('forwarder_id: createForm.forwarder_id || undefined');
    expect(page).toContain('shipper_id: createForm.shipper_id || undefined');
    expect(page).toContain('consignee_id: createForm.consignee_id || undefined');
    expect(page).toContain('trucking_company_id: createForm.trucking_company_id || undefined');
    expect(page).toContain('bill_to_customer_id: createForm.bill_to_customer_id || createForm.booking_customer_id || undefined');
  });

  it('booking API returns party ids and names for UI summaries', () => {
    expect(route).toContain('booking_customer_name');
    expect(route).toContain('shipping_line_name');
    expect(route).toContain('forwarder_name');
    expect(route).toContain('shipper_name');
    expect(route).toContain('consignee_name');
    expect(route).toContain('trucking_company_name');
    expect(route).toContain('bill_to_customer_name');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/app/api/__tests__/booking-business-context-ui.test.ts --runInBand
```

Expected: FAIL because `Business Relationship` and explicit party id submit fields are not in `booking/page.tsx`.

- [ ] **Step 3: Extend BookingRow and createForm**

In `src/app/(dashboard)/booking/page.tsx`, extend `BookingRow`:

```ts
interface BookingRow {
  booking_id: number; booking_number: string; booking_type: string;
  vessel_name: string; voyage_number: string; container_count: number;
  container_size: string; container_type: string; eta: string;
  valid_from: string; valid_to: string;
  status: string; seal_number: string; notes: string; customer_name: string;
  booking_customer_id?: number | null; shipping_line_id?: number | null;
  forwarder_id?: number | null; shipper_id?: number | null;
  consignee_id?: number | null; trucking_company_id?: number | null;
  bill_to_customer_id?: number | null;
  booking_customer_name?: string | null; shipping_line_name?: string | null;
  forwarder_name?: string | null; shipper_name?: string | null;
  consignee_name?: string | null; trucking_company_name?: string | null;
  bill_to_customer_name?: string | null;
  received_count: number; released_count: number; linked_containers: number;
  pending_count?: number; receive_percent?: number; release_percent?: number;
  utilization_status?: UtilizationStatus;
  created_at: string;
}
```

Replace `createForm` initial state with:

```ts
const emptyCreateForm = {
  booking_number: '', booking_type: 'import', vessel_name: '', voyage_number: '',
  container_count: 1, container_size: '20', container_type: 'GP',
  eta: '', valid_from: '', valid_to: '', seal_number: '', notes: '',
  booking_customer_id: null as number | null,
  shipping_line_id: null as number | null,
  forwarder_id: null as number | null,
  shipper_id: null as number | null,
  consignee_id: null as number | null,
  trucking_company_id: null as number | null,
  bill_to_customer_id: null as number | null,
};
const [createForm, setCreateForm] = useState(emptyCreateForm);
```

- [ ] **Step 4: Load customers for Booking selectors**

Add state and effect near create form state:

```ts
const [customerList, setCustomerList] = useState<Array<{
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_trucking: boolean;
  is_forwarder: boolean;
  credit_term: number;
}>>([]);

useEffect(() => {
  fetch('/api/settings/customers')
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) setCustomerList(data);
    })
    .catch(err => console.error('Load booking customers error:', err));
}, []);
```

Add helper functions near `typeLabels`:

```ts
const customerOptions = (kind: 'any' | 'line' | 'forwarder' | 'trucking') => {
  if (kind === 'line') return customerList.filter(c => c.is_line);
  if (kind === 'forwarder') return customerList.filter(c => c.is_forwarder);
  if (kind === 'trucking') return customerList.filter(c => c.is_trucking);
  return customerList;
};

const customerName = (customerId?: number | null) =>
  customerList.find(c => c.customer_id === customerId)?.customer_name || '';
```

- [ ] **Step 5: Render Business Relationship section**

Add this section before `เลขตู้ล่วงหน้า` in the create form:

```tsx
<div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/10">
  <div className="mb-3">
    <p className="text-sm font-semibold text-slate-800 dark:text-white">Business Relationship</p>
    <p className="text-[10px] text-slate-400">ใช้กำหนด Portal grants และ EIR visibility ของ Booking นี้</p>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    <PartySelect label="Booking Customer" value={createForm.booking_customer_id} customers={customerOptions('any')} onChange={(value) => setCreateForm(prev => ({ ...prev, booking_customer_id: value, bill_to_customer_id: prev.bill_to_customer_id || value }))} required />
    <PartySelect label="Shipping Line / Container Owner" value={createForm.shipping_line_id} customers={customerOptions('line')} onChange={(value) => setCreateForm(prev => ({ ...prev, shipping_line_id: value }))} />
    <PartySelect label="Forwarder" value={createForm.forwarder_id} customers={customerOptions('forwarder')} onChange={(value) => setCreateForm(prev => ({ ...prev, forwarder_id: value }))} />
    <PartySelect label="Shipper" value={createForm.shipper_id} customers={customerOptions('any')} onChange={(value) => setCreateForm(prev => ({ ...prev, shipper_id: value }))} />
    <PartySelect label="Consignee" value={createForm.consignee_id} customers={customerOptions('any')} onChange={(value) => setCreateForm(prev => ({ ...prev, consignee_id: value }))} />
    <PartySelect label="Trucking Company" value={createForm.trucking_company_id} customers={customerOptions('trucking')} onChange={(value) => setCreateForm(prev => ({ ...prev, trucking_company_id: value }))} />
    <PartySelect label="Bill To Customer" value={createForm.bill_to_customer_id} customers={customerOptions('any')} onChange={(value) => setCreateForm(prev => ({ ...prev, bill_to_customer_id: value }))} />
  </div>
</div>
```

Add this component at the bottom of `booking/page.tsx`:

```tsx
function PartySelect({
  label,
  value,
  customers,
  onChange,
  required = false,
}: {
  label: string;
  value?: number | null;
  customers: Array<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean }>;
  onChange: (value: number | null) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>{label}{required ? ' *' : ''}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className={inputClass}
      >
        <option value="">ไม่ระบุ</option>
        {customers.map(customer => (
          <option key={customer.customer_id} value={customer.customer_id}>
            {customer.customer_name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 6: Submit party ids**

Replace `handleCreate` request body construction with:

```ts
const payload = {
  yard_id: yardId,
  ...createForm,
  customer_id: createForm.booking_customer_id || undefined,
  booking_customer_id: createForm.booking_customer_id || undefined,
  shipping_line_id: createForm.shipping_line_id || undefined,
  forwarder_id: createForm.forwarder_id || undefined,
  shipper_id: createForm.shipper_id || undefined,
  consignee_id: createForm.consignee_id || undefined,
  trucking_company_id: createForm.trucking_company_id || undefined,
  bill_to_customer_id: createForm.bill_to_customer_id || createForm.booking_customer_id || undefined,
  container_numbers: cns,
};
const res = await fetch('/api/edi/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

On success, reset with:

```ts
setCreateForm(emptyCreateForm);
```

- [ ] **Step 7: Show party summary in detail modal**

Replace the current single `ลูกค้า` info item with these items:

```tsx
<div><span className="text-[10px] text-slate-400 uppercase block">Booking Customer</span><span className="text-slate-700 dark:text-white">{selectedBooking.booking_customer_name || selectedBooking.customer_name || '—'}</span></div>
<div><span className="text-[10px] text-slate-400 uppercase block">Shipping Line</span><span className="text-slate-700 dark:text-white">{selectedBooking.shipping_line_name || '—'}</span></div>
<div><span className="text-[10px] text-slate-400 uppercase block">Forwarder</span><span className="text-slate-700 dark:text-white">{selectedBooking.forwarder_name || '—'}</span></div>
<div><span className="text-[10px] text-slate-400 uppercase block">Shipper</span><span className="text-slate-700 dark:text-white">{selectedBooking.shipper_name || '—'}</span></div>
<div><span className="text-[10px] text-slate-400 uppercase block">Consignee</span><span className="text-slate-700 dark:text-white">{selectedBooking.consignee_name || '—'}</span></div>
<div><span className="text-[10px] text-slate-400 uppercase block">Trucking</span><span className="text-slate-700 dark:text-white">{selectedBooking.trucking_company_name || '—'}</span></div>
<div><span className="text-[10px] text-slate-400 uppercase block">Bill To</span><span className="text-slate-700 dark:text-white">{selectedBooking.bill_to_customer_name || selectedBooking.booking_customer_name || selectedBooking.customer_name || '—'}</span></div>
```

- [ ] **Step 8: Run test and commit**

Run:

```bash
npm test -- src/app/api/__tests__/booking-business-context-ui.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/(dashboard)/booking/page.tsx src/app/api/__tests__/booking-business-context-ui.test.ts
git commit -m "Add booking business relationship UI"
```

---

### Task 2: Booking API List Party Names

**Files:**
- Modify: `src/app/api/edi/bookings/route.ts`
- Test: `src/app/api/__tests__/booking-business-context-ui.test.ts`

- [ ] **Step 1: Write failing API response coverage**

Extend `booking-business-context-ui.test.ts` with:

```ts
it('paginated booking list uses bookingSummarySelect so party names are returned', () => {
  expect(route).toContain('SELECT');
  expect(route).toContain('bookingSummarySelect()');
  expect(route).toContain('ORDER BY b.created_at DESC');
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/app/api/__tests__/booking-business-context-ui.test.ts --runInBand
```

Expected: FAIL because the paginated list still selects `b.*, c.customer_name` and does not use `bookingSummarySelect()`.

- [ ] **Step 3: Update paginated list query**

In `src/app/api/edi/bookings/route.ts`, replace the paginated list query that starts with `SELECT b.*, c.customer_name` with:

```ts
const result = await req.query(`
  SELECT ${bookingSummarySelect()}
  FROM Bookings b
  LEFT JOIN Customers c ON b.customer_id = c.customer_id
  LEFT JOIN Customers bookingCustomer ON bookingCustomer.customer_id = COALESCE(b.booking_customer_id, b.customer_id)
  LEFT JOIN Customers shippingLine ON shippingLine.customer_id = b.shipping_line_id
  LEFT JOIN Customers forwarder ON forwarder.customer_id = b.forwarder_id
  LEFT JOIN Customers shipper ON shipper.customer_id = b.shipper_id
  LEFT JOIN Customers consignee ON consignee.customer_id = b.consignee_id
  LEFT JOIN Customers trucking ON trucking.customer_id = b.trucking_company_id
  LEFT JOIN Customers billTo ON billTo.customer_id = b.bill_to_customer_id
  ${where}
  ORDER BY b.created_at DESC
  OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
`);
```

- [ ] **Step 4: Run test and commit**

Run:

```bash
npm test -- src/app/api/__tests__/booking-business-context-ui.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/api/edi/bookings/route.ts src/app/api/__tests__/booking-business-context-ui.test.ts
git commit -m "Return booking party names in booking list"
```

---

### Task 3: Gate In Container Owner Selector And Booking Owner Autofill

**Files:**
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Test: `src/app/api/__tests__/gate-in-business-context-ui.test.ts`

- [ ] **Step 1: Add failing tests**

Extend `gate-in-business-context-ui.test.ts`:

```ts
it('supports explicit container owner selection and booking shipping line autofill', () => {
  expect(gateIn).toContain('Container Owner');
  expect(gateIn).toContain('setContainerOwnerId(booking.shipping_line_id)');
  expect(gateIn).toContain('Shipping Line / Container Owner');
  expect(gateIn).toContain('ownerSearch');
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/api/__tests__/gate-in-business-context-ui.test.ts --runInBand
```

Expected: FAIL because no explicit owner selector exists and `applyGateInBooking()` does not set owner from `booking.shipping_line_id`.

- [ ] **Step 3: Add owner selector state**

In `GateInTab.tsx`, add near owner/billing state:

```ts
const [ownerSearch, setOwnerSearch] = useState('');
const [ownerSearchOpen, setOwnerSearchOpen] = useState(false);
const ownerSearchRef = useRef<HTMLDivElement>(null);
```

Add click-outside effect:

```ts
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (ownerSearchRef.current && !ownerSearchRef.current.contains(e.target as Node)) {
      setOwnerSearchOpen(false);
    }
  };
  if (ownerSearchOpen) document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [ownerSearchOpen]);
```

- [ ] **Step 4: Autofill owner from Booking**

Inside `applyGateInBooking()` after the line `const bookingCustomerId = booking.booking_customer_id || booking.customer_id || null;`, add:

```ts
if (booking.shipping_line_id) {
  setContainerOwnerId(booking.shipping_line_id);
  const shippingLineName = booking.shipping_line_name || '';
  if (shippingLineName) setOwnerSearch(shippingLineName);
  if (!billingDiffFromOwner && !booking.bill_to_customer_id) setBillingCustomerId(booking.shipping_line_id);
}
```

Extend `bookingDerivedContextRef.current` with:

```ts
containerOwnerId: booking.shipping_line_id || null,
ownerName: booking.shipping_line_name || null,
```

Update `BookingDerivedContext` interface:

```ts
interface BookingDerivedContext {
  manualCustomerId?: number | null;
  billingCustomerId?: number | null;
  containerOwnerId?: number | null;
  ownerName?: string | null;
  truckCompanyName?: string | null;
}
```

Update `clearBookingDerivedContext()`:

```ts
if (context.containerOwnerId) {
  setContainerOwnerId(prev => prev === context.containerOwnerId ? null : prev);
}
if (context.ownerName) {
  setOwnerSearch(prev => prev === context.ownerName ? '' : prev);
}
```

- [ ] **Step 5: Render explicit owner selector**

Replace the read-only owner display inside owner/billing section with:

```tsx
<div className="relative" ref={ownerSearchRef}>
  <label className="text-xs text-slate-500 mb-1 block">Shipping Line / Container Owner</label>
  <input
    type="text"
    placeholder="เลือกเจ้าของตู้"
    value={ownerSearch || (containerOwnerId ? customerList.find(c => c.customer_id === containerOwnerId)?.customer_name || '' : '')}
    onChange={e => {
      setOwnerSearch(e.target.value);
      setOwnerSearchOpen(true);
      if (!e.target.value) setContainerOwnerId(null);
    }}
    onFocus={() => setOwnerSearchOpen(true)}
    className={`${inputClass} text-sm`}
  />
  {ownerSearchOpen && (
    <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl">
      {customerList
        .filter(c => !ownerSearch || c.customer_name.toLowerCase().includes(ownerSearch.toLowerCase()))
        .slice(0, 15)
        .map(c => (
          <button
            key={c.customer_id}
            onClick={() => {
              setContainerOwnerId(c.customer_id);
              setOwnerSearch(c.customer_name);
              if (!billingDiffFromOwner) setBillingCustomerId(c.customer_id);
              setOwnerSearchOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between ${
              containerOwnerId === c.customer_id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            <span>{c.customer_name}</span>
            <span className="text-[10px] text-slate-400">{c.is_line ? 'สายเรือ' : c.is_forwarder ? 'Forwarder' : c.is_trucking ? 'รถบรรทุก' : 'ทั่วไป'}</span>
          </button>
        ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- src/app/api/__tests__/gate-in-business-context-ui.test.ts --runInBand
npm test -- src/app/api/__tests__/gate-in-party-grants.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/(dashboard)/gate/GateInTab.tsx src/app/api/__tests__/gate-in-business-context-ui.test.ts
git commit -m "Add Gate In owner selector"
```

---

### Task 4: Portal Visibility Preview With Names And Booking Parties

**Files:**
- Modify: `src/app/api/gate/visibility-preview/route.ts`
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Test: `src/app/api/__tests__/gate-visibility-preview.test.ts`

- [ ] **Step 1: Write failing preview tests**

Extend `gate-visibility-preview.test.ts`:

```ts
it('preview endpoint can include booking party grants and customer names', () => {
  expect(route).toContain('booking_id');
  expect(route).toContain('buildBookingPartyGrants');
  expect(route).toContain('customerName');
  expect(route).toContain('Customers');
});

it('Gate In sends booking id to visibility preview and renders customer names', () => {
  expect(gateIn).toContain('booking_id: selectedBooking?.booking_id || null');
  expect(gateIn).toContain('row.customerName');
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/api/__tests__/gate-visibility-preview.test.ts --runInBand
```

Expected: FAIL because preview does not accept `booking_id` and returns only `Customer #id`.

- [ ] **Step 3: Extend preview endpoint**

In `visibility-preview/route.ts`, import:

```ts
import { buildBookingPartyGrants } from '@/lib/portalGrantRules';
```

After the line `const containerNumber = cleanString(body.container_number);`, add:

```ts
const bookingId = positiveIntOrNull(body.booking_id);
```

Before mapping `preview`, add:

```ts
if (bookingId) {
  const bookingResult = await db.request()
    .input('bookingId', sql.Int, bookingId)
    .query(`
      SELECT booking_id, booking_number, customer_id, booking_customer_id,
        shipping_line_id, forwarder_id, shipper_id, consignee_id,
        trucking_company_id, bill_to_customer_id
      FROM Bookings
      WHERE booking_id = @bookingId
    `);
  const booking = bookingResult.recordset[0];
  if (booking) grants.push(...buildBookingPartyGrants(booking));
}

const customerIds = Array.from(new Set(grants.map(grant => grant.customerId).filter(Boolean)));
const names = new Map<number, string>();
if (customerIds.length > 0) {
  const customerResult = await db.request()
    .query(`
      SELECT customer_id, customer_name
      FROM Customers
      WHERE customer_id IN (${customerIds.map(id => Number(id)).join(',')})
    `);
  for (const row of customerResult.recordset) {
    names.set(Number(row.customer_id), row.customer_name);
  }
}
```

Change preview row to include:

```ts
customerName: names.get(grant.customerId) || null,
```

- [ ] **Step 4: Send booking id from Gate In**

In `GateInTab.tsx` preview request body, add:

```ts
booking_id: selectedBooking?.booking_id || null,
```

In preview card, replace:

```tsx
<p className="font-semibold text-slate-700 dark:text-slate-200">Customer #{row.customerId}</p>
```

with:

```tsx
<p className="font-semibold text-slate-700 dark:text-slate-200">{row.customerName || `Customer #${row.customerId}`}</p>
```

Extend `PortalVisibilityPreviewRow`:

```ts
customerName?: string | null;
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/app/api/__tests__/gate-visibility-preview.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/api/gate/visibility-preview/route.ts src/app/(dashboard)/gate/GateInTab.tsx src/app/api/__tests__/gate-visibility-preview.test.ts
git commit -m "Improve gate portal visibility preview"
```

---

### Task 5: Gate Out Party Types And Submit Payload

**Files:**
- Modify: `src/app/(dashboard)/gate/types.ts`
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`
- Test: `src/app/api/__tests__/gate-out-party-grants.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/__tests__/gate-out-party-grants.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Gate Out party grants', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
  const types = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/types.ts'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/route.ts'), 'utf8');

  it('GateOutBooking includes party fields from Booking API', () => {
    expect(types).toContain('booking_customer_id?: number | null');
    expect(types).toContain('shipping_line_id?: number | null');
    expect(types).toContain('forwarder_id?: number | null');
    expect(types).toContain('shipper_id?: number | null');
    expect(types).toContain('consignee_id?: number | null');
    expect(types).toContain('trucking_company_id?: number | null');
    expect(types).toContain('bill_to_customer_id?: number | null');
  });

  it('Gate Out submit sends owner, booking customer, billing, and trucking ids', () => {
    expect(gateOut).toContain('container_owner_id: selectedContainer.container_owner_id || billingData?.owner?.customer_id || undefined');
    expect(gateOut).toContain('booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || undefined');
    expect(gateOut).toContain('trucking_company_id: selectedBooking?.trucking_company_id || undefined');
    expect(gateOut).toContain('driver_user_id: undefined');
  });

  it('gate API builds grants from resolved Gate Out party ids', () => {
    expect(route).toContain('booking_customer_id: resolvedBookingCustomerId');
    expect(route).toContain('billing_customer_id: resolvedBillingCustomerId');
    expect(route).toContain('trucking_company_id: resolvedTruckingCompanyId');
    expect(route).toContain('driver_user_id: resolvedDriverUserId');
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-party-grants.test.ts --runInBand
```

Expected: FAIL because `types.ts` and `GateOutTab.tsx` do not include the new party fields/payload.

- [ ] **Step 3: Extend `ContainerResult` and `GateOutBooking`**

In `src/app/(dashboard)/gate/types.ts`, add to `ContainerResult`:

```ts
is_soc?: boolean | number;
container_owner_id?: number | null;
```

Add to `GateOutBooking`:

```ts
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
```

- [ ] **Step 4: Send party ids in Gate Out submit**

In `handleGateOut()` request body, add:

```ts
container_owner_id: selectedContainer.container_owner_id || billingData?.owner?.customer_id || undefined,
booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || undefined,
trucking_company_id: selectedBooking?.trucking_company_id || undefined,
driver_user_id: undefined,
```

Keep:

```ts
billing_customer_id: resolvedCustomer?.customer_id || undefined,
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-party-grants.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/(dashboard)/gate/types.ts src/app/(dashboard)/gate/GateOutTab.tsx src/app/api/__tests__/gate-out-party-grants.test.ts
git commit -m "Send Gate Out party ids"
```

---

### Task 6: Gate Out Business Relationship UI And Preview

**Files:**
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`
- Test: `src/app/api/__tests__/gate-out-business-context-ui.test.ts`
- Test: `src/app/api/__tests__/gate-visibility-preview.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/__tests__/gate-out-business-context-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Gate Out business context UI', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

  it('shows booking party summary on Gate Out', () => {
    expect(gateOut).toContain('Business Relationship');
    expect(gateOut).toContain('Booking Customer');
    expect(gateOut).toContain('Shipping Line');
    expect(gateOut).toContain('Forwarder');
    expect(gateOut).toContain('Shipper');
    expect(gateOut).toContain('Consignee');
    expect(gateOut).toContain('Trucking Company');
    expect(gateOut).toContain('Bill To Customer');
  });

  it('renders Portal Visibility Preview in Gate Out', () => {
    expect(gateOut).toContain('Portal Visibility Preview');
    expect(gateOut).toContain('/api/gate/visibility-preview');
    expect(gateOut).toContain('visibilityPreview');
    expect(gateOut).toContain('row.customerName');
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-business-context-ui.test.ts --runInBand
```

Expected: FAIL because Gate Out has no Business Relationship section and no preview.

- [ ] **Step 3: Add Gate Out visibility preview state**

In `GateOutTab.tsx`, add:

```ts
interface PortalVisibilityPreviewRow {
  customerId: number;
  customerName?: string | null;
  entityType: string;
  entityRef: string | null;
  accessRole: string;
  validUntil?: string | null;
}

const [visibilityPreview, setVisibilityPreview] = useState<PortalVisibilityPreviewRow[]>([]);
const [visibilityPreviewLoading, setVisibilityPreviewLoading] = useState(false);
const [visibilityPreviewError, setVisibilityPreviewError] = useState('');
```

- [ ] **Step 4: Fetch preview for selected container**

Add effect:

```ts
useEffect(() => {
  if (!selectedContainer) {
    setVisibilityPreview([]);
    setVisibilityPreviewError('');
    setVisibilityPreviewLoading(false);
    return;
  }
  const controller = new AbortController();
  setVisibilityPreviewLoading(true);
  setVisibilityPreviewError('');
  fetch('/api/gate/visibility-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      container_number: selectedContainer.container_number,
      container_id: selectedContainer.container_id,
      container_owner_id: selectedContainer.container_owner_id || billingData?.owner?.customer_id || null,
      booking_id: selectedBooking?.booking_id || null,
      booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || null,
      billing_customer_id: resolvedCustomer?.customer_id || null,
      trucking_company_id: selectedBooking?.trucking_company_id || null,
      driver_user_id: null,
    }),
  })
    .then(async res => {
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || !Array.isArray(json.preview)) throw new Error('Visibility preview unavailable');
      setVisibilityPreview(json.preview);
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.error('Gate Out visibility preview error', err);
        setVisibilityPreview([]);
        setVisibilityPreviewError('Visibility preview unavailable');
      }
    })
    .finally(() => {
      if (!controller.signal.aborted) setVisibilityPreviewLoading(false);
    });
  return () => controller.abort();
}, [selectedContainer, selectedBooking, resolvedCustomer?.customer_id, billingData?.owner?.customer_id]);
```

- [ ] **Step 5: Render Business Relationship summary under Booking card**

Inside selected container area after Booking card, add:

```tsx
<div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-900/10">
  <p className="text-sm font-semibold text-slate-800 dark:text-white">Business Relationship</p>
  <p className="text-[10px] text-slate-400 mb-3">ใช้ตรวจ Portal grants และ EIR visibility ก่อนปล่อยตู้</p>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
    <InfoMini label="Container Owner" value={billingData?.owner?.customer_name || selectedContainer.shipping_line || '-'} />
    <InfoMini label="Booking Customer" value={selectedBooking?.booking_customer_name || selectedBooking?.customer_name || '-'} />
    <InfoMini label="Shipping Line" value={selectedBooking?.shipping_line_name || '-'} />
    <InfoMini label="Forwarder" value={selectedBooking?.forwarder_name || '-'} />
    <InfoMini label="Shipper" value={selectedBooking?.shipper_name || '-'} />
    <InfoMini label="Consignee" value={selectedBooking?.consignee_name || '-'} />
    <InfoMini label="Trucking Company" value={selectedBooking?.trucking_company_name || '-'} />
    <InfoMini label="Bill To Customer" value={selectedBooking?.bill_to_customer_name || resolvedCustomer?.customer_name || '-'} />
  </div>
</div>
```

Add `InfoMini` helper at bottom of `GateOutTab.tsx`:

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

- [ ] **Step 6: Render Portal Visibility Preview**

Add after Business Relationship:

```tsx
<div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold text-slate-800 dark:text-white">Portal Visibility Preview</p>
      <p className="text-[10px] text-slate-400">Gate Out แสดงเฉพาะว่าจะสร้าง grant ให้ใคร ไม่ได้ตั้ง field policy รายครั้ง</p>
    </div>
    {visibilityPreviewLoading && <Loader2 size={14} className="animate-spin text-cyan-600" />}
  </div>
  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
    {visibilityPreviewError ? (
      <p className="text-xs text-rose-500">{visibilityPreviewError}</p>
    ) : visibilityPreview.length === 0 ? (
      <p className="text-xs text-slate-400">ยังไม่มี party ที่จะได้รับสิทธิ์</p>
    ) : visibilityPreview.map((row, index) => (
      <div key={`${row.customerId}-${row.entityType}-${row.accessRole}-${index}`} className="rounded-lg bg-white/80 p-2 text-xs dark:bg-slate-800/70">
        <p className="font-semibold text-slate-700 dark:text-slate-200">{row.customerName || `Customer #${row.customerId}`}</p>
        <p className="mt-0.5 text-slate-400">{row.entityType} · {row.accessRole}</p>
        <p className="mt-1 text-[10px] text-slate-400">Grade default: hidden</p>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-business-context-ui.test.ts src/app/api/__tests__/gate-visibility-preview.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/(dashboard)/gate/GateOutTab.tsx src/app/api/__tests__/gate-out-business-context-ui.test.ts src/app/api/__tests__/gate-visibility-preview.test.ts
git commit -m "Add Gate Out relationship preview"
```

---

### Task 7: Gate Out Compatibility Uses New Party Model

**Files:**
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`
- Modify: `src/app/api/gate/route.ts`
- Test: `src/app/api/__tests__/gate-out-party-grants.test.ts`
- Test: `src/app/api/__tests__/gate.test.ts`

- [ ] **Step 1: Add failing checks**

Extend `gate-out-party-grants.test.ts`:

```ts
it('Gate Out compatibility checks booking_customer_id before legacy customer_id', () => {
  expect(gateOut).toContain('booking.booking_customer_id || booking.customer_id');
  expect(gateOut).toContain('selectedBooking?.bill_to_customer_id || selectedBooking?.booking_customer_id || selectedBooking?.customer_id');
});
```

- [ ] **Step 2: Run failing checks**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-party-grants.test.ts --runInBand
```

Expected: FAIL because `getBookingCompatibility()` uses `booking.customer_id` and billing defaults use legacy customer id.

- [ ] **Step 3: Update compatibility logic**

In `getBookingCompatibility()`, replace customer comparison with:

```ts
const bookingCustomerId = booking.booking_customer_id || booking.customer_id || null;
const billToCustomerId = booking.bill_to_customer_id || bookingCustomerId;
const acceptedCustomerIds = [
  selectedContainer?.container_owner_id,
  billingData?.owner?.customer_id,
  resolvedCustomer?.customer_id,
].filter(Boolean);
if (bookingCustomerId && acceptedCustomerIds.length > 0 && !acceptedCustomerIds.includes(bookingCustomerId)) {
  warnings.push(`ลูกค้า Booking ไม่ตรง: ${booking.booking_customer_name || booking.customer_name || bookingCustomerId}`);
}
if (resolvedCustomer?.customer_id && billToCustomerId && billToCustomerId !== resolvedCustomer.customer_id) {
  warnings.push(`Bill To ไม่ตรง: ${booking.bill_to_customer_name || billToCustomerId}`);
}
```

- [ ] **Step 4: Use Bill To default when applying Booking**

In `applyGateOutBooking()`, replace:

```ts
if (booking?.customer_id) setManualCustomerId(booking.customer_id);
if (container) await loadGateOutBilling(container, booking?.customer_id || manualCustomerId, bookingRef);
```

with:

```ts
const bookingBillingCustomerId = booking?.bill_to_customer_id || booking?.booking_customer_id || booking?.customer_id || null;
if (bookingBillingCustomerId) setManualCustomerId(bookingBillingCustomerId);
if (container) await loadGateOutBilling(container, bookingBillingCustomerId || manualCustomerId, bookingRef);
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-party-grants.test.ts src/app/api/__tests__/gate.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/(dashboard)/gate/GateOutTab.tsx src/app/api/__tests__/gate-out-party-grants.test.ts
git commit -m "Use booking party model in Gate Out checks"
```

---

### Task 8: Booking Import Template Party Columns

**Files:**
- Modify: `src/app/(dashboard)/booking/page.tsx`
- Test: `src/app/api/__tests__/booking-business-context-ui.test.ts`

- [ ] **Step 1: Add failing import-template test**

Extend `booking-business-context-ui.test.ts`:

```ts
it('booking import template and row mapper include party id columns', () => {
  expect(page).toContain('booking_customer_id');
  expect(page).toContain('shipping_line_id');
  expect(page).toContain('forwarder_id');
  expect(page).toContain('shipper_id');
  expect(page).toContain('consignee_id');
  expect(page).toContain('trucking_company_id');
  expect(page).toContain('bill_to_customer_id');
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/api/__tests__/booking-business-context-ui.test.ts --runInBand
```

Expected: FAIL if the import template and mapper do not include all columns.

- [ ] **Step 3: Extend `mapRow()`**

Add to returned object in `mapRow()`:

```ts
booking_customer_id: Number(get('booking_customer_id', 'booking_customer')) || undefined,
shipping_line_id: Number(get('shipping_line_id', 'shipping_line')) || undefined,
forwarder_id: Number(get('forwarder_id', 'forwarder')) || undefined,
shipper_id: Number(get('shipper_id', 'shipper')) || undefined,
consignee_id: Number(get('consignee_id', 'consignee')) || undefined,
trucking_company_id: Number(get('trucking_company_id', 'trucking_company')) || undefined,
bill_to_customer_id: Number(get('bill_to_customer_id', 'bill_to_customer')) || undefined,
```

- [ ] **Step 4: Extend template headers**

Replace `headers` in `downloadTemplate()` with:

```ts
const headers = [
  'booking_number', 'booking_type', 'booking_customer_id', 'shipping_line_id',
  'forwarder_id', 'shipper_id', 'consignee_id', 'trucking_company_id',
  'bill_to_customer_id', 'vessel_name', 'voyage_number', 'container_count',
  'container_size', 'container_type', 'eta', 'seal_number', 'container_numbers',
  'valid_from', 'valid_to', 'notes',
];
```

Update sample rows to include blank or numeric ids in the new columns:

```ts
['BK-2025-0001', 'import', '', '', '', '', '', '', '', 'EVER GIVEN', 'V.001N', 5, '40', 'GP', '2025-04-01', 'SL12345', 'MSCU1234567, MSCU2345678', '2025-04-01', '2025-04-30', 'ตัวอย่าง'],
['BK-2025-0002', 'export', '', '', '', '', '', '', '', 'MSC ANNA', 'V.120E', 3, '20', 'HC', '2025-04-05', '', 'TEMU9876543', '2025-04-05', '2025-05-05', ''],
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- src/app/api/__tests__/booking-business-context-ui.test.ts --runInBand
```

Expected: PASS.

Commit:

```bash
git add src/app/(dashboard)/booking/page.tsx src/app/api/__tests__/booking-business-context-ui.test.ts
git commit -m "Add booking party columns to import"
```

---

### Task 9: Documentation And Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add a section under `Customer Portal Access UI/UX`:

```md
### Booking / Gate Business Relationship UI

- Booking create form captures Booking Customer, Shipping Line / Container Owner, Forwarder, Shipper, Consignee, Trucking Company, and Bill To Customer.
- Booking list/detail returns party names so Gate In and Gate Out can use Booking as source-of-truth.
- Gate In auto-fills Container Owner from Booking shipping line for COC and still supports manual owner selection.
- Gate Out submits owner, booking customer, billing customer, trucking, and future driver ids to `/api/gate`.
- Gate In and Gate Out show Portal Visibility Preview with customer names, roles, and entity types. Field-level visibility policy remains in Settings/Customer Master.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/app/api/__tests__/booking-business-context-ui.test.ts src/app/api/__tests__/gate-in-business-context-ui.test.ts src/app/api/__tests__/gate-out-business-context-ui.test.ts src/app/api/__tests__/gate-visibility-preview.test.ts src/app/api/__tests__/gate-in-party-grants.test.ts src/app/api/__tests__/gate-out-party-grants.test.ts --runInBand
```

Expected: all selected suites PASS.

- [ ] **Step 3: Run compiler and lint**

Run:

```bash
npx tsc --noEmit --pretty false
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 4: Run full test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: all suites PASS.

- [ ] **Step 5: Commit docs**

Commit:

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Document booking gate relationship UI"
```

- [ ] **Step 6: Push branch**

Run:

```bash
git push
```

Expected: current feature branch is pushed.

---

## Acceptance Criteria

- Booking create UI captures all required party ids.
- Booking detail shows party names, not only legacy `customer_name`.
- Booking import template supports party id columns.
- Gate In has explicit Container Owner selector.
- Gate In auto-fills Container Owner from selected Booking shipping line when present.
- Gate In preview displays customer names and includes Booking party grants.
- Gate Out sends `container_owner_id`, `booking_customer_id`, `billing_customer_id`, `trucking_company_id`, and future `driver_user_id`.
- Gate Out displays selected Booking party summary.
- Gate Out preview displays customer names and includes Booking party grants.
- Gate Out compatibility uses `booking_customer_id` and `bill_to_customer_id` before legacy `customer_id`.
- No Gate UI sets field-level visibility policy.
- Tests, TypeScript, and lint pass.

## Rollback Plan

- Revert commits task by task in reverse order.
- No schema rollback is expected because this plan reuses existing booking party columns and PortalEntityAccess fields.
- If preview endpoint changes cause issues, revert Task 4 and Task 6 first. Booking and Gate submit payload changes remain backward compatible because all new ids are optional.
