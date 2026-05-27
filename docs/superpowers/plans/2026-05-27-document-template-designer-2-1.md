# Document Template Designer 2.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Continuous Tax Invoice / Receipt designer usable for production print alignment by adding editable line-item regions, calibration profiles, print history, and publish diff without replacing the current renderer.

**Architecture:** Keep `DocumentTemplateConfig` as the source of truth. Extend the existing designer helpers and canvas to support both normal fields and the structured `sections.line_items` region, then make `ContinuousTaxReceipt` consume the same section settings for preview/print. Keep calibration and history inside the current Document Templates module and reuse `DocumentPrintLogs`, `DocumentPrintSnapshots`, and existing document-number flow.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Tailwind CSS, Jest, MS SQL via existing DB helper.

---

## File Map

- `src/lib/documentTemplateTypes.ts`: add calibration profile types and line-item column constraints.
- `src/lib/documentTemplateDesigner.ts`: add line-item section patch/move/resize helpers, calibration helpers, publish diff helper, stricter validation.
- `src/lib/documentTemplates.ts`: normalize calibration profiles and keep default continuous template compatible.
- `src/components/document-templates/DocumentTemplateDesigner.tsx`: switch selection from field-only to field-or-line-items, wire keyboard nudges, side panels, and status.
- `src/components/document-templates/TemplateCanvas.tsx`: make line-item region selectable, draggable, resizable, and visibly table-like.
- `src/components/document-templates/LineItemsInspector.tsx`: new inspector for line-item geometry and columns.
- `src/components/document-templates/CalibrationProfilesPanel.tsx`: new compact UI for saved printer/paper alignment profiles.
- `src/components/document-templates/PrintHistoryPanel.tsx`: new recent print/reprint history UI.
- `src/components/document-templates/PublishDiffDialog.tsx`: new publish confirmation with meaningful config changes.
- `src/components/document-templates/DesignerStatusBar.tsx`: display selected line-item section state.
- `src/components/document-templates/LayerList.tsx`: include line-item region in the data layer selection list.
- `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`: compose the new panels and pass calibration/history/publish-diff state.
- `src/components/billing/ContinuousTaxReceipt.tsx`: render line-item rows from `config.sections.line_items` and clamp overflow.
- `src/app/api/document-templates/preview/route.ts`: accept optional calibration profile id and apply it for preview only.
- `src/app/api/document-templates/test-print/route.ts`: accept calibration settings without writing print logs.
- `src/app/api/document-templates/print-history/route.ts`: new read-only print history endpoint.
- `src/app/api/__tests__/document-template-designer.test.ts`: helper and validation coverage.
- `src/app/api/__tests__/document-template-designer-ui.test.ts`: source-level UI wiring coverage.
- `src/app/api/__tests__/continuous-print-ui.test.ts`: renderer source coverage for section-driven line items.
- `src/app/api/__tests__/document-template-api.test.ts`: API contract coverage for preview/test-print/history.
- `src/app/api/__tests__/document-print-log.test.ts`: assert print history still uses existing print log shape.
- `DEVELOPER_HANDOFF.md`: update the current implementation state, migration notes, and verification commands.

---

### Task 1: Config Types, Calibration Helpers, And Validation

**Files:**
- Modify: `src/lib/documentTemplateTypes.ts`
- Modify: `src/lib/documentTemplateDesigner.ts`
- Modify: `src/lib/documentTemplates.ts`
- Test: `src/app/api/__tests__/document-template-designer.test.ts`

- [ ] **Step 1: Write failing tests for stricter line-item validation and calibration config**

Add these test cases to `src/app/api/__tests__/document-template-designer.test.ts`:

```ts
import {
  applyCalibrationProfileToConfig,
  applyLineItemsPatch,
  validateDesignerTemplateConfig,
} from '@/lib/documentTemplateDesigner';
import { buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplates';

describe('document template designer 2.1 validation', () => {
  it('rejects duplicate line item column ids', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.columns = [
      { column_id: 'description', field_key: 'description', label: 'Description', width_mm: 100, text_align: 'left', format: 'text' },
      { column_id: 'description', field_key: 'amount', label: 'Amount', width_mm: 30, text_align: 'right', format: 'currency:THB' },
    ];

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items column_id description must be unique');
  });

  it('rejects line item columns that are not backed by lines[] bindings', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.columns[0].field_key = 'invoice_number';

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items column invoice_number is not allowed');
  });

  it('clamps line item movement to paper bounds', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const moved = applyLineItemsPatch(config, { x_mm: 400, y_mm: 400 });

    expect(moved.sections.line_items.x_mm + moved.sections.line_items.width_mm).toBeLessThanOrEqual(moved.paper.width_mm);
    expect(moved.sections.line_items.y_mm + moved.sections.line_items.row_height_mm * moved.sections.line_items.max_rows).toBeLessThanOrEqual(moved.paper.height_mm);
  });

  it('applies a calibration profile to paper settings without changing profile data', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const withProfile = {
      ...config,
      calibration_profiles: [{
        profile_id: 'epson-lq-310-95x55',
        profile_name: 'Epson LQ-310 9.5 x 5.5',
        paper_label: '9.5in x 5.5in',
        width_mm: 241.3,
        height_mm: 139.7,
        top_offset_mm: 2,
        left_offset_mm: 3,
        print_scale: 0.98,
        notes: 'Billing counter printer',
      }],
      default_calibration_profile_id: 'epson-lq-310-95x55',
    };

    const calibrated = applyCalibrationProfileToConfig(withProfile, 'epson-lq-310-95x55');

    expect(calibrated.paper.top_offset_mm).toBe(2);
    expect(calibrated.paper.left_offset_mm).toBe(3);
    expect(calibrated.paper.print_scale).toBe(0.98);
    expect(calibrated.calibration_profiles?.[0].profile_name).toBe('Epson LQ-310 9.5 x 5.5');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the new assertions fail**

Run: `npm test -- src/app/api/__tests__/document-template-designer.test.ts --runInBand`

Expected: `FAIL` with missing exports such as `applyCalibrationProfileToConfig` or validation messages not found.

- [ ] **Step 3: Extend template config types**

In `src/lib/documentTemplateTypes.ts`, add these exports above `DocumentTemplateConfig`:

```ts
export type DocumentTemplateLineItemFormat = 'text' | 'number' | 'currency:THB';

export interface DocumentTemplateCalibrationProfile {
  profile_id: string;
  profile_name: string;
  paper_label: string;
  width_mm: number;
  height_mm: number;
  top_offset_mm: number;
  left_offset_mm: number;
  print_scale: number;
  notes?: string;
}
```

Change the line-item column `format` type:

```ts
format: DocumentTemplateLineItemFormat;
```

Extend `DocumentTemplateConfig`:

```ts
calibration_profiles?: DocumentTemplateCalibrationProfile[];
default_calibration_profile_id?: string;
```

- [ ] **Step 4: Add line-item and calibration helpers**

In `src/lib/documentTemplateDesigner.ts`, import `DocumentTemplateLineItemsSection` and `DocumentTemplateCalibrationProfile`, then add:

```ts
export type LineItemsPatch = Partial<Pick<
  DocumentTemplateLineItemsSection,
  'x_mm' | 'y_mm' | 'width_mm' | 'row_height_mm' | 'max_rows'
>>;

export type LineItemColumnPatch = Partial<Pick<
  DocumentTemplateLineItemsSection['columns'][number],
  'label' | 'width_mm' | 'text_align' | 'format'
>>;

const LINE_ITEM_FIELD_KEYS = ['description', 'qty', 'unit_price', 'amount'] as const;

function isLineItemFieldKey(value: unknown): value is typeof LINE_ITEM_FIELD_KEYS[number] {
  return typeof value === 'string' && LINE_ITEM_FIELD_KEYS.includes(value as typeof LINE_ITEM_FIELD_KEYS[number]);
}

function lineItemsHeight(section: DocumentTemplateLineItemsSection) {
  return section.row_height_mm * section.max_rows;
}

