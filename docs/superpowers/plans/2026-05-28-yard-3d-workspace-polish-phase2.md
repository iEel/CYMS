# Yard 3D Workspace Polish Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Yard 3D view feel like a practical operations workspace: better camera framing, clearer status-first colors, compact legend, stronger workspace layout, and less confusing live-sync copy.

**Architecture:** Keep Three.js rendering inside `YardViewer3D`, but move pure camera math and legend presentation into focused units so tests can verify behavior without browser rendering. `YardPageClient` owns page-level live/sync status and 3D workspace layout, while 3D scene helpers stay in `yard3dScene.ts` and `yard3dGeometry.ts`.

**Tech Stack:** Next.js client components, React state/effects, Three.js + OrbitControls, Jest static/unit tests, Browser plugin visual verification.

---

## File Structure

- Modify: `src/components/yard/YardViewer3D.tsx`
  - Default 3D color mode.
  - Use camera helper for home/top-down/focus poses.
  - Render compact legend component.
  - Use responsive workspace height classes.
- Create: `src/components/yard/yard3dCamera.ts`
  - Pure camera/framing math for home, top-down, and focus poses.
  - No DOM or Three.js renderer dependency beyond `THREE.Vector3`.
- Create: `src/components/yard/Yard3DLegend.tsx`
  - Compact legend with visible item limit, overflow count, and short labels.
  - Keeps long shipping-line names from consuming the canvas.
- Modify: `src/components/yard/Yard3DCameraToolbar.tsx`
  - Add stronger labels/tooltips and disabled focus hint.
  - Keep icon buttons compact.
- Modify: `src/app/(dashboard)/yard/YardPageClient.tsx`
  - Rename live label copy from ambiguous "อัปเดต" to sync/connection language.
  - Use 3D workspace layout when `viewMode === '3d'`.
  - Optionally refresh yard data on a safe interval while the user is on Yard.
- Test: `src/app/api/__tests__/yard-3d-camera-framing.test.ts`
  - Unit tests for camera helper math.
- Test: `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`
  - Static tests for default status color mode, compact legend, responsive height, toolbar hints, and live-sync copy.
- Modify: `src/app/api/__tests__/yard-ui.test.ts`
  - Update existing assertions if copy or component ownership changes.
- Modify: `DEVELOPER_HANDOFF.md`
  - Record Yard 3D Phase 2 UX changes, tests, and remaining ideas.

---

## Task 1: Add Failing Tests For Current UX Gaps

**Files:**
- Create: `src/app/api/__tests__/yard-3d-camera-framing.test.ts`
- Create: `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`
- Modify: `src/app/api/__tests__/yard-ui.test.ts` only if existing static copy fails after new wording.

- [ ] **Step 1: Add camera framing tests**

Create `src/app/api/__tests__/yard-3d-camera-framing.test.ts`:

```ts
import * as THREE from 'three';
import {
  computeYardHomePose,
  computeYardTopDownPose,
  computeContainerFocusPose,
} from '@/components/yard/yard3dCamera';

describe('Yard 3D camera framing', () => {
  it('keeps home pose centered on the usable yard span', () => {
    const pose = computeYardHomePose({ totalWidth: 80, maxDepth: 12 });

    expect(pose.target.x).toBeCloseTo(40);
    expect(pose.target.z).toBeCloseTo(6);
    expect(pose.position.y).toBeGreaterThan(20);
    expect(pose.position.z).toBeLessThan(80);
  });

  it('top-down pose fits the yard without excessive empty vertical framing', () => {
    const home = computeYardHomePose({ totalWidth: 80, maxDepth: 12 });
    const topDown = computeYardTopDownPose(home);

    expect(topDown.position.x).toBeCloseTo(home.target.x);
    expect(topDown.position.z).toBeCloseTo(home.target.z, 1);
    expect(topDown.position.y).toBeLessThan(home.span * 0.95);
    expect(topDown.position.y).toBeGreaterThan(home.span * 0.45);
  });

  it('focus pose stays close enough to read the selected container context', () => {
    const target = new THREE.Vector3(20, 3, 8);
    const pose = computeContainerFocusPose(target);

    expect(pose.target).toEqual(target);
    expect(pose.position.distanceTo(target)).toBeLessThan(20);
    expect(pose.position.y).toBeGreaterThan(target.y);
  });
});
```

