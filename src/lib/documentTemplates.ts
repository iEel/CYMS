import type { DocumentTemplateConfig, DocumentTemplateField } from './documentTemplateTypes';

const THAI_COPY_LABELS = [
  'ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน',
  'สำเนาใบกำกับภาษี/ใบเสร็จรับเงิน',
  'สำเนาสำหรับบัญชี',
  'สำเนาสำหรับลูกค้า',
  'สำเนาสำหรับเก็บ',
];

function field(input: Omit<DocumentTemplateField, 'visible' | 'layer' | 'locked'>): DocumentTemplateField {
  return {
    ...input,
    visible: true,
    layer: 'data',
    locked: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string, errors: string[]): Record<string, unknown> | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }
  return value;
}

function requireArray(value: unknown, path: string, errors: string[]): unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  return value;
}

function requireString(value: unknown, path: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${path} is required`);
    return null;
  }
  return value;
}

function requireNumber(value: unknown, path: string, errors: string[]): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${path} must be a number`);
    return null;
  }
  return value;
}

export function buildDefaultContinuousTemplateConfig(): DocumentTemplateConfig {
  return {
    paper: {
      width_mm: 241.3,
      height_mm: 139.7,
      top_offset_mm: 0,
      left_offset_mm: 0,
      print_scale: 1,
      margin_top_mm: 6,
      margin_right_mm: 6,
      margin_bottom_mm: 6,
      margin_left_mm: 6,
    },
    mode: 'full',
    copy_mode: 'carbonless',
    copy_labels: [...THAI_COPY_LABELS],
    fields: [
      field({
        field_id: 'document-title',
        field_key: 'document.document_title',
        label: 'Document title',
        binding_source: 'document.document_title',
        x_mm: 9,
        y_mm: 6,
        width_mm: 110,
        height_mm: 8,
        font_size: 13,
        font_weight: 'bold',
        text_align: 'left',
        format: 'text',
        default_value: 'ใบกำกับภาษี/ใบเสร็จรับเงิน',
        sample_value: 'ใบกำกับภาษี/ใบเสร็จรับเงิน',
      }),
      field({
        field_id: 'invoice-number',
        field_key: 'document.invoice_number',
        label: 'Invoice number',
        binding_source: 'document.invoice_number',
        x_mm: 178,
        y_mm: 6,
        width_mm: 54,
        height_mm: 6,
        font_size: 10,
        font_weight: 'semibold',
        text_align: 'right',
        format: 'text',
        sample_value: 'INV-2026-00001',
      }),
      field({
        field_id: 'receipt-number',
        field_key: 'document.receipt_number',
        label: 'Receipt number',
        binding_source: 'document.receipt_number',
        x_mm: 178,
        y_mm: 12,
        width_mm: 54,
        height_mm: 5,
        font_size: 9,
        font_weight: 'normal',
        text_align: 'right',
        format: 'text',
        sample_value: 'RCT-2026-00001',
      }),
      field({
        field_id: 'tax-invoice-number',
        field_key: 'document.tax_invoice_number',
        label: 'Tax invoice number',
        binding_source: 'document.tax_invoice_number',
        x_mm: 178,
        y_mm: 18,
        width_mm: 54,
        height_mm: 5,
        font_size: 9,
        font_weight: 'normal',
        text_align: 'right',
        format: 'text',
        sample_value: 'TAX-2026-00001',
      }),
      field({
        field_id: 'document-date',
        field_key: 'document.document_date',
        label: 'Document date',
        binding_source: 'document.document_date',
        x_mm: 178,
        y_mm: 24,
        width_mm: 54,
        height_mm: 5,
        font_size: 9,
        font_weight: 'normal',
        text_align: 'right',
        format: 'date:dd/MM/yyyy',
        sample_value: '26/05/2026',
      }),
      field({
        field_id: 'company-name',
        field_key: 'company.company_name',
        label: 'Company name',
        binding_source: 'company.company_name',
        x_mm: 9,
        y_mm: 18,
        width_mm: 120,
        height_mm: 6,
        font_size: 10,
        font_weight: 'semibold',
        text_align: 'left',
        format: 'text',
        sample_value: 'Container Yard Co., Ltd.',
      }),
      field({
        field_id: 'company-tax-id',
        field_key: 'company.tax_id',
        label: 'Company tax ID',
        binding_source: 'company.tax_id',
        x_mm: 9,
        y_mm: 25,
        width_mm: 70,
        height_mm: 5,
        font_size: 8,
        font_weight: 'normal',
        text_align: 'left',
        format: 'text',
        sample_value: '0105559000000',
      }),
      field({
        field_id: 'customer-name',
        field_key: 'customer.customer_name',
        label: 'Customer name',
        binding_source: 'customer.customer_name',
        x_mm: 9,
        y_mm: 36,
        width_mm: 112,
        height_mm: 6,
        font_size: 10,
        font_weight: 'semibold',
        text_align: 'left',
        format: 'text',
        sample_value: 'Example Customer Co., Ltd.',
      }),
      field({
        field_id: 'customer-tax-id',
        field_key: 'customer.tax_id',
        label: 'Customer tax ID',
        binding_source: 'customer.tax_id',
        x_mm: 9,
        y_mm: 43,
        width_mm: 70,
        height_mm: 5,
        font_size: 8,
        font_weight: 'normal',
        text_align: 'left',
        format: 'text',
        sample_value: '0105566000000',
      }),
      field({
        field_id: 'customer-branch',
        field_key: 'customer.branch_name',
        label: 'Customer branch',
        binding_source: 'customer.branch_name',
        x_mm: 82,
        y_mm: 43,
        width_mm: 48,
        height_mm: 5,
        font_size: 8,
        font_weight: 'normal',
        text_align: 'left',
        format: 'text',
        sample_value: 'สำนักงานใหญ่',
      }),
      field({
        field_id: 'totals-subtotal',
        field_key: 'totals.subtotal',
        label: 'Subtotal',
        binding_source: 'totals.subtotal',
        x_mm: 175,
        y_mm: 103,
        width_mm: 56,
        height_mm: 5,
        font_size: 9,
        font_weight: 'normal',
        text_align: 'right',
        format: 'currency:THB',
        sample_value: '10,000.00',
      }),
      field({
        field_id: 'totals-vat',
        field_key: 'totals.vat_amount',
        label: 'VAT amount',
        binding_source: 'totals.vat_amount',
        x_mm: 175,
        y_mm: 110,
        width_mm: 56,
        height_mm: 5,
        font_size: 9,
        font_weight: 'normal',
        text_align: 'right',
        format: 'currency:THB',
        sample_value: '700.00',
      }),
      field({
        field_id: 'totals-grand-total',
        field_key: 'totals.grand_total',
        label: 'Grand total',
        binding_source: 'totals.grand_total',
        x_mm: 175,
        y_mm: 119,
        width_mm: 56,
        height_mm: 7,
        font_size: 11,
        font_weight: 'bold',
        text_align: 'right',
        format: 'currency:THB',
        sample_value: '10,700.00',
      }),
      field({
        field_id: 'totals-amount-text-th',
        field_key: 'totals.amount_text_th',
        label: 'Amount text Thai',
        binding_source: 'totals.amount_text_th',
        x_mm: 9,
        y_mm: 119,
        width_mm: 154,
        height_mm: 7,
        font_size: 9,
        font_weight: 'semibold',
        text_align: 'left',
        format: 'text',
        sample_value: 'หนึ่งหมื่นเจ็ดร้อยบาทถ้วน',
      }),
    ],
    sections: {
      line_items: {
        section_id: 'line-items',
        binding_source: 'lines',
        x_mm: 9,
        y_mm: 55,
        start_y_mm: 55,
        width_mm: 222,
        row_height_mm: 6,
        max_rows: 7,
        columns: [
          {
            column_id: 'description',
            field_key: 'lines[].description',
            label: 'Description',
            width_mm: 120,
            text_align: 'left',
            format: 'text',
          },
          {
            column_id: 'quantity',
            field_key: 'lines[].qty',
            label: 'Qty',
            width_mm: 22,
            text_align: 'right',
            format: 'number',
          },
          {
            column_id: 'unit_price',
            field_key: 'lines[].unit_price',
            label: 'Unit price',
            width_mm: 36,
            text_align: 'right',
            format: 'currency:THB',
          },
          {
            column_id: 'amount',
            field_key: 'lines[].amount',
            label: 'Amount',
            width_mm: 44,
            text_align: 'right',
            format: 'currency:THB',
          },
        ],
      },
    },
  };
}