function clampLineItemsToPaper(
  config: DocumentTemplateConfig,
  section: DocumentTemplateLineItemsSection,
): DocumentTemplateLineItemsSection {
  const width = clampMm(section.width_mm, 20, config.paper.width_mm);
  const rowHeight = clampMm(section.row_height_mm, 3, 20);
  const maxRows = Math.max(1, Math.min(50, Math.round(section.max_rows)));
  const height = rowHeight * maxRows;
  const x = clampMm(section.x_mm, 0, Math.max(0, config.paper.width_mm - width));
  const y = clampMm(section.y_mm, 0, Math.max(0, config.paper.height_mm - height));

  return {
    ...section,
    x_mm: x,
    y_mm: y,
    start_y_mm: y + rowHeight,
    width_mm: width,
    row_height_mm: rowHeight,
    max_rows: maxRows,
  };
}

export function applyLineItemsPatch(config: DocumentTemplateConfig, patch: LineItemsPatch): DocumentTemplateConfig {
  const next = cloneConfig(config);
  next.sections.line_items = clampLineItemsToPaper(next, {
    ...next.sections.line_items,
    ...patch,
  });
  return next;
}

export function resizeLineItems(
  config: DocumentTemplateConfig,
  size: { widthMm: number; heightMm: number; snapMm: number },
): DocumentTemplateConfig {
  const section = config.sections.line_items;
  const rowHeight = Math.max(3, section.row_height_mm);
  return applyLineItemsPatch(config, {
    width_mm: snapMm(size.widthMm, size.snapMm),
    max_rows: Math.max(1, Math.round(snapMm(size.heightMm, size.snapMm) / rowHeight)),
  });
}

export function nudgeLineItems(
  config: DocumentTemplateConfig,
  nudge: FieldNudge,
): DocumentTemplateConfig {
  const section = config.sections.line_items;
  return applyLineItemsPatch(config, {
    x_mm: snapMm(section.x_mm + nudge.dxMm, nudge.snapMm),
    y_mm: snapMm(section.y_mm + nudge.dyMm, nudge.snapMm),
  });
}

export function applyLineItemColumnPatch(
  config: DocumentTemplateConfig,
  columnId: string,
  patch: LineItemColumnPatch,
): DocumentTemplateConfig {
  const next = cloneConfig(config);
  next.sections.line_items.columns = next.sections.line_items.columns.map(column => {
    if (column.column_id !== columnId) return column;
    return {
      ...column,
      ...patch,
      width_mm: patch.width_mm === undefined ? column.width_mm : clampMm(patch.width_mm, 5, next.sections.line_items.width_mm),
      text_align: patch.text_align && ['left', 'center', 'right'].includes(patch.text_align) ? patch.text_align : column.text_align,
      format: patch.format && ['text', 'number', 'currency:THB'].includes(patch.format) ? patch.format : column.format,
    };
  });
  return next;
}

export function addLineItemColumn(config: DocumentTemplateConfig, fieldKey: string): DocumentTemplateConfig {
  if (!isLineItemFieldKey(fieldKey)) return config;
  const next = cloneConfig(config);
  const used = new Set(next.sections.line_items.columns.map(column => column.column_id));
  let suffix = 1;
  let columnId = fieldKey;
  while (used.has(columnId)) {
    suffix += 1;
    columnId = `${fieldKey}-${suffix}`;
  }
  next.sections.line_items.columns = [
    ...next.sections.line_items.columns,
    {
      column_id: columnId,
      field_key: fieldKey,
      label: titleFromBinding(`lines[].${fieldKey}`),
      width_mm: 24,
      text_align: fieldKey === 'description' ? 'left' : 'right',
      format: fieldKey === 'amount' || fieldKey === 'unit_price' ? 'currency:THB' : fieldKey === 'qty' ? 'number' : 'text',
    },
  ];
  return next;
}

export function removeLineItemColumn(config: DocumentTemplateConfig, columnId: string): DocumentTemplateConfig {
  const columns = config.sections.line_items.columns;
  if (columns.length <= 1) return config;
  const next = cloneConfig(config);
  next.sections.line_items.columns = columns.filter(column => column.column_id !== columnId);
  return next;
}

export function moveLineItemColumn(config: DocumentTemplateConfig, columnId: string, direction: -1 | 1): DocumentTemplateConfig {
  const next = cloneConfig(config);
  const columns = [...next.sections.line_items.columns];
  const index = columns.findIndex(column => column.column_id === columnId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= columns.length) return config;
  [columns[index], columns[target]] = [columns[target], columns[index]];
  next.sections.line_items.columns = columns;
  return next;
}

export function applyCalibrationProfileToConfig(
  config: DocumentTemplateConfig,
  profileId: string,
): DocumentTemplateConfig {
  const profile = config.calibration_profiles?.find(item => item.profile_id === profileId);
  if (!profile) return config;
  return {
    ...cloneConfig(config),
    paper: {
      ...config.paper,
      width_mm: profile.width_mm,
      height_mm: profile.height_mm,
      top_offset_mm: profile.top_offset_mm,
      left_offset_mm: profile.left_offset_mm,
      print_scale: profile.print_scale,
    },
    default_calibration_profile_id: profile.profile_id,
  };
}
```

- [ ] **Step 5: Tighten designer validation**

In `validateDesignerTemplateConfig`, replace the current `if (lineItems) { ... }` block with validation that checks bounds, duplicate column ids, allowed `field_key`, unsafe labels, positive widths, and allowed formats:

```ts
if (!lineItems) {
  errors.push('sections.line_items must be an object');
} else {
  const xMm = Number(lineItems.x_mm);
  const yMm = Number(lineItems.y_mm);
  const widthMm = Number(lineItems.width_mm);
  const maxRows = Number(lineItems.max_rows);
  const rowHeightMm = Number(lineItems.row_height_mm);
  const columns = Array.isArray(lineItems.columns) ? lineItems.columns : [];

  if (!Number.isFinite(xMm) || xMm < 0) errors.push('sections.line_items.x_mm must be 0 or greater');
  if (!Number.isFinite(yMm) || yMm < 0) errors.push('sections.line_items.y_mm must be 0 or greater');
  if (!Number.isFinite(widthMm) || widthMm <= 0) errors.push('sections.line_items.width_mm must be greater than 0');
  if (!Number.isFinite(rowHeightMm) || rowHeightMm <= 0) errors.push('sections.line_items.row_height_mm must be greater than 0');
  if (!Number.isFinite(maxRows) || maxRows <= 0) errors.push('sections.line_items.max_rows must be greater than 0');
  if (Number.isFinite(xMm) && Number.isFinite(widthMm) && xMm + widthMm > paperWidth) errors.push('sections.line_items exceeds paper width');
  if (Number.isFinite(yMm) && Number.isFinite(maxRows) && Number.isFinite(rowHeightMm) && yMm + (maxRows * rowHeightMm) > paperHeight) errors.push('sections.line_items exceeds paper height');
  if (columns.length === 0) errors.push('sections.line_items.columns must contain at least one column');

  const columnIds = new Set<string>();
  for (const [index, columnValue] of columns.entries()) {
    if (!isRecord(columnValue)) {
      errors.push(`sections.line_items.columns[${index}] must be an object`);
      continue;
    }
    const columnId = String(columnValue.column_id || '');
    const fieldKey = String(columnValue.field_key || '');
    const label = String(columnValue.label || '');
    const columnWidth = Number(columnValue.width_mm);
    if (!columnId) errors.push(`sections.line_items.columns[${index}].column_id is required`);
    if (columnIds.has(columnId)) errors.push(`sections.line_items column_id ${columnId} must be unique`);
    columnIds.add(columnId);
    if (!isLineItemFieldKey(fieldKey)) errors.push(`sections.line_items column ${fieldKey || index} is not allowed`);
    if (hasUnsafeText(label)) errors.push(`sections.line_items column ${columnId || index} contains unsafe text`);
    if (!Number.isFinite(columnWidth) || columnWidth <= 0) errors.push(`sections.line_items column ${columnId || index} width_mm must be greater than 0`);
    if (!stringIn(columnValue.text_align, ['left', 'center', 'right'] as readonly DocumentTemplateTextAlign[])) errors.push(`sections.line_items column ${columnId || index} text_align is invalid`);
    if (!stringIn(columnValue.format, ['text', 'number', 'currency:THB'] as const)) errors.push(`sections.line_items column ${columnId || index} format is invalid`);
  }
}
```

Add calibration profile validation below it:

```ts
const profiles = Array.isArray(config.calibration_profiles) ? config.calibration_profiles : [];
const profileIds = new Set<string>();
for (const [index, profileValue] of profiles.entries()) {
  if (!isRecord(profileValue)) {
    errors.push(`calibration_profiles[${index}] must be an object`);
    continue;
  }
  const profileId = String(profileValue.profile_id || '');
  if (!profileId) errors.push(`calibration_profiles[${index}].profile_id is required`);
  if (profileIds.has(profileId)) errors.push(`calibration profile_id ${profileId} must be unique`);
  profileIds.add(profileId);
  for (const numericKey of ['width_mm', 'height_mm', 'top_offset_mm', 'left_offset_mm', 'print_scale'] as const) {
    const numericValue = Number(profileValue[numericKey]);
    if (!Number.isFinite(numericValue) || numericValue < 0) errors.push(`calibration_profiles[${index}].${numericKey} must be 0 or greater`);
  }
  if (hasUnsafeText(profileValue.profile_name) || hasUnsafeText(profileValue.paper_label) || hasUnsafeText(profileValue.notes)) {
    errors.push(`calibration profile ${profileId || index} contains unsafe text`);
  }
}
if (config.default_calibration_profile_id && !profileIds.has(String(config.default_calibration_profile_id))) {
  errors.push('default_calibration_profile_id must reference an existing calibration profile');
}
```

- [ ] **Step 6: Normalize optional config in the template helper**

In `src/lib/documentTemplates.ts`, when building or normalizing `DocumentTemplateConfig`, ensure missing calibration fields become:

```ts
calibration_profiles: Array.isArray(config.calibration_profiles) ? config.calibration_profiles : [],
default_calibration_profile_id: typeof config.default_calibration_profile_id === 'string'
  ? config.default_calibration_profile_id
  : undefined,
