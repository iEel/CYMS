# Continuous Receipt Template Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Continuous Tax Invoice / Receipt Designer and Preview render from the same template-driven paper canvas so full-form print output matches the visual designer.

**Architecture:** Replace the hard-coded `FullReceipt` layout path with a shared template canvas renderer that reads layout elements from `DocumentTemplateConfig`. Keep the existing paper/field/line-items config backward compatible by deriving a default full-form element set when older templates do not yet have `elements`.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest static/unit tests, CSS absolute positioning in `mm`, existing `DocumentTemplates` / `DocumentTemplateVersions` APIs.

---

## File Structure

- Modify `src/lib/documentTemplateTypes.ts`
  - Add `DocumentTemplateElement` and optional `elements?: DocumentTemplateElement[]` to `DocumentTemplateConfig`.
  - Element types: `text`, `bound_text`, `box`, `line`, `image`, `checkbox`, `line_items`, `totals_table`.

- Create `src/lib/documentTemplateCanvas.ts`
  - Shared helpers for rendering and designer preview: `normalizeTemplateCanvasConfig`, `buildSonicFullFormElements`, `elementValue`, `elementBounds`.
  - Converts legacy configs into a full-form element list without mutating stored data.

- Modify `src/lib/documentTemplates.ts`
  - Accept and validate `elements`.
  - Parse old configs without `elements`.
  - Keep `repairStoredTemplateConfig` behavior for older line item header settings.

- Modify `src/lib/documentTemplateDefaults.ts`
  - Add SONIC-style default `elements` matching the sample form.
  - Keep existing `fields` for overlay mode and field palette compatibility.

- Modify `src/components/billing/ContinuousTaxReceipt.tsx`
  - Replace hard-coded `FullReceipt` body with `TemplateCanvasReceipt`.
  - Render `full` mode from `elements`.
  - Render `overlay` mode from data-only elements/fields.
  - Keep line-items data formatting and print CSS.

- Create `src/components/billing/TemplateCanvasReceipt.tsx`
  - Pure presentational renderer for paper canvas elements.
  - Uses `position:absolute`, `mm` units, and payload bindings.
  - No fetch, no DB, no permission logic.

- Modify `src/components/document-templates/TemplateCanvas.tsx`
  - Render full-form `elements` behind/alongside editable fields.
  - Allow selecting/editing elements in a later task, but MVP should at least display the same form chrome as Preview.

- Modify `src/components/document-templates/DocumentTemplateDesigner.tsx`
  - Add element/field selection model only if needed for MVP.
  - Keep existing field selection working.

- Modify `src/components/document-templates/FieldInspector.tsx`
  - Keep current field inspector unchanged for existing fields.
  - Do not overload it with element editing in the first task unless the element is represented as a field.

- Test files:
  - Modify `src/app/api/__tests__/continuous-print-ui.test.ts`
  - Modify `src/app/api/__tests__/document-template-designer-ui.test.ts`
  - Modify `src/app/api/__tests__/document-template-designer.test.ts`

---

## Task 1: Add Canvas Element Types And Normalization

**Files:**
- Modify: `src/lib/documentTemplateTypes.ts`
- Create: `src/lib/documentTemplateCanvas.ts`
- Test: `src/app/api/__tests__/document-template-designer.test.ts`

- [ ] **Step 1: Write failing tests for template elements**

Add tests that prove a legacy config without `elements` is normalized into a full-form canvas:

```ts
import { buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplateDefaults';
import { normalizeTemplateCanvasConfig } from '@/lib/documentTemplateCanvas';

it('normalizes legacy full-form templates into canvas elements', () => {
  const config = buildDefaultContinuousTemplateConfig();
  const legacy = { ...config };
  delete (legacy as { elements?: unknown }).elements;

  const normalized = normalizeTemplateCanvasConfig(legacy);

  expect(normalized.elements?.some(element => element.element_id === 'sonic-company-header')).toBe(true);
  expect(normalized.elements?.some(element => element.type === 'line_items')).toBe(true);
  expect(normalized.elements?.every(element => element.x_mm + element.width_mm <= normalized.paper.width_mm)).toBe(true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/document-template-designer.test.ts
```