- [ ] **Step 2: Add workspace UI static tests**

Create `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Yard 3D workspace UI', () => {
  it('uses status colors as the default operational color mode', () => {
    const source = read('src/components/yard/YardViewer3D.tsx');
    expect(source).toContain("useState<YardColorMode>('status')");
  });

  it('uses compact legend instead of rendering long shipping names directly in YardViewer3D', () => {
    const source = read('src/components/yard/YardViewer3D.tsx');
    const legend = read('src/components/yard/Yard3DLegend.tsx');

    expect(source).toContain('Yard3DLegend');
    expect(legend).toContain('maxVisibleItems');
    expect(legend).toContain('overflowCount');
  });

  it('makes 3D a taller workspace instead of a small preview panel', () => {
    const source = read('src/components/yard/YardViewer3D.tsx');
    expect(source).toContain('min-h-[520px]');
    expect(source).toContain('h-[min(72vh,760px)]');
  });

  it('uses clearer live sync copy on the Yard page', () => {
    const source = read('src/app/(dashboard)/yard/YardPageClient.tsx');
    expect(source).toContain('เชื่อมต่ออยู่');
    expect(source).toContain('ซิงก์ล่าสุด');
    expect(source).not.toContain('อัปเดต {lastLiveRefreshLabel}');
  });

  it('keeps camera controls discoverable with labels and a disabled focus hint', () => {
    const toolbar = read('src/components/yard/Yard3DCameraToolbar.tsx');
    expect(toolbar).toContain('ภาพรวม');
    expect(toolbar).toContain('Top');
    expect(toolbar).toContain('เลือกตู้ก่อน');
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-camera-framing.test.ts src/app/api/__tests__/yard-3d-workspace-ui.test.ts
```

Expected:

```text
FAIL src/app/api/__tests__/yard-3d-camera-framing.test.ts
FAIL src/app/api/__tests__/yard-3d-workspace-ui.test.ts
```

- [ ] **Step 4: Commit failing tests**

```bash
git add src/app/api/__tests__/yard-3d-camera-framing.test.ts src/app/api/__tests__/yard-3d-workspace-ui.test.ts
git commit -m "Add Yard 3D workspace UX tests"
```

---

## Task 2: Add Camera Framing Helper

**Files:**
- Create: `src/components/yard/yard3dCamera.ts`
- Modify: `src/components/yard/YardViewer3D.tsx`
- Test: `src/app/api/__tests__/yard-3d-camera-framing.test.ts`

- [ ] **Step 1: Create pure camera helper**

Create `src/components/yard/yard3dCamera.ts`:

```ts
import * as THREE from 'three';

export interface YardCameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  span: number;
}

export function computeYardHomePose({
  totalWidth,
  maxDepth,
}: {
  totalWidth: number;
  maxDepth: number;
}): YardCameraPose {
  const width = Math.max(totalWidth, 20);
  const depth = Math.max(maxDepth, 8);
  const span = Math.max(width, depth);
  const target = new THREE.Vector3(width / 2, 1.1, depth / 2);
  const position = new THREE.Vector3(
    target.x + span * 0.12,
    Math.max(18, span * 0.34),
    target.z + Math.max(18, span * 0.42),
  );

  return { position, target, span };
}

export function computeYardTopDownPose(home: YardCameraPose): YardCameraPose {
  const height = Math.max(24, home.span * 0.72);
  return {
    position: new THREE.Vector3(home.target.x, height, home.target.z + 0.01),
    target: home.target.clone(),
    span: home.span,
  };
}

export function computeContainerFocusPose(target: THREE.Vector3): YardCameraPose {
  return {
    position: new THREE.Vector3(target.x + 9, target.y + 8, target.z + 9),
    target: target.clone(),
    span: 18,
  };
}
```