export function validateTemplateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const root = requireRecord(config, 'config', errors);
  if (!root) return { valid: false, errors };

  const paper = requireRecord(root.paper, 'paper', errors);
  if (paper) {
    const widthMm = requireNumber(paper.width_mm, 'paper.width_mm', errors);
    const heightMm = requireNumber(paper.height_mm, 'paper.height_mm', errors);
    const topOffsetMm = requireNumber(paper.top_offset_mm, 'paper.top_offset_mm', errors);
    const leftOffsetMm = requireNumber(paper.left_offset_mm, 'paper.left_offset_mm', errors);
    const printScale = requireNumber(paper.print_scale, 'paper.print_scale', errors);

    if (widthMm !== null && widthMm <= 0) errors.push('paper.width_mm must be greater than 0');
    if (heightMm !== null && heightMm <= 0) errors.push('paper.height_mm must be greater than 0');
    if (topOffsetMm !== null && topOffsetMm < 0) errors.push('paper.top_offset_mm must be 0 or greater');
    if (leftOffsetMm !== null && leftOffsetMm < 0) errors.push('paper.left_offset_mm must be 0 or greater');
    if (printScale !== null && printScale <= 0) errors.push('paper.print_scale must be greater than 0');
  }

  if (!['full', 'overlay'].includes(String(root.mode))) errors.push('mode must be full or overlay');
  if (!['carbonless', 'separate'].includes(String(root.copy_mode))) {
    errors.push('copy_mode must be carbonless or separate');
  }

  const copyLabels = requireArray(root.copy_labels, 'copy_labels', errors);
  if (copyLabels.length === 0) errors.push('copy_labels must contain at least one label');

  const fields = requireArray(root.fields, 'fields', errors);
  if (fields.length === 0) errors.push('fields must contain at least one field');

  const fieldIds = new Set<string>();

  for (const [index, templateField] of fields.entries()) {
    const path = `fields[${index}]`;
    const fieldRecord = requireRecord(templateField, path, errors);
    if (!fieldRecord) continue;

    const fieldId = requireString(fieldRecord.field_id, `${path}.field_id`, errors);
    const fieldLabel = fieldId || path;
    if (fieldId) {
      if (fieldIds.has(fieldId)) errors.push(`field_id ${fieldId} must be unique`);
      fieldIds.add(fieldId);
    }

    requireString(fieldRecord.field_key, `${path}.field_key`, errors);
    requireString(fieldRecord.binding_source, `${path}.binding_source`, errors);

    const xMm = requireNumber(fieldRecord.x_mm, `${path}.x_mm`, errors);
    const yMm = requireNumber(fieldRecord.y_mm, `${path}.y_mm`, errors);
    const widthMm = requireNumber(fieldRecord.width_mm, `${path}.width_mm`, errors);
    const heightMm = requireNumber(fieldRecord.height_mm, `${path}.height_mm`, errors);
    const fontSize = requireNumber(fieldRecord.font_size, `${path}.font_size`, errors);

    if (xMm !== null && xMm < 0) errors.push(`field ${fieldLabel} x_mm must be 0 or greater`);
    if (yMm !== null && yMm < 0) errors.push(`field ${fieldLabel} y_mm must be 0 or greater`);
    if (widthMm !== null && widthMm <= 0) errors.push(`field ${fieldLabel} width_mm must be greater than 0`);
    if (heightMm !== null && heightMm <= 0) errors.push(`field ${fieldLabel} height_mm must be greater than 0`);
    if (fontSize !== null && fontSize <= 0) errors.push(`field ${fieldLabel} font_size must be greater than 0`);
  }

  const sections = requireRecord(root.sections, 'sections', errors);
  const lineItems = sections ? requireRecord(sections.line_items, 'sections.line_items', errors) : null;
  if (lineItems) {
    const xMm = requireNumber(lineItems.x_mm, 'sections.line_items.x_mm', errors);
    const yMm = requireNumber(lineItems.y_mm, 'sections.line_items.y_mm', errors);
    const startYMm = requireNumber(lineItems.start_y_mm, 'sections.line_items.start_y_mm', errors);
    const widthMm = requireNumber(lineItems.width_mm, 'sections.line_items.width_mm', errors);
    const rowHeightMm = requireNumber(lineItems.row_height_mm, 'sections.line_items.row_height_mm', errors);
    const maxRows = requireNumber(lineItems.max_rows, 'sections.line_items.max_rows', errors);
    const columns = requireArray(lineItems.columns, 'sections.line_items.columns', errors);

    if (xMm !== null && xMm < 0) errors.push('sections.line_items.x_mm must be 0 or greater');
    if (yMm !== null && yMm < 0) errors.push('sections.line_items.y_mm must be 0 or greater');
    if (startYMm !== null && startYMm < 0) errors.push('sections.line_items.start_y_mm must be 0 or greater');
    if (widthMm !== null && widthMm <= 0) errors.push('sections.line_items.width_mm must be greater than 0');
    if (rowHeightMm !== null && rowHeightMm <= 0) {
      errors.push('sections.line_items.row_height_mm must be greater than 0');
    }
    if (maxRows !== null && maxRows <= 0) errors.push('sections.line_items.max_rows must be greater than 0');
    if (columns.length === 0) errors.push('sections.line_items.columns must contain at least one column');
  }

  return { valid: errors.length === 0, errors };
}