Expected: FAIL because `documentTemplateCanvas` and `elements` do not exist yet.

- [ ] **Step 3: Add element types**

Update `src/lib/documentTemplateTypes.ts`:

```ts
export type DocumentTemplateElementType =
  | 'text'
  | 'bound_text'
  | 'box'
  | 'line'
  | 'image'
  | 'checkbox'
  | 'line_items'
  | 'totals_table';

export interface DocumentTemplateElement {
  element_id: string;
  type: DocumentTemplateElementType;
  label: string;
  binding_source?: string;
  text?: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  font_size?: number;
  font_weight?: DocumentTemplateFontWeight;
  text_align?: DocumentTemplateTextAlign;
  visible: boolean;
  layer: DocumentTemplateFieldLayer;
  locked: boolean;
  border?: boolean;
  border_width_mm?: number;
  class_name?: string;
}
```

Add to `DocumentTemplateConfig`:

```ts
elements?: DocumentTemplateElement[];
```

- [ ] **Step 4: Create normalization helper**

Create `src/lib/documentTemplateCanvas.ts` with:

```ts
import type { DocumentTemplateConfig, DocumentTemplateElement } from './documentTemplateTypes';

function cloneConfig(config: DocumentTemplateConfig): DocumentTemplateConfig {
  return JSON.parse(JSON.stringify(config)) as DocumentTemplateConfig;
}

function element(input: Omit<DocumentTemplateElement, 'visible' | 'layer' | 'locked'> & Partial<Pick<DocumentTemplateElement, 'visible' | 'layer' | 'locked'>>): DocumentTemplateElement {
  return {
    visible: true,
    layer: 'form',
    locked: true,
    ...input,
  };
}

export function buildSonicFullFormElements(config: DocumentTemplateConfig): DocumentTemplateElement[] {
  const lineItems = config.sections.line_items;
  return [
    element({ element_id: 'sonic-logo', type: 'image', label: 'Logo', binding_source: 'company.logo_url', x_mm: 8, y_mm: 5, width_mm: 26, height_mm: 25 }),
    element({ element_id: 'sonic-company-header', type: 'bound_text', label: 'Company header', binding_source: 'company.company_name', x_mm: 38, y_mm: 4, width_mm: 110, height_mm: 24, font_size: 14, font_weight: 'bold', text_align: 'left' }),
    element({ element_id: 'sonic-copy-box', type: 'bound_text', label: 'Copy label', binding_source: 'document.copy_label', x_mm: 162, y_mm: 5, width_mm: 70, height_mm: 18, font_size: 13, font_weight: 'bold', text_align: 'center', border: true }),
    element({ element_id: 'sonic-customer-box', type: 'box', label: 'Customer box', x_mm: 4, y_mm: 31, width_mm: config.paper.width_mm - 8, height_mm: 31, border: true }),
    element({ element_id: 'sonic-line-items', type: 'line_items', label: 'Line items', x_mm: lineItems.x_mm, y_mm: lineItems.y_mm, width_mm: lineItems.width_mm, height_mm: Math.max(0, lineItems.start_y_mm - lineItems.y_mm) + lineItems.row_height_mm * lineItems.max_rows }),
    element({ element_id: 'sonic-payment-box', type: 'box', label: 'Payment and totals', x_mm: 4, y_mm: 112, width_mm: config.paper.width_mm - 8, height_mm: 20, border: true }),
    element({ element_id: 'sonic-amount-text', type: 'bound_text', label: 'Amount text', binding_source: 'totals.amount_text_th', x_mm: 4, y_mm: 132, width_mm: config.paper.width_mm - 8, height_mm: 7, font_size: 9, font_weight: 'semibold', text_align: 'left', border: true }),
    element({ element_id: 'sonic-footer', type: 'bound_text', label: 'Collector', binding_source: 'payment.collector_name', x_mm: 4, y_mm: config.paper.height_mm - 16, width_mm: 120, height_mm: 12, font_size: 9, font_weight: 'normal', text_align: 'left' }),
  ];
}

export function normalizeTemplateCanvasConfig(config: DocumentTemplateConfig): DocumentTemplateConfig {
  const next = cloneConfig(config);
  if (!Array.isArray(next.elements) || next.elements.length === 0) {
    next.elements = buildSonicFullFormElements(next);
  }
  return next;
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/document-template-designer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/documentTemplateTypes.ts src/lib/documentTemplateCanvas.ts src/app/api/__tests__/document-template-designer.test.ts
git commit -m "Add document template canvas element model"
```