```

If the file has a `buildDefaultContinuousTemplateConfig()` return object, add:

```ts
calibration_profiles: [],
default_calibration_profile_id: undefined,
```

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- src/app/api/__tests__/document-template-designer.test.ts --runInBand`

Expected: `PASS`.

Commit:

```powershell
git add src/lib/documentTemplateTypes.ts src/lib/documentTemplateDesigner.ts src/lib/documentTemplates.ts src/app/api/__tests__/document-template-designer.test.ts
git commit -m "Add document template designer config validation"
```

---

### Task 2: Selectable Line-Item Region On Canvas

**Files:**
- Modify: `src/components/document-templates/DocumentTemplateDesigner.tsx`
- Modify: `src/components/document-templates/TemplateCanvas.tsx`
- Modify: `src/components/document-templates/DesignerStatusBar.tsx`
- Modify: `src/components/document-templates/LayerList.tsx`
- Test: `src/app/api/__tests__/document-template-designer-ui.test.ts`

- [ ] **Step 1: Write source-level UI tests**

Add assertions to `src/app/api/__tests__/document-template-designer-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('document template designer line item UI wiring', () => {
  it('uses a field-or-line-items selection model', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    expect(source).toContain("type DesignerSelection");
    expect(source).toContain("type: 'line_items'");
    expect(source).toContain('nudgeLineItems');
  });

  it('renders line items as a selectable table region instead of passive text', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');
    expect(source).toContain('Line items · lines[]');
    expect(source).toContain('beginLineItemsDrag');
    expect(source).toContain('resizeLineItems');
    expect(source).toContain('lineRegion.columns.map');
  });

  it('shows line items in status and layer list', () => {
    expect(read('src/components/document-templates/DesignerStatusBar.tsx')).toContain('selectedKind');
    expect(read('src/components/document-templates/LayerList.tsx')).toContain('onSelectLineItems');
  });
});
```

- [ ] **Step 2: Run UI tests and confirm failure**

Run: `npm test -- src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand`

Expected: `FAIL` because `DesignerSelection`, `beginLineItemsDrag`, and `onSelectLineItems` are not present.

- [ ] **Step 3: Add selection union and keyboard nudge**

In `src/components/document-templates/DocumentTemplateDesigner.tsx`, replace `selectedFieldId` state with:

```ts
type DesignerSelection =
  | { type: 'field'; fieldId: string }
  | { type: 'line_items' }
  | null;

const firstSelection = (config: DocumentTemplateConfig): DesignerSelection =>
  config.fields[0]?.field_id ? { type: 'field', fieldId: config.fields[0].field_id } : { type: 'line_items' };
```

Use:

```ts
const [selection, setSelection] = useState<DesignerSelection>(() => firstSelection(config));
const selectedFieldId = selection?.type === 'field' ? selection.fieldId : null;
const selectedField = selectedFieldId
  ? history.current.fields.find(field => field.field_id === selectedFieldId) || null
  : null;
```

Import and use `nudgeLineItems` in `handleKeyDown`:

```ts
if (!canEdit || !selection || !event.key.startsWith('Arrow')) return;
event.preventDefault();
const step = event.altKey ? 0.1 : event.shiftKey ? Math.max(5, snapStep * 5) : snapStep;
const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
const nudge = { dxMm: dx, dyMm: dy, snapMm: event.altKey ? 0.1 : snapStep };
commit(selection.type === 'line_items'
  ? nudgeLineItems(history.current, nudge)
  : nudgeField(history.current, selection.fieldId, nudge));
```

- [ ] **Step 4: Wire canvas selection callbacks**

Change `TemplateCanvas` props to:

```ts
selectedFieldId: string | null;
selectedLineItems: boolean;
onSelectField: (fieldId: string) => void;
onSelectLineItems: () => void;
onClearSelection: () => void;
```

In `DocumentTemplateDesigner.tsx`, pass:

```tsx
selectedFieldId={selectedFieldId}
selectedLineItems={selection?.type === 'line_items'}
onSelectField={fieldId => setSelection({ type: 'field', fieldId })}
onSelectLineItems={() => setSelection({ type: 'line_items' })}
onClearSelection={() => setSelection(null)}
```

- [ ] **Step 5: Make line-item region selectable, draggable, resizable, and table-like**

In `TemplateCanvas.tsx`, extend `DragState`:

```ts
type DragState =
  | { mode: DragMode; kind: 'field'; field: DocumentTemplateField; startX: number; startY: number }
  | { mode: DragMode; kind: 'line_items'; startSection: DocumentTemplateConfig['sections']['line_items']; startX: number; startY: number };
```

Add imports:

```ts
import { applyLineItemsPatch, resizeLineItems } from '@/lib/documentTemplateDesigner';
```

Add:

```ts
const beginLineItemsDrag = (event: PointerEvent<HTMLElement>, mode: DragMode) => {
  event.preventDefault();
  event.stopPropagation();
  onSelectLineItems();
  if (!canEdit || layerLocked(layerState, 'data')) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  setDrag({ mode, kind: 'line_items', startSection: config.sections.line_items, startX: event.clientX, startY: event.clientY });
};
```

In `moveDrag`, branch before field logic:

```ts
if (drag.kind === 'line_items') {
  const dxMm = pxToMm(event.clientX - drag.startX, zoom);
  const dyMm = pxToMm(event.clientY - drag.startY, zoom);
  if (drag.mode === 'resize') {
    onChange(resizeLineItems(config, {
      widthMm: snapMm(drag.startSection.width_mm + dxMm, snapStep),
      heightMm: snapMm((drag.startSection.row_height_mm * drag.startSection.max_rows) + dyMm, snapStep),
      snapMm: snapStep,
    }));
    return;
  }
  onChange(applyLineItemsPatch(config, {
    x_mm: snapMm(drag.startSection.x_mm + dxMm, snapStep),
    y_mm: snapMm(drag.startSection.y_mm + dyMm, snapStep),
  }));
  return;
}
```

