'use client';

import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import type { ContinuousPrintLine, ContinuousPrintPayload } from '@/lib/billingContinuousPrintTypes';
import { normalizeTemplateCanvasConfig } from '@/lib/documentTemplateCanvas';
import type {
  DocumentTemplateConfig,
  DocumentTemplateElement,
  DocumentTemplateField,
  DocumentTemplateMode,
} from '@/lib/documentTemplateTypes';

type TemplateCanvasReceiptProps = {
  payload: ContinuousPrintPayload;
  config: DocumentTemplateConfig;
  mode: DocumentTemplateMode;
  copyLabel: string;
  reprintLabel?: string | null;
  testPrint?: boolean;
};

type LineItemColumn = DocumentTemplateConfig['sections']['line_items']['columns'][number];

function mm(value: number) {
  return `${value}mm`;
}

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

function dateNumericText(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB');
}

function branchLabel(branchType: string, branchNumber: string) {
  if (branchType === 'head_office') return 'สำนักงานใหญ่';
  return branchNumber ? `สาขา ${branchNumber}` : 'สาขา';
}

function nonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || '';
}

function companyBranchText(payload: ContinuousPrintPayload) {
  const branch = payload.company.branch_number
    ? `สาขาที่ ${payload.company.branch_number}`
    : branchLabel(payload.company.branch_type, payload.company.branch_number);
  return `เลขที่ประจำตัวผู้เสียภาษี ${payload.company.tax_id || '-'}   ${branch}`;
}

function paymentMethodMatches(payload: ContinuousPrintPayload, method: 'cash' | 'cheque' | 'transfer') {
  const normalized = (payload.payment.method || '').toLowerCase();
  if (method === 'cash') return normalized.includes('cash') || normalized.includes('เงินสด');
  if (method === 'cheque') return normalized.includes('cheque') || normalized.includes('check') || normalized.includes('เช็ค');
  return normalized.includes('transfer') || normalized.includes('โอน');
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

function formatBoundValue(payload: ContinuousPrintPayload, bindingSource: string, copyLabel: string) {
  if (bindingSource === 'document.copy_label') return nonEmpty(payload.document.copy_label, copyLabel);

  const value = readBinding(payload, bindingSource);
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number' && /(amount|price|subtotal|total|vat)/i.test(bindingSource)) return money(value);
  if (/(date|paid_at|issue_date|due_date)/i.test(bindingSource)) return dateText(String(value));
  if (typeof value === 'number') return String(value);
  return String(value);
}

function formatFieldValue(payload: ContinuousPrintPayload, field: DocumentTemplateField, copyLabel: string) {
  const value = field.binding_source === 'document.copy_label'
    ? nonEmpty(payload.document.copy_label, copyLabel)
    : readBinding(payload, field.binding_source || field.field_key);

  if (value === null || value === undefined || value === '') return field.default_value || '';
  if (field.format.startsWith('currency')) return money(Number(value));
  if (field.format.startsWith('date')) return dateText(String(value));
  if (field.format === 'number') return String(Number(value || 0));
  return String(value);
}

function fontWeightValue(weight?: DocumentTemplateElement['font_weight'] | DocumentTemplateField['font_weight']) {
  if (weight === 'medium') return 500;
  if (weight === 'semibold') return 600;
  if (weight === 'bold') return 700;
  return 400;
}

function percent(value: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return 'auto';
  return `${(value / total) * 100}%`;
}

function lineItemColumnTotal(section: DocumentTemplateConfig['sections']['line_items']) {
  return Math.max(1, section.columns.reduce((sum, column) => sum + Math.max(0, column.width_mm), 0));
}

function lineItemRawValue(line: ContinuousPrintLine, fieldKey: string) {
  const key = fieldKey.replace(/^lines\[\]\./, '');
  if (key === 'description') return line.description;
  if (key === 'qty') return line.qty;
  if (key === 'unit_price') return line.unit_price;
  if (key === 'amount') return line.amount;
  return '';
}

function lineItemValue(line: ContinuousPrintLine, column: LineItemColumn) {
  const value = lineItemRawValue(line, column.field_key);
  if (column.format === 'currency:THB') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? money(numericValue) : '';
  }
  if (column.format === 'number') return String(value);
  return String(value);
}