---

## Task 2: Store Default Full-Form Elements In New Templates

**Files:**
- Modify: `src/lib/documentTemplateDefaults.ts`
- Modify: `src/lib/documentTemplates.ts`
- Test: `src/app/api/__tests__/document-template-designer.test.ts`

- [ ] **Step 1: Write failing tests for default config**

Add:

```ts
it('creates default continuous templates with full-form canvas elements', () => {
  const config = buildDefaultContinuousTemplateConfig();

  expect(config.elements?.map(element => element.element_id)).toEqual(expect.arrayContaining([
    'sonic-logo',
    'sonic-company-header',
    'sonic-copy-box',
    'sonic-customer-box',
    'sonic-line-items',
  ]));
});
```

- [ ] **Step 2: Run and verify RED**

Run the same Jest file. Expected: FAIL because default config does not include `elements`.

- [ ] **Step 3: Add elements to defaults**

In `src/lib/documentTemplateDefaults.ts`, import and apply:

```ts
import { buildSonicFullFormElements } from './documentTemplateCanvas';
```

Build the config object first, then return:

```ts
const config: DocumentTemplateConfig = {
  paper: { ... },
  mode: 'full',
  copy_mode: 'carbonless',
  copy_labels: [...THAI_COPY_LABELS],
  print_policy: { ... },
  fields: [ ... ],
  sections: { ... },
};

return {
  ...config,
  elements: buildSonicFullFormElements(config),
};
```

- [ ] **Step 4: Preserve legacy parsing**