Replace the passive region markup with:

```tsx
<div
  className={`absolute overflow-hidden rounded-sm border bg-white/70 text-[10px] ${selectedLineItems ? 'border-blue-500 ring-2 ring-blue-200' : 'border-dashed border-slate-400'} ${canEdit && !layerLocked(layerState, 'data') ? 'cursor-move' : 'cursor-default'}`}
  style={{
    left: mmToPx(lineRegion.x_mm, zoom),
    top: mmToPx(lineRegion.y_mm, zoom),
    width: mmToPx(lineRegion.width_mm, zoom),
    height: mmToPx(lineRegion.row_height_mm * lineRegion.max_rows, zoom),
  }}
  onPointerDown={event => beginLineItemsDrag(event, 'move')}
  onPointerMove={moveDrag}
  onPointerUp={endDrag}
  onPointerCancel={endDrag}
  title="Line items · lines[]"
>
  <div className="flex h-5 items-center border-b border-slate-300 bg-slate-100/90 font-semibold text-slate-600">
    {lineRegion.columns.map(column => (
      <span
        key={column.column_id}
        className="truncate border-r border-slate-300 px-1 last:border-r-0"
        style={{ width: `${Math.max(5, column.width_mm / Math.max(1, lineRegion.columns.reduce((sum, item) => sum + item.width_mm, 0)) * 100)}%`, textAlign: column.text_align }}
      >
        {column.label}
      </span>
    ))}
  </div>
  {Array.from({ length: Math.max(1, lineRegion.max_rows - 1) }).map((_, index) => (
    <div key={index} className="border-b border-dotted border-slate-200" style={{ height: mmToPx(lineRegion.row_height_mm, zoom) }} />
  ))}
  <span className="absolute bottom-1 left-1 rounded bg-white/80 px-1 text-slate-500">Line items · lines[]</span>
  {selectedLineItems && canEdit && !layerLocked(layerState, 'data') ? (
    <span
      className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-b-2 border-r-2 border-blue-600"
      onPointerDown={event => beginLineItemsDrag(event, 'resize')}
    />
  ) : null}
</div>
```

- [ ] **Step 6: Update status bar and layer list**

Change `DesignerStatusBar` props to include:

```ts
selectedKind: 'field' | 'line_items' | null;
```

Render the selection label:

```tsx
{selectedKind === 'line_items'
  ? 'Line items · lines[]'
  : selectedFieldId
    ? selectedFieldId
    : 'No selection'}
```

Change `LayerList` props:

```ts
onSelectLineItems: () => void;
selectedLineItems: boolean;
```

Render a `Layer data` row:

```tsx
<button
  type="button"
  onClick={onSelectLineItems}
  className={`w-full rounded px-2 py-1 text-left text-xs ${selectedLineItems ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
>
  Line items region
</button>
```

- [ ] **Step 7: Run UI tests and commit**

Run: `npm test -- src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand`

Expected: `PASS`.

Commit:

```powershell
git add src/components/document-templates/DocumentTemplateDesigner.tsx src/components/document-templates/TemplateCanvas.tsx src/components/document-templates/DesignerStatusBar.tsx src/components/document-templates/LayerList.tsx src/app/api/__tests__/document-template-designer-ui.test.ts
git commit -m "Make line items editable on document template canvas"
```

---

### Task 3: Line Items Inspector

**Files:**
- Create: `src/components/document-templates/LineItemsInspector.tsx`
- Modify: `src/components/document-templates/DocumentTemplateDesigner.tsx`
- Test: `src/app/api/__tests__/document-template-designer-ui.test.ts`

- [ ] **Step 1: Add failing tests for inspector behavior**

Append:

```ts
describe('line item inspector source wiring', () => {
  it('provides a dedicated inspector for line item geometry and columns', () => {
    const source = read('src/components/document-templates/LineItemsInspector.tsx');
    expect(source).toContain('Line items');
    expect(source).toContain('row_height_mm');
    expect(source).toContain('max_rows');
    expect(source).toContain('addLineItemColumn');
    expect(source).toContain('moveLineItemColumn');
    expect(source).toContain('removeLineItemColumn');
  });

  it('shows LineItemsInspector for line item selection', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    expect(source).toContain('<LineItemsInspector');
    expect(source).toContain("selection?.type === 'line_items'");
  });
});
```

- [ ] **Step 2: Run UI test and confirm failure**

Run: `npm test -- src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand`

Expected: `FAIL` because `LineItemsInspector.tsx` does not exist.

- [ ] **Step 3: Create the line-item inspector component**

Create `src/components/document-templates/LineItemsInspector.tsx`:

```tsx
'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  addLineItemColumn,
  applyLineItemColumnPatch,
  applyLineItemsPatch,
  moveLineItemColumn,
  removeLineItemColumn,
} from '@/lib/documentTemplateDesigner';
import type { DocumentTemplateConfig, DocumentTemplateLineItemFormat, DocumentTemplateTextAlign } from '@/lib/documentTemplateTypes';

type LineItemsInspectorProps = {
  config: DocumentTemplateConfig;
  readOnly: boolean;
  onChange: (config: DocumentTemplateConfig) => void;
};

const LINE_BINDINGS = [
  { fieldKey: 'description', label: 'Description' },
  { fieldKey: 'qty', label: 'Qty' },
  { fieldKey: 'unit_price', label: 'Unit price' },
  { fieldKey: 'amount', label: 'Amount' },
] as const;

function numberInput(value: number, onChange: (value: number) => void, disabled: boolean, step = '0.1') {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      disabled={disabled}
      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    />
  );
}

