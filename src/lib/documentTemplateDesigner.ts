import type {
  DocumentTemplateCalibrationProfile,
  DocumentTemplateConfig,
  DocumentTemplateField,
  DocumentTemplateFieldLayer,
  DocumentTemplateFontWeight,
  DocumentTemplateLineItemFormat,
  DocumentTemplateTextAlign,
} from './documentTemplateTypes';

export const DESIGNER_BINDINGS = [
  'company.logo_url',
  'company.company_name',
  'company.name',
  'company.name_th',
  'company.name_en',
  'company.address',
  'company.address_th',
  'company.address_en',
  'company.tax_id',
  'company.branch_type',
  'company.branch_number',
  'company.phone',
  'company.email',
  'customer.customer_name',
  'customer.name',
  'customer.address',
  'customer.billing_address',
  'customer.tax_id',
  'customer.branch_type',
  'customer.branch_number',
  'customer.branch_name',
  'document.document_title',
  'document.document_number',
  'document.invoice_id',
  'document.invoice_number',
  'document.receipt_number',
  'document.tax_invoice_number',
  'document.reference_no',
  'document.document_date',
  'document.issue_date',
  'document.copy_label',
  'document.red_ref_no',
  'payment.method',
  'payment.status',
  'payment.cheque_no',
  'payment.bank_name',
  'payment.cheque_date',
  'payment.payment_ref',
  'payment.collector_name',
  'totals.subtotal',
  'totals.vat_rate',
  'totals.vat_amount',
  'totals.grand_total',
  'totals.amount_text_th',
  'lines[].description',
  'lines[].qty',
  'lines[].unit_price',
  'lines[].amount',
] as const;

export type DesignerBinding = typeof DESIGNER_BINDINGS[number];

export type DesignerHistory = {
  past: DocumentTemplateConfig[];
  current: DocumentTemplateConfig;
  future: DocumentTemplateConfig[];
};

export type FieldPatch = Partial<Pick<
  DocumentTemplateField,
  | 'label'
  | 'field_key'
  | 'binding_source'
  | 'x_mm'
  | 'y_mm'
  | 'width_mm'
  | 'height_mm'
  | 'font_size'
  | 'font_weight'
  | 'text_align'
  | 'visible'
  | 'locked'
  | 'layer'
  | 'format'
  | 'sample_value'
>>;

export type FieldNudge = {
  dxMm: number;
  dyMm: number;
  snapMm: number;
  largeStepMm?: number;
  fineStepMm?: number;
};

const LINE_ITEM_FIELD_KEYS = ['description', 'qty', 'unit_price', 'amount'] as const;
const LINE_ITEM_FORMATS = ['text', 'number', 'currency:THB'] as const;
const LINE_ITEM_MIN_ROW_HEIGHT_MM = 4;

type LineItemFieldKey = typeof LINE_ITEM_FIELD_KEYS[number];
const LINE_ITEM_BINDINGS = LINE_ITEM_FIELD_KEYS.map(fieldKey => `lines[].${fieldKey}`) as Array<`lines[].${LineItemFieldKey}`>;
type LineItemColumn = DocumentTemplateConfig['sections']['line_items']['columns'][number];

export type LineItemsPatch = Partial<Pick<
  DocumentTemplateConfig['sections']['line_items'],
  | 'x_mm'
  | 'y_mm'
  | 'width_mm'
  | 'row_height_mm'
  | 'max_rows'
>>;

export type LineItemColumnPatch = Partial<Pick<
  LineItemColumn,
  | 'field_key'
  | 'label'
  | 'width_mm'
  | 'text_align'
  | 'format'
>>;

function cloneConfig(config: DocumentTemplateConfig): DocumentTemplateConfig {
  return JSON.parse(JSON.stringify(config)) as DocumentTemplateConfig;
}

function roundMm(value: number) {
  return Math.round(value * 100) / 100;
}

export function snapMm(value: number, stepMm: number) {
  const step = Number.isFinite(stepMm) && stepMm > 0 ? stepMm : 1;
  return roundMm(Math.round(value / step) * step);
}

function clampMm(value: number, min: number, max: number) {
  return roundMm(Math.min(Math.max(value, min), max));
}

