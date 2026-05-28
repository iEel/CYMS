# Yard 3D Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing 3D Yard viewer feel like a polished operational digital twin while preserving current yard workflows, search highlight, selected-container actions, and live refresh behavior.

**Architecture:** Keep `YardViewer3D.tsx` as the integration component, but move visual constants and small Three.js builders into focused helper files so future layers can be added without turning the viewer into a larger monolith. Phase 1 does not change database schema or API contracts; it uses the current `zones` and `containers` payload and adds richer scene context, lighting, camera presets, and selection treatment.

**Tech Stack:** Next.js App Router, React client components, Three.js, OrbitControls, lucide-react, Jest static UI regression tests, existing `/yard` dev-server smoke flow.

---

## Visual Direction

**Visual thesis:** A calm concrete-yard digital twin: dark operational canvas, measured industrial lighting, readable zone context, and precise status emphasis.

**Content plan:** The 3D canvas remains the primary workspace; surrounding UI should support filtering, selected-container actions, and live state without adding decorative panels.

**Interaction thesis:** Operators should be able to orient instantly, focus a container smoothly, and switch camera/context views without fighting the 3D controls.

## File Structure

- Modify: `src/components/yard/YardViewer3D.tsx`
  - Keep data fetching, renderer lifecycle, raycasting, and callback wiring.
  - Consume helper functions for scene theme, lane marks, zone labels, selection outline, and camera presets.

- Create: `src/components/yard/yard3dScene.ts`
  - Owns scene palette, renderer settings, light creation, material factories, and reusable constants.

- Create: `src/components/yard/yard3dGeometry.ts`
  - Owns small geometry builders: concrete floor, lane markings, zone boundary, bay/row tick labels, direction arrows, reefer plug posts, selection outline.

- Create: `src/components/yard/Yard3DCameraToolbar.tsx`
  - Replaces the current small camera control block with clearer icon controls and compact labels.

- Modify: `src/app/api/__tests__/yard-ui.test.ts`
  - Keep existing regression coverage for color mode, camera controls, selected action panel, live yard SSE, and nested-button prevention.

- Create: `src/app/api/__tests__/yard-3d-visual-polish.test.ts`
  - Static guard tests for the new helper boundary and visual/interaction features.

- Modify: `DEVELOPER_HANDOFF.md`
  - Document the Phase 1 visual polish, files touched, and verification commands.

## Task 1: Characterization Tests

**Files:**
- Create: `src/app/api/__tests__/yard-3d-visual-polish.test.ts`
- Modify: `src/app/api/__tests__/yard-ui.test.ts`

- [ ] **Step 1: Add static regression tests for the planned helper boundary**

```ts
import fs from 'fs';
import path from 'path';

describe('Yard 3D visual polish', () => {
  const root = process.cwd();

  function read(filePath: string) {
    return fs.readFileSync(path.join(root, filePath), 'utf8');
  }

  it('keeps scene visual primitives outside the main YardViewer3D integration component', () => {
    const viewer = read('src/components/yard/YardViewer3D.tsx');

    expect(viewer).toContain('yard3dScene');
    expect(viewer).toContain('yard3dGeometry');
    expect(viewer).toContain('Yard3DCameraToolbar');
  });

  it('adds operational yard context to the 3D scene', () => {
    const geometry = read('src/components/yard/yard3dGeometry.ts');

    expect(geometry).toContain('createLaneMarkings');
    expect(geometry).toContain('createDirectionArrow');
    expect(geometry).toContain('createBayRowTicks');
    expect(geometry).toContain('createReeferPlugPosts');
  });

  it('adds a selected-container outline instead of relying only on material brightening', () => {
    const geometry = read('src/components/yard/yard3dGeometry.ts');
    const viewer = read('src/components/yard/YardViewer3D.tsx');

    expect(geometry).toContain('createSelectionOutline');
    expect(viewer).toContain('selectionOutlineRef');
  });

  it('exposes camera presets for common operator views', () => {
    const toolbar = read('src/components/yard/Yard3DCameraToolbar.tsx');

    expect(toolbar).toContain('ภาพรวม');
    expect(toolbar).toContain('ด้านบน');
    expect(toolbar).toContain('โฟกัสตู้');
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails before implementation**

Run:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-visual-polish.test.ts
```

Expected: FAIL because `yard3dScene.ts`, `yard3dGeometry.ts`, and `Yard3DCameraToolbar.tsx` do not exist yet.

## Task 2: Scene Theme And Materials

**Files:**
- Create: `src/components/yard/yard3dScene.ts`
- Modify: `src/components/yard/YardViewer3D.tsx`

- [ ] **Step 1: Create a reusable scene theme helper**

Implement `src/components/yard/yard3dScene.ts` with these exports:

```ts
import * as THREE from 'three';

export const YARD_SCENE_THEME = {
  background: 0x101827,
  fog: 0x101827,
  concrete: 0x202a38,
  concreteGridMajor: 0x40516a,
  concreteGridMinor: 0x263244,
  laneLine: 0xcbd5e1,
  zoneLabel: '#f8fafc',
  mutedLabel: '#94a3b8',
  selection: 0xfacc15,
  reeferPost: 0x22d3ee,
} as const;

export function applyRendererQuality(renderer: THREE.WebGLRenderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
}

export function createYardLights() {
  const group = new THREE.Group();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  group.add(ambientLight);

  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(24, 34, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  group.add(sun);

  const fill = new THREE.DirectionalLight(0x93c5fd, 0.18);
  fill.position.set(-18, 12, -14);
  group.add(fill);

  return group;
}

export function createConcreteMaterial() {
  return new THREE.MeshStandardMaterial({
    color: YARD_SCENE_THEME.concrete,
    roughness: 0.96,
    metalness: 0.02,
  });
}

export function createContainerBodyMaterial(color: number, selected = false) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: selected ? 0.45 : 0.64,
    metalness: 0.26,
  });
}
```

- [ ] **Step 2: Replace inline renderer and light setup in `YardViewer3D.tsx`**

Use:

```ts
import {
  YARD_SCENE_THEME,
  applyRendererQuality,
  createYardLights,
  createConcreteMaterial,
  createContainerBodyMaterial,
} from './yard3dScene';
```

Replace inline renderer quality setup with:

```ts
applyRendererQuality(renderer);
```

Replace inline lights with:

```ts
scene.add(createYardLights());
```

Replace the ground material with:

```ts
const groundMat = createConcreteMaterial();
```

Replace `new THREE.MeshStandardMaterial` for container body with `createContainerBodyMaterial(baseColor)`.

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-ui.test.ts src/app/api/__tests__/yard-3d-visual-polish.test.ts
```

Expected: Task 1 tests still partially fail until Task 3 and Task 4, but existing `yard-ui.test.ts` should continue passing.

- [ ] **Step 4: Commit**

```powershell
git add src/components/yard/yard3dScene.ts src/components/yard/YardViewer3D.tsx src/app/api/__tests__/yard-3d-visual-polish.test.ts
git commit -m "Polish 3D yard scene foundation"
```

## Task 3: Yard Context Geometry

**Files:**
- Create: `src/components/yard/yard3dGeometry.ts`
- Modify: `src/components/yard/YardViewer3D.tsx`

- [ ] **Step 1: Add geometry builders**

Implement `src/components/yard/yard3dGeometry.ts` with builders for:

```ts
import * as THREE from 'three';
import { YARD_SCENE_THEME } from './yard3dScene';

export function createLaneMarkings(width: number, depth: number, x: number, z: number) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: YARD_SCENE_THEME.laneLine,
    transparent: true,
    opacity: 0.22,
  });

  const left = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, 0.035, z),
    new THREE.Vector3(x + width, 0.035, z),
  ]);
  const right = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, 0.035, z + depth),
    new THREE.Vector3(x + width, 0.035, z + depth),
  ]);

  group.add(new THREE.Line(left, material));
  group.add(new THREE.Line(right, material));
  return group;
}

export function createDirectionArrow(x: number, z: number, rotationY = 0) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: YARD_SCENE_THEME.laneLine,
    transparent: true,
    opacity: 0.36,
    side: THREE.DoubleSide,
  });

  const shape = new THREE.Shape();
  shape.moveTo(0, 0.45);
  shape.lineTo(0.45, -0.25);
  shape.lineTo(0.16, -0.25);
  shape.lineTo(0.16, -0.72);
  shape.lineTo(-0.16, -0.72);
  shape.lineTo(-0.16, -0.25);
  shape.lineTo(-0.45, -0.25);
  shape.lineTo(0, 0.45);

  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotationY;
  mesh.position.set(x, 0.045, z);
  group.add(mesh);
  return group;
}

export function createBayRowTicks(zoneWidth: number, zoneDepth: number, baySlot: number, rowSlot: number, xOffset: number) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: YARD_SCENE_THEME.concreteGridMajor,
    transparent: true,
    opacity: 0.35,
  });

  for (let x = 0; x <= zoneWidth; x += baySlot) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOffset + x, 0.04, 0),
      new THREE.Vector3(xOffset + x, 0.04, zoneDepth),
    ]);
    group.add(new THREE.Line(geo, material));
  }

  for (let z = 0; z <= zoneDepth; z += rowSlot) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xOffset, 0.04, z),
      new THREE.Vector3(xOffset + zoneWidth, 0.04, z),
    ]);
    group.add(new THREE.Line(geo, material));
  }

  return group;
}