In `src/lib/documentTemplates.ts`, make `parseStoredTemplateConfig()` return `normalizeTemplateCanvasConfig(parsedConfig)` after current repair/validation succeeds.

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/document-template-designer.test.ts src/app/api/__tests__/document-template-api.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/documentTemplateDefaults.ts src/lib/documentTemplates.ts src/app/api/__tests__/document-template-designer.test.ts
git commit -m "Store full-form canvas elements in document templates"
```

---

## Task 3: Replace Hard-Coded FullReceipt With Shared Canvas Renderer

**Files:**
- Create: `src/components/billing/TemplateCanvasReceipt.tsx`
- Modify: `src/components/billing/ContinuousTaxReceipt.tsx`
- Test: `src/app/api/__tests__/continuous-print-ui.test.ts`

- [ ] **Step 1: Write failing tests for renderer unification**

Add tests:

```ts
it('renders full receipts through the shared template canvas renderer', () => {
  expect(source).toContain('TemplateCanvasReceipt');
  expect(source).toContain('normalizeTemplateCanvasConfig(config)');
  expect(source).not.toContain('function FullReceipt');
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/continuous-print-ui.test.ts
```

Expected: FAIL because `FullReceipt` is still used.

- [ ] **Step 3: Create `TemplateCanvasReceipt`**

Implement a presentational component that:

- Accepts `payload`, normalized `config`, `mode`, `copyLabel`, `reprintLabel`, `testPrint`.
- Renders `config.elements`.
- For `line_items`, reuses existing line item rendering logic.
- For `bound_text`, resolves `binding_source` from payload.
- For `box`, renders an empty bordered block.
- For `image`, renders company logo or fallback.
- Uses CSS `left/top/width/height` in `mm`.

Core shape:

```tsx
export function TemplateCanvasReceipt({ payload, config, mode, copyLabel, reprintLabel, testPrint }: TemplateCanvasReceiptProps) {
  const elements = normalizeTemplateCanvasConfig(config).elements || [];
  return (
    <div className="ctr-canvas">
      {elements.filter(element => element.visible).map(element => (
        <TemplateElement key={element.element_id} element={element} payload={payload} mode={mode} copyLabel={copyLabel} />
      ))}
      {reprintLabel ? <div className="ctr-reprint">{reprintLabel}</div> : null}
      {testPrint ? <CalibrationMarks /> : null}
    </div>
  );
}
```

- [ ] **Step 4: Wire `ContinuousTaxReceipt`**

In `ContinuousTaxReceipt.tsx`:

- Keep `money`, `lineItemValue`, `lineItemsBoxStyle`, `CalibrationMarks` exports if tests/imports use them.
- Remove `FullReceipt`.
- Normalize config once:

```ts
const normalizedConfig = normalizeTemplateCanvasConfig(config);
```

- Render:

```tsx
<TemplateCanvasReceipt
  payload={payload}
  config={normalizedConfig}
  mode={mode}
  copyLabel={labels[index] || labels[0] || DEFAULT_COPY_LABELS[0]}
  reprintLabel={reprintLabel}
  testPrint={testPrint}
/>
```

- [ ] **Step 5: Run print UI tests**

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/continuous-print-ui.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/billing/TemplateCanvasReceipt.tsx src/components/billing/ContinuousTaxReceipt.tsx src/app/api/__tests__/continuous-print-ui.test.ts
git commit -m "Render continuous receipts from template canvas"
```

---

## Task 4: Show The Same Full Form Canvas In Designer

**Files:**
- Modify: `src/components/document-templates/TemplateCanvas.tsx`
- Modify: `src/components/document-templates/DocumentTemplateDesigner.tsx`
- Test: `src/app/api/__tests__/document-template-designer-ui.test.ts`

- [ ] **Step 1: Write failing Designer parity tests**

Add:

```ts
it('renders full-form template elements in the designer canvas', () => {
  const source = read('src/components/document-templates/TemplateCanvas.tsx');

  expect(source).toContain('normalizeTemplateCanvasConfig(config)');
  expect(source).toContain('normalizedConfig.elements');
  expect(source).toContain('element.type ===');
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/document-template-designer-ui.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Render form elements behind editable fields**

In `TemplateCanvas.tsx`:

- Import `normalizeTemplateCanvasConfig`.
- Use normalized config for `pageStyle`, `lineRegion`, fields, and elements.
- Render elements before `line_items` and fields.
- Use `pointer-events-none` for locked form elements in MVP so existing field drag behavior is not broken.

Example:

```tsx
const normalizedConfig = normalizeTemplateCanvasConfig(config);

{normalizedConfig.elements?.filter(element => element.visible && element.type !== 'line_items').map(element => (
  <div
    key={element.element_id}
    className="pointer-events-none absolute overflow-hidden text-slate-700"
    style={elementStyle(element, zoom)}
  >
    {element.text || element.label}
  </div>
))}
```

- [ ] **Step 4: Keep editable fields above form chrome**

Ensure the existing `config.fields.map(...)` block is rendered after static form elements and uses a higher z-index:

```tsx
className={`absolute z-20 flex items-center ...`}
```

- [ ] **Step 5: Run Designer tests**

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/document-template-designer-ui.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/document-templates/TemplateCanvas.tsx src/components/document-templates/DocumentTemplateDesigner.tsx src/app/api/__tests__/document-template-designer-ui.test.ts
git commit -m "Show full-form canvas elements in document designer"
```

---

## Task 5: Make Full And Overlay Mode Behavior Explicit

**Files:**
- Modify: `src/components/billing/TemplateCanvasReceipt.tsx`
- Modify: `src/components/document-templates/DocumentTemplateDesigner.tsx`
- Test: `src/app/api/__tests__/continuous-print-ui.test.ts`

- [ ] **Step 1: Write tests for mode filtering**

Add:

```ts
it('renders full mode with form and data layers while overlay mode hides form chrome', () => {
  const source = fs.readFileSync(componentPath, 'utf8');

  expect(source).toContain("mode === 'overlay'");
  expect(source).toContain("element.layer === 'form'");
  expect(source).toContain('return null');
});
```

- [ ] **Step 2: Run and verify RED**

Run continuous print UI tests. Expected: FAIL until filtering exists.

- [ ] **Step 3: Implement filtering**

In `TemplateCanvasReceipt`, define:

```ts
function shouldRenderElement(mode: DocumentTemplateMode, element: DocumentTemplateElement) {
  if (!element.visible) return false;
  if (mode === 'overlay' && element.layer === 'form') return false;
  return true;
}
```

Use it before rendering elements.

- [ ] **Step 4: Add Designer mode hint**

In `DocumentTemplateDesigner.tsx`, add small utility copy near status:

- `Full mode: form + data layers print`
- `Overlay mode: data layer only prints`

Do not add large explanation blocks.

- [ ] **Step 5: Run tests**

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/continuous-print-ui.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/billing/TemplateCanvasReceipt.tsx src/components/document-templates/DocumentTemplateDesigner.tsx src/app/api/__tests__/continuous-print-ui.test.ts
git commit -m "Clarify full and overlay template rendering"
```

---

## Task 6: Verify Preview/Designer Parity And Print Safety

**Files:**
- Modify tests only unless verification finds a defect.
- Test:
  - `src/app/api/__tests__/continuous-print-ui.test.ts`
  - `src/app/api/__tests__/document-template-designer-ui.test.ts`
  - `src/app/api/__tests__/document-template-designer.test.ts`

- [ ] **Step 1: Run focused tests**

```powershell
npm test -- --runInBand --runTestsByPath src/app/api/__tests__/continuous-print-ui.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/document-template-designer.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

```powershell
npx tsc --noEmit
```

Expected: no output and exit code 0.

- [ ] **Step 3: Run lint**

```powershell
npm run lint
```

Expected: `eslint` passes with exit code 0.

- [ ] **Step 4: Manual browser check**

Open:

```text
http://localhost:3005/settings?tab=document-templates
```

Check:

- Designer shows the same SONIC-style form frame as Preview.
- Changing paper size still clamps elements/line items.
- Clicking `Company Name` still opens Inspector.
- Multi-line line item header labels still render on separate lines.

Open Preview:

```text
http://localhost:3005/billing/print/continuous?preview=sample&type=tax_invoice_receipt&templateId=<selected>&versionNo=<draft>
```

Check:

- Preview form frame matches Designer.
- Full mode prints form chrome.
- Overlay mode hides form chrome and keeps data positions.

- [ ] **Step 5: Update handoff**

Add to `DEVELOPER_HANDOFF.md`:

```md
### Continuous Receipt Template Canvas
- Full Receipt preview now uses the same template canvas model as Document Templates.
- `DocumentTemplateConfig.elements` defines full-form chrome and data blocks.
- `full` mode prints form + data layers; `overlay` mode prints data/calibration layers only.
- Legacy templates without `elements` are normalized at runtime with SONIC-style default elements.
```

- [ ] **Step 6: Final commit**

```powershell
git add DEVELOPER_HANDOFF.md
git commit -m "Document continuous receipt canvas renderer"
```

---

## Self-Review

- Spec coverage: The plan makes Designer and Preview share one template-driven renderer, keeps overlay mode, preserves legacy configs, and verifies print safety.
- Scope check: This is limited to Continuous Tax Invoice / Receipt. It does not implement EIR/Statement designers or advanced line item table design.
- Type consistency: `DocumentTemplateElement`, `DocumentTemplateConfig.elements`, `normalizeTemplateCanvasConfig`, and `TemplateCanvasReceipt` are introduced before later tasks use them.
- Risk control: The plan keeps the existing print route and document number flow untouched. The main risk is visual drift, handled by browser checks and focused Jest tests.
