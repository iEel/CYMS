export type DocumentTemplateMode = 'full' | 'overlay';
export type DocumentTemplateCopyMode = 'carbonless' | 'separate';

export type DocumentTemplateTextAlign = 'left' | 'center' | 'right';
export type DocumentTemplateFontWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type DocumentTemplateFieldLayer = 'form' | 'data' | 'calibration';

export interface DocumentTemplatePaper {
  width_mm: number;
  height_mm: number;
  top_offset_mm: number;
  left_offset_mm: number;
  print_scale: number;
  margin_top_mm: number;
  margin_right_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
}

export interface DocumentTemplatePrintPolicy {
  reprint_label_template: string;
  red_ref_source: 'receipt_number' | 'invoice_number' | 'tax_invoice_number' | 'document_number';
}

export interface DocumentTemplateField {
  field_id: string;
  field_key: string;
  label: string;
  binding_source: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  font_size: number;
  font_weight: DocumentTemplateFontWeight;
  text_align: DocumentTemplateTextAlign;
  visible: boolean;
  layer: DocumentTemplateFieldLayer;
  locked: boolean;
  format: string;
  default_value?: string;
  sample_value?: string;
}

export interface DocumentTemplateLineItemsSection {
  section_id: string;
  binding_source: string;
  x_mm: number;
  y_mm: number;
  start_y_mm: number;
  width_mm: number;
  row_height_mm: number;
  max_rows: number;
  columns: Array<{
    column_id: string;
    field_key: string;
    label: string;
    width_mm: number;
    text_align: DocumentTemplateTextAlign;
    format: string;
  }>;
}

export interface DocumentTemplateConfig {
  paper: DocumentTemplatePaper;
  mode: DocumentTemplateMode;
  copy_mode: DocumentTemplateCopyMode;
  copy_labels: string[];
  print_policy: DocumentTemplatePrintPolicy;
  fields: DocumentTemplateField[];
  sections: {
    line_items: DocumentTemplateLineItemsSection;
  };
}