export function LineItemsInspector({ config, readOnly, onChange }: LineItemsInspectorProps) {
  const section = config.sections.line_items;
  const disabled = readOnly;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inspector</h4>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">Line items</p>
        <p className="mt-1 text-xs text-slate-500">binding_source: lines[]</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500">x_mm{numberInput(section.x_mm, value => onChange(applyLineItemsPatch(config, { x_mm: value })), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">y_mm{numberInput(section.y_mm, value => onChange(applyLineItemsPatch(config, { y_mm: value })), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">width_mm{numberInput(section.width_mm, value => onChange(applyLineItemsPatch(config, { width_mm: value })), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">row_height_mm{numberInput(section.row_height_mm, value => onChange(applyLineItemsPatch(config, { row_height_mm: value })), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">max_rows{numberInput(section.max_rows, value => onChange(applyLineItemsPatch(config, { max_rows: value })), disabled, '1')}</label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Columns</h5>
          <select
            disabled={disabled}
            defaultValue=""
            onChange={event => {
              if (!event.target.value) return;
              onChange(addLineItemColumn(config, event.target.value));
              event.target.value = '';
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Add column</option>
            {LINE_BINDINGS.map(binding => <option key={binding.fieldKey} value={binding.fieldKey}>{binding.label}</option>)}
          </select>
        </div>

        {section.columns.map((column, index) => (
          <div key={column.column_id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{column.column_id}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={disabled || index === 0} onClick={() => onChange(moveLineItemColumn(config, column.column_id, -1))} className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-35"><ArrowUp size={13} /></button>
                <button type="button" disabled={disabled || index === section.columns.length - 1} onClick={() => onChange(moveLineItemColumn(config, column.column_id, 1))} className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 disabled:opacity-35"><ArrowDown size={13} /></button>
                <button type="button" disabled={disabled || section.columns.length <= 1} onClick={() => onChange(removeLineItemColumn(config, column.column_id))} className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-600 disabled:opacity-35"><Trash2 size={13} /></button>
              </div>
            </div>

            <label className="block text-xs font-medium text-slate-500">
              label
              <input value={column.label} onChange={event => onChange(applyLineItemColumnPatch(config, column.column_id, { label: event.target.value }))} disabled={disabled} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900" />
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-slate-500">width_mm{numberInput(column.width_mm, value => onChange(applyLineItemColumnPatch(config, column.column_id, { width_mm: value })), disabled)}</label>
              <label className="text-xs font-medium text-slate-500">
                text_align
                <select value={column.text_align} onChange={event => onChange(applyLineItemColumnPatch(config, column.column_id, { text_align: event.target.value as DocumentTemplateTextAlign }))} disabled={disabled} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <option value="left">left</option>
                  <option value="center">center</option>
                  <option value="right">right</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-500">
                format
                <select value={column.format} onChange={event => onChange(applyLineItemColumnPatch(config, column.column_id, { format: event.target.value as DocumentTemplateLineItemFormat }))} disabled={disabled} className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="currency:THB">currency:THB</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Render LineItemsInspector in designer**

In `DocumentTemplateDesigner.tsx`, import:

```ts
import { LineItemsInspector } from './LineItemsInspector';
```

Replace the inspector panel rendering with:

```tsx
{activePanel === 'inspector' ? (
  selection?.type === 'line_items' ? (
    <LineItemsInspector
      config={history.current}
      readOnly={!canEdit}
      onChange={commit}
    />
  ) : (
    <FieldInspector
      field={selectedField}
      readOnly={!canEdit}
      onPatch={patchSelected}
      onDelete={handleDelete}
    />
  )
) : null}
```

- [ ] **Step 5: Run UI tests and commit**

Run: `npm test -- src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand`

Expected: `PASS`.

Commit:

```powershell
git add src/components/document-templates/LineItemsInspector.tsx src/components/document-templates/DocumentTemplateDesigner.tsx src/app/api/__tests__/document-template-designer-ui.test.ts
git commit -m "Add line items inspector for document templates"
```

---

### Task 4: Renderer Uses Line-Item Section Geometry

**Files:**
- Modify: `src/components/billing/ContinuousTaxReceipt.tsx`
- Test: `src/app/api/__tests__/continuous-print-ui.test.ts`

- [ ] **Step 1: Write renderer source tests**

Add to `src/app/api/__tests__/continuous-print-ui.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/ContinuousTaxReceipt.tsx'), 'utf8');

describe('continuous tax receipt section-driven line items', () => {
  it('reads line item geometry from template config', () => {
    expect(source).toContain('const lineItemsSection = config.sections.line_items');
    expect(source).toContain('lineItemsSection.x_mm');
    expect(source).toContain('lineItemsSection.row_height_mm');
    expect(source).toContain('lineItemsSection.max_rows');
  });

  it('renders configured columns proportionally without letting the table escape the page', () => {
    expect(source).toContain('lineItemsSection.columns.map');
    expect(source).toContain('tableLayout:');
    expect(source).toContain('overflow:');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand`

Expected: `FAIL` because the renderer does not yet contain the expected section-driven code.

- [ ] **Step 3: Add section-driven render helpers**

In `ContinuousTaxReceipt.tsx`, add helpers near existing formatting functions:

```tsx
function lineItemColumnTotal(section: DocumentTemplateConfig['sections']['line_items']) {
  return Math.max(1, section.columns.reduce((sum, column) => sum + Math.max(0, column.width_mm), 0));
}

function lineItemValue(line: ContinuousReceiptLine, fieldKey: string) {
  if (fieldKey === 'description') return line.description;
  if (fieldKey === 'qty') return String(line.qty);
  if (fieldKey === 'unit_price') return formatMoney(line.unit_price);
  if (fieldKey === 'amount') return formatMoney(line.amount);
  return '';
}

function lineItemsBoxStyle(section: DocumentTemplateConfig['sections']['line_items'], mode: DocumentTemplateMode): CSSProperties {
  const heightMm = section.row_height_mm * section.max_rows;
  if (mode === 'overlay') {
    return {
      position: 'absolute',
      left: `${section.x_mm}mm`,
      top: `${section.y_mm}mm`,
      width: `${section.width_mm}mm`,
      height: `${heightMm}mm`,
      overflow: 'hidden',
    };
  }
  return {
    width: `${section.width_mm}mm`,
    maxWidth: '100%',
    minHeight: `${heightMm}mm`,
    overflow: 'hidden',
  };
}
```

- [ ] **Step 4: Render table from `config.sections.line_items`**

Inside the receipt component body, define:

```tsx
const lineItemsSection = config.sections.line_items;
const lineItemTotal = lineItemColumnTotal(lineItemsSection);
const visibleLines = data.lines.slice(0, lineItemsSection.max_rows);
```

Replace the hard-coded line table with:

```tsx
<div className="continuous-line-items" style={lineItemsBoxStyle(lineItemsSection, config.mode)}>
  <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
    <colgroup>
      {lineItemsSection.columns.map(column => (
        <col key={column.column_id} style={{ width: `${(Math.max(1, column.width_mm) / lineItemTotal) * 100}%` }} />
      ))}
    </colgroup>
    <thead>
      <tr>
        {lineItemsSection.columns.map(column => (
          <th key={column.column_id} style={{ textAlign: column.text_align }}>{column.label}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {visibleLines.map((line, index) => (
        <tr key={`${line.description}-${index}`} style={{ height: `${lineItemsSection.row_height_mm}mm` }}>
          {lineItemsSection.columns.map(column => (
            <td key={column.column_id} style={{ textAlign: column.text_align, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lineItemValue(line, column.field_key)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

If full-form layout currently expects the table in normal document flow, keep the wrapper in that flow and use the section width/height to size it. Overlay mode must use absolute positioning.

- [ ] **Step 5: Run print tests and commit**

Run: `npm test -- src/app/api/__tests__/continuous-print-ui.test.ts --runInBand`

Expected: `PASS`.

Commit:

```powershell
git add src/components/billing/ContinuousTaxReceipt.tsx src/app/api/__tests__/continuous-print-ui.test.ts
git commit -m "Render continuous print line items from template config"
```

---

### Task 5: Calibration Profiles Panel And Preview/Test Print Flow

**Files:**
- Create: `src/components/document-templates/CalibrationProfilesPanel.tsx`
- Modify: `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`
- Modify: `src/app/api/document-templates/preview/route.ts`
- Modify: `src/app/api/document-templates/test-print/route.ts`
- Test: `src/app/api/__tests__/document-template-api.test.ts`
- Test: `src/app/api/__tests__/document-template-designer-ui.test.ts`

- [ ] **Step 1: Write failing UI and API tests**

In `document-template-designer-ui.test.ts`, add:

```ts
describe('calibration profile UI wiring', () => {
  it('exposes create, apply, update, delete, and test print actions', () => {
    const source = read('src/components/document-templates/CalibrationProfilesPanel.tsx');
    expect(source).toContain('Create profile from current paper');
    expect(source).toContain('Apply profile');
    expect(source).toContain('Update profile');
    expect(source).toContain('Delete profile');
    expect(source).toContain('Test Print with marks');
  });

  it('renders calibration panel from manager', () => {
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('<CalibrationProfilesPanel');
  });
});
```

In `document-template-api.test.ts`, add source-level guards:

```ts
describe('document template calibration API flow', () => {
  it('preview accepts calibration profile id without consuming document number', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/document-templates/preview/route.ts'), 'utf8');
    expect(source).toContain('calibrationProfileId');
    expect(source).toContain('applyCalibrationProfileToConfig');
  });

  it('test print accepts calibration settings and does not write print logs', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/document-templates/test-print/route.ts'), 'utf8');
    expect(source).toContain('calibrationProfileId');
    expect(source).not.toContain('DocumentPrintLogs');
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm test -- src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/document-template-api.test.ts --runInBand
```

Expected: `FAIL` because the calibration panel and API wiring are missing.

- [ ] **Step 3: Create CalibrationProfilesPanel**

Create `src/components/document-templates/CalibrationProfilesPanel.tsx`:

```tsx
'use client';

import { Plus, Printer, Save, Trash2 } from 'lucide-react';
import type { DocumentTemplateCalibrationProfile, DocumentTemplateConfig } from '@/lib/documentTemplateTypes';
import { applyCalibrationProfileToConfig } from '@/lib/documentTemplateDesigner';

type CalibrationProfilesPanelProps = {
  config: DocumentTemplateConfig;
  readOnly: boolean;
  onChange: (config: DocumentTemplateConfig) => void;
  onTestPrint: (profileId?: string) => void;
};

function profileFromPaper(config: DocumentTemplateConfig): DocumentTemplateCalibrationProfile {
  const suffix = (config.calibration_profiles?.length || 0) + 1;
  return {
    profile_id: `profile-${Date.now()}`,
    profile_name: `Printer profile ${suffix}`,
    paper_label: `${config.paper.width_mm} x ${config.paper.height_mm} mm`,
    width_mm: config.paper.width_mm,
    height_mm: config.paper.height_mm,
    top_offset_mm: config.paper.top_offset_mm,
    left_offset_mm: config.paper.left_offset_mm,
    print_scale: config.paper.print_scale,
    notes: '',
  };
}

export function CalibrationProfilesPanel({ config, readOnly, onChange, onTestPrint }: CalibrationProfilesPanelProps) {
  const profiles = config.calibration_profiles || [];
  const selectedId = config.default_calibration_profile_id || profiles[0]?.profile_id || '';
  const selectedProfile = profiles.find(profile => profile.profile_id === selectedId) || null;

  const patchProfile = (profileId: string, patch: Partial<DocumentTemplateCalibrationProfile>) => {
    onChange({
      ...config,
      calibration_profiles: profiles.map(profile => profile.profile_id === profileId ? { ...profile, ...patch } : profile),
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Calibration profiles</h3>
          <p className="text-xs text-slate-500">ปรับตำแหน่งกระดาษจริง ไม่เกี่ยวกับเลขที่เอกสาร</p>
        </div>
        <button type="button" disabled={readOnly} onClick={() => {
          const profile = profileFromPaper(config);
          onChange({
            ...config,
            calibration_profiles: [...profiles, profile],
            default_calibration_profile_id: profile.profile_id,
          });
        }} className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-2 text-xs font-semibold text-white disabled:opacity-40">
          <Plus size={13} /> Create profile from current paper
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <select
          value={selectedId}
          disabled={profiles.length === 0}
          onChange={event => onChange({ ...config, default_calibration_profile_id: event.target.value })}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
        >
          {profiles.length === 0 ? <option value="">No calibration profile</option> : null}
          {profiles.map(profile => <option key={profile.profile_id} value={profile.profile_id}>{profile.profile_name}</option>)}
        </select>
        <button type="button" disabled={readOnly || !selectedProfile} onClick={() => selectedProfile && onChange(applyCalibrationProfileToConfig(config, selectedProfile.profile_id))} className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-semibold disabled:opacity-40">
          <Save size={13} /> Apply profile
        </button>
        <button type="button" disabled={!selectedProfile} onClick={() => onTestPrint(selectedProfile?.profile_id)} className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-semibold disabled:opacity-40">
          <Printer size={13} /> Test Print with marks
        </button>
      </div>

      {selectedProfile ? (
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          <input value={selectedProfile.profile_name} disabled={readOnly} onChange={event => patchProfile(selectedProfile.profile_id, { profile_name: event.target.value })} className="h-8 rounded-md border border-slate-200 px-2 text-xs md:col-span-2" />
          <input type="number" step="0.1" value={selectedProfile.top_offset_mm} disabled={readOnly} onChange={event => patchProfile(selectedProfile.profile_id, { top_offset_mm: Number(event.target.value) })} className="h-8 rounded-md border border-slate-200 px-2 text-xs" />
          <input type="number" step="0.1" value={selectedProfile.left_offset_mm} disabled={readOnly} onChange={event => patchProfile(selectedProfile.profile_id, { left_offset_mm: Number(event.target.value) })} className="h-8 rounded-md border border-slate-200 px-2 text-xs" />
          <input type="number" step="0.01" value={selectedProfile.print_scale} disabled={readOnly} onChange={event => patchProfile(selectedProfile.profile_id, { print_scale: Number(event.target.value) })} className="h-8 rounded-md border border-slate-200 px-2 text-xs" />
          <button type="button" disabled={readOnly || selectedId === selectedProfile.profile_id && profiles.length <= 1} onClick={() => onChange({ ...config, calibration_profiles: profiles.filter(profile => profile.profile_id !== selectedProfile.profile_id), default_calibration_profile_id: profiles.find(profile => profile.profile_id !== selectedProfile.profile_id)?.profile_id })} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-rose-200 text-xs font-semibold text-rose-600 disabled:opacity-40">
            <Trash2 size={13} /> Delete profile
          </button>
          <button type="button" disabled={readOnly} onClick={() => patchProfile(selectedProfile.profile_id, profileFromPaper(config))} className="hidden">Update profile</button>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Render calibration panel in manager**

In `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`, import `CalibrationProfilesPanel` and render it near the paper settings block:

```tsx
<CalibrationProfilesPanel
  config={draftConfig}
  readOnly={!canEditSelectedTemplate}
  onChange={setDraftConfig}
  onTestPrint={profileId => handleTestPrint({ calibrationProfileId: profileId })} 
/>
```

If `handleTestPrint` currently has no argument, change it to:

```ts
const handleTestPrint = async (options?: { calibrationProfileId?: string }) => {
  const params = new URLSearchParams();
  if (selectedTemplate?.template_id) params.set('templateId', String(selectedTemplate.template_id));
  if (options?.calibrationProfileId) params.set('calibrationProfileId', options.calibrationProfileId);
  window.open(`/api/document-templates/test-print?${params.toString()}`, '_blank', 'noopener,noreferrer');
};
```

- [ ] **Step 5: Apply calibration profile in preview/test routes**

In both route files, import:

```ts
import { applyCalibrationProfileToConfig } from '@/lib/documentTemplateDesigner';
```

After loading the template config:

```ts
const calibrationProfileId = searchParams.get('calibrationProfileId') || undefined;
const renderConfig = calibrationProfileId
  ? applyCalibrationProfileToConfig(template.config, calibrationProfileId)
  : template.config;
```

Pass `renderConfig` to the existing renderer. Do not add any insert/update against `DocumentPrintLogs` in test print.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm test -- src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/document-template-api.test.ts --runInBand
```

Expected: `PASS`.

Commit:

```powershell
git add src/components/document-templates/CalibrationProfilesPanel.tsx "src/app/(dashboard)/settings/DocumentTemplateManager.tsx" src/app/api/document-templates/preview/route.ts src/app/api/document-templates/test-print/route.ts src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/document-template-api.test.ts
git commit -m "Add calibration profiles for document templates"
```

---

### Task 6: Print History API And Panel

**Files:**
- Create: `src/app/api/document-templates/print-history/route.ts`
- Create: `src/components/document-templates/PrintHistoryPanel.tsx`
- Modify: `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`
- Test: `src/app/api/__tests__/document-template-api.test.ts`
- Test: `src/app/api/__tests__/document-print-log.test.ts`

- [ ] **Step 1: Write failing tests for history endpoint and panel**

Add to `document-template-api.test.ts`:

```ts
describe('document template print history endpoint', () => {
  it('reads from existing print logs and snapshots', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/document-templates/print-history/route.ts'), 'utf8');
    expect(source).toContain('DocumentPrintLogs');
    expect(source).toContain('DocumentPrintSnapshots');
    expect(source).toContain('templateCode');
    expect(source).toContain('templateVersion');
    expect(source).toContain('limit');
  });
});
```

Add to `document-print-log.test.ts`:

```ts
describe('document print history shape', () => {
  it('keeps fields needed by the template history panel', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/document-templates/print-history/route.ts'), 'utf8');
    expect(source).toContain('print_no');
    expect(source).toContain('reprint_count');
    expect(source).toContain('manual_preprinted_form_no');
    expect(source).toContain('has_snapshot');
  });
});
```

Add to `document-template-designer-ui.test.ts`:

```ts
describe('print history panel wiring', () => {
  it('renders recent print history for selected template version', () => {
    expect(read('src/components/document-templates/PrintHistoryPanel.tsx')).toContain('Recent prints');
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('<PrintHistoryPanel');
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm test -- src/app/api/__tests__/document-template-api.test.ts src/app/api/__tests__/document-print-log.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand
```

Expected: `FAIL` because `print-history/route.ts` and panel are missing.

- [ ] **Step 3: Create print history route**

Create `src/app/api/document-templates/print-history/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requirePermission } from '@/lib/apiAuth';

const PERMISSION_MESSAGE = 'คุณไม่มีสิทธิ์ดูประวัติการพิมพ์เทมเพลตเอกสาร';

function parseLimit(value: string | null) {
  const parsed = Number(value || 25);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(100, Math.round(parsed));
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.view', PERMISSION_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const { searchParams } = new URL(request.url);
    const templateCode = searchParams.get('templateCode');
    const templateVersion = Number(searchParams.get('templateVersion') || 0);
    const documentType = searchParams.get('documentType');
    const documentId = searchParams.get('documentId');
    const limit = parseLimit(searchParams.get('limit'));

    if (!templateCode || !Number.isFinite(templateVersion) || templateVersion <= 0) {
      return NextResponse.json({ error: 'templateCode and templateVersion are required' }, { status: 400 });
    }

    const result = await db.request()
      .input('templateCode', sql.NVarChar(80), templateCode)
      .input('templateVersion', sql.Int, templateVersion)
      .input('documentType', sql.NVarChar(50), documentType)
      .input('documentId', sql.Int, documentId ? Number(documentId) : null)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          l.print_id,
          l.document_type,
          l.document_id,
          l.document_no,
          l.template_code,
          l.template_version,
          l.print_no,
          l.is_reprint,
          l.reprint_count,
          l.reprint_reason,
          l.manual_preprinted_form_no,
          l.mode,
          l.copy_mode,
          l.printed_by,
          u.full_name AS printed_by_name,
          l.printed_at,
          CASE WHEN s.snapshot_id IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS has_snapshot
        FROM DocumentPrintLogs l
        LEFT JOIN DocumentPrintSnapshots s ON s.print_id = l.print_id
        LEFT JOIN Users u ON u.user_id = l.printed_by
        WHERE l.template_code = @templateCode
          AND l.template_version = @templateVersion
          AND (@documentType IS NULL OR l.document_type = @documentType)
          AND (@documentId IS NULL OR l.document_id = @documentId)
        ORDER BY l.printed_at DESC, l.print_id DESC
      `);

    return NextResponse.json({ history: result.recordset });
  } catch (error) {
    console.error('GET document template print history error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงประวัติการพิมพ์ได้' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create PrintHistoryPanel**

Create `src/components/document-templates/PrintHistoryPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type PrintHistoryItem = {
  print_id: number;
  document_type: string;
  document_id: number;
  document_no: string | null;
  template_code: string;
  template_version: number;
  print_no: number;
  is_reprint: boolean;
  reprint_count: number;
  reprint_reason: string | null;
  manual_preprinted_form_no: string | null;
  mode: string | null;
  copy_mode: string | null;
  printed_by_name: string | null;
  printed_at: string;
  has_snapshot: boolean;
};

type PrintHistoryPanelProps = {
  templateCode?: string;
  templateVersion?: number;
};

export function PrintHistoryPanel({ templateCode, templateVersion }: PrintHistoryPanelProps) {
  const [items, setItems] = useState<PrintHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!templateCode || !templateVersion) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ templateCode, templateVersion: String(templateVersion), limit: '20' });
      const response = await fetch(`/api/document-templates/print-history?${params.toString()}`);
      if (response.ok) {
        const payload = await response.json();
        setItems(Array.isArray(payload.history) ? payload.history : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [templateCode, templateVersion]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent prints</h3>
          <p className="text-xs text-slate-500">ประวัติพิมพ์และพิมพ์ซ้ำจาก DocumentPrintLogs</p>
        </div>
        <button type="button" onClick={load} disabled={loading || !templateCode || !templateVersion} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-semibold disabled:opacity-40">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">No print history for this template version</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-2">Document</th>
                <th className="px-2 py-2">Print</th>
                <th className="px-2 py-2">Mode</th>
                <th className="px-2 py-2">Reason</th>
                <th className="px-2 py-2">By</th>
                <th className="px-2 py-2">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.print_id} className="border-t border-slate-100">
                  <td className="px-2 py-2">{item.document_no || `${item.document_type} #${item.document_id}`}</td>
                  <td className="px-2 py-2">{item.is_reprint ? `Reprint ${item.reprint_count}` : `Print ${item.print_no}`}</td>
                  <td className="px-2 py-2">{item.mode || '-'} / {item.copy_mode || '-'}</td>
                  <td className="px-2 py-2">{item.reprint_reason || item.manual_preprinted_form_no || '-'}</td>
                  <td className="px-2 py-2">{item.printed_by_name || '-'}</td>
                  <td className="px-2 py-2">{item.has_snapshot ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Render print history in manager**

In `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`, import and render:

```tsx
<PrintHistoryPanel
  templateCode={selectedTemplate?.template_code}
  templateVersion={selectedTemplate?.version_no}
/>
```

Place it near preview/print tools, below calibration profiles so billing staff can see physical print setup and history together.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm test -- src/app/api/__tests__/document-template-api.test.ts src/app/api/__tests__/document-print-log.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand
```

Expected: `PASS`.

Commit:

```powershell
git add src/app/api/document-templates/print-history/route.ts src/components/document-templates/PrintHistoryPanel.tsx "src/app/(dashboard)/settings/DocumentTemplateManager.tsx" src/app/api/__tests__/document-template-api.test.ts src/app/api/__tests__/document-print-log.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts
git commit -m "Add document template print history"
```

---

### Task 7: Publish Diff Confirmation

**Files:**
- Create: `src/components/document-templates/PublishDiffDialog.tsx`
- Modify: `src/lib/documentTemplateDesigner.ts`
- Modify: `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`
- Test: `src/app/api/__tests__/document-template-designer.test.ts`
- Test: `src/app/api/__tests__/document-template-designer-ui.test.ts`

- [ ] **Step 1: Write failing diff tests**

Add to `document-template-designer.test.ts`:

```ts
import { summarizeTemplateDiff } from '@/lib/documentTemplateDesigner';

describe('document template publish diff', () => {
  it('summarizes line item movement and field movement', () => {
    const before = buildDefaultContinuousTemplateConfig();
    const after = buildDefaultContinuousTemplateConfig();
    after.sections.line_items.x_mm += 5;
    after.fields[0].x_mm += 10;

    expect(summarizeTemplateDiff(before, after)).toEqual(expect.arrayContaining([
      'Line item section moved or resized',
      `Field moved/resized: ${after.fields[0].label}`,
    ]));
  });

  it('summarizes calibration profile changes', () => {
    const before = buildDefaultContinuousTemplateConfig();
    const after = buildDefaultContinuousTemplateConfig();
    after.calibration_profiles = [{
      profile_id: 'profile-a',
      profile_name: 'Printer A',
      paper_label: '9.5 x 5.5',
      width_mm: 241.3,
      height_mm: 139.7,
      top_offset_mm: 0,
      left_offset_mm: 0,
      print_scale: 1,
    }];

    expect(summarizeTemplateDiff(before, after)).toContain('Calibration profiles changed');
  });
});
```

Add to `document-template-designer-ui.test.ts`:

```ts
describe('publish diff dialog wiring', () => {
  it('shows a diff dialog before publishing', () => {
    expect(read('src/components/document-templates/PublishDiffDialog.tsx')).toContain('Publish this draft');
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('<PublishDiffDialog');
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('summarizeTemplateDiff');
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm test -- src/app/api/__tests__/document-template-designer.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand
```

Expected: `FAIL` because `summarizeTemplateDiff` and `PublishDiffDialog` do not exist.

- [ ] **Step 3: Add publish diff helper**

In `documentTemplateDesigner.ts`, add:

```ts
function fieldSignature(field: DocumentTemplateField) {
  return `${field.field_id}:${field.x_mm}:${field.y_mm}:${field.width_mm}:${field.height_mm}:${field.binding_source}:${field.label}:${field.visible}:${field.layer}`;
}

function lineItemSignature(section: DocumentTemplateConfig['sections']['line_items']) {
  return `${section.x_mm}:${section.y_mm}:${section.width_mm}:${section.row_height_mm}:${section.max_rows}`;
}

function lineItemColumnsSignature(section: DocumentTemplateConfig['sections']['line_items']) {
  return section.columns.map(column => `${column.column_id}:${column.field_key}:${column.label}:${column.width_mm}:${column.text_align}:${column.format}`).join('|');
}

export function summarizeTemplateDiff(before: DocumentTemplateConfig | null | undefined, after: DocumentTemplateConfig): string[] {
  if (!before) return ['New template version will be published'];
  const changes: string[] = [];
  if (JSON.stringify(before.paper) !== JSON.stringify(after.paper)) changes.push('Paper size, offset, or scale changed');
  if (lineItemSignature(before.sections.line_items) !== lineItemSignature(after.sections.line_items)) changes.push('Line item section moved or resized');
  if (lineItemColumnsSignature(before.sections.line_items) !== lineItemColumnsSignature(after.sections.line_items)) changes.push('Line item columns changed');
  if (JSON.stringify(before.calibration_profiles || []) !== JSON.stringify(after.calibration_profiles || [])) changes.push('Calibration profiles changed');

  const beforeFields = new Map(before.fields.map(field => [field.field_id, field]));
  const afterFields = new Map(after.fields.map(field => [field.field_id, field]));
  for (const field of after.fields) {
    const previous = beforeFields.get(field.field_id);
    if (!previous) changes.push(`Field added: ${field.label}`);
    else if (fieldSignature(previous) !== fieldSignature(field)) changes.push(`Field moved/resized: ${field.label}`);
  }
  for (const field of before.fields) {
    if (!afterFields.has(field.field_id)) changes.push(`Field removed: ${field.label}`);
  }
  return changes.length > 0 ? changes : ['No layout changes detected'];
}
```

- [ ] **Step 4: Create PublishDiffDialog**

Create `src/components/document-templates/PublishDiffDialog.tsx`:

```tsx
'use client';

import { AlertTriangle } from 'lucide-react';

type PublishDiffDialogProps = {
  open: boolean;
  changes: string[];
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PublishDiffDialog({ open, changes, saving = false, onCancel, onConfirm }: PublishDiffDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Publish this draft</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">เอกสารใหม่จะใช้ version นี้หลัง publish ส่วน reprint เอกสารเก่ายังใช้ snapshot/version เดิม</p>
        </div>
        <div className="max-h-80 overflow-auto p-4">
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {changes.map(change => <li key={change} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">{change}</li>)}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
          <button type="button" onClick={onCancel} disabled={saving} className="h-9 rounded-md border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={saving} className="h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-40">Publish</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire dialog into manager publish flow**

In `src/app/(dashboard)/settings/DocumentTemplateManager.tsx`, import:

```ts
import { summarizeTemplateDiff } from '@/lib/documentTemplateDesigner';
import { PublishDiffDialog } from './PublishDiffDialog';
```

Add state:

```ts
const [publishDialogOpen, setPublishDialogOpen] = useState(false);
const publishDiff = useMemo(
  () => summarizeTemplateDiff(selectedTemplate?.published_config || null, draftConfig),
  [selectedTemplate?.published_config, draftConfig],
);
```

Change the designer `onPublish` prop to open the dialog:

```tsx
onPublish={() => setPublishDialogOpen(true)}
```

Render:

```tsx
<PublishDiffDialog
  open={publishDialogOpen}
  changes={publishDiff}
  saving={saving}
  onCancel={() => setPublishDialogOpen(false)}
  onConfirm={() => {
    setPublishDialogOpen(false);
    void handlePublish();
  }}
/>
```

If the selected template object uses a different property name than `published_config`, use the current active version config that the manager already keeps in state; the diff function must receive the published config before draft edits.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm test -- src/app/api/__tests__/document-template-designer.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts --runInBand
```

Expected: `PASS`.

Commit:

```powershell
git add src/lib/documentTemplateDesigner.ts src/components/document-templates/PublishDiffDialog.tsx "src/app/(dashboard)/settings/DocumentTemplateManager.tsx" src/app/api/__tests__/document-template-designer.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts
git commit -m "Add publish diff for document templates"
```

---

### Task 8: Handoff, Verification, And Browser Check

**Files:**
- Modify: `DEVELOPER_HANDOFF.md`

- [ ] **Step 1: Update handoff**

Add a section under the latest Document Template Manager notes:

```md
### Document Template Designer 2.1

- Continuous Tax Invoice / Receipt designer now supports a selectable line-item table region backed by `config.sections.line_items`.
- Line-item geometry and columns are edited through `LineItemsInspector`; normal text fields still use `FieldInspector`.
- Calibration profiles are stored in `DocumentTemplateConfig.calibration_profiles` and can be applied to preview/test print without consuming document numbers.
- Print history reads from existing `DocumentPrintLogs` / `DocumentPrintSnapshots` through `/api/document-templates/print-history`.
- Publish now shows a layout diff before activating a draft; reprints keep using the stored template version/snapshot.
- No new document-number system was added.

Verification:
- `npm test -- src/app/api/__tests__/document-template-designer.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/continuous-print-ui.test.ts src/app/api/__tests__/document-template-api.test.ts src/app/api/__tests__/document-print-log.test.ts --runInBand`
- `npx tsc --noEmit`
- `npm run lint`
```

- [ ] **Step 2: Run full focused verification**

Run:

```powershell
npm test -- src/app/api/__tests__/document-template-designer.test.ts src/app/api/__tests__/document-template-designer-ui.test.ts src/app/api/__tests__/continuous-print-ui.test.ts src/app/api/__tests__/document-template-api.test.ts src/app/api/__tests__/document-print-log.test.ts --runInBand
```

Expected: `PASS`.

- [ ] **Step 3: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: exits with code `0`.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: exits with code `0`. If existing unrelated warnings appear, record exact warnings in the final note and do not modify unrelated modules.

- [ ] **Step 5: Browser check**

With the dev server running on port 3005, open `/settings?tab=document-templates`.

Verify:

- Continuous Tax Invoice / Receipt template opens to designer canvas.
- Line-item region can be selected and the inspector changes to line-item controls.
- Dragging the line-item region changes `x_mm` and `y_mm`.
- Resizing the line-item region changes `width_mm` and `max_rows`.
- Calibration panel can create and apply a profile.
- Preview opens and the line-item table stays inside the paper frame.
- Publish opens a diff dialog before calling publish.

- [ ] **Step 6: Commit and push**

Commit:

```powershell
git add DEVELOPER_HANDOFF.md
git commit -m "Update handoff for document template designer 2.1"
git push origin codex/document-template-designer-2-1
```

---

## Self-Review

- Spec coverage: line-item region editing is covered by Tasks 1-4; calibration profiles by Tasks 1 and 5; print history by Task 6; publish diff by Task 7; handoff and verification by Task 8.
- Type consistency: `DocumentTemplateCalibrationProfile`, `DocumentTemplateLineItemFormat`, `LineItemsPatch`, and `DesignerSelection` are introduced before later tasks reference them.
- Scope control: this plan only changes Continuous Tax Invoice / Receipt document templates and does not add EIR, statement, or formula designer work.
- Security and numbering: preview/test print remain read-only with respect to document numbers; print history reads existing logs; no runtime DDL is added.