function lineReferenceText(lines: ContinuousPrintLine[]) {
  const refs = new Set<string>();
  for (const line of lines) {
    [...(line.container_refs || []), ...(line.job_refs || [])]
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => refs.add(value));
  }
  return Array.from(refs).join(' - ');
}

function elementStyle(element: DocumentTemplateElement): CSSProperties {
  return {
    left: mm(element.x_mm),
    top: mm(element.y_mm),
    width: mm(element.width_mm),
    height: mm(element.height_mm),
    fontSize: element.font_size ? `${element.font_size}pt` : undefined,
    fontWeight: fontWeightValue(element.font_weight),
    textAlign: element.text_align,
    border: element.border ? `${element.border_width_mm || 0.2}mm solid #374151` : undefined,
  };
}

function fieldStyle(field: DocumentTemplateField): CSSProperties {
  return {
    left: mm(field.x_mm),
    top: mm(field.y_mm),
    width: mm(field.width_mm),
    height: mm(field.height_mm),
    fontSize: `${field.font_size}pt`,
    fontWeight: fontWeightValue(field.font_weight),
    textAlign: field.text_align,
  };
}

function shouldRenderElement(mode: DocumentTemplateMode, element: DocumentTemplateElement) {
  if (!element.visible) return false;
  if (mode === 'overlay') return element.layer === 'data';
  return true;
}

function shouldRenderOverlayField(field: DocumentTemplateField) {
  if (!field.visible) return false;
  return field.layer === 'data';
}

function CompanyLogo({ payload }: { payload: ContinuousPrintPayload }) {
  if (payload.company.logo_url) {
    return (
      <Image
        className="ctr-logo-image"
        src={payload.company.logo_url}
        alt="Company logo"
        width={96}
        height={104}
        unoptimized
      />
    );
  }

  const fallback = nonEmpty(payload.company.name_en, payload.company.company_name, payload.company.name);
  const isSonic = fallback.toLowerCase().includes('sonic') || fallback.includes('โซนิค');

  return (
    <div className="ctr-logo-fallback" aria-label="Company logo placeholder">
      <div className="ctr-logo-symbol">{isSonic ? 'S' : fallback.slice(0, 1).toUpperCase() || 'C'}</div>
      <div className="ctr-logo-name">{isSonic ? 'SONIC' : fallback.slice(0, 12)}</div>
      {isSonic ? <div className="ctr-logo-tagline">save &amp; smooth services</div> : null}
    </div>
  );
}

function CompanyHeader({ payload }: { payload: ContinuousPrintPayload }) {
  const companyNameTh = nonEmpty(payload.company.name_th, payload.company.company_name, payload.company.name);
  const companyNameEn = nonEmpty(payload.company.name_en, payload.company.name);
  const companyAddressTh = nonEmpty(payload.company.address_th, payload.company.address);
  const companyAddressEn = nonEmpty(payload.company.address_en);

  return (
    <div className="ctr-company-header">
      <h1>{companyNameTh}</h1>
      <h2>{companyNameEn}</h2>
      <p>{companyAddressTh}</p>
      {companyAddressEn ? <p>{companyAddressEn}</p> : null}
      <p>{companyBranchText(payload)}</p>
      <p>TAX ID : {payload.company.tax_id || '-'} <span>BRANCH {payload.company.branch_number || '-'}</span></p>
    </div>
  );
}

