# Gate Out Container Booking Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gate Out primary search with a focused container-number / booking-number search that returns selectable in-yard containers and booking-group results.

**Architecture:** Add a Gate-Out-specific search endpoint instead of broadening `/api/containers`, because Gate Out has operational rules: current yard only, in-yard containers only, no already-gated-out items, booking status/progress, and selection must set both container and booking context. Keep the existing Booking picker for secondary changes after a container is selected.

**Tech Stack:** Next.js App Router API route, TypeScript React client component, MS SQL via `mssql`, Jest static/API tests, existing `requireAnyPermission` and `requireYardAccess` auth helpers.

---

### Task 1: Gate Out Search API

**Files:**
- Create: `src/app/api/gate/out-search/route.ts`
- Test: `src/app/api/__tests__/gate-out-search.test.ts`

- [ ] **Step 1: Write the failing API/static test**

Create `src/app/api/__tests__/gate-out-search.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Gate Out focused search', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/gate/out-search/route.ts');
  const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf8') : '';

  it('exposes a Gate Out specific endpoint guarded by gate.out and yard access', () => {
    expect(route).toContain('requireAnyPermission');
    expect(route).toContain("'gate.out'");
    expect(route).toContain('requireYardAccess');
    expect(route).toContain('yard_id');
    expect(route).toContain('q');
  });

  it('searches only container number and booking number for Gate Out', () => {
    expect(route).toContain('c.container_number LIKE @search');
    expect(route).toContain('b.booking_number LIKE @search');
    expect(route).not.toContain('c.shipping_line LIKE @search');
    expect(route).not.toContain('b.vessel_name LIKE @search');
  });

  it('filters out containers that cannot be gated out', () => {
    expect(route).toContain("c.status <> 'gated_out'");
    expect(route).toContain('c.yard_id = @yardId');
    expect(route).toContain('b.yard_id = @yardId');
    expect(route).toContain("bc.status <> 'released'");
  });

  it('returns container and booking result shapes', () => {
    expect(route).toContain("result_type: 'container'");
    expect(route).toContain("result_type: 'booking'");
    expect(route).toContain('containers:');
    expect(route).toContain('selectable');
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-search.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the API route**

Create `src/app/api/gate/out-search/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

