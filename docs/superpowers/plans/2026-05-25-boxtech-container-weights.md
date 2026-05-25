# BoxTech Container Weights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and display BoxTech `tare` and `max gross` values as container technical specs, while keeping Gate Out read-only unless a later actual/VGM weight source is added.

**Architecture:** `/api/boxtech` already returns `tare_kg` and `max_gross_mass_kg`; this plan maps those values into first-class `Containers` columns during Gate In and optional Gate Out refresh. UI surfaces the values as reference specs in Gate In, Gate Out, Container 360, and EIR payloads. The values are not used as actual cargo weight and do not drive yard weight limit decisions.

**Tech Stack:** Next.js App Router, TypeScript React components, MS SQL Server via `mssql`, Jest static/API tests, existing migration script `scripts/migrate-runtime-core-schema.js`.

---

## File Structure

- Modify: `scripts/setup-db.js` — add the new columns for fresh databases.
- Modify: `scripts/migrate-runtime-core-schema.js` — add idempotent column guards for existing databases.
- Modify: `src/app/api/boxtech/route.ts` — normalize numeric BoxTech weight fields in the response.
- Modify: `src/app/api/gate/route.ts` — accept weight spec fields and persist them on Gate In create/re-entry; Gate Out keeps existing values.
- Modify: `src/app/(dashboard)/gate/types.ts` — expose container technical spec fields to Gate Out search results.
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx` — capture BoxTech values, show badges, send them to Gate In.
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx` — show read-only spec values and add an optional "ดึง BoxTech อีกครั้ง" refresh when values are missing.
- Modify: `src/app/api/containers/detail/route.ts` — return the new columns through Container 360 detail payload.
- Modify: `src/components/yard/ContainerDetailModal.tsx` — show the specs in Container 360.
- Modify: `src/lib/eirPayload.ts` and `src/components/gate/EIRDocument.tsx` — include and print the spec values as reference data.
- Modify: `DEVELOPER_HANDOFF.md` — document the BoxTech technical spec behavior.
- Create: `src/app/api/__tests__/boxtech-container-weights.test.ts` — static/API guard tests for schema, persistence, and UI coverage.

---

### Task 1: Schema Columns

