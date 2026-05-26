import type { ContinuousPrintPayload } from '@/lib/billingContinuousPrintTypes';
import type {
  DocumentTemplateConfig,
  DocumentTemplateCopyMode,
  DocumentTemplateField,
  DocumentTemplateMode,
} from '@/lib/documentTemplateTypes';

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

function money(value: number) {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateText(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function branchLabel(branchType: string, branchNumber: string) {
  if (branchType === 'head_office') return 'สำนักงานใหญ่';
  return branchNumber ? `สาขา ${branchNumber}` : 'สาขา';
}

function readBinding(payload: ContinuousPrintPayload, bindingSource: string): unknown {
  return bindingSource
    .replace(/\[\]/g, '')
    .split('.')
    .reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return '';
      return (current as Record<string, unknown>)[key];
    }, payload);
}

function formatFieldValue(payload: ContinuousPrintPayload, field: DocumentTemplateField) {
  const value = readBinding(payload, field.binding_source || field.field_key);
  if (value === null || value === undefined || value === '') return field.default_value || '';

  if (field.format.startsWith('currency')) return money(Number(value));
  if (field.format.startsWith('date')) return dateText(String(value));
  if (field.format === 'number') return String(Number(value || 0));
  return String(value);
}

function mm(value: number) {
  return `${value}mm`;
}

function fontWeightValue(weight: DocumentTemplateField['font_weight']) {
  if (weight === 'medium') return 500;
  if (weight === 'semibold') return 600;
  if (weight === 'bold') return 700;
  return 400;
}

function copyIndexes(copyMode: DocumentTemplateCopyMode, copyIndex?: number) {
  if (typeof copyIndex === 'number' && Number.isInteger(copyIndex) && copyIndex >= 0) return [copyIndex];
  if (copyMode === 'separate') return [0, 1, 2, 3, 4];
  return [0];
}

function CalibrationMarks() {
  return (
    <div aria-hidden className="ctr-calibration">
      <div className="ctr-mark ctr-mark-tl" />
      <div className="ctr-mark ctr-mark-tr" />
      <div className="ctr-mark ctr-mark-bl" />
      <div className="ctr-mark ctr-mark-br" />
      {Array.from({ length: 12 }).map((_, index) => (
        <span key={`h-${index}`} className="ctr-ruler ctr-ruler-h" style={{ left: `${index * 20}mm` }} />
      ))}
      {Array.from({ length: 7 }).map((_, index) => (
        <span key={`v-${index}`} className="ctr-ruler ctr-ruler-v" style={{ top: `${index * 20}mm` }} />
      ))}
    </div>
  );
}

function OverlayFields({
  payload,
  config,
}: {
  payload: ContinuousPrintPayload;
  config: DocumentTemplateConfig;
}) {
  return (
    <>
      {config.fields.filter((field) => field.visible).map((field) => (
        <div
          key={field.field_id}
          className="ctr-overlay-field"
          style={{
            left: mm(field.x_mm),
            top: mm(field.y_mm),
            width: mm(field.width_mm),
            height: mm(field.height_mm),
            fontSize: `${field.font_size}pt`,
            fontWeight: fontWeightValue(field.font_weight),
            textAlign: field.text_align,
          }}
        >
          {formatFieldValue(payload, field)}
        </div>
      ))}
    </>
  );
}