export function createReeferPlugPosts(zoneWidth: number, zoneDepth: number, xOffset: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: YARD_SCENE_THEME.reeferPost,
    emissive: new THREE.Color(YARD_SCENE_THEME.reeferPost).multiplyScalar(0.12),
    roughness: 0.45,
  });

  const postCount = Math.max(2, Math.floor(zoneWidth / 8));
  for (let i = 0; i < postCount; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), material);
    post.position.set(xOffset + 1 + i * Math.max(4, zoneWidth / postCount), 0.4, zoneDepth + 0.55);
    group.add(post);
  }

  return group;
}
```

- [ ] **Step 2: Add context geometry per zone in `YardViewer3D.tsx`**

Inside the `for (const zone of filteredZones)` block, after zone floor and before containers:

```ts
scene.add(createBayRowTicks(zoneWidth, zoneDepth, CW_20 + GAP_X, CD + GAP_Z, zoneOffsetX));
scene.add(createLaneMarkings(zoneWidth, zoneDepth + 1, zoneOffsetX, -0.65));
scene.add(createDirectionArrow(zoneOffsetX + zoneWidth / 2, -0.65, Math.PI / 2));

if (zone.zone_type === 'reefer') {
  scene.add(createReeferPlugPosts(zoneWidth, zoneDepth, zoneOffsetX));
}
```

- [ ] **Step 3: Run tests**

Run:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-visual-polish.test.ts
```

Expected: context geometry test passes; selection and toolbar tests still fail until later tasks.

- [ ] **Step 4: Commit**

```powershell
git add src/components/yard/yard3dGeometry.ts src/components/yard/YardViewer3D.tsx src/app/api/__tests__/yard-3d-visual-polish.test.ts
git commit -m "Add operational context to 3D yard scene"
```

## Task 4: Selected Container Treatment

**Files:**
- Modify: `src/components/yard/yard3dGeometry.ts`
- Modify: `src/components/yard/YardViewer3D.tsx`

- [ ] **Step 1: Add selection outline builder**

Append this export to `yard3dGeometry.ts`:

```ts
export function createSelectionOutline(width: number, height: number, depth: number) {
  const geometry = new THREE.BoxGeometry(width + 0.12, height + 0.12, depth + 0.12);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({
    color: YARD_SCENE_THEME.selection,
    transparent: true,
    opacity: 0.95,
  });

  return new THREE.LineSegments(edges, material);
}
```

- [ ] **Step 2: Track and update the selection outline in `YardViewer3D.tsx`**

Add a ref near the other refs:

```ts
const selectionOutlineRef = useRef<THREE.Object3D | null>(null);
```

When a container is selected, remove the old outline and add a new one:

```ts
if (selectionOutlineRef.current) {
  sceneRef.current?.remove(selectionOutlineRef.current);
  selectionOutlineRef.current = null;
}

const is40 = foundEntry.data.size === '40' || foundEntry.data.size === '45';
const width = is40 ? CW_40 : CW_20;
const height = foundEntry.data.size === '45' ? CH * 1.12 : CH;
const outline = createSelectionOutline(width, height, CD);
targetMesh.add(outline);
selectionOutlineRef.current = outline;
```

Keep the existing floating label, but reduce reliance on material brightening so colors remain meaningful.

- [ ] **Step 3: Make tooltip copy more operational**

Change tooltip text format to:

```ts
text: `${c.container_number} • ${c.size}'${c.type} • ${statusLabel} • Zone ${c.zone_name} B${c.bay}-R${c.row}-T${c.tier}`,
```

- [ ] **Step 4: Run tests**

Run:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-visual-polish.test.ts src/app/api/__tests__/yard-ui.test.ts
```

Expected: selection outline tests pass and existing Yard UI tests stay green.

- [ ] **Step 5: Commit**

```powershell
git add src/components/yard/yard3dGeometry.ts src/components/yard/YardViewer3D.tsx src/app/api/__tests__/yard-3d-visual-polish.test.ts
git commit -m "Improve 3D yard selection affordance"
```

## Task 5: Camera Toolbar

**Files:**
- Create: `src/components/yard/Yard3DCameraToolbar.tsx`
- Modify: `src/components/yard/YardViewer3D.tsx`

- [ ] **Step 1: Create a compact camera toolbar component**

Implement `src/components/yard/Yard3DCameraToolbar.tsx`:

```tsx
'use client';

import { Compass, LocateFixed, RotateCcw } from 'lucide-react';

interface Props {
  canFocusSelected: boolean;
  onOverview: () => void;
  onTopDown: () => void;
  onFocusSelected: () => void;
}

export default function Yard3DCameraToolbar({
  canFocusSelected,
  onOverview,
  onTopDown,
  onFocusSelected,
}: Props) {
  const buttonClass = 'h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-700/80 hover:text-white transition';

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 p-1 backdrop-blur">
        <button type="button" title="ภาพรวมลาน" aria-label="ภาพรวมลาน" onClick={onOverview} className={buttonClass}>
          <RotateCcw size={14} />
        </button>
        <button type="button" title="มุมมองด้านบน" aria-label="มุมมองด้านบน" onClick={onTopDown} className={buttonClass}>
          <Compass size={14} />
        </button>
        <button
          type="button"
          title="โฟกัสตู้ที่เลือก"
          aria-label="โฟกัสตู้ที่เลือก"
          onClick={onFocusSelected}
          disabled={!canFocusSelected}
          className={`${buttonClass} disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300`}
        >
          <LocateFixed size={14} />
        </button>
      </div>
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-2.5 py-1.5 text-[10px] text-slate-500 backdrop-blur">
        หมุน • Shift+ลาก • Scroll ซูม
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace inline camera controls in `YardViewer3D.tsx`**

Import:

```ts
import Yard3DCameraToolbar from './Yard3DCameraToolbar';
```

Replace the inline camera block with:

```tsx
<Yard3DCameraToolbar
  canFocusSelected={Boolean(selectedContainerNumber || highlightContainerNumber)}
  onOverview={resetYardCamera}
  onTopDown={showTopDownView}
  onFocusSelected={focusSelectedContainer}
/>
```

Remove unused icon imports from `YardViewer3D.tsx`.

- [ ] **Step 3: Run tests**

Run:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-3d-visual-polish.test.ts src/app/api/__tests__/yard-ui.test.ts
```

Expected: all focused Yard UI tests pass.

- [ ] **Step 4: Commit**

```powershell
git add src/components/yard/Yard3DCameraToolbar.tsx src/components/yard/YardViewer3D.tsx src/app/api/__tests__/yard-3d-visual-polish.test.ts src/app/api/__tests__/yard-ui.test.ts
git commit -m "Refine 3D yard camera controls"
```

## Task 6: Visual QA And Handoff

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Run focused regression tests**

Run:

```powershell
npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-ui.test.ts src/app/api/__tests__/yard-3d-visual-polish.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader verification**

Run:

```powershell
npm run lint
npm run tsc
```

Expected: both pass.

- [ ] **Step 3: Browser smoke**

With the dev server running on port `3005`, open:

```text
http://localhost:3005/yard?yard_3d_visual_polish=1
```

Verify:
- 3D canvas is not blank.
- Existing color modes still work.
- Camera overview/top/focus buttons work.
- Selecting a container shows the selected action panel.
- Zone labels, lane marks, and reefer posts do not cover container labels.
- Text in overlay controls does not overflow at desktop and tablet widths.

- [ ] **Step 4: Update handoff**

Add a short note under `### 7.9 3D Yard Viewer (Three.js)`:

```md
- **3D Yard visual polish Phase 1**: scene theme/helper split, concrete yard floor treatment, operational lane/zone context, selected-container outline, and compact camera toolbar. No schema/API changes; existing search highlight, color mode, live refresh, and selected-container action panel remain intact.
```

- [ ] **Step 5: Commit**

```powershell
git add DEVELOPER_HANDOFF.md src/components/yard src/app/api/__tests__/yard-ui.test.ts src/app/api/__tests__/yard-3d-visual-polish.test.ts
git commit -m "Document 3D yard visual polish"
```

## Phase 2 Candidates After This Plan

- Add operational layer modes: `Dwell`, `Reefer`, `Billing Hold`, `Move Recommendation`, and `Congestion`.
- Add minimap or zone strip only if operators still need orientation after camera presets.
- Move large container sets to `THREE.InstancedMesh` if browser profiling shows frame drops.
- Add Playwright/browser pixel checks for nonblank canvas and major overlay controls after the browser tool is available in the session.

## Acceptance Criteria

- Existing 3D Yard behavior still works: load, color toggle, tooltip, click select, search highlight, reset/top/focus camera, selected-container panel.
- The scene reads as a real container yard: concrete floor, zone boundaries, lane context, bay/row grid, and reefer plug posts for reefer zones.
- Selected containers are easier to see without destroying status/shipping-line color meaning.
- Toolbar controls are compact, icon-led, and usable on desktop and tablet.
- No schema or API changes are required for Phase 1.
- `npm test -- --cacheDirectory .tmp\jest --runInBand --runTestsByPath src/app/api/__tests__/yard-ui.test.ts src/app/api/__tests__/yard-3d-visual-polish.test.ts` passes.
- `npm run lint` passes.
- `npm run tsc` passes.
- `/yard` browser smoke confirms the canvas is visible and interactive.