**Files:**
- Modify: `scripts/setup-db.js`
- Modify: `scripts/migrate-runtime-core-schema.js`
- Test: `src/app/api/__tests__/boxtech-container-weights.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `src/app/api/__tests__/boxtech-container-weights.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('BoxTech container technical weights', () => {
  const root = process.cwd();

  it('adds persistent container technical spec columns for fresh and existing databases', () => {
    const setup = fs.readFileSync(path.join(root, 'scripts/setup-db.js'), 'utf8');
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    for (const column of [
      'tare_weight_kg',
      'max_gross_weight_kg',
      'boxtech_group_st',
      'boxtech_source',
      'boxtech_fetched_at',
    ]) {
      expect(setup).toContain(column);
      expect(migration).toContain(`COL_LENGTH('Containers', '${column}')`);
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because the new column names are not in `setup-db.js` or `migrate-runtime-core-schema.js`.

- [ ] **Step 3: Add columns to fresh DB setup**

In `scripts/setup-db.js`, inside `CREATE TABLE Containers`, add the fields after `seal_number`:

```js
          tare_weight_kg     INT,
          max_gross_weight_kg INT,
          boxtech_group_st    NVARCHAR(10),
          boxtech_source      NVARCHAR(30),
          boxtech_fetched_at  DATETIME2,
```

- [ ] **Step 4: Add idempotent migration guards**

In `scripts/migrate-runtime-core-schema.js`, in the first `runStep(pool, 'Gate/billing clearance columns', ...)` block after the existing `container_grade` guard, add:

```sql
      IF COL_LENGTH('Containers', 'tare_weight_kg') IS NULL
        ALTER TABLE Containers ADD tare_weight_kg INT NULL;
      IF COL_LENGTH('Containers', 'max_gross_weight_kg') IS NULL
        ALTER TABLE Containers ADD max_gross_weight_kg INT NULL;
      IF COL_LENGTH('Containers', 'boxtech_group_st') IS NULL
        ALTER TABLE Containers ADD boxtech_group_st NVARCHAR(10) NULL;
      IF COL_LENGTH('Containers', 'boxtech_source') IS NULL
        ALTER TABLE Containers ADD boxtech_source NVARCHAR(30) NULL;
      IF COL_LENGTH('Containers', 'boxtech_fetched_at') IS NULL
        ALTER TABLE Containers ADD boxtech_fetched_at DATETIME2 NULL;
```

- [ ] **Step 5: Run the schema test**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-db.js scripts/migrate-runtime-core-schema.js src/app/api/__tests__/boxtech-container-weights.test.ts
git commit -m "Add container BoxTech weight columns"
```

---

### Task 2: BoxTech Weight Normalization

**Files:**
- Modify: `src/app/api/boxtech/route.ts`
- Test: `src/app/api/__tests__/boxtech-container-weights.test.ts`

- [ ] **Step 1: Extend the test for API response field names**

Append this test to `boxtech-container-weights.test.ts`:

```ts
  it('normalizes BoxTech tare and max gross fields for downstream persistence', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/api/boxtech/route.ts'), 'utf8');

    expect(source).toContain('response.tare_weight_kg');
    expect(source).toContain('response.max_gross_weight_kg');
    expect(source).toContain('response.max_gross_mass_kg');
    expect(source).toContain('Number(containerData.tare_kg)');
    expect(source).toContain('Number(containerData.max_gross_mass_kg)');
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because the route currently returns only `tare_kg` and `max_gross_mass_kg`.

- [ ] **Step 3: Normalize fields in `/api/boxtech`**

In `src/app/api/boxtech/route.ts`, replace the extra details block:

```ts
    if (containerData?.tare_kg) response.tare_kg = containerData.tare_kg;
    if (containerData?.max_gross_mass_kg) response.max_gross_mass_kg = containerData.max_gross_mass_kg;
    if (containerData?.manufacture_date) response.manufacture_date = containerData.manufacture_date;
```

with:

```ts
    const tareWeightKg = Number(containerData?.tare_kg);
    const maxGrossWeightKg = Number(containerData?.max_gross_mass_kg);
    if (Number.isFinite(tareWeightKg) && tareWeightKg > 0) {
      response.tare_kg = tareWeightKg;
      response.tare_weight_kg = tareWeightKg;
    }
    if (Number.isFinite(maxGrossWeightKg) && maxGrossWeightKg > 0) {
      response.max_gross_mass_kg = maxGrossWeightKg;
      response.max_gross_weight_kg = maxGrossWeightKg;
    }
    if (containerData?.manufacture_date) response.manufacture_date = containerData.manufacture_date;
```

- [ ] **Step 4: Run the test**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/boxtech/route.ts src/app/api/__tests__/boxtech-container-weights.test.ts
git commit -m "Normalize BoxTech container weights"
```

---

### Task 3: Gate In Persistence

**Files:**
- Modify: `src/app/api/gate/route.ts`
- Test: `src/app/api/__tests__/boxtech-container-weights.test.ts`

- [ ] **Step 1: Extend the API persistence test**

Append:

```ts
  it('persists BoxTech weight specs during Gate In create and re-entry', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/api/gate/route.ts'), 'utf8');

    expect(source).toContain('tare_weight_kg: z.coerce.number().int().positive().optional().nullable()');
    expect(source).toContain('max_gross_weight_kg: z.coerce.number().int().positive().optional().nullable()');
    expect(source).toContain('boxtech_group_st: z.string().max(10).optional().nullable()');
    expect(source).toContain("boxtech_source: z.string().max(30).optional().nullable()");
    expect(source).toContain(".input('tareWeightKg', sql.Int, tare_weight_kg || null)");
    expect(source).toContain(".input('maxGrossWeightKg', sql.Int, max_gross_weight_kg || null)");
    expect(source).toContain('tare_weight_kg = @tareWeightKg');
    expect(source).toContain('max_gross_weight_kg = @maxGrossWeightKg');
    expect(source).toContain('boxtech_fetched_at = @boxtechFetchedAt');
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because Gate In does not accept or persist these fields yet.

- [ ] **Step 3: Extend request validation**

In `src/app/api/gate/route.ts`, add to `gateBodySchema`:

```ts
  tare_weight_kg: z.coerce.number().int().positive().optional().nullable(),
  max_gross_weight_kg: z.coerce.number().int().positive().optional().nullable(),
  boxtech_group_st: z.string().max(10).optional().nullable(),
  boxtech_source: z.string().max(30).optional().nullable(),
```

In the body destructuring, add:

```ts
      tare_weight_kg, max_gross_weight_kg, boxtech_group_st, boxtech_source,
```

- [ ] **Step 4: Persist specs on re-entry update**

In the existing container update request, add inputs:

```ts
          .input('tareWeightKg', sql.Int, tare_weight_kg || null)
          .input('maxGrossWeightKg', sql.Int, max_gross_weight_kg || null)
          .input('boxtechGroupSt', sql.NVarChar, boxtech_group_st || null)
          .input('boxtechSource', sql.NVarChar, boxtech_source || null)
          .input('boxtechFetchedAt', sql.DateTime2, tare_weight_kg || max_gross_weight_kg ? new Date() : null)
```

Add to the `UPDATE Containers SET` block:

```sql
              tare_weight_kg = COALESCE(@tareWeightKg, tare_weight_kg),
              max_gross_weight_kg = COALESCE(@maxGrossWeightKg, max_gross_weight_kg),
              boxtech_group_st = COALESCE(@boxtechGroupSt, boxtech_group_st),
              boxtech_source = COALESCE(@boxtechSource, boxtech_source),
              boxtech_fetched_at = COALESCE(@boxtechFetchedAt, boxtech_fetched_at),
```

- [ ] **Step 5: Persist specs on new container insert**

In the insert request, add the same inputs as Step 4.

Change the insert column list to:

```sql
            INSERT INTO Containers (container_number, size, type, status, yard_id, zone_id,
              bay, [row], tier, shipping_line, is_laden, is_soc, container_owner_id,
              container_grade, seal_number, tare_weight_kg, max_gross_weight_kg,
              boxtech_group_st, boxtech_source, boxtech_fetched_at, gate_in_date)
```

Change the values list to:

```sql
            VALUES (@containerNumber, @size, @type, @status, @yardId, @zoneId,
              @bay, @row, @tier, @shippingLine, @isLaden, @isSoc, @ownerId,
              @containerGrade, @sealNumber, @tareWeightKg, @maxGrossWeightKg,
              @boxtechGroupSt, @boxtechSource, @boxtechFetchedAt, @gateInDate)
```

- [ ] **Step 6: Run the persistence test**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/gate/route.ts src/app/api/__tests__/boxtech-container-weights.test.ts
git commit -m "Persist BoxTech weights on gate in"
```

---

### Task 4: Gate In UI Capture And Display

**Files:**
- Modify: `src/app/(dashboard)/gate/GateInTab.tsx`
- Test: `src/app/api/__tests__/boxtech-container-weights.test.ts`

- [ ] **Step 1: Extend the UI test**

Append:

```ts
  it('shows BoxTech weight specs in Gate In and submits them with the transaction', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');

    expect(source).toContain('tare_weight_kg?: number');
    expect(source).toContain('max_gross_weight_kg?: number');
    expect(source).toContain('Tare');
    expect(source).toContain('Max Gross');
    expect(source).toContain('tare_weight_kg: boxtechResult?.tare_weight_kg || null');
    expect(source).toContain('max_gross_weight_kg: boxtechResult?.max_gross_weight_kg || null');
    expect(source).toContain('boxtech_group_st: boxtechResult?.group_st || null');
    expect(source).toContain("boxtech_source: boxtechResult?.source === 'boxtech' ? 'boxtech' : null");
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL because Gate In does not show or submit weight specs yet.

- [ ] **Step 3: Extend `boxtechResult` type**

In `GateInTab.tsx`, add to the `boxtechResult` state type:

```ts
    tare_weight_kg?: number;
    max_gross_weight_kg?: number;
    tare_kg?: number;
    max_gross_mass_kg?: number;
    group_st?: string;
```

- [ ] **Step 4: Show spec badges under the container number**

Under the existing BoxTech/customer badges, add:

```tsx
                    {boxtechResult?.tare_weight_kg && (
                      <span className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                        Tare {Number(boxtechResult.tare_weight_kg).toLocaleString()} kg
                      </span>
                    )}
                    {boxtechResult?.max_gross_weight_kg && (
                      <span className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                        Max Gross {Number(boxtechResult.max_gross_weight_kg).toLocaleString()} kg
                      </span>
                    )}
```

- [ ] **Step 5: Submit specs with Gate In**

Find the Gate In POST body and add:

```ts
        tare_weight_kg: boxtechResult?.tare_weight_kg || null,
        max_gross_weight_kg: boxtechResult?.max_gross_weight_kg || null,
        boxtech_group_st: boxtechResult?.group_st || null,
        boxtech_source: boxtechResult?.source === 'boxtech' ? 'boxtech' : null,
```

- [ ] **Step 6: Run the UI test**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/gate/GateInTab.tsx src/app/api/__tests__/boxtech-container-weights.test.ts
git commit -m "Show BoxTech weights in gate in"
```

---

### Task 5: Gate Out Read-Only Spec Display

**Files:**
- Modify: `src/app/(dashboard)/gate/types.ts`
- Modify: `src/app/(dashboard)/gate/GateOutTab.tsx`
- Modify: `src/app/api/containers/route.ts`
- Test: `src/app/api/__tests__/boxtech-container-weights.test.ts`

- [ ] **Step 1: Extend the Gate Out test**

Append:

```ts
  it('shows BoxTech weight specs in Gate Out without requiring manual entry', () => {
    const types = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/types.ts'), 'utf8');
    const gateOut = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
    const containersRoute = fs.readFileSync(path.join(root, 'src/app/api/containers/route.ts'), 'utf8');

    expect(types).toContain('tare_weight_kg?: number | null');
    expect(types).toContain('max_gross_weight_kg?: number | null');
    expect(containersRoute).toContain('tare_weight_kg');
    expect(containersRoute).toContain('max_gross_weight_kg');
    expect(gateOut).toContain('ข้อมูลสเปกจาก BoxTech');
    expect(gateOut).toContain('Tare');
    expect(gateOut).toContain('Max Gross');
    expect(gateOut).toContain('ไม่ใช่น้ำหนักจริง/VGM');
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL.

- [ ] **Step 3: Extend the Gate Out container type**

In `src/app/(dashboard)/gate/types.ts`, add to `ContainerResult`:

```ts
  tare_weight_kg?: number | null;
  max_gross_weight_kg?: number | null;
  boxtech_group_st?: string | null;
  boxtech_source?: string | null;
  boxtech_fetched_at?: string | null;
```

- [ ] **Step 4: Ensure container listing selects the columns**

In `src/app/api/containers/route.ts`, the query currently uses `SELECT c.*`; keep that behavior. Add a short comment near the query:

```ts
    // c.* includes BoxTech technical spec fields used by Gate Out and Container 360.
```

- [ ] **Step 5: Add read-only display in Gate Out selected container panel**

In `GateOutTab.tsx`, under the selected container summary, add:

```tsx
                {(selectedContainer.tare_weight_kg || selectedContainer.max_gross_weight_kg) && (
                  <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3">
                    <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">ข้อมูลสเปกจาก BoxTech</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedContainer.tare_weight_kg && (
                        <span className="rounded bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 dark:text-slate-300">
                          Tare {Number(selectedContainer.tare_weight_kg).toLocaleString()} kg
                        </span>
                      )}
                      {selectedContainer.max_gross_weight_kg && (
                        <span className="rounded bg-white dark:bg-slate-800 px-2 py-1 text-slate-600 dark:text-slate-300">
                          Max Gross {Number(selectedContainer.max_gross_weight_kg).toLocaleString()} kg
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">เป็นสเปกตู้ ไม่ใช่น้ำหนักจริง/VGM</p>
                  </div>
                )}
```

- [ ] **Step 6: Run the Gate Out test**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/gate/types.ts src/app/(dashboard)/gate/GateOutTab.tsx src/app/api/containers/route.ts src/app/api/__tests__/boxtech-container-weights.test.ts
git commit -m "Show BoxTech weights in gate out"
```

---

### Task 6: Container 360 And EIR Display

**Files:**
- Modify: `src/lib/eirPayload.ts`
- Modify: `src/components/gate/EIRDocument.tsx`
- Modify: `src/components/yard/ContainerDetailModal.tsx`
- Test: `src/app/api/__tests__/boxtech-container-weights.test.ts`

- [ ] **Step 1: Extend the display test**

Append:

```ts
  it('surfaces BoxTech specs in Container 360 and EIR documents', () => {
    const eirPayload = fs.readFileSync(path.join(root, 'src/lib/eirPayload.ts'), 'utf8');
    const eirDocument = fs.readFileSync(path.join(root, 'src/components/gate/EIRDocument.tsx'), 'utf8');
    const detailModal = fs.readFileSync(path.join(root, 'src/components/yard/ContainerDetailModal.tsx'), 'utf8');

    expect(eirPayload).toContain('tare_weight_kg: number');
    expect(eirPayload).toContain('max_gross_weight_kg: number');
    expect(eirPayload).toContain('tare_weight_kg: asNumber(row.tare_weight_kg)');
    expect(eirPayload).toContain('max_gross_weight_kg: asNumber(row.max_gross_weight_kg)');
    expect(eirDocument).toContain('Tare Weight');
    expect(eirDocument).toContain('Max Gross');
    expect(detailModal).toContain('Tare Weight');
    expect(detailModal).toContain('Max Gross');
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: FAIL.

- [ ] **Step 3: Extend EIR payload type**

In `src/lib/eirPayload.ts`, add to `EIRPayload`:

```ts
  tare_weight_kg: number;
  max_gross_weight_kg: number;
```

In `buildEIRPayload`, add:

```ts
    tare_weight_kg: asNumber(row.tare_weight_kg),
    max_gross_weight_kg: asNumber(row.max_gross_weight_kg),
```

- [ ] **Step 4: Print specs on EIR**

In `src/components/gate/EIRDocument.tsx`, add two `InfoCell` entries near the size/type block:

```tsx
              <InfoCell label="Tare Weight" value={data.tare_weight_kg ? `${data.tare_weight_kg.toLocaleString()} kg` : '-'} className="p-2" />
              <InfoCell label="Max Gross" value={data.max_gross_weight_kg ? `${data.max_gross_weight_kg.toLocaleString()} kg` : '-'} className="p-2" />
```

- [ ] **Step 5: Show specs in Container 360**

In `src/components/yard/ContainerDetailModal.tsx`, add to the container info grid:

```tsx
              <InfoField label="Tare Weight" value={c.tare_weight_kg ? `${Number(c.tare_weight_kg).toLocaleString()} kg` : '—'} />
              <InfoField label="Max Gross" value={c.max_gross_weight_kg ? `${Number(c.max_gross_weight_kg).toLocaleString()} kg` : '—'} />
```

Ensure the local container type/interface includes:

```ts
    tare_weight_kg?: number | null;
    max_gross_weight_kg?: number | null;
```

- [ ] **Step 6: Run the display test**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/eirPayload.ts src/components/gate/EIRDocument.tsx src/components/yard/ContainerDetailModal.tsx src/app/api/__tests__/boxtech-container-weights.test.ts
git commit -m "Show BoxTech weights in documents"
```

---

### Task 7: Handoff And Final Verification

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add under the BoxTech/Gate section:

```md
- **BoxTech container specs**: `/api/boxtech` normalizes `tare_kg` and `max_gross_mass_kg` into `tare_weight_kg` / `max_gross_weight_kg`; Gate In persists them to `Containers`, while Gate Out, Container 360, and EIR show them as read-only technical specs. These are not actual/VGM weights.
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/app/api/__tests__/boxtech-container-weights.test.ts --runInBand --cacheDirectory ./.next/jest-cache
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 4: Run TypeScript**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: exit code 0.

- [ ] **Step 5: Browser verify**

Open `http://localhost:3005/gate`:

1. Enter a valid container number with BoxTech data.
2. Confirm Gate In shows `Tare` and `Max Gross` badges.
3. Submit Gate In and confirm no error.
4. Search the same container in Gate Out and confirm the selected container panel shows the read-only spec block.
5. Open EIR and Container 360 to confirm the spec values display.

- [ ] **Step 6: Commit and push**

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Document BoxTech container specs"
git push origin master
```

---

## Self-Review

- Spec coverage: Covers schema, BoxTech normalization, Gate In persistence, Gate Out read-only behavior, Container 360, EIR, docs, and verification.
- Placeholder scan: No TBD/TODO placeholders; each step includes exact files, commands, and expected results.
- Type consistency: Uses `tare_weight_kg`, `max_gross_weight_kg`, `boxtech_group_st`, `boxtech_source`, and `boxtech_fetched_at` consistently across schema, API, and UI.
