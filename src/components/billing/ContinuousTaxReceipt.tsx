import type { CSSProperties } from 'react';
import type { ContinuousPrintLine, ContinuousPrintPayload } from '@/lib/billingContinuousPrintTypes';
import { normalizeTemplateCanvasConfig } from '@/lib/documentTemplateCanvas';
import type {
  DocumentTemplateConfig,
  DocumentTemplateCopyMode,
  DocumentTemplateMode,
} from '@/lib/documentTemplateTypes';
import { TemplateCanvasReceipt } from './TemplateCanvasReceipt';

const DEFAULT_COPY_LABELS = [
  'ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน',
  'สำเนาใบกำกับภาษี/ใบเสร็จรับเงิน',
  'สำเนาสำหรับบัญชี',
  'สำเนาสำหรับลูกค้า',
  'สำเนาสำหรับเก็บ',
];

type ContinuousTaxReceiptProps = {
  payload: ContinuousPrintPayload;
  config: DocumentTemplateConfig;
  mode: DocumentTemplateMode;
  copyMode: DocumentTemplateCopyMode;
  copyIndex?: number;
  reprintLabel?: string | null;
  testPrint?: boolean;
};

type LineItemColumn = DocumentTemplateConfig['sections']['line_items']['columns'][number];

function money(value: number) {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function lineItemRawValue(line: ContinuousPrintLine, fieldKey: string) {
  const key = fieldKey.replace(/^lines\[\]\./, '');
  if (key === 'description') return line.description;
  if (key === 'qty') return line.qty;
  if (key === 'unit_price') return line.unit_price;
  if (key === 'amount') return line.amount;
  return '';
}

export function lineItemValue(line: ContinuousPrintLine, column: LineItemColumn) {
  const value = lineItemRawValue(line, column.field_key);
  if (column.format === 'currency:THB') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? money(numericValue) : '';
  }
  if (column.format === 'number') return String(value);
  return String(value);
}

export function lineItemsBoxStyle(
  lineItemsSection: DocumentTemplateConfig['sections']['line_items'],
  mode: DocumentTemplateMode,
): CSSProperties {
  const headerHeightMm = Math.max(0, lineItemsSection.start_y_mm - lineItemsSection.y_mm);
  const heightMm = headerHeightMm + lineItemsSection.row_height_mm * lineItemsSection.max_rows;
  if (mode === 'overlay') {
    return {
      position: 'absolute',
      left: `${lineItemsSection.x_mm}mm`,
      top: `${lineItemsSection.y_mm}mm`,
      width: `${lineItemsSection.width_mm}mm`,
      height: `${heightMm}mm`,
      overflow: 'hidden',
    };
  }
  return {
    width: `${lineItemsSection.width_mm}mm`,
    maxWidth: '100%',
    height: `${heightMm}mm`,
    overflow: 'hidden',
  };
}

function mm(value: number) {
  return `${value}mm`;
}

function copyIndexes(copyMode: DocumentTemplateCopyMode, copyIndex?: number) {
  if (typeof copyIndex === 'number' && Number.isInteger(copyIndex) && copyIndex >= 0) return [copyIndex];
  if (copyMode === 'separate') return [0, 1, 2, 3, 4];
  return [0];
}

export function ContinuousTaxReceipt({
  payload,
  config,
  mode,
  copyMode,
  copyIndex,
  reprintLabel,
  testPrint = false,
}: ContinuousTaxReceiptProps) {
  const normalizedConfig = normalizeTemplateCanvasConfig(config);
  const labels = normalizedConfig.copy_labels.length > 0 ? normalizedConfig.copy_labels : DEFAULT_COPY_LABELS;
  const indexes = copyIndexes(copyMode, copyIndex);
  const paper = normalizedConfig.paper;
  const contentWidth = mode === 'overlay' ? paper.width_mm : paper.width_mm - paper.margin_left_mm - paper.margin_right_mm;
  const contentHeight = mode === 'overlay' ? paper.height_mm : paper.height_mm - paper.margin_top_mm - paper.margin_bottom_mm;
  const contentLeft = paper.left_offset_mm + (mode === 'overlay' ? 0 : paper.margin_left_mm);
  const contentTop = paper.top_offset_mm + (mode === 'overlay' ? 0 : paper.margin_top_mm);
  const lineItemsSection = normalizedConfig.sections.line_items;

  return (
    <div className="ctr-root" data-mode={mode} data-copy-mode={copyMode}>
      <style>{`
        .ctr-root { color: #111827; font-family: 'Sarabun', 'Noto Sans Thai', Arial, sans-serif; }
        .ctr-page { background: #fff; box-sizing: border-box; margin: 0 auto 8mm; overflow: hidden; position: relative; }
        .ctr-page-content { box-sizing: border-box; height: ${contentHeight}mm; position: absolute; transform-origin: top left; width: ${contentWidth}mm; }
        @media print {
          body { background: #fff !important; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ctr-page { box-shadow: none !important; margin: 0; page-break-after: always; }
          .ctr-page:last-child { page-break-after: auto; }
          @page { size: ${paper.width_mm}mm ${paper.height_mm}mm; margin: 0; }
        }
      `}</style>
      {indexes.map((index) => (
        <section
          key={index}
          className="ctr-page"
          style={{
            width: mm(paper.width_mm),
            height: mm(paper.height_mm),
          }}
        >
          <div
            className={`ctr-page-content ${mode === 'overlay' ? 'ctr-page-content-overlay' : 'ctr-page-content-full'}`}
            data-line-items-section={lineItemsSection.section_id}
            style={{
              left: mm(contentLeft),
              top: mm(contentTop),
              transform: `scale(${paper.print_scale})`,
            }}
          >
            <TemplateCanvasReceipt
              payload={payload}
              config={normalizedConfig}
              mode={mode}
              copyLabel={labels[index] || labels[0] || DEFAULT_COPY_LABELS[0]}
              reprintLabel={reprintLabel}
              testPrint={testPrint}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