function CustomerBox({ payload }: { payload: ContinuousPrintPayload }) {
  const customerName = nonEmpty(payload.customer.customer_name, payload.customer.name);
  const customerTaxLabel = `${payload.customer.tax_id || '-'} ${payload.customer.branch_name || branchLabel(payload.customer.branch_type, payload.customer.branch_number)}`;
  const referenceNo = nonEmpty(payload.document.reference_no, payload.document.ref_invoice_number, payload.document.document_number, payload.document.invoice_number);
  const documentDate = dateNumericText(payload.document.document_date || payload.document.issue_date);

  return (
    <div className="ctr-customer-grid">
      <div className="ctr-customer-left">
        <div className="ctr-form-row ctr-customer-name">
          <span className="ctr-label">Customer Name :</span>
          <span className="ctr-value">{customerName || '-'}</span>
        </div>
        <div className="ctr-form-row ctr-address-row">
          <span className="ctr-label">Address :</span>
          <span className="ctr-value">{payload.customer.address || '-'}</span>
        </div>
        <div className="ctr-form-row">
          <span className="ctr-label">TAX ID :</span>
          <span className="ctr-value">{customerTaxLabel}</span>
        </div>
      </div>
      <div className="ctr-reference-box">
        <div><span>เลขที่ / Reference :</span><strong>{referenceNo || '-'}</strong></div>
        <div><span>วันที่ / Date :</span><strong>{documentDate || '-'}</strong></div>
      </div>
    </div>
  );
}

function PaymentBox({ payload }: { payload: ContinuousPrintPayload }) {
  return (
    <div className="ctr-payment-box">
      <div className="ctr-payment-row">
        <span className={`ctr-checkbox ${paymentMethodMatches(payload, 'cash') ? 'checked' : ''}`} />
        <span>เงินสด</span>
      </div>
      <div className="ctr-payment-row">
        <span className={`ctr-checkbox ${paymentMethodMatches(payload, 'cheque') ? 'checked' : ''}`} />
        <span>เช็ค เลขที่</span>
        <span className="ctr-payment-value">{payload.payment.cheque_no || ''}</span>
        <span className="ctr-payment-date-label">ลงวันที่</span>
        <span className="ctr-payment-value ctr-payment-date">{dateNumericText(payload.payment.cheque_date || '')}</span>
      </div>
      <div className="ctr-payment-row">
        <span className="ctr-checkbox ghost" />
        <span>ธนาคาร</span>
        <span className="ctr-payment-value">{payload.payment.bank_name || payload.payment.payment_ref || ''}</span>
      </div>
    </div>
  );
}