- [ ] **Step 2: Wire helper into `YardViewer3D`**

In `src/components/yard/YardViewer3D.tsx`, import:

```ts
import {
  computeContainerFocusPose,
  computeYardHomePose,
  computeYardTopDownPose,
  type YardCameraPose,
} from './yard3dCamera';
```

Replace the local `CameraPose` interface with:

```ts
type CameraPose = YardCameraPose;
```

Replace home camera calculation:

```ts
const totalWidth = Math.max(zoneOffsetX - ZONE_GAP, 20);
const maxDepth = filteredZones.reduce((max, zone) => Math.max(max, zone.max_row * (CD + GAP_Z)), 8);
const home = computeYardHomePose({ totalWidth, maxDepth });
cameraHomeRef.current = {
  position: home.position.clone(),
  target: home.target.clone(),
  span: home.span,
};
camera.position.copy(home.position);
controls.target.copy(home.target);
controls.update();
```

Replace top-down:

```ts
const topDown = computeYardTopDownPose(home);
moveCameraTo(topDown.position.clone(), topDown.target.clone());
```

Replace selected focus:

```ts
const focusPose = computeContainerFocusPose(target);
moveCameraTo(focusPose.position, focusPose.target);
```

- [ ] **Step 3: Run camera tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-camera-framing.test.ts
```

Expected:

```text
PASS src/app/api/__tests__/yard-3d-camera-framing.test.ts
```

- [ ] **Step 4: Commit camera helper**

```bash
git add src/components/yard/yard3dCamera.ts src/components/yard/YardViewer3D.tsx src/app/api/__tests__/yard-3d-camera-framing.test.ts
git commit -m "Improve Yard 3D camera framing"
```

---

## Task 3: Make Status Color The Operational Default

**Files:**
- Modify: `src/components/yard/YardViewer3D.tsx`
- Test: `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`

- [ ] **Step 1: Change default color mode**

In `src/components/yard/YardViewer3D.tsx`, change:

```ts
const [colorMode, setColorMode] = useState<YardColorMode>('shipping');
```

to:

```ts
const [colorMode, setColorMode] = useState<YardColorMode>('status');
```

- [ ] **Step 2: Keep shipping mode as a secondary option**

Keep the existing color mode options:

```tsx
[
  { key: 'status' as const, label: 'สถานะ' },
  { key: 'shipping' as const, label: 'สายเรือ' },
]
```

If changing order, ensure `สถานะ` appears first.

- [ ] **Step 3: Run workspace UI tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-workspace-ui.test.ts
```

Expected: the default color mode assertion passes.

- [ ] **Step 4: Commit default color mode**

```bash
git add src/components/yard/YardViewer3D.tsx src/app/api/__tests__/yard-3d-workspace-ui.test.ts
git commit -m "Default Yard 3D to status colors"
```

---

## Task 4: Add Compact 3D Legend

**Files:**
- Create: `src/components/yard/Yard3DLegend.tsx`
- Modify: `src/components/yard/YardViewer3D.tsx`
- Test: `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`

- [ ] **Step 1: Create compact legend component**

Create `src/components/yard/Yard3DLegend.tsx`:

```tsx
'use client';

interface LegendItem {
  label: string;
  color: string;
  count?: number;
}

interface Props {
  title: string;
  items: LegendItem[];
  note?: string;
  maxVisibleItems?: number;
}

function shortLabel(label: string) {
  if (label.length <= 24) return label;
  return `${label.slice(0, 21)}...`;
}

export default function Yard3DLegend({
  title,
  items,
  note,
  maxVisibleItems = 4,
}: Props) {
  const visibleItems = items.slice(0, maxVisibleItems);
  const overflowCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 backdrop-blur">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </span>
      {visibleItems.map((item) => (
        <span key={item.label} title={item.label} className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-1 text-[10px] text-slate-200">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          <span>{shortLabel(item.label)}</span>
          {typeof item.count === 'number' && <span className="text-slate-500">{item.count}</span>}
        </span>
      ))}
      {overflowCount > 0 && (
        <span className="rounded-md bg-slate-800/80 px-2 py-1 text-[10px] font-semibold text-slate-400">
          +{overflowCount}
        </span>
      )}
      {note && <span className="text-[10px] text-slate-500">{note}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Count shipping legend items**

In `YardViewer3D.tsx`, replace `activeShippingLegend` with:

```ts
const activeShippingLegend = Array.from(
  containers.reduce((map, c) => {
    if (!c.shipping_line) return map;
    map.set(c.shipping_line, (map.get(c.shipping_line) || 0) + 1);
    return map;
  }, new Map<string, number>())
)
  .sort((a, b) => b[1] - a[1])
  .map(([line, count]) => ({
    label: line,
    color: hexColor(SHIPPING_COLORS[line] || STATUS_COLORS.in_yard),
    count,
  }));
```

- [ ] **Step 3: Render `Yard3DLegend`**

Import:

```ts
import Yard3DLegend from './Yard3DLegend';
```

Replace the inline legend block with:

```tsx
<Yard3DLegend
  title={colorMode === 'shipping' ? 'สีตู้: สายเรือ' : 'สีตู้: สถานะ'}
  items={colorMode === 'shipping'
    ? activeShippingLegend
    : STATUS_LEGEND.map(s => ({
        label: s.label,
        color: hexColor(STATUS_COLORS[s.key] || STATUS_COLORS.in_yard),
      }))
  }
  note={colorMode === 'shipping' ? 'Hold/Repair แสดงสีสถานะ' : undefined}
  maxVisibleItems={colorMode === 'shipping' ? 4 : 6}
/>
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-workspace-ui.test.ts src/app/api/__tests__/yard-ui.test.ts
```

Expected: both suites pass.

- [ ] **Step 5: Commit compact legend**

```bash
git add src/components/yard/Yard3DLegend.tsx src/components/yard/YardViewer3D.tsx src/app/api/__tests__/yard-3d-workspace-ui.test.ts src/app/api/__tests__/yard-ui.test.ts
git commit -m "Compact Yard 3D legend"
```

---

## Task 5: Improve 3D Workspace Height And Panel Composition

**Files:**
- Modify: `src/components/yard/YardViewer3D.tsx`
- Modify: `src/app/(dashboard)/yard/YardPageClient.tsx`
- Test: `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`

- [ ] **Step 1: Change 3D canvas height**

In `YardViewer3D.tsx`, change the root wrapper class from:

```tsx
<div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-slate-700">
```

to:

```tsx
<div className="relative w-full min-h-[520px] h-[min(72vh,760px)] rounded-xl overflow-hidden border border-slate-700">
```

Also update loading skeleton height to match:

```tsx
<div className="w-full min-h-[520px] h-[min(72vh,760px)] rounded-xl bg-slate-900 flex items-center justify-center">
```

- [ ] **Step 2: Keep selected panel near the 3D workspace without crowding**

In `YardPageClient.tsx`, when `viewMode === '3d'`, keep `YardViewer3D` first and render `selectedContainerActionPanel` immediately after it with reduced top margin:

```tsx
{viewMode === '3d' && (
  <div className="space-y-3">
    <YardViewer3D
      yardId={yardId}
      selectedZone={filterZone}
      highlightContainerNumber={highlightNumber}
      onSelectContainer={setSelectedContainer}
    />
    {selectedContainerActionPanel}
  </div>
)}
```

Do not introduce nested cards. Reuse the existing selected panel component.

- [ ] **Step 3: Run UI tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-workspace-ui.test.ts
```

