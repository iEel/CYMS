import type {
  DocumentTemplateConfig,
  DocumentTemplateField,
  DocumentTemplateFieldLayer,
  DocumentTemplateFontWeight,
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

function clampFieldToPaper(config: DocumentTemplateConfig, field: DocumentTemplateField): DocumentTemplateField {
  const maxWidth = Math.max(1, config.paper.width_mm - field.x_mm);
  const maxHeight = Math.max(1, config.paper.height_mm - field.y_mm);
  const width = clampMm(field.width_mm, 1, config.paper.width_mm);
  const height = clampMm(field.height_mm, 1, config.paper.height_mm);
  const x = clampMm(field.x_mm, 0, Math.max(0, config.paper.width_mm - width));
  const y = clampMm(field.y_mm, 0, Math.max(0, config.paper.height_mm - height));

  return {
    ...field,
    x_mm: x,
    y_mm: y,
    width_mm: clampMm(width, 1, maxWidth),
    height_mm: clampMm(height, 1, maxHeight),
  };
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

function stringIn<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

export function validateDesignerTemplateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(config)) return { valid: false, errors: ['config must be an object'] };
  if (!isRecord(config.paper)) errors.push('paper must be an object');

  const paper = config.paper as Record<string, unknown>;
  const paperWidth = Number(paper.width_mm);
  const paperHeight = Number(paper.height_mm);
  if (!Number.isFinite(paperWidth) || paperWidth <= 0) errors.push('paper.width_mm must be greater than 0');
  if (!Number.isFinite(paperHeight) || paperHeight <= 0) errors.push('paper.height_mm must be greater than 0');

  const fields = Array.isArray(config.fields) ? config.fields : [];
  if (fields.length === 0) errors.push('fields must contain at least one field');

  const fieldIds = new Set<string>();
  for (const [index, value] of fields.entries()) {
    if (!isRecord(value)) {
      errors.push(`fields[${index}] must be an object`);
      continue;
    }

    const fieldId = String(value.field_id || '');
    const bindingSource = String(value.binding_source || '');
    const label = String(value.label || '');
    const xMm = Number(value.x_mm);
    const yMm = Number(value.y_mm);
    const widthMm = Number(value.width_mm);
    const heightMm = Number(value.height_mm);
    const fontSize = Number(value.font_size);

    if (!fieldId) errors.push(`fields[${index}].field_id is required`);
    if (fieldIds.has(fieldId)) errors.push(`field_id ${fieldId} must be unique`);
    fieldIds.add(fieldId);

    if (!bindingSource || !canUseTemplateBinding(bindingSource)) {
      errors.push(`field ${fieldId || index} binding_source ${bindingSource || '(empty)'} is not allowed`);
    }
    if (hasUnsafeText(label) || hasUnsafeText(value.default_value) || hasUnsafeText(value.sample_value)) {
      errors.push(`field ${fieldId || index} contains unsafe text`);
    }
    if (!Number.isFinite(xMm) || xMm < 0) errors.push(`field ${fieldId || index} x_mm must be 0 or greater`);
    if (!Number.isFinite(yMm) || yMm < 0) errors.push(`field ${fieldId || index} y_mm must be 0 or greater`);
    if (!Number.isFinite(widthMm) || widthMm <= 0) errors.push(`field ${fieldId || index} width_mm must be greater than 0`);
    if (!Number.isFinite(heightMm) || heightMm <= 0) errors.push(`field ${fieldId || index} height_mm must be greater than 0`);
    if (!Number.isFinite(fontSize) || fontSize <= 0) errors.push(`field ${fieldId || index} font_size must be greater than 0`);
    if (Number.isFinite(xMm) && Number.isFinite(widthMm) && xMm + widthMm > paperWidth) {
      errors.push(`field ${fieldId || index} exceeds paper width`);
    }
    if (Number.isFinite(yMm) && Number.isFinite(heightMm) && yMm + heightMm > paperHeight) {
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
  if (lineItems) {
    const xMm = Number(lineItems.x_mm);
    const yMm = Number(lineItems.y_mm);
    const widthMm = Number(lineItems.width_mm);
    const maxRows = Number(lineItems.max_rows);
    const rowHeightMm = Number(lineItems.row_height_mm);
    if (Number.isFinite(xMm) && Number.isFinite(widthMm) && xMm + widthMm > paperWidth) {
      errors.push('sections.line_items exceeds paper width');
    }
    if (Number.isFinite(yMm) && Number.isFinite(maxRows) && Number.isFinite(rowHeightMm)
      && yMm + (maxRows * rowHeightMm) > paperHeight) {
      errors.push('sections.line_items exceeds paper height');
    }
  }

  return { valid: errors.length === 0, errors };
}