function finiteOr(value: unknown, fallback: number) {
  return finiteNumber(value) ? value : fallback;
}

export function canUseTemplateBinding(bindingSource: string): bindingSource is DesignerBinding {
  return DESIGNER_BINDINGS.includes(bindingSource as DesignerBinding);
}

function titleFromBinding(bindingSource: string) {
  const raw = bindingSource.split('.').pop()?.replace(/\[\]/g, '') || 'field';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function fieldIdFromBinding(config: DocumentTemplateConfig, bindingSource: string) {
  const base = bindingSource
    .replace(/\[\]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'field';
  const used = new Set(config.fields.map(field => field.field_id));
  let suffix = config.fields.length + 1;
  let candidate = `${base}-${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function safeFieldPatch(patch: FieldPatch): FieldPatch {
  const next = { ...patch };
  if (next.binding_source && !canUseTemplateBinding(next.binding_source)) {
    delete next.binding_source;
  }
  if (next.field_key && !canUseTemplateBinding(next.field_key)) {
    delete next.field_key;
  }
  if (next.font_weight && !['normal', 'medium', 'semibold', 'bold'].includes(next.font_weight)) {
    delete next.font_weight;
  }
  if (next.text_align && !['left', 'center', 'right'].includes(next.text_align)) {
    delete next.text_align;
  }
  if (next.layer && !['form', 'data', 'calibration'].includes(next.layer)) {
    delete next.layer;
  }
  return next;
}

function normalizeLineItemFieldKey(value: unknown): LineItemFieldKey | null {
  if (typeof value !== 'string') return null;
  const normalized = value.startsWith('lines[].') ? value.slice('lines[].'.length) : value;
  return LINE_ITEM_FIELD_KEYS.includes(normalized as LineItemFieldKey)
    ? normalized as LineItemFieldKey
    : null;
}

function lineItemBindingFromFieldKey(fieldKey: LineItemFieldKey) {
  return `lines[].${fieldKey}` as const;
}

function canUseLineItemBinding(value: unknown) {
  return typeof value === 'string' && LINE_ITEM_BINDINGS.includes(value as `lines[].${LineItemFieldKey}`);
}

function defaultLineItemFormat(fieldKey: LineItemFieldKey): DocumentTemplateLineItemFormat {
  if (fieldKey === 'description') return 'text';
  if (fieldKey === 'qty') return 'number';
  return 'currency:THB';
}

function lineItemColumnId(config: DocumentTemplateConfig, fieldKey: LineItemFieldKey) {
  const used = new Set(config.sections.line_items.columns.map(column => column.column_id));
  let candidate: string = fieldKey;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${fieldKey}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function lineItemsHeaderHeight(startYMm: number, yMm: number) {
  return roundMm(Math.max(0, startYMm - yMm));
}

function safeLineItemColumnPatch(patch: LineItemColumnPatch, sectionWidthMm: number): LineItemColumnPatch {
  const next = { ...patch };
  const fieldKey = normalizeLineItemFieldKey(next.field_key);
  if (next.field_key && (!fieldKey || !canUseLineItemBinding(next.field_key))) delete next.field_key;
  if (next.label && hasUnsafeText(next.label)) {
    delete next.label;
  }
  if (next.width_mm !== undefined) {
    if (finiteNumber(next.width_mm)) {
      next.width_mm = clampMm(next.width_mm, 1, sectionWidthMm);
    } else {
      delete next.width_mm;
    }
  }
  if (next.text_align && !['left', 'center', 'right'].includes(next.text_align)) {
    delete next.text_align;
  }
  if (next.format && !LINE_ITEM_FORMATS.includes(next.format)) {
    delete next.format;
  }
  return next;
}

function clampLineItemsToPaper(config: DocumentTemplateConfig): DocumentTemplateConfig['sections']['line_items'] {
  const lineItems = config.sections.line_items;
  const paperWidth = finiteOr(config.paper.width_mm, 20);
  const paperHeight = finiteOr(config.paper.height_mm, 60);
  const width = clampMm(finiteOr(lineItems.width_mm, 20), 20, paperWidth);
  const rowHeight = clampMm(finiteOr(lineItems.row_height_mm, 6), LINE_ITEM_MIN_ROW_HEIGHT_MM, 20);
  const rawY = finiteOr(lineItems.y_mm, 0);
  const rawStartY = roundMm(rawY + rowHeight);
  const headerHeight = lineItemsHeaderHeight(rawStartY, rawY);
  const requestedMaxRows = Math.round(clampMm(finiteOr(lineItems.max_rows, 1), 1, 50));
  const rowsThatFitOnPaper = Math.max(1, Math.floor(Math.max(0, paperHeight - headerHeight) / rowHeight));
  const maxRows = Math.min(requestedMaxRows, rowsThatFitOnPaper);
  const x = clampMm(finiteOr(lineItems.x_mm, 0), 0, Math.max(0, paperWidth - width));
  const totalHeight = headerHeight + rowHeight * maxRows;
  const y = clampMm(rawY, 0, Math.max(0, paperHeight - totalHeight));

  return {
    ...lineItems,
    x_mm: x,
    y_mm: y,
    start_y_mm: roundMm(y + rowHeight),
    width_mm: width,
    row_height_mm: rowHeight,
    max_rows: maxRows,
  };
}

function clampFieldToPaper(config: DocumentTemplateConfig, field: DocumentTemplateField): DocumentTemplateField {
  const width = clampMm(field.width_mm, 1, config.paper.width_mm);
  const height = clampMm(field.height_mm, 1, config.paper.height_mm);
  const x = clampMm(field.x_mm, 0, Math.max(0, config.paper.width_mm - width));
  const y = clampMm(field.y_mm, 0, Math.max(0, config.paper.height_mm - height));
  const maxWidth = Math.max(1, config.paper.width_mm - x);
  const maxHeight = Math.max(1, config.paper.height_mm - y);

  return {
    ...field,
    x_mm: x,
    y_mm: y,
    width_mm: clampMm(width, 1, maxWidth),
    height_mm: clampMm(height, 1, maxHeight),
  };
}

export function applyLineItemsPatch(config: DocumentTemplateConfig, patch: LineItemsPatch): DocumentTemplateConfig {
  const next = cloneConfig(config);
  const safePatch: LineItemsPatch = {};
  for (const key of ['x_mm', 'y_mm', 'width_mm', 'row_height_mm', 'max_rows'] as const) {
    if (finiteNumber(patch[key])) {
      safePatch[key] = patch[key];
    }
  }
  next.sections.line_items = clampLineItemsToPaper({
    ...next,
    sections: {
      ...next.sections,
      line_items: {
        ...next.sections.line_items,
        ...safePatch,
      },
    },
  });
  return next;
}

export function resizeLineItems(
  config: DocumentTemplateConfig,
  size: { widthMm: number; heightMm: number; snapMm: number },
): DocumentTemplateConfig {
  const rowHeight = config.sections.line_items.row_height_mm || 1;
  const headerHeight = lineItemsHeaderHeight(config.sections.line_items.start_y_mm, config.sections.line_items.y_mm);
  return applyLineItemsPatch(config, {
    width_mm: snapMm(size.widthMm, size.snapMm),
    max_rows: Math.round((snapMm(size.heightMm, size.snapMm) - headerHeight) / rowHeight),
  });
}

export function nudgeLineItems(
  config: DocumentTemplateConfig,
  nudge: FieldNudge,
): DocumentTemplateConfig {
  return applyLineItemsPatch(config, {
    x_mm: snapMm(config.sections.line_items.x_mm + nudge.dxMm, nudge.snapMm),
    y_mm: snapMm(config.sections.line_items.y_mm + nudge.dyMm, nudge.snapMm),
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
      ...safeLineItemColumnPatch(patch, next.sections.line_items.width_mm),
    };
  });
  return next;
}

export function addLineItemColumn(config: DocumentTemplateConfig, fieldKey: string): DocumentTemplateConfig {
  const normalizedFieldKey = normalizeLineItemFieldKey(fieldKey);
  if (!normalizedFieldKey) return config;

  const next = cloneConfig(config);
  next.sections.line_items.columns = [
    ...next.sections.line_items.columns,
    {
      column_id: lineItemColumnId(next, normalizedFieldKey),
      field_key: lineItemBindingFromFieldKey(normalizedFieldKey),
      label: titleFromBinding(normalizedFieldKey),
      width_mm: 30,
      text_align: normalizedFieldKey === 'description' ? 'left' : 'right',
      format: defaultLineItemFormat(normalizedFieldKey),
    },
  ];
  return next;
}

export function removeLineItemColumn(config: DocumentTemplateConfig, columnId: string): DocumentTemplateConfig {
  const next = cloneConfig(config);
  if (next.sections.line_items.columns.length <= 1) return config;
  next.sections.line_items.columns = next.sections.line_items.columns.filter(column => column.column_id !== columnId);
  return next;
}

export function moveLineItemColumn(
  config: DocumentTemplateConfig,
  columnId: string,
  direction: -1 | 1,
): DocumentTemplateConfig {
  const index = config.sections.line_items.columns.findIndex(column => column.column_id === columnId);
  if (index < 0) return config;
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= config.sections.line_items.columns.length) return config;

  const next = cloneConfig(config);
  const columns = [...next.sections.line_items.columns];
  [columns[index], columns[targetIndex]] = [columns[targetIndex], columns[index]];
  next.sections.line_items.columns = columns;
  return next;
}

export function applyCalibrationProfileToConfig(
  config: DocumentTemplateConfig,
  profileId: string,
): DocumentTemplateConfig {
  const profile = config.calibration_profiles?.find(item => item.profile_id === profileId);
  if (!profile) return config;

  const next = cloneConfig(config);
  next.paper = {
    ...next.paper,
    width_mm: profile.width_mm,
    height_mm: profile.height_mm,
    top_offset_mm: profile.top_offset_mm,
    left_offset_mm: profile.left_offset_mm,
    print_scale: profile.print_scale,
  };
  next.fields = next.fields.map(field => clampFieldToPaper(next, field));
  next.sections.line_items = clampLineItemsToPaper(next);
  next.default_calibration_profile_id = profile.profile_id;
  return next;
}

export function applyFieldPatch(
  config: DocumentTemplateConfig,
  fieldId: string,
  patch: FieldPatch,
): DocumentTemplateConfig {
  const next = cloneConfig(config);
  next.fields = next.fields.map(field => {
    if (field.field_id !== fieldId || field.locked) return field;
    return clampFieldToPaper(next, {
      ...field,
      ...safeFieldPatch(patch),
    });
  });
  return next;
}

export function nudgeField(
  config: DocumentTemplateConfig,
  fieldId: string,
  nudge: FieldNudge,
): DocumentTemplateConfig {
  const field = config.fields.find(item => item.field_id === fieldId);
  if (!field || field.locked) return config;

  return applyFieldPatch(config, fieldId, {
    x_mm: snapMm(field.x_mm + nudge.dxMm, nudge.snapMm),
    y_mm: snapMm(field.y_mm + nudge.dyMm, nudge.snapMm),
  });
}

export function resizeField(
  config: DocumentTemplateConfig,
  fieldId: string,
  size: { widthMm: number; heightMm: number; snapMm: number },
): DocumentTemplateConfig {
  const field = config.fields.find(item => item.field_id === fieldId);
  if (!field || field.locked) return config;

  return applyFieldPatch(config, fieldId, {
    width_mm: snapMm(size.widthMm, size.snapMm),
    height_mm: snapMm(size.heightMm, size.snapMm),
  });
}

export function addFieldFromBinding(
  config: DocumentTemplateConfig,
  bindingSource: string,
  position: { xMm: number; yMm: number },
): DocumentTemplateConfig {
  if (!canUseTemplateBinding(bindingSource)) return config;

  const next = cloneConfig(config);
  const newField: DocumentTemplateField = clampFieldToPaper(next, {
    field_id: fieldIdFromBinding(next, bindingSource),
    field_key: bindingSource,
    label: titleFromBinding(bindingSource),
    binding_source: bindingSource,
    x_mm: snapMm(position.xMm, 1),
    y_mm: snapMm(position.yMm, 1),
    width_mm: 42,
    height_mm: 6,
    font_size: 9,
    font_weight: 'normal',
    text_align: 'left',
    visible: true,
    layer: 'data',
    locked: false,
    format: bindingSource.includes('amount') || bindingSource.includes('total') ? 'currency:THB' : 'text',
    sample_value: titleFromBinding(bindingSource),
  });
  next.fields = [...next.fields, newField];
  return next;
}

export function deleteField(config: DocumentTemplateConfig, fieldId: string): DocumentTemplateConfig {
  const field = config.fields.find(item => item.field_id === fieldId);
  if (!field || field.locked) return config;
  return {
    ...cloneConfig(config),
    fields: config.fields.filter(item => item.field_id !== fieldId),
  };
}

export function createDesignerHistory(config: DocumentTemplateConfig): DesignerHistory {
  return { past: [], current: cloneConfig(config), future: [] };
}

export function pushDesignerHistory(
  history: DesignerHistory,
  nextConfig: DocumentTemplateConfig,
  maxEntries = 40,
): DesignerHistory {
  return {
    past: [...history.past, cloneConfig(history.current)].slice(-maxEntries),
    current: cloneConfig(nextConfig),
    future: [],
  };
}

export function undoDesignerHistory(history: DesignerHistory): DesignerHistory {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    current: cloneConfig(previous),
    future: [cloneConfig(history.current), ...history.future],
  };
}

export function redoDesignerHistory(history: DesignerHistory): DesignerHistory {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, cloneConfig(history.current)],
    current: cloneConfig(next),
    future: history.future.slice(1),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnsafeText(value: unknown) {
  return typeof value === 'string' && /<\s*script|javascript:/i.test(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function stringIn<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

export function validateDesignerTemplateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(config)) return { valid: false, errors: ['config must be an object'] };
  if (!isRecord(config.paper)) errors.push('paper must be an object');

  const paper = isRecord(config.paper) ? config.paper : {};
  const paperWidth = finiteNumber(paper.width_mm) ? paper.width_mm : NaN;
  const paperHeight = finiteNumber(paper.height_mm) ? paper.height_mm : NaN;
  if (!finiteNumber(paper.width_mm) || paper.width_mm <= 0) errors.push('paper.width_mm must be greater than 0');
  if (!finiteNumber(paper.height_mm) || paper.height_mm <= 0) errors.push('paper.height_mm must be greater than 0');

  const fields = Array.isArray(config.fields) ? config.fields : [];
  if (fields.length === 0) errors.push('fields must contain at least one field');

  const fieldIds = new Set<string>();
  for (const [index, value] of fields.entries()) {
    if (!isRecord(value)) {
      errors.push(`fields[${index}] must be an object`);
      continue;
    }

    const fieldId = String(value.field_id || '');
    const fieldKey = String(value.field_key || '');
    const bindingSource = String(value.binding_source || '');
    const label = String(value.label || '');
    const xMm = finiteNumber(value.x_mm) ? value.x_mm : NaN;
    const yMm = finiteNumber(value.y_mm) ? value.y_mm : NaN;
    const widthMm = finiteNumber(value.width_mm) ? value.width_mm : NaN;
    const heightMm = finiteNumber(value.height_mm) ? value.height_mm : NaN;
    const fontSize = finiteNumber(value.font_size) ? value.font_size : NaN;

    if (!fieldId) errors.push(`fields[${index}].field_id is required`);
    if (fieldIds.has(fieldId)) errors.push(`field_id ${fieldId} must be unique`);
    fieldIds.add(fieldId);

    if (!bindingSource || !canUseTemplateBinding(bindingSource)) {
      errors.push(`field ${fieldId || index} binding_source ${bindingSource || '(empty)'} is not allowed`);
    }
    if (!fieldKey || !canUseTemplateBinding(fieldKey)) {
      errors.push(`field ${fieldId || index} field_key ${fieldKey || '(empty)'} is not allowed`);
    }
    if (hasUnsafeText(label) || hasUnsafeText(value.default_value) || hasUnsafeText(value.sample_value)) {
      errors.push(`field ${fieldId || index} contains unsafe text`);
    }
    if (!finiteNumber(value.x_mm) || xMm < 0) errors.push(`field ${fieldId || index} x_mm must be 0 or greater`);
    if (!finiteNumber(value.y_mm) || yMm < 0) errors.push(`field ${fieldId || index} y_mm must be 0 or greater`);
    if (!finiteNumber(value.width_mm) || widthMm <= 0) errors.push(`field ${fieldId || index} width_mm must be greater than 0`);
    if (!finiteNumber(value.height_mm) || heightMm <= 0) errors.push(`field ${fieldId || index} height_mm must be greater than 0`);
    if (!finiteNumber(value.font_size) || fontSize <= 0) errors.push(`field ${fieldId || index} font_size must be greater than 0`);
    if (finiteNumber(value.x_mm) && finiteNumber(value.width_mm) && xMm + widthMm > paperWidth) {
      errors.push(`field ${fieldId || index} exceeds paper width`);
    }
    if (finiteNumber(value.y_mm) && finiteNumber(value.height_mm) && yMm + heightMm > paperHeight) {
      errors.push(`field ${fieldId || index} exceeds paper height`);
    }
    if (!stringIn(value.font_weight, ['normal', 'medium', 'semibold', 'bold'] as readonly DocumentTemplateFontWeight[])) {
      errors.push(`field ${fieldId || index} font_weight is invalid`);
    }
    if (!stringIn(value.text_align, ['left', 'center', 'right'] as readonly DocumentTemplateTextAlign[])) {
      errors.push(`field ${fieldId || index} text_align is invalid`);
    }
    if (!stringIn(value.layer, ['form', 'data', 'calibration'] as readonly DocumentTemplateFieldLayer[])) {
      errors.push(`field ${fieldId || index} layer is invalid`);
    }
  }

  const lineItems = isRecord(config.sections) && isRecord(config.sections.line_items)
    ? config.sections.line_items
    : null;
  if (!lineItems) {
    errors.push('sections.line_items must be an object');
  } else {
    const xMm = finiteNumber(lineItems.x_mm) ? lineItems.x_mm : NaN;
    const yMm = finiteNumber(lineItems.y_mm) ? lineItems.y_mm : NaN;
    const widthMm = finiteNumber(lineItems.width_mm) ? lineItems.width_mm : NaN;
    const maxRows = finiteNumber(lineItems.max_rows) ? lineItems.max_rows : NaN;
    const rowHeightMm = finiteNumber(lineItems.row_height_mm) ? lineItems.row_height_mm : NaN;
    const startYMm = finiteNumber(lineItems.start_y_mm) ? lineItems.start_y_mm : NaN;
    const columns = Array.isArray(lineItems.columns) ? lineItems.columns : [];

    if (!finiteNumber(lineItems.x_mm) || xMm < 0) errors.push('sections.line_items.x_mm must be 0 or greater');
    if (!finiteNumber(lineItems.y_mm) || yMm < 0) errors.push('sections.line_items.y_mm must be 0 or greater');
    if (!finiteNumber(lineItems.width_mm) || widthMm < 20 || widthMm > paperWidth) {
      errors.push('sections.line_items.width_mm must be between 20 and paper width');
    }
    if (!finiteNumber(lineItems.row_height_mm) || rowHeightMm < LINE_ITEM_MIN_ROW_HEIGHT_MM || rowHeightMm > 20) {
      errors.push('sections.line_items.row_height_mm must be between 4 and 20');
    }
    if (!finiteNumber(lineItems.max_rows) || !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 50) {
      errors.push('sections.line_items.max_rows must be an integer between 1 and 50');
    }
    if (
      !finiteNumber(lineItems.start_y_mm)
      || !finiteNumber(lineItems.y_mm)
      || !finiteNumber(lineItems.row_height_mm)
      || startYMm !== roundMm(yMm + rowHeightMm)
    ) {
      errors.push('sections.line_items.start_y_mm must equal y_mm + row_height_mm');
    }
    if (finiteNumber(lineItems.x_mm) && finiteNumber(lineItems.width_mm) && xMm + widthMm > paperWidth) {
      errors.push('sections.line_items exceeds paper width');
    }
    if (finiteNumber(lineItems.y_mm) && finiteNumber(lineItems.start_y_mm) && finiteNumber(lineItems.max_rows) && finiteNumber(lineItems.row_height_mm)
      && yMm + roundMm(lineItemsHeaderHeight(startYMm, yMm) + maxRows * rowHeightMm) > paperHeight) {
      errors.push('sections.line_items exceeds paper height');
    }
    if (columns.length === 0) errors.push('sections.line_items.columns must contain at least one column');

    const columnIds = new Set<string>();
    for (const [index, value] of columns.entries()) {
      if (!isRecord(value)) {
        errors.push(`sections.line_items column ${index} must be an object`);
        continue;
      }

      const columnId = String(value.column_id || '');
      const fieldKey = String(value.field_key || '');
      const columnLabel = columnId || String(index);
      const columnWidth = finiteNumber(value.width_mm) ? value.width_mm : NaN;

      if (!columnId) errors.push(`sections.line_items column ${index} column_id is required`);
      if (columnId && columnIds.has(columnId)) {
        errors.push(`sections.line_items column_id ${columnId} must be unique`);
      }
      if (columnId) columnIds.add(columnId);
      if (!canUseLineItemBinding(fieldKey)) {
        errors.push(`sections.line_items column ${fieldKey || columnLabel} is not allowed`);
      }
      if (hasUnsafeText(value.label)) {
        errors.push(`sections.line_items column ${columnLabel} contains unsafe text`);
      }
      if (!finiteNumber(value.width_mm) || columnWidth <= 0) {
        errors.push(`sections.line_items column ${columnLabel} width_mm must be greater than 0`);
      }
      if (!stringIn(value.text_align, ['left', 'center', 'right'] as readonly DocumentTemplateTextAlign[])) {
        errors.push(`sections.line_items column ${columnLabel} text_align is invalid`);
      }
      if (!stringIn(value.format, LINE_ITEM_FORMATS)) {
        errors.push(`sections.line_items column ${columnLabel} format is invalid`);
      }
    }
  }

  if (config.calibration_profiles !== undefined && !Array.isArray(config.calibration_profiles)) {
    errors.push('calibration_profiles must be an array');
  }
  const calibrationProfiles = Array.isArray(config.calibration_profiles) ? config.calibration_profiles : [];
  const profileIds = new Set<string>();
  for (const [index, value] of calibrationProfiles.entries()) {
    if (!isRecord(value)) {
      errors.push(`calibration_profiles[${index}] must be an object`);
      continue;
    }

    const profile = value as Partial<DocumentTemplateCalibrationProfile>;
    const profileId = String(profile.profile_id || '');
    const profileLabel = profileId || String(index);
    if (!profileId) errors.push(`calibration_profiles[${index}].profile_id is required`);
    if (profileId && profileIds.has(profileId)) errors.push(`calibration_profile_id ${profileId} must be unique`);
    if (profileId) profileIds.add(profileId);
    if (typeof profile.profile_name !== 'string' || profile.profile_name.trim().length === 0) {
      errors.push(`calibration_profile ${profileLabel} profile_name is required`);
    }
    if (typeof profile.paper_label !== 'string' || profile.paper_label.trim().length === 0) {
      errors.push(`calibration_profile ${profileLabel} paper_label is required`);
    }

    if (
      hasUnsafeText(profile.profile_id)
      || hasUnsafeText(profile.profile_name)
      || hasUnsafeText(profile.paper_label)
      || hasUnsafeText(profile.notes)
    ) {
      errors.push(`calibration_profile ${profileLabel} contains unsafe text`);
    }

    for (const key of ['width_mm', 'height_mm', 'print_scale'] as const) {
      const valueAtKey = profile[key];
      if (!finiteNumber(valueAtKey) || valueAtKey <= 0) {
        errors.push(`calibration_profile ${profileLabel} ${key} must be greater than 0`);
      }
    }
    for (const key of ['top_offset_mm', 'left_offset_mm'] as const) {
      const valueAtKey = profile[key];
      if (!finiteNumber(valueAtKey) || valueAtKey < 0) {
        errors.push(`calibration_profile ${profileLabel} ${key} must be 0 or greater`);
      }
    }
  }

  if (
    typeof config.default_calibration_profile_id === 'string'
    && config.default_calibration_profile_id.length > 0
    && !profileIds.has(config.default_calibration_profile_id)
  ) {
    errors.push('default_calibration_profile_id must reference an existing profile');
  }

  return { valid: errors.length === 0, errors };
}