Expected: workspace height assertion passes.

- [ ] **Step 4: Commit workspace height**

```bash
git add src/components/yard/YardViewer3D.tsx src/app/(dashboard)/yard/YardPageClient.tsx src/app/api/__tests__/yard-3d-workspace-ui.test.ts
git commit -m "Make Yard 3D a taller workspace"
```

---

## Task 6: Clarify Camera Toolbar Affordance

**Files:**
- Modify: `src/components/yard/Yard3DCameraToolbar.tsx`
- Test: `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`

- [ ] **Step 1: Add visible compact text labels on desktop**

Update button classes to allow icon plus short label:

```tsx
const buttonClass = 'h-8 inline-flex items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-slate-300 hover:bg-slate-700/80 hover:text-white transition';
```

Use:

```tsx
<RotateCcw size={14} />
<span className="hidden sm:inline">ภาพรวม</span>
```

```tsx
<Compass size={14} />
<span className="hidden sm:inline">Top</span>
```

```tsx
<LocateFixed size={14} />
<span className="hidden sm:inline">{canFocusSelected ? 'Focus' : 'เลือกตู้ก่อน'}</span>
```

- [ ] **Step 2: Keep disabled focus explicit**

Set focus button title:

```tsx
title={canFocusSelected ? 'โฟกัสตู้ที่เลือก' : 'เลือกตู้ก่อน'}
```

Set `aria-label` similarly.

- [ ] **Step 3: Run toolbar test**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-workspace-ui.test.ts
```

Expected: toolbar assertion passes.

- [ ] **Step 4: Commit toolbar copy**

```bash
git add src/components/yard/Yard3DCameraToolbar.tsx src/app/api/__tests__/yard-3d-workspace-ui.test.ts
git commit -m "Clarify Yard 3D camera controls"
```

---

## Task 7: Clarify Live Sync Label And Yard Data Refresh

**Files:**
- Modify: `src/app/(dashboard)/yard/YardPageClient.tsx`
- Modify: `src/app/api/__tests__/yard-ui.test.ts`
- Test: `src/app/api/__tests__/yard-3d-workspace-ui.test.ts`
- Test: `src/app/api/__tests__/yard-ui.test.ts`

- [ ] **Step 1: Rename live metadata**

In `YardPageClient.tsx`, change live status labels:

```ts
const LIVE_STATUS_STYLE: Record<YardLiveStatus, { label: string; dot: string; text: string; bg: string }> = {
  connecting: { label: 'กำลังเชื่อมต่อ', ... },
  live: { label: 'เชื่อมต่ออยู่', ... },
  reconnecting: { label: 'กำลังต่อใหม่', ... },
  offline: { label: 'ไม่ได้เชื่อมต่อ', ... },
};
```

Change rendered copy:

```tsx
<span className="font-normal opacity-75">ซิงก์ล่าสุด {lastLiveRefreshLabel}</span>
```

- [ ] **Step 2: Make initial data fetch set a sync timestamp**

At the end of successful `fetchData`, add:

```ts
setLastLiveRefreshAt(new Date());
```

This ensures the label reflects initial yard data load, not only SSE work-order changes.

- [ ] **Step 3: Add safe interval refresh while on Yard**

Add:

```ts
useEffect(() => {
  const interval = window.setInterval(fetchData, 30000);
  return () => window.clearInterval(interval);
}, [fetchData]);
```

Keep SSE for operation events; the interval handles container/yard freshness.

- [ ] **Step 4: Update static tests**

If `yard-ui.test.ts` expects `Live Yard`, update it to expect:

```ts
expect(source).toContain('เชื่อมต่ออยู่');
expect(source).toContain('ซิงก์ล่าสุด');
```

- [ ] **Step 5: Run Yard tests**

Run:

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-workspace-ui.test.ts src/app/api/__tests__/yard-ui.test.ts
```

Expected: both suites pass.

- [ ] **Step 6: Commit sync label**