function LineItems({ payload, config }: { payload: ContinuousPrintPayload; config: DocumentTemplateConfig }) {
  const section = config.sections.line_items;
  const rows = payload.lines.slice(0, section.max_rows);

  return (
    <table className="ctr-lines">
      <thead>
        <tr>
          <th style={{ width: '9mm' }}>#</th>
          {section.columns.map((column) => (
            <th key={column.column_id} style={{ width: mm(column.width_mm), textAlign: column.text_align }}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((line, index) => (
          <tr key={`${line.description}-${index}`}>
            <td>{index + 1}</td>
            {section.columns.map((column) => {
              const key = column.field_key.replace('lines[].', '') as keyof typeof line;
              const value = line[key];
              const display = column.format.startsWith('currency') ? money(Number(value)) : String(value ?? '');
              return (
                <td key={column.column_id} style={{ textAlign: column.text_align }}>
                  {display}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FullReceipt({
  payload,
  config,
  copyLabel,
  reprintLabel,
}: {
  payload: ContinuousPrintPayload;
  config: DocumentTemplateConfig;
  copyLabel: string;
  reprintLabel?: string | null;
}) {
  return (
    <div className="ctr-full">
      <header className="ctr-header">
        <div>
          <h1>{payload.document.document_title || 'ใบกำกับภาษี/ใบเสร็จรับเงิน'}</h1>
          <p className="ctr-copy-label">{copyLabel}</p>
          {reprintLabel ? <p className="ctr-reprint">{reprintLabel}</p> : null}
        </div>
        <dl>
          <div><dt>เลขที่</dt><dd>{payload.document.document_number || payload.document.invoice_number}</dd></div>
          <div><dt>ใบเสร็จ</dt><dd>{payload.document.receipt_number || '-'}</dd></div>
          <div><dt>วันที่</dt><dd>{dateText(payload.document.document_date || payload.document.issue_date)}</dd></div>
        </dl>
      </header>

      <section className="ctr-parties">
        <div>
          <h2>{payload.company.company_name || payload.company.name}</h2>
          <p>{payload.company.address || '-'}</p>
          <p>เลขประจำตัวผู้เสียภาษี {payload.company.tax_id || '-'} {branchLabel(payload.company.branch_type, payload.company.branch_number)}</p>
          <p>โทร {payload.company.phone || '-'} อีเมล {payload.company.email || '-'}</p>
        </div>
        <div>
          <h2>{payload.customer.customer_name || payload.customer.name}</h2>
          <p>{payload.customer.address || '-'}</p>
          <p>เลขประจำตัวผู้เสียภาษี {payload.customer.tax_id || '-'} {payload.customer.branch_name || branchLabel(payload.customer.branch_type, payload.customer.branch_number)}</p>
        </div>
      </section>

      <LineItems payload={payload} config={config} />

      <section className="ctr-summary">
        <div className="ctr-payment">
          <p><strong>การชำระเงิน</strong> {payload.payment.method || payload.payment.status || '-'}</p>
          <p><strong>จำนวนเงินตัวอักษร</strong> {payload.totals.amount_text_th}</p>
        </div>
        <dl>
          <div><dt>รวมเป็นเงิน</dt><dd>{money(payload.totals.subtotal)}</dd></div>
          <div><dt>ภาษีมูลค่าเพิ่ม {Math.round(payload.totals.vat_rate * 100)}%</dt><dd>{money(payload.totals.vat_amount)}</dd></div>
          <div className="ctr-total"><dt>ยอดรวมทั้งสิ้น</dt><dd>{money(payload.totals.grand_total)}</dd></div>
        </dl>
      </section>

      <footer className="ctr-footer">
        <div><span />ผู้รับเอกสาร</div>
        <div><span />ผู้รับเงิน / ผู้ออกเอกสาร</div>
      </footer>
    </div>
  );
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
  const labels = config.copy_labels.length > 0 ? config.copy_labels : DEFAULT_COPY_LABELS;
  const indexes = copyIndexes(copyMode, copyIndex);
  const paper = config.paper;
  const contentWidth = paper.width_mm - paper.margin_left_mm - paper.margin_right_mm;
  const contentHeight = paper.height_mm - paper.margin_top_mm - paper.margin_bottom_mm;

  return (
    <div className="ctr-root" data-mode={mode} data-copy-mode={copyMode}>
      <style>{`
        .ctr-root { color: #111827; font-family: 'Sarabun', 'Noto Sans Thai', Arial, sans-serif; }
        .ctr-page { background: #fff; box-sizing: border-box; margin: 0 auto 8mm; overflow: hidden; position: relative; }
        .ctr-page-content { box-sizing: border-box; position: absolute; transform-origin: top left; }
        .ctr-page-content-full { height: ${contentHeight}mm; width: ${contentWidth}mm; }
        .ctr-page-content-overlay { height: ${paper.height_mm}mm; width: ${paper.width_mm}mm; }
        .ctr-full { border: 0.35mm solid #111827; display: flex; flex-direction: column; height: 100%; padding: 5mm; }
        .ctr-header { align-items: flex-start; border-bottom: 0.25mm solid #111827; display: flex; justify-content: space-between; padding-bottom: 3mm; }
        .ctr-header h1 { font-size: 15pt; line-height: 1.15; margin: 0; }
        .ctr-copy-label { font-size: 9pt; font-weight: 700; margin: 1.5mm 0 0; }
        .ctr-reprint { border: 0.2mm solid #991b1b; color: #991b1b; display: inline-block; font-size: 8pt; font-weight: 700; margin: 1.5mm 0 0; padding: 0.8mm 2mm; }
        .ctr-header dl, .ctr-summary dl { margin: 0; min-width: 52mm; }
        .ctr-header dl div, .ctr-summary dl div { display: flex; gap: 3mm; justify-content: space-between; }
        .ctr-header dt, .ctr-summary dt { color: #4b5563; font-size: 8pt; }
        .ctr-header dd, .ctr-summary dd { font-size: 8.5pt; font-weight: 700; margin: 0; text-align: right; }
        .ctr-parties { display: grid; gap: 5mm; grid-template-columns: 1fr 1fr; padding: 3mm 0; }
        .ctr-parties h2 { font-size: 10pt; margin: 0 0 1mm; }
        .ctr-parties p, .ctr-payment p { font-size: 8pt; line-height: 1.35; margin: 0.5mm 0; }
        .ctr-lines { border-collapse: collapse; font-size: 8pt; table-layout: fixed; width: 100%; }
        .ctr-lines th { background: #f3f4f6; border: 0.2mm solid #374151; font-weight: 700; padding: 1mm; }
        .ctr-lines td { border: 0.2mm solid #9ca3af; height: ${config.sections.line_items.row_height_mm}mm; padding: 0.8mm 1mm; vertical-align: top; }
        .ctr-summary { display: grid; gap: 4mm; grid-template-columns: 1fr 58mm; margin-top: 3mm; }
        .ctr-total { border-top: 0.25mm solid #111827; margin-top: 1mm; padding-top: 1mm; }
        .ctr-total dt, .ctr-total dd { font-size: 10pt; font-weight: 700; }
        .ctr-footer { display: grid; gap: 18mm; grid-template-columns: 1fr 1fr; margin-top: auto; padding-top: 5mm; text-align: center; }
        .ctr-footer div { font-size: 8pt; }
        .ctr-footer span { border-bottom: 0.2mm solid #374151; display: block; height: 9mm; margin-bottom: 1mm; }
        .ctr-overlay-field { box-sizing: border-box; line-height: 1.2; overflow: hidden; position: absolute; white-space: pre-wrap; }
        .ctr-calibration { background-image: linear-gradient(to right, rgba(37, 99, 235, 0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(37, 99, 235, 0.16) 1px, transparent 1px); background-size: 10mm 10mm; inset: 0; pointer-events: none; position: absolute; }
        .ctr-mark { border-color: #dc2626; height: 8mm; position: absolute; width: 8mm; }
        .ctr-mark-tl { border-left: 0.4mm solid; border-top: 0.4mm solid; left: 2mm; top: 2mm; }
        .ctr-mark-tr { border-right: 0.4mm solid; border-top: 0.4mm solid; right: 2mm; top: 2mm; }
        .ctr-mark-bl { border-bottom: 0.4mm solid; border-left: 0.4mm solid; bottom: 2mm; left: 2mm; }
        .ctr-mark-br { border-bottom: 0.4mm solid; border-right: 0.4mm solid; bottom: 2mm; right: 2mm; }
        .ctr-ruler { background: #dc2626; opacity: 0.5; position: absolute; }
        .ctr-ruler-h { height: 100%; top: 0; width: 0.15mm; }
        .ctr-ruler-v { height: 0.15mm; left: 0; width: 100%; }
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
            style={{
              left: mm(paper.left_offset_mm + (mode === 'overlay' ? 0 : paper.margin_left_mm)),
              top: mm(paper.top_offset_mm + (mode === 'overlay' ? 0 : paper.margin_top_mm)),
              transform: `scale(${paper.print_scale})`,
            }}
          >
            {mode === 'overlay' ? (
              <OverlayFields payload={payload} config={config} />
            ) : (
              <FullReceipt
                payload={payload}
                config={config}
                copyLabel={labels[index] || labels[0] || DEFAULT_COPY_LABELS[0]}
                reprintLabel={reprintLabel}
              />
            )}
            {testPrint ? <CalibrationMarks /> : null}
          </div>
        </section>
      ))}
    </div>
  );
}