function positiveInt(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeQuery(value: string | null) {
  return (value || '').trim();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = positiveInt(searchParams.get('yard_id'));
    const query = normalizeQuery(searchParams.get('q'));

    if (!yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }
    if (query.length < 2) {
      return NextResponse.json({ results: [], query });
    }

    const db = await getDb();
    const actor = await requireAnyPermission(request, db, ['gate.out'], 'คุณไม่มีสิทธิ์ค้นหาตู้ Gate Out');
    if (actor instanceof NextResponse) return actor;
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;

    const search = `%${query}%`;
    const req = db.request()
      .input('yardId', sql.Int, yardId)
      .input('search', sql.NVarChar, search);

    const containerResult = await req.query(`
      SELECT TOP 20 c.*, y.yard_name, z.zone_name, z.zone_type
      FROM Containers c
      LEFT JOIN Yards y ON c.yard_id = y.yard_id
      LEFT JOIN YardZones z ON c.zone_id = z.zone_id
      WHERE c.yard_id = @yardId
        AND c.status <> 'gated_out'
        AND c.container_number LIKE @search
      ORDER BY c.updated_at DESC
    `);

    const bookingResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('search', sql.NVarChar, search)
      .query(`
        SELECT TOP 10 b.booking_id, b.booking_number, b.booking_type, b.status,
          b.customer_id, b.booking_customer_id, b.shipping_line_id, b.forwarder_id,
          b.shipper_id, b.consignee_id, b.trucking_company_id, b.bill_to_customer_id,
          b.vessel_name, b.voyage_number, b.container_count, b.container_size,
          b.container_type, b.received_count, b.released_count,
          c.customer_name,
          bookingCustomer.customer_name AS booking_customer_name,
          shippingLine.customer_name AS shipping_line_name,
          trucking.customer_name AS trucking_company_name,
          billTo.customer_name AS bill_to_customer_name
        FROM Bookings b
        LEFT JOIN Customers c ON b.customer_id = c.customer_id
        LEFT JOIN Customers bookingCustomer ON bookingCustomer.customer_id = COALESCE(b.booking_customer_id, b.customer_id)
        LEFT JOIN Customers shippingLine ON shippingLine.customer_id = b.shipping_line_id
        LEFT JOIN Customers trucking ON trucking.customer_id = b.trucking_company_id
        LEFT JOIN Customers billTo ON billTo.customer_id = b.bill_to_customer_id
        WHERE b.yard_id = @yardId
          AND b.booking_number LIKE @search
        ORDER BY b.created_at DESC
      `);

    const bookingIds = bookingResult.recordset.map(row => Number(row.booking_id)).filter(Boolean);
    const bookingContainers = new Map<number, unknown[]>();
    if (bookingIds.length > 0) {
      const containerReq = db.request().input('yardId', sql.Int, yardId);
      const idParams = bookingIds.map((bookingId, index) => {
        const paramName = `bookingId${index}`;
        containerReq.input(paramName, sql.Int, bookingId);
        return `@${paramName}`;
      });
      const linkedResult = await containerReq.query(`
        SELECT bc.booking_id, bc.status AS booking_container_status,
          c.*, y.yard_name, z.zone_name, z.zone_type
        FROM BookingContainers bc
        JOIN Containers c
          ON (bc.container_id = c.container_id OR (bc.container_id IS NULL AND bc.container_number = c.container_number))
        LEFT JOIN Yards y ON c.yard_id = y.yard_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE bc.booking_id IN (${idParams.join(', ')})
          AND c.yard_id = @yardId
          AND c.status <> 'gated_out'
          AND ISNULL(bc.status, '') <> 'released'
        ORDER BY c.updated_at DESC
      `);
      for (const row of linkedResult.recordset) {
        const bookingId = Number(row.booking_id);
        bookingContainers.set(bookingId, [...(bookingContainers.get(bookingId) || []), row]);
      }
    }

    const results = [
      ...containerResult.recordset.map(container => ({
        result_type: 'container' as const,
        selectable: true,
        container,
        booking: null,
        containers: [],
      })),
      ...bookingResult.recordset.map(booking => {
        const containers = bookingContainers.get(Number(booking.booking_id)) || [];
        const bookingClosed = ['cancelled', 'completed'].includes(String(booking.status));
        return {
          result_type: 'booking' as const,
          selectable: !bookingClosed && containers.length > 0,
          booking,
          container: null,
          containers,
          message: bookingClosed
            ? 'Booking นี้ปิดหรือยกเลิกแล้ว'
            : containers.length === 0
              ? 'พบ Booking แต่ยังไม่มีตู้ในลานสำหรับปล่อยออก'
              : null,
        };
      }),
    ];

    return NextResponse.json({ query, results });
  } catch (error) {
    console.error('Gate Out search error:', error);
    return NextResponse.json({ error: 'ไม่สามารถค้นหา Gate Out ได้' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test and commit**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-search.test.ts --runInBand --cacheDirectory ./.next/jest-cache
npx tsc --noEmit --pretty false
```

Expected: PASS.

Commit:

```bash
git add src/app/api/gate/out-search/route.ts src/app/api/__tests__/gate-out-search.test.ts
git commit -m "Add Gate Out focused search API"
```

### Task 2: Gate Out Search UI

**Files:**
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`
- Test: `src/app/api/__tests__/gate-out-search-ui.test.ts`

- [ ] **Step 1: Write failing UI test**

Create `src/app/api/__tests__/gate-out-search-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('Gate Out focused search UI', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

  it('uses focused container or booking search copy and endpoint', () => {
    expect(gateOut).toContain('ค้นหาเลขตู้ หรือ Booking No.');
    expect(gateOut).toContain('/api/gate/out-search');
    expect(gateOut).not.toContain('พิมพ์เลขตู้ หรือสายเรือ...');
  });

  it('renders container and booking result groups', () => {
    expect(gateOut).toContain("result_type: 'container'");
    expect(gateOut).toContain("result_type: 'booking'");
    expect(gateOut).toContain('Container Match');
    expect(gateOut).toContain('Booking Match');
    expect(gateOut).toContain('พบ Booking แต่ยังไม่มีตู้ในลานสำหรับปล่อยออก');
  });

  it('selects container and booking context together from booking results', () => {
    expect(gateOut).toContain('selectContainerForGateOut(container, result.booking)');
    expect(gateOut).toContain('initialBooking?: GateOutBooking | null');
    expect(gateOut).toContain('setSelectedBooking(initialBooking)');
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-search-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because the UI still calls `/api/containers` and mentions shipping line.

- [ ] **Step 3: Update Gate Out state and selection**

In `GateOutTab.tsx`, add:

```ts
interface GateOutSearchResult {
  result_type: 'container' | 'booking';
  selectable: boolean;
  container: ContainerResult | null;
  booking: GateOutBooking | null;
  containers: ContainerResult[];
  message?: string | null;
}
```

Change:

```ts
const [searchResults, setSearchResults] = useState<ContainerResult[]>([]);
```

to:

```ts
const [searchResults, setSearchResults] = useState<GateOutSearchResult[]>([]);
```

Change `selectContainerForGateOut` signature:

```ts
const selectContainerForGateOut = async (c: ContainerResult, initialBooking?: GateOutBooking | null) => {
```

Inside the booking lookup block, before the automatic `fetch('/api/edi/bookings?...')`, add:

```ts
if (initialBooking) {
  const bookingRef = initialBooking.booking_number;
  setSelectedBooking(initialBooking);
  setGateOutForm(prev => ({ ...prev, booking_ref: bookingRef }));
  const billingCustomerId = initialBooking.bill_to_customer_id || initialBooking.booking_customer_id || initialBooking.customer_id || null;
  await loadGateOutBilling(c, billingCustomerId, bookingRef);
} else {
  // existing auto lookup block stays here
}
```

Ensure the existing `await loadGateOutBilling(c, null, bookingRef);` runs only in the `else` branch.

- [ ] **Step 4: Update search function**

Replace `searchContainers()` fetch:

```ts
const res = await fetch(`/api/containers?yard_id=${yardId}&search=${searchQuery}`);
const data = await res.json();
const allResults = Array.isArray(data) ? data : [];
setSearchResults(allResults.filter((c: ContainerResult) => c.status !== 'gated_out'));
```

with:

```ts
const res = await fetch(`/api/gate/out-search?yard_id=${yardId}&q=${encodeURIComponent(searchQuery)}`);
const data = await res.json();
setSearchResults(Array.isArray(data.results) ? data.results : []);
```

- [ ] **Step 5: Update search UI**

Replace placeholder:

```tsx
placeholder="พิมพ์เลขตู้ หรือสายเรือ..."
```

with:

```tsx
placeholder="ค้นหาเลขตู้ หรือ Booking No."
```

Replace result rendering with two branches:

```tsx
{searchResults.map((result, index) => {
  if (result.result_type === 'container' && result.container) {
    const c = result.container;
    return (
      <button key={`container-${c.container_id}`} onClick={() => selectContainerForGateOut(c)}
        className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
            <Package size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-blue-500">Container Match</p>
            <p className="font-mono font-semibold text-slate-800 dark:text-white text-sm">{c.container_number}</p>
            <p className="text-xs text-slate-400">{c.size}&apos;{c.type} • {c.shipping_line || '-'}</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-mono">{c.zone_name ? `Zone ${c.zone_name} B${c.bay}-R${c.row}-T${c.tier}` : 'ไม่มีพิกัด'}</span>
      </button>
    );
  }

  if (result.result_type === 'booking' && result.booking) {
    return (
      <div key={`booking-${result.booking.booking_id}-${index}`} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-900/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-indigo-500">Booking Match</p>
            <p className="font-mono font-bold text-slate-800 dark:text-white">{result.booking.booking_number}</p>
            <p className="text-xs text-slate-500">{result.booking.booking_customer_name || result.booking.customer_name || '-'} • {result.booking.vessel_name || '-'}</p>
            <p className="text-[10px] text-indigo-500 mt-1">{bookingProgressText(result.booking)}</p>
          </div>
          {!result.selectable && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">{result.message || 'ยังเลือกไม่ได้'}</span>}
        </div>
        {result.message && <p className="mt-2 text-xs text-amber-600">{result.message}</p>}
        {result.containers.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {result.containers.map(container => (
              <button key={container.container_id} disabled={!result.selectable}
                onClick={() => selectContainerForGateOut(container, result.booking)}
                className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-700 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{container.container_number}</span>
                  <span className="text-slate-400">{container.zone_name ? `Zone ${container.zone_name} B${container.bay}-R${container.row}-T${container.tier}` : 'ไม่มีพิกัด'}</span>
                </div>
                <p className="text-[10px] text-slate-400">{container.size}&apos;{container.type} • {container.shipping_line || '-'}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
})}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-search-ui.test.ts src/app/api/__tests__/gate-out-search.test.ts --runInBand --cacheDirectory ./.next/jest-cache
npx tsc --noEmit --pretty false
```

Expected: PASS.

Commit:

```bash
git add src/app/\(dashboard\)/gate/GateOutTab.tsx src/app/api/__tests__/gate-out-search-ui.test.ts
git commit -m "Use focused Gate Out search UI"
```

### Task 3: Documentation And Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add under `Booking / Gate Business Relationship UI`:

```md
- Gate Out primary search now accepts only container number or Booking No.; shipping line is no longer part of the primary search.
- `/api/gate/out-search` returns container matches and booking matches scoped to current yard, with selectable in-yard containers for booking results.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test -- src/app/api/__tests__/gate-out-search.test.ts src/app/api/__tests__/gate-out-search-ui.test.ts src/app/api/__tests__/gate-out-party-grants.test.ts src/app/api/__tests__/gate.test.ts --runInBand --cacheDirectory ./.next/jest-cache
npx tsc --noEmit --pretty false
npm run lint
npm test -- --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 3: Commit and push**

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Document focused Gate Out search"
git push
```

---

## Acceptance Criteria

- Gate Out search placeholder no longer mentions shipping line.
- Primary Gate Out search calls `/api/gate/out-search`, not `/api/containers`.
- Server search only uses container number and booking number.
- Booking result lists selectable in-yard containers and clearly explains non-selectable booking states.
- Selecting a container from booking result sets both selected container and selected booking context.
- Search and booking lookup are yard-scoped and permission-guarded.
- Tests, TypeScript, and lint pass.

## Rollback Plan

- Revert the UI commit to restore `/api/containers` Gate Out search.
- Revert the API commit if `/api/gate/out-search` causes operational issues; no schema rollback is required.