```bash
git add src/app/(dashboard)/yard/YardPageClient.tsx src/app/api/__tests__/yard-3d-workspace-ui.test.ts src/app/api/__tests__/yard-ui.test.ts
git commit -m "Clarify Yard live sync status"
```

---

## Task 8: Browser QA Across 3D Viewports

**Files:**
- No code changes unless Browser QA finds a regression.
- Modify relevant source/test files if fixes are needed.

- [ ] **Step 1: Start or confirm dev server**

If server is already running on `http://localhost:3005`, keep it. If not, start it using the project dev command.

- [ ] **Step 2: Verify desktop 3D**

Use Browser plugin:

1. Open `http://localhost:3005/yard`.
2. Click `3D`.
3. Confirm canvas is nonblank.
4. Confirm default color mode is `สถานะ`.
5. Confirm top-down view uses most of the canvas and does not shrink the yard into a tiny strip.
6. Confirm legend is compact and does not cover key yard content.
7. Confirm selected container panel remains usable.

- [ ] **Step 3: Verify mobile/narrow viewport**

Use Browser viewport capability or a narrow window:

1. Confirm no horizontal page overflow.
2. Confirm camera toolbar labels collapse acceptably.
3. Confirm legend wraps without covering the whole lower half of the canvas.
4. Confirm the selected panel remains below the canvas.

- [ ] **Step 4: Check console**

Read browser console logs. Expected:

```text
No Three.js runtime errors.
No React hydration errors.
No failed fetches for /api/yard/stats or /api/containers.
```

- [ ] **Step 5: Fix any Browser QA issues**

If QA finds issues, add a focused test first, then patch the smallest relevant file.

- [ ] **Step 6: Commit Browser QA fixes**

```bash
git add src/components/yard src/app/(dashboard)/yard src/app/api/__tests__
git commit -m "Fix Yard 3D browser QA issues"
```

Skip this commit if no fixes were needed.

---

## Task 9: Final Verification And Handoff

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add a short section under current Yard/3D notes:

```md
### Yard 3D Workspace Phase 2

- Default 3D color mode is status-first for operations; shipping-line color remains available.
- Camera framing now uses shared helper math for overview, top-down, and selected-container focus.
- 3D canvas uses taller responsive workspace sizing.
- Legend is compact and limits long shipping-line labels.
- Live status copy now separates connection state from last yard data sync.
- Browser QA should verify desktop and narrow viewport canvas rendering after future 3D changes.
```

- [ ] **Step 2: Run focused tests**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-camera-framing.test.ts src/app/api/__tests__/yard-3d-workspace-ui.test.ts src/app/api/__tests__/yard-ui.test.ts src/app/api/__tests__/yard-3d-visual-polish.test.ts
```

Expected:

```text
PASS all listed Yard 3D suites
```

- [ ] **Step 3: Run full verification**

```bash
npm test -- --cacheDirectory .tmp\jest --runInBand
npm run lint
npx tsc --noEmit
```

Expected:

```text
Jest: all suites pass
ESLint: exits 0
TypeScript: exits 0
```

- [ ] **Step 4: Commit handoff**

```bash
git add DEVELOPER_HANDOFF.md
git commit -m "Document Yard 3D workspace polish"
```

- [ ] **Step 5: Push branch**

```bash
git push origin codex/api-permission-hardening
```

---

## Self-Review

- Spec coverage: covers top-down framing, default status color, compact legend, taller 3D workspace, clearer camera controls, live-sync wording, Browser QA, tests, and handoff.
- Placeholder scan: no TBD/TODO/fill-in-later instructions remain.
- Type consistency: `YardCameraPose`, `computeYardHomePose`, `computeYardTopDownPose`, and `computeContainerFocusPose` are defined before use and referenced consistently.
- Scope check: this plan only targets Yard 3D workspace UX and does not expand into Yard allocation, 2D yard, Bay view, or backend yard data model changes.
