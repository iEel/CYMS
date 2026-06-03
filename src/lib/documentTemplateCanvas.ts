import type { DocumentTemplateConfig, DocumentTemplateElement } from './documentTemplateTypes';

type ElementInput = Omit<DocumentTemplateElement, 'visible' | 'layer' | 'locked'> & Partial<Pick<DocumentTemplateElement, 'visible' | 'layer' | 'locked'>>;

function cloneTemplateConfig(config: DocumentTemplateConfig): DocumentTemplateConfig {
  return JSON.parse(JSON.stringify(config)) as DocumentTemplateConfig;
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampAxisToPaper(positionMm: number, sizeMm: number, paperSizeMm: number) {
  const pageSize = finitePositive(paperSizeMm, 1);
  const minSize = Math.min(1, pageSize);
  const safePosition = Number.isFinite(positionMm) ? Math.max(0, positionMm) : 0;
  const xMm = Math.min(safePosition, Math.max(0, pageSize - minSize));
  const requestedSize = Number.isFinite(sizeMm) && sizeMm > 0 ? sizeMm : minSize;
  const maxSize = Math.max(minSize, pageSize - xMm);

  return {
    position_mm: xMm,
    size_mm: Math.min(requestedSize, maxSize),
  };
}

function clampElementToPaper(config: DocumentTemplateConfig, input: ElementInput): ElementInput {
  const horizontal = clampAxisToPaper(input.x_mm, input.width_mm, config.paper.width_mm);
  const vertical = clampAxisToPaper(input.y_mm, input.height_mm, config.paper.height_mm);

  return {
    ...input,
    x_mm: horizontal.position_mm,
    y_mm: vertical.position_mm,
    width_mm: horizontal.size_mm,
    height_mm: vertical.size_mm,
  };
}

function element(config: DocumentTemplateConfig, input: ElementInput): DocumentTemplateElement {
  return {
    ...clampElementToPaper(config, input),
    visible: input.visible ?? true,
    layer: input.layer ?? 'form',
    locked: input.locked ?? false,
  };
}

export function buildSonicFullFormElements(config: DocumentTemplateConfig): DocumentTemplateElement[] {
  const lineItems = config.sections.line_items;
  const contentX = config.paper.margin_left_mm;
  const contentWidth = config.paper.width_mm - contentX - config.paper.margin_right_mm;
  const lineItemsHeight = (lineItems.start_y_mm - lineItems.y_mm) + lineItems.row_height_mm * lineItems.max_rows;

  return [
    element(config, {
      element_id: 'sonic-logo',
      type: 'image',
      label: 'SONIC logo',
      binding_source: 'company.logo_url',
      x_mm: contentX,
      y_mm: 6,
      width_mm: 24,
      height_mm: 18,
      class_name: 'sonic-logo',
    }),
    element(config, {
      element_id: 'sonic-company-header',
      type: 'bound_text',
      label: 'SONIC company header',
      binding_source: 'company.company_name',
      x_mm: 31,
      y_mm: 6,
      width_mm: 124,
      height_mm: 25,
      font_size: 10,
      font_weight: 'semibold',
      text_align: 'left',
      class_name: 'sonic-company-header',
    }),
    element(config, {
      element_id: 'sonic-copy-box',
      type: 'box',
      label: 'Copy label box',
      x_mm: 158,
      y_mm: 6,
      width_mm: 74,
      height_mm: 27,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-copy-box',
    }),
    element(config, {
      element_id: 'sonic-customer-box',
      type: 'box',
      label: 'Customer information box',
      x_mm: contentX,
      y_mm: 34,
      width_mm: contentWidth,
      height_mm: 21,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-customer-box',
    }),
    element(config, {
      element_id: 'sonic-line-items',
      type: 'line_items',
      label: 'Line items table',
      binding_source: lineItems.binding_source,
      x_mm: lineItems.x_mm,
      y_mm: lineItems.y_mm,
      width_mm: lineItems.width_mm,
      height_mm: lineItemsHeight,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-line-items',
    }),
    element(config, {
      element_id: 'sonic-payment-box',
      type: 'box',
      label: 'Payment details box',
      x_mm: contentX,
      y_mm: 101,
      width_mm: 160,
      height_mm: 16,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-payment-box',
    }),
    element(config, {
      element_id: 'sonic-amount-text',
      type: 'bound_text',
      label: 'Amount in text',
      binding_source: 'totals.amount_text_th',
      x_mm: contentX,
      y_mm: 119,
      width_mm: 160,
      height_mm: 8,
      font_size: 9,
      font_weight: 'semibold',
      text_align: 'left',
      class_name: 'sonic-amount-text',
    }),
    element(config, {
      element_id: 'sonic-footer',
      type: 'text',
      label: 'Footer note',
      text: 'ผู้รับเงิน / Collector',
      x_mm: 170,
      y_mm: 128,
      width_mm: 62,
      height_mm: 8,
      font_size: 8,
      text_align: 'center',
      class_name: 'sonic-footer',
    }),
  ];
}

export function buildA4TaxReceiptElements(config: DocumentTemplateConfig): DocumentTemplateElement[] {
  const lineItems = config.sections.line_items;
  const lineItemsHeight = (lineItems.start_y_mm - lineItems.y_mm) + lineItems.row_height_mm * lineItems.max_rows;

  return [
    element(config, {
      element_id: 'a4-logo',
      type: 'image',
      label: 'Company logo',
      binding_source: 'company.logo_url',
      x_mm: 12,
      y_mm: 12,
      width_mm: 24,
      height_mm: 24,
      class_name: 'sonic-logo a4-logo',
    }),
    element(config, {
      element_id: 'a4-company-header',
      type: 'bound_text',
      label: 'Company header',
      binding_source: 'company.company_name',
      x_mm: 40,
      y_mm: 12,
      width_mm: 104,
      height_mm: 28,
      font_size: 10,
      font_weight: 'semibold',
      text_align: 'left',
      class_name: 'sonic-company-header a4-company-header',
    }),
    element(config, {
      element_id: 'a4-copy-box',
      type: 'box',
      label: 'Copy label box',
      binding_source: 'document.copy_label',
      x_mm: 150,
      y_mm: 12,
      width_mm: 48,
      height_mm: 28,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-copy-box a4-copy-box',
    }),
    element(config, {
      element_id: 'a4-customer-box',
      type: 'box',
      label: 'Customer information box',
      x_mm: 12,
      y_mm: 46,
      width_mm: 186,
      height_mm: 36,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-customer-box a4-customer-box',
    }),
    element(config, {
      element_id: 'a4-line-items',
      type: 'line_items',
      label: 'Line items table',
      binding_source: lineItems.binding_source,
      x_mm: lineItems.x_mm,
      y_mm: lineItems.y_mm,
      width_mm: lineItems.width_mm,
      height_mm: lineItemsHeight,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-line-items a4-line-items',
    }),
    element(config, {
      element_id: 'a4-payment-box',
      type: 'box',
      label: 'Payment details box',
      x_mm: 12,
      y_mm: 218,
      width_mm: 106,
      height_mm: 25,
      border: true,
      border_width_mm: 0.2,
      class_name: 'sonic-payment-box a4-payment-box',
    }),
    element(config, {
      element_id: 'a4-totals-table',
      type: 'totals_table',
      label: 'Totals table',
      x_mm: 124,
      y_mm: 218,
      width_mm: 74,
      height_mm: 25,
      class_name: 'a4-totals-table',
    }),
    element(config, {
      element_id: 'a4-amount-text',
      type: 'bound_text',
      label: 'Amount in text',
      binding_source: 'totals.amount_text_th',
      x_mm: 12,
      y_mm: 248,
      width_mm: 186,
      height_mm: 8,
      font_size: 9,
      font_weight: 'semibold',
      text_align: 'left',
      class_name: 'sonic-amount-text a4-amount-text',
    }),
    element(config, {
      element_id: 'a4-footer-note',
      type: 'text',
      label: 'Footer note',
      text: 'บริษัทฯ กำหนดเวลาในการแก้ไขใบเสร็จรับเงิน/ใบกำกับภาษีภายใน 7 วัน นับจากวันที่ออกเอกสาร หากพ้นกำหนดทางบริษัทฯ ถือว่าถูกต้องแล้ว',
      x_mm: 12,
      y_mm: 260,
      width_mm: 186,
      height_mm: 10,
      font_size: 7,
      text_align: 'left',
      class_name: 'a4-footer-note',
    }),
    element(config, {
      element_id: 'a4-collector',
      type: 'text',
      label: 'Collector',
      text: 'ผู้รับเงิน / Collector',
      x_mm: 12,
      y_mm: 274,
      width_mm: 80,
      height_mm: 10,
      font_size: 8,
      text_align: 'left',
      class_name: 'sonic-footer a4-collector',
    }),
  ];
}

function unlockLegacyGeneratedElements(config: DocumentTemplateConfig): DocumentTemplateConfig {
  if (!Array.isArray(config.elements) || config.elements.length === 0) return config;
  const sonicElements = config.elements.filter(element => element.class_name?.startsWith('sonic-') && element.type !== 'line_items');
  if (sonicElements.length === 0 || sonicElements.some(element => element.locked === false)) return config;

  return {
    ...config,
    elements: config.elements.map(element => (
      element.class_name?.startsWith('sonic-') && element.type !== 'line_items'
        ? { ...element, locked: false }
        : element
    )),
  };
}

export function normalizeTemplateCanvasConfig(config: DocumentTemplateConfig): DocumentTemplateConfig {
  let next = cloneTemplateConfig(config);
  if (!Array.isArray(next.elements) || next.elements.length === 0) {
    next.elements = next.template_family === 'a4_tax_receipt'
      ? buildA4TaxReceiptElements(next)
      : buildSonicFullFormElements(next);
  }
  next = unlockLegacyGeneratedElements(next);
  return next;
}