function TotalsTable({ payload }: { payload: ContinuousPrintPayload }) {
  return (
    <table className="ctr-totals-table">
      <tbody>
        <tr>
          <th>จำนวนเงิน/Total</th>
          <td>{money(payload.totals.subtotal)}</td>
        </tr>
        <tr>
          <th>ภาษีมูลค่าเพิ่ม / Value added tax</th>
          <td>{money(payload.totals.vat_amount)}</td>
        </tr>
        <tr>
          <th>จำนวนเงินทั้งสิ้น / Grand Total</th>
          <td>{money(payload.totals.grand_total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function LineItems({
  normalizedConfig,
  payload,
  mode,
}: {
  normalizedConfig: DocumentTemplateConfig;
  payload: ContinuousPrintPayload;
  mode: DocumentTemplateMode;
}) {
  const lineItemsSection = normalizedConfig.sections.line_items;
  const totalColumnWidthMm = lineItemColumnTotal(lineItemsSection);
  const headerHeightMm = Math.max(0, lineItemsSection.start_y_mm - lineItemsSection.y_mm);
  const visibleLines = payload.lines.slice(0, lineItemsSection.max_rows);
  const referenceText = mode === 'full' ? lineReferenceText(visibleLines) : '';

  return (
    <table
      className="ctr-lines"
      style={{
        tableLayout: 'fixed',
        width: '100%',
      }}
    >
      <colgroup>
        {lineItemsSection.columns.map((column) => (
          <col key={column.column_id} style={{ width: percent(Math.max(0, column.width_mm), totalColumnWidthMm) }} />
        ))}
      </colgroup>
      <thead>
        <tr style={{ height: `${headerHeightMm}mm` }}>
          {lineItemsSection.columns.map((column) => (
            <th
              key={column.column_id}
              style={{
                height: `${headerHeightMm}mm`,
                textAlign: column.text_align,
              }}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visibleLines.map((line, index) => (
          <tr key={`${line.description}-${index}`}>
            {lineItemsSection.columns.map((column) => (
              <td
                key={column.column_id}
                style={{
                  height: `${lineItemsSection.row_height_mm}mm`,
                  textAlign: column.text_align,
                }}
              >
                {lineItemValue(line, column)}
              </td>
            ))}
          </tr>
        ))}
        {referenceText ? (
          <tr className="ctr-lines-reference">
            <td colSpan={lineItemsSection.columns.length}>{referenceText}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
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

function elementSemanticText(element: DocumentTemplateElement) {
  return [
    element.class_name,
    element.binding_source,
    element.label,
    element.text,
  ].filter(Boolean).join(' ').toLowerCase();
}

function hasElementHint(element: DocumentTemplateElement, hint: string) {
  return elementSemanticText(element).includes(hint);
}

function isCopyElement(element: DocumentTemplateElement) {
  return element.binding_source === 'document.copy_label' || hasElementHint(element, 'copy');
}

function isCustomerElement(element: DocumentTemplateElement) {
  return element.binding_source?.startsWith('customer.') || hasElementHint(element, 'customer');
}

function isPaymentElement(element: DocumentTemplateElement) {
  return element.binding_source?.startsWith('payment.') || hasElementHint(element, 'payment');
}

function isCompanyHeaderElement(element: DocumentTemplateElement) {
  return hasElementHint(element, 'company-header') || hasElementHint(element, 'company header');
}

function isFooterElement(element: DocumentTemplateElement) {
  return hasElementHint(element, 'footer') || hasElementHint(element, 'collector') || hasElementHint(element, 'ผู้รับเงิน');
}

function renderBoxContent(element: DocumentTemplateElement, payload: ContinuousPrintPayload, copyLabel: string): ReactNode {
  if (isCopyElement(element)) {
    return (
      <div className="ctr-copy-area">
        <div className="ctr-copy-box">{nonEmpty(payload.document.copy_label, copyLabel)}</div>
        <div className="ctr-set-note">(เอกสารออกเป็นชุด)</div>
      </div>
    );
  }

  if (isCustomerElement(element)) return <CustomerBox payload={payload} />;
  if (isPaymentElement(element)) return <PaymentBox payload={payload} />;
  return null;
}

function renderBoundText(element: DocumentTemplateElement, payload: ContinuousPrintPayload, copyLabel: string) {
  if (isCompanyHeaderElement(element)) return <CompanyHeader payload={payload} />;
  return formatBoundValue(payload, element.binding_source || '', copyLabel);
}

function renderElement(
  element: DocumentTemplateElement,
  payload: ContinuousPrintPayload,
  config: DocumentTemplateConfig,
  mode: DocumentTemplateMode,
  copyLabel: string,
  reprintLabel?: string | null,
) {
  const className = [
    'ctr-canvas-element',
    `ctr-element-${element.type}`,
    element.class_name,
  ].filter(Boolean).join(' ');

  let content: ReactNode = null;

  if (element.type === 'box') content = renderBoxContent(element, payload, copyLabel);
  if (element.type === 'text') {
    const footerElement = isFooterElement(element);
    content = (
      <>
        {element.text || (footerElement ? 'ผู้รับเงิน / Collector' : element.label)}
        {footerElement ? (
          <span className="ctr-collector-value">{payload.payment.collector_name || ''}</span>
        ) : null}
      </>
    );
  }
  if (element.type === 'bound_text') content = renderBoundText(element, payload, copyLabel);
  if (element.type === 'image') content = <CompanyLogo payload={payload} />;
  if (element.type === 'line_items') content = <LineItems normalizedConfig={config} payload={payload} mode={mode} />;
  if (element.type === 'checkbox') content = <span className="ctr-checkbox" />;
  if (element.type === 'totals_table') content = <TotalsTable payload={payload} />;
  if (element.type === 'line') content = <span className="ctr-line-rule" />;

  return (
    <div key={element.element_id} className={className} style={elementStyle(element)}>
      {content}
      {reprintLabel && isCopyElement(element) ? <p className="ctr-reprint">{reprintLabel}</p> : null}
    </div>
  );
}

export function TemplateCanvasReceipt({
  payload,
  config,
  mode,
  copyLabel,
  reprintLabel,
  testPrint = false,
}: TemplateCanvasReceiptProps) {
  const normalizedConfig = normalizeTemplateCanvasConfig(config);
  const elements = (normalizedConfig.elements || []).filter((element) => shouldRenderElement(mode, element));
  const rendersLineItems = elements.some((element) => element.type === 'line_items');
  const rendersCompanyHeader = elements.some((element) => element.type === 'bound_text' && isCompanyHeaderElement(element));
  const rendersCopyBox = elements.some((element) => element.type === 'box' && isCopyElement(element));
  const rendersCustomerBox = elements.some((element) => element.type === 'box' && isCustomerElement(element));
  const rendersPaymentBox = elements.some((element) => element.type === 'box' && isPaymentElement(element));
  const rendersFooter = elements.some((element) => element.type === 'text' && isFooterElement(element));

  return (
    <div className="ctr-canvas-receipt" data-mode={mode}>
      <style>{`
        .ctr-canvas-receipt { box-sizing: border-box; color: #111827; height: 100%; position: relative; width: 100%; }
        .ctr-canvas-element { box-sizing: border-box; line-height: 1.2; overflow: hidden; position: absolute; white-space: pre-wrap; }
        .ctr-element-box { background: transparent; }
        .ctr-element-line { border: 0 !important; }
        .ctr-line-rule { border-top: 0.25mm solid #374151; display: block; margin-top: 50%; width: 100%; }
        ${rendersCompanyHeader ? `
        .ctr-logo-image { display: block; height: 100%; object-fit: contain; width: 100%; }
        .ctr-logo-fallback { align-items: center; color: #4b5563; display: flex; flex-direction: column; height: 100%; justify-content: center; width: 100%; }
        .ctr-logo-symbol { border: 0.45mm solid #6b7280; border-radius: 50%; font-size: 16pt; font-weight: 800; height: 11mm; line-height: 10mm; text-align: center; transform: skew(-12deg); width: 11mm; }
        .ctr-logo-name { font-size: 14pt; letter-spacing: 0; line-height: 1; margin-top: 1mm; }
        .ctr-logo-tagline { font-size: 4.5pt; line-height: 1; }
        .ctr-company-header { min-width: 0; width: 100%; }
        .ctr-company-header h1 { font-size: 15pt; font-weight: 700; line-height: 1.08; margin: 0 0 0.6mm; }
        .ctr-company-header h2 { font-size: 10.5pt; font-weight: 600; line-height: 1.08; margin: 0 0 1.2mm; text-transform: uppercase; }
        .ctr-company-header p { font-size: 7.4pt; line-height: 1.22; margin: 0.3mm 0; }
        .ctr-company-header span { margin-left: 8mm; }
        ` : ''}
        ${rendersCopyBox ? `
        .ctr-copy-area { align-items: center; display: flex; flex-direction: column; gap: 2mm; height: 100%; justify-content: center; width: 100%; }
        .ctr-copy-box { box-sizing: border-box; font-size: 14pt; font-weight: 700; line-height: 1.12; text-align: center; width: 100%; }
        .ctr-set-note { font-size: 10pt; font-weight: 600; }
        .ctr-reprint { border: 0.2mm solid #991b1b; color: #991b1b; display: inline-block; font-size: 8pt; font-weight: 700; margin: 0; padding: 0.8mm 2mm; position: absolute; right: 0; top: 100%; }
        ` : ''}
        ${rendersCustomerBox ? `
        .ctr-customer-grid { box-sizing: border-box; display: grid; grid-template-columns: 1fr 84mm; height: 100%; width: 100%; }
        .ctr-customer-left { display: flex; flex-direction: column; justify-content: space-between; min-width: 0; padding: 3mm 4mm 2mm; }
        .ctr-form-row { align-items: flex-start; display: grid; gap: 3mm; grid-template-columns: 27mm 1fr; min-width: 0; }
        .ctr-label { font-size: 9pt; white-space: nowrap; }
        .ctr-value { color: #374151; display: block; font-size: 9pt; line-height: 1.2; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .ctr-address-row .ctr-value { white-space: normal; }
        .ctr-reference-box { display: flex; flex-direction: column; gap: 3.5mm; justify-content: flex-start; padding: 3mm 5mm 0 0; }
        .ctr-reference-box div { align-items: baseline; display: grid; gap: 5mm; grid-template-columns: 32mm 1fr; }
        .ctr-reference-box span { font-size: 9pt; font-weight: 700; text-align: right; }
        .ctr-reference-box strong { color: #374151; font-size: 11pt; font-weight: 500; }
        ` : ''}
        ${rendersLineItems ? `
        .ctr-lines { border-collapse: collapse; font-size: 8pt; line-height: 1.1; width: 100%; }
        .ctr-lines, .ctr-lines tr, .ctr-lines th, .ctr-lines td { box-sizing: border-box; }
        .ctr-lines th { background: #fff; border: 0.25mm solid #374151; font-size: 8.4pt; font-weight: 700; line-height: 1.1; overflow-wrap: anywhere; padding: 0.2mm 0.8mm; white-space: pre-line; }
        .ctr-lines td { border-left: 0.25mm solid #374151; border-right: 0.25mm solid #374151; color: #374151; font-size: 8.5pt; overflow: hidden; overflow-wrap: anywhere; padding: 0.2mm 0.8mm; vertical-align: top; }
        .ctr-lines tbody tr:last-child td { border-bottom: 0.25mm solid #374151; }
        .ctr-lines-reference td { font-size: 8.2pt; padding-top: 2mm; }
        ` : ''}
        ${rendersPaymentBox ? `
        .ctr-payment-box { display: flex; flex-direction: column; height: 100%; justify-content: space-around; padding: 1.2mm 4mm; }
        .ctr-payment-row { align-items: center; display: flex; font-size: 9pt; gap: 3mm; min-height: 5mm; }
        .ctr-checkbox { border: 0.35mm solid #374151; box-sizing: border-box; display: inline-block; height: 4mm; position: relative; width: 7mm; }
        .ctr-checkbox.checked::after { content: '✓'; font-size: 9pt; font-weight: 700; left: -2mm; position: absolute; top: -3mm; }
        .ctr-checkbox.ghost { opacity: 0; }
        .ctr-payment-value { border-bottom: 0.2mm solid transparent; color: #374151; min-width: 28mm; }
        .ctr-payment-date-label { margin-left: auto; }
        .ctr-payment-date { min-width: 24mm; }
        ` : ''}
        .ctr-totals-table { border-collapse: collapse; table-layout: fixed; width: 100%; }
        .ctr-totals-table th, .ctr-totals-table td { border-bottom: 0.25mm solid #374151; box-sizing: border-box; font-size: 8.8pt; line-height: 1.15; padding: 1mm 1.5mm; }
        .ctr-totals-table tr:last-child th, .ctr-totals-table tr:last-child td { border-bottom: 0; font-weight: 700; }
        .ctr-totals-table th { font-weight: 600; text-align: left; width: 55mm; }
        .ctr-totals-table td { color: #374151; text-align: right; width: 23mm; }
        ${rendersFooter ? `
        .ctr-collector-value { border-bottom: 0.2mm solid #374151; color: #374151; display: inline-block; margin-left: 3mm; min-height: 5mm; min-width: 34mm; }
        ` : ''}
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
      `}</style>
      {elements.map((element) => renderElement(element, payload, normalizedConfig, mode, copyLabel, reprintLabel))}
      {mode === 'overlay' ? normalizedConfig.fields.filter(shouldRenderOverlayField).map((field) => (
        <div
          key={field.field_id}
          className="ctr-overlay-field"
          style={fieldStyle(field)}
        >
          {formatFieldValue(payload, field, copyLabel)}
        </div>
      )) : null}
      {testPrint ? <CalibrationMarks /> : null}
    </div>
  );
}
