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
        field_key: 'document.title',
        label: 'Document title',
        binding_source: 'document.title',
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
        field_id: 'document-number',
        field_key: 'document.document_number',
        label: 'Document number',
        binding_source: 'document.document_number',
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
        field_id: 'document-date',
        field_key: 'document.document_date',
        label: 'Document date',
        binding_source: 'document.document_date',
        x_mm: 178,
        y_mm: 14,
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
        field_id: 'totals-grand-total-text',
        field_key: 'totals.grand_total_text',
        label: 'Grand total text',
        binding_source: 'totals.grand_total_text',
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
        binding_source: 'line_items',
        x_mm: 9,
        y_mm: 55,
        width_mm: 222,
        row_height_mm: 6,
        max_rows: 7,
        columns: [
          {
            column_id: 'description',
            field_key: 'line_items.description',
            label: 'Description',
            width_mm: 120,
            text_align: 'left',
            format: 'text',
          },
          {
            column_id: 'quantity',
            field_key: 'line_items.quantity',
            label: 'Qty',
            width_mm: 22,
            text_align: 'right',
            format: 'number',
          },
          {
            column_id: 'unit_price',
            field_key: 'line_items.unit_price',
            label: 'Unit price',
            width_mm: 36,
            text_align: 'right',
            format: 'currency:THB',
          },
          {
            column_id: 'amount',
            field_key: 'line_items.amount',
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

export function validateTemplateConfig(config: DocumentTemplateConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.paper.width_mm <= 0) errors.push('paper.width_mm must be greater than 0');
  if (config.paper.height_mm <= 0) errors.push('paper.height_mm must be greater than 0');
  if (config.paper.top_offset_mm < 0) errors.push('paper.top_offset_mm must be 0 or greater');
  if (config.paper.left_offset_mm < 0) errors.push('paper.left_offset_mm must be 0 or greater');
  if (config.paper.print_scale <= 0) errors.push('paper.print_scale must be greater than 0');
  if (!['full', 'overlay'].includes(config.mode)) errors.push('mode must be full or overlay');
  if (!['carbonless', 'separate'].includes(config.copy_mode)) errors.push('copy_mode must be carbonless or separate');
  if (config.copy_labels.length === 0) errors.push('copy_labels must contain at least one label');
  if (config.fields.length === 0) errors.push('fields must contain at least one field');

  const fieldIds = new Set<string>();
  const fieldKeys = new Set<string>();

  for (const templateField of config.fields) {
    if (!templateField.field_id) errors.push('field.field_id is required');
    if (fieldIds.has(templateField.field_id)) errors.push(`field_id ${templateField.field_id} must be unique`);
    fieldIds.add(templateField.field_id);

    if (!templateField.field_key) errors.push(`field ${templateField.field_id} field_key is required`);
    if (fieldKeys.has(templateField.field_key)) errors.push(`field_key ${templateField.field_key} must be unique`);
    fieldKeys.add(templateField.field_key);

    if (templateField.x_mm < 0) errors.push(`field ${templateField.field_id} x_mm must be 0 or greater`);
    if (templateField.y_mm < 0) errors.push(`field ${templateField.field_id} y_mm must be 0 or greater`);
    if (templateField.width_mm <= 0) errors.push(`field ${templateField.field_id} width_mm must be greater than 0`);
    if (templateField.height_mm <= 0) errors.push(`field ${templateField.field_id} height_mm must be greater than 0`);
    if (templateField.font_size <= 0) errors.push(`field ${templateField.field_id} font_size must be greater than 0`);
  }

  const lineItems = config.sections.line_items;
  if (lineItems.x_mm < 0) errors.push('sections.line_items.x_mm must be 0 or greater');
  if (lineItems.y_mm < 0) errors.push('sections.line_items.y_mm must be 0 or greater');
  if (lineItems.width_mm <= 0) errors.push('sections.line_items.width_mm must be greater than 0');
  if (lineItems.row_height_mm <= 0) errors.push('sections.line_items.row_height_mm must be greater than 0');
  if (lineItems.max_rows <= 0) errors.push('sections.line_items.max_rows must be greater than 0');
  if (lineItems.columns.length === 0) errors.push('sections.line_items.columns must contain at least one column');

  return { valid: errors.length === 0, errors };
}
