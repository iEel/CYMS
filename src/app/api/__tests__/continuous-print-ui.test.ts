import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { lineItemsBoxStyle, lineItemValue } from '@/components/billing/ContinuousTaxReceipt';
import { TemplateCanvasReceipt } from '@/components/billing/TemplateCanvasReceipt';
import { sanitizeContinuousPrintReturnTo } from '@/app/billing/print/continuous/returnPath';
import { buildSampleContinuousPrintPayload } from '@/lib/billingContinuousPrintSample';
import { buildDefaultA4TaxReceiptTemplateConfig, buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplateDefaults';
import type { DocumentTemplateConfig } from '@/lib/documentTemplateTypes';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/ContinuousTaxReceipt.tsx'), 'utf8');
const rendererSource = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/TemplateCanvasReceipt.tsx'), 'utf8');
type LineItemColumn = DocumentTemplateConfig['sections']['line_items']['columns'][number];

describe('continuous tax receipt section-driven line items', () => {
  it('reads line item geometry from template config', () => {
    expect(source).toContain('const lineItemsSection = normalizedConfig.sections.line_items');
    expect(rendererSource).toContain('const lineItemsSection = normalizedConfig.sections.line_items');
    expect(rendererSource).toContain('lineItemDataRowHeight(lineItemsSection)');
    expect(rendererSource).toContain('lineItemEmptyRowHeight(lineItemsSection');
  });

  it('renders configured columns proportionally without letting the table escape the page', () => {
    expect(rendererSource).toContain('lineItemsSection.columns.map');
    expect(rendererSource).toContain('tableLayout:');
    expect(rendererSource).toContain('overflow:');
  });

  it('clips the full-form line item box to the configured section height', () => {
    expect(source).toContain('height: `${heightMm}mm`');
    expect(source).not.toContain('minHeight: `${heightMm}mm`');
  });

  it('includes the configured header band in the line item section height', () => {
    expect(source).toContain('const headerHeightMm = Math.max(0, lineItemsSection.start_y_mm - lineItemsSection.y_mm)');
    expect(source).toContain('const heightMm = headerHeightMm + lineItemsSection.row_height_mm * lineItemsSection.max_rows');
    expect(rendererSource).toContain('height: `${headerHeightMm}mm`');
  });

  it('formats line item values from configured column formats', () => {
    expect(source).toContain("function lineItemValue(line: ContinuousPrintLine, column: LineItemColumn)");
    expect(source).toContain("if (column.format === 'currency:THB')");
    expect(source).toContain("if (column.format === 'number')");
    expect(source).toContain("if (key === 'amount') return line.amount");
    expect(source).toContain('money(numericValue)');
    expect(rendererSource).toContain('lineItemValue(line, column)');
  });

  it('computes line item box styles from header and body height', () => {
    const section = {
      section_id: 'line-items',
      binding_source: 'lines',
      x_mm: 10,
      y_mm: 55,
      start_y_mm: 61,
      width_mm: 120,
      row_height_mm: 6,
      max_rows: 7,
      columns: [],
    } satisfies DocumentTemplateConfig['sections']['line_items'];

    expect(lineItemsBoxStyle(section, 'full')).toMatchObject({
      width: '120mm',
      height: '48mm',
      overflow: 'hidden',
    });
    expect(lineItemsBoxStyle(section, 'overlay')).toMatchObject({
      position: 'absolute',
      left: '10mm',
      top: '55mm',
      width: '120mm',
      height: '48mm',
      overflow: 'hidden',
    });
  });

  it('formats line item values using the column format', () => {
    const line = {
      description: 'Refund',
      qty: 2,
      unit_price: 150,
      amount: -300,
    };
    const column = (field_key: string, format: LineItemColumn['format']): LineItemColumn => ({
      column_id: `${field_key}-${format}`,
      field_key,
      label: field_key,
      width_mm: 20,
      text_align: 'right',
      format,
    });

    expect(lineItemValue(line, column('lines[].amount', 'currency:THB'))).toBe('-300.00');
    expect(lineItemValue(line, column('lines[].amount', 'number'))).toBe('-300');
    expect(lineItemValue(line, column('lines[].description', 'text'))).toBe('Refund');
  });

  it('uses border-box sizing for configured line item row heights', () => {
    expect(rendererSource).toContain('.ctr-lines, .ctr-lines tr, .ctr-lines th, .ctr-lines td { box-sizing: border-box; }');
    expect(rendererSource).toContain('line-height: 1.1');
    expect(rendererSource).toContain('padding: 0.2mm 0.8mm');
  });
});

describe('continuous print UI', () => {
  const root = process.cwd();
  const pagePath = path.join(root, 'src/app/billing/print/continuous/page.tsx');
  const componentPath = path.join(root, 'src/components/billing/ContinuousTaxReceipt.tsx');
  const rendererPath = path.join(root, 'src/components/billing/TemplateCanvasReceipt.tsx');
  const settingsPath = path.join(root, 'src/app/(dashboard)/settings/page.tsx');
  const templateManagerPath = path.join(root, 'src/app/(dashboard)/settings/DocumentTemplateManager.tsx');
  const previewRoutePath = path.join(root, 'src/app/api/document-templates/preview/route.ts');
  const billingPagePath = path.join(root, 'src/app/(dashboard)/billing/page.tsx');
  const billingClearanceTabPath = path.join(root, 'src/app/(dashboard)/billing/BillingClearanceTab.tsx');
  const gateInTabPath = path.join(root, 'src/app/(dashboard)/gate/GateInTab.tsx');
  const gateOutTabPath = path.join(root, 'src/app/(dashboard)/gate/GateOutTab.tsx');
  const gatePrintDraftHookPath = path.join(root, 'src/app/(dashboard)/gate/hooks/useGatePrintReturnDraft.ts');

  it('loads continuous print preview data from the planned preview route', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('/api/document-templates/preview');
    expect(source).toContain('/api/document-templates/test-print');
    expect(source).toContain("method: 'POST'");
    expect(source).toContain('calibrationProfileId');
    expect(source).toContain('versionNo');
    expect(source).toContain('version_no: versionNo');
  });

  it('keeps the continuous print page safe for the client bundle', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('Suspense');
    expect(source).not.toMatch(/from ['"]@\/lib\/billingContinuousPrint['"]/);
    expect(source).not.toMatch(/from ['"]@\/lib\/documentTemplates['"]/);
  });

  it('renders continuous tax receipt copy labels and mode controls', () => {
    const source = fs.readFileSync(componentPath, 'utf8');

    expect(source).toContain('ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน');
    expect(source).toContain('copyMode');
    expect(source).toContain('mode');
  });

  it('renders the full form with the original continuous receipt sections', () => {
    const source = fs.readFileSync(rendererPath, 'utf8');

    expect(source).toContain('ctr-company-header');
    expect(source).toContain('ctr-copy-box');
    expect(source).toContain('Customer Name');
    expect(source).toContain('เลขที่ / Reference');
    expect(source).toContain('วันที่ / Date');
    expect(source).toContain('เงินสด');
    expect(source).toContain('เช็ค เลขที่');
    expect(source).toContain('จำนวนเงิน/Total');
    expect(source).toContain('ภาษีมูลค่าเพิ่ม / Value added tax');
    expect(source).toContain('จำนวนเงินทั้งสิ้น / Grand Total');
    expect(source).toContain('ผู้รับเงิน / Collector');
    expect(source).not.toContain('ใบกำกับภาษี / ใบแจ้งหนี้');
  });

  it('renders full receipts through the shared template canvas renderer', () => {
    const source = fs.readFileSync(componentPath, 'utf8');

    expect(source).toContain('TemplateCanvasReceipt');
    expect(source).toContain('normalizeTemplateCanvasConfig(config)');
    expect(source).not.toContain('function FullReceipt');
  });

  it('preserves full and overlay page content geometry while using the shared renderer', () => {
    const source = fs.readFileSync(componentPath, 'utf8');

    expect(source).toContain('mode === \'overlay\' ? paper.width_mm : paper.width_mm - paper.margin_left_mm - paper.margin_right_mm');
    expect(source).toContain('mode === \'overlay\' ? paper.height_mm : paper.height_mm - paper.margin_top_mm - paper.margin_bottom_mm');
    expect(source).toContain('paper.left_offset_mm + (mode === \'overlay\' ? 0 : paper.margin_left_mm)');
    expect(source).toContain('paper.top_offset_mm + (mode === \'overlay\' ? 0 : paper.margin_top_mm)');
  });

  it('normalizes template canvas config inside the shared renderer', () => {
    const source = fs.readFileSync(rendererPath, 'utf8');

    expect(source).toContain("import { normalizeTemplateCanvasConfig } from '@/lib/documentTemplateCanvas'");
    expect(source).toContain('const normalizedConfig = normalizeTemplateCanvasConfig(config)');
    expect(source).toContain('normalizedConfig.elements || []');
  });

  it('uses an explicit helper to filter full and overlay template layers', () => {
    const source = fs.readFileSync(rendererPath, 'utf8');

    expect(source).toContain('function shouldRenderElement(mode: DocumentTemplateMode, element: DocumentTemplateElement)');
    expect(source).toContain("mode === 'overlay'");
    expect(source).toContain("element.layer === 'data'");
    expect(source).toContain('shouldRenderElement(mode, element)');
  });

  it('keeps the full-form continuous receipt table inside the paper frame', () => {
    const source = fs.readFileSync(rendererPath, 'utf8');

    expect(source).toContain('box-sizing: border-box');
    expect(source).toContain('const totalColumnWidthMm');
    expect(source).toContain('<colgroup>');
    expect(source).toContain('overflow-wrap: anywhere');
    expect(source).toContain('.ctr-element-line_items::after');
    expect(source).toContain('border-bottom: 0.25mm solid #374151');
  });

  it('renders form chrome in full mode and excludes it from overlay mode', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = buildDefaultContinuousTemplateConfig();
    const fullMarkup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));
    const overlayMarkup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'overlay',
      copyLabel: config.copy_labels[0],
    }));

    expect(fullMarkup).toContain('ctr-lines');
    expect(fullMarkup).toContain('Customer Name');
    expect(fullMarkup).toContain('ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน');
    expect(fullMarkup).toContain('ctr-company-header');

    expect(overlayMarkup).not.toContain('ctr-lines');
    expect(overlayMarkup).not.toContain('Customer Name');
    expect(overlayMarkup).not.toContain('ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน');
    expect(overlayMarkup).not.toContain('ctr-company-header');
  });

  it('does not duplicate the company name when no English company name is configured', () => {
    const companyName = 'บริษัท ทดสอบ จำกัด';
    const basePayload = buildSampleContinuousPrintPayload();
    const payload = {
      ...basePayload,
      company: {
        ...basePayload.company,
        name: companyName,
        company_name: companyName,
        name_th: companyName,
        name_en: '',
      },
    };
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(markup.split(companyName).length - 1).toBe(1);
  });

  it('shows the issued document number in the customer reference box instead of an external reference', () => {
    const basePayload = buildSampleContinuousPrintPayload();
    const payload = {
      ...basePayload,
      document: {
        ...basePayload.document,
        invoice_number: 'INV-202606-000012',
        tax_invoice_number: 'TAX-202606-000012',
        receipt_number: 'RCT-202606-000012',
        document_number: 'RCT-202606-000012',
        reference_no: 'BOOKING-ABC-001',
      },
    };
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(markup).toContain('เลขที่ / Reference');
    expect(markup).toContain('RCT-202606-000012');
    expect(markup).not.toContain('BOOKING-ABC-001');
  });

  it('fills remaining configured line item rows with blank rows for stable print layout', () => {
    const basePayload = buildSampleContinuousPrintPayload();
    const payload = {
      ...basePayload,
      lines: basePayload.lines.slice(0, 2).map((line) => ({
        ...line,
        container_refs: undefined,
        job_refs: undefined,
      })),
    };
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    const emptyRowCount = (markup.match(/class="ctr-lines-empty"/g) || []).length;

    expect(config.sections.line_items.max_rows).toBe(5);
    expect(markup).toContain('ctr-lines-data');
    expect(emptyRowCount).toBe(3);
  });

  it('does not render container or job references as trailing text inside the line item table', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));
    const emptyRowCount = (markup.match(/class="ctr-lines-empty"/g) || []).length;

    expect(markup).not.toContain('ctr-lines-reference');
    expect(markup).not.toContain('CNSI26030029');
    expect(emptyRowCount).toBe(config.sections.line_items.max_rows - payload.lines.length);
  });

  it('left-aligns item description values while keeping the header centered', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(markup).toContain('style="height:8mm;text-align:center">รายการ');
    expect(markup).toContain('style="height:5.6mm;text-align:left">CONTAINER REPAIR CHARGES');
  });

  it('keeps filled line item rows compact while blank rows absorb the remaining table height', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(config.sections.line_items.row_height_mm).toBe(8);
    expect(markup).toContain('style="height:5.6mm;text-align:left">CONTAINER REPAIR CHARGES');
    expect(markup).toContain('style="height:11.6mm;text-align:left"></td>');
  });

  it('keeps payment labels in fixed no-wrap columns', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(markup).toContain('class="ctr-payment-row ctr-payment-row-cheque"');
    expect(markup).toContain('class="ctr-payment-label">เช็ค เลขที่</span>');
    expect(markup).toContain('grid-template-columns: 7mm 24mm 42mm 18mm 34mm;');
    expect(markup).toContain('.ctr-payment-label, .ctr-payment-date-label { white-space: nowrap; }');
  });

  it('centers the payment checkbox tick inside the checkbox', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = buildDefaultContinuousTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(markup).toContain(".ctr-checkbox.checked::after { color: #111827; content: '✓'; font-size: 8.5pt; font-weight: 700; left: 50%; line-height: 1; position: absolute; top: 50%; transform: translate(-50%, -58%); }");
    expect(markup).not.toContain("left: -2mm; position: absolute; top: -3mm;");
  });

  it('does not append collector signature line to footer notes but keeps the collector line', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = buildDefaultA4TaxReceiptTemplateConfig();

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(markup).toContain('บริษัทฯ กำหนดเวลาในการแก้ไขใบเสร็จรับเงิน/ใบกำกับภาษีภายใน 7 วัน นับจากวันที่ออกเอกสาร หากพ้นกำหนดทางบริษัทฯ ถือว่าถูกต้องแล้ว</div>');
    expect(markup).toContain('ผู้รับเงิน / Collector<span class="ctr-collector-value"></span>');
    expect(markup).not.toContain('>KIT</span>');
  });

  it('renders overlay mode with only data layer elements', () => {
    const payload = buildSampleContinuousPrintPayload();
    const baseConfig = buildDefaultContinuousTemplateConfig();
    const config = {
      ...baseConfig,
      elements: [
        {
          element_id: 'form-label',
          type: 'text',
          label: 'FORM SHOULD NOT PRINT',
          text: 'FORM SHOULD NOT PRINT',
          x_mm: 10,
          y_mm: 10,
          width_mm: 50,
          height_mm: 5,
          visible: true,
          layer: 'form',
          locked: true,
        },
        {
          element_id: 'data-label',
          type: 'text',
          label: 'DATA SHOULD PRINT',
          text: 'DATA SHOULD PRINT',
          x_mm: 10,
          y_mm: 20,
          width_mm: 50,
          height_mm: 5,
          visible: true,
          layer: 'data',
          locked: false,
        },
        {
          element_id: 'calibration-label',
          type: 'text',
          label: 'CALIBRATION SHOULD NOT PRINT',
          text: 'CALIBRATION SHOULD NOT PRINT',
          x_mm: 10,
          y_mm: 30,
          width_mm: 50,
          height_mm: 5,
          visible: true,
          layer: 'calibration',
          locked: true,
        },
      ],
    } satisfies DocumentTemplateConfig;

    const overlayMarkup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'overlay',
      copyLabel: config.copy_labels[0],
    }));

    expect(overlayMarkup).not.toContain('FORM SHOULD NOT PRINT');
    expect(overlayMarkup).toContain('DATA SHOULD PRINT');
    expect(overlayMarkup).not.toContain('CALIBRATION SHOULD NOT PRINT');
  });

  it('does not render editor text or labels when bound text has no value', () => {
    const payload = buildSampleContinuousPrintPayload();
    const config = {
      ...buildDefaultContinuousTemplateConfig(),
      elements: [
        {
          element_id: 'empty-bound-text',
          type: 'bound_text',
          label: 'EDITOR LABEL',
          text: 'EDITOR TEXT',
          binding_source: 'document.not_real',
          x_mm: 10,
          y_mm: 10,
          width_mm: 50,
          height_mm: 5,
          visible: true,
          layer: 'data',
          locked: false,
        },
      ],
    } satisfies DocumentTemplateConfig;

    const markup = renderToStaticMarkup(React.createElement(TemplateCanvasReceipt, {
      payload,
      config,
      mode: 'full',
      copyLabel: config.copy_labels[0],
    }));

    expect(markup).not.toContain('EDITOR TEXT');
    expect(markup).not.toContain('EDITOR LABEL');
  });

  it('provides a back action from the print preview to the template designer', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('handleBackToTemplate');
    expect(source).toContain('returnTo');
    expect(source).toContain("sanitizeContinuousPrintReturnTo(searchParams.get('returnTo'))");
    expect(source).toContain('returnLabelFrom(returnTo)');
    expect(source).toContain("returnTo.startsWith('/gate')");
    expect(source).not.toContain("searchParams.get('returnTo') || '/settings?tab=document-templates'");
    expect(source).toContain('กลับไป Document Templates');
    expect(source).toContain('href={returnTo}');
    expect(source).toContain("import { sanitizeContinuousPrintReturnTo } from './returnPath'");
  });

  it('sanitizes returnTo before exposing it as preview navigation', () => {
    expect(sanitizeContinuousPrintReturnTo('/settings?tab=document-templates')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('/settings?tab=document-templates#draft')).toBe('/settings?tab=document-templates#draft');
    expect(sanitizeContinuousPrintReturnTo(null)).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('   ')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('//evil.test/path')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('http://evil.test/path')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('https://evil.test/path')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('javascript:alert(1)')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('settings?tab=document-templates')).toBe('/settings?tab=document-templates');
    expect(sanitizeContinuousPrintReturnTo('/\n/evil.test')).toBe('/settings?tab=document-templates');
  });

  it('shows selected template identity on the non-print preview toolbar', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain("const templateId = searchParams.get('templateId')");
    expect(source).toContain("const versionNo = searchParams.get('versionNo')");
    expect(source).toContain("Template {templateId || '-'} / v{versionNo || '-'}");
  });

  it('does not render fallback receipt content while the selected preview is loading', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('useState<ContinuousPrintPayload | null>(null)');
    expect(source).toContain('useState<DocumentTemplateConfig | null>(null)');
    expect(source).toContain("status === 'loading' || !payload || !config");
    expect(source).toContain('continuous-print-loading');
    expect(source).not.toContain('useState<ContinuousPrintPayload>(fallback.payload)');
    expect(source).not.toContain('useState<DocumentTemplateConfig>(fallback.config)');
  });

  it('wires document template management into settings', () => {
    const source = fs.readFileSync(settingsPath, 'utf8');

    expect(source).toContain('Document Templates');
    expect(source).toContain('DocumentTemplateManager');
  });

  it('provides the planned document template preview route used by the print page', () => {
    expect(fs.existsSync(previewRoutePath)).toBe(true);

    const source = fs.readFileSync(previewRoutePath, 'utf8');
    expect(source).toContain('export async function GET');
    expect(source).toContain('buildSampleContinuousPrintPayload');
    expect(source).toContain('buildContinuousPrintPayload');
    expect(source).not.toContain('nextDocumentNumber');
  });

  it('wires continuous print actions into billing and gate flows', () => {
    [
      billingPagePath,
      billingClearanceTabPath,
      gateInTabPath,
      gateOutTabPath,
    ].forEach((sourcePath) => {
      const source = fs.readFileSync(sourcePath, 'utf8');

      const expectedPath = [gateInTabPath, gateOutTabPath].includes(sourcePath)
        ? '/billing/print/continuous?'
        : '/billing/print/continuous?id=';
      expect(source).toContain(expectedPath);
    });
  });

  it('routes gate billing print actions through document templates with stable return paths', () => {
    const gateIn = fs.readFileSync(gateInTabPath, 'utf8');
    const gateOut = fs.readFileSync(gateOutTabPath, 'utf8');

    expect(gateIn).toContain('openGateInBillingPrint');
    expect(gateIn).toContain("templateFamily: 'a4_tax_receipt'");
    expect(gateIn).toContain("templateFamily: 'continuous_tax_receipt'");
    expect(gateIn).toContain("type: 'tax_invoice_receipt'");
    expect(gateIn).toContain("returnTo: '/gate?tab=gate_in'");
    expect(gateIn).toContain('persistGateInPrintDraft');
    expect(gateIn).not.toContain('/billing/print?id=${gateInInvoiceId}');

    expect(gateOut).toContain('openGateOutBillingPrint');
    expect(gateOut).toContain("templateFamily: 'a4_tax_receipt'");
    expect(gateOut).toContain("templateFamily: 'continuous_tax_receipt'");
    expect(gateOut).toContain("type: 'tax_invoice_receipt'");
    expect(gateOut).toContain("returnTo: '/gate?tab=gate_out'");
    expect(gateOut).not.toContain('/billing/print?id=${invId}');
  });

  it('uses a shared helper for Gate print return drafts', () => {
    const gateIn = fs.readFileSync(gateInTabPath, 'utf8');
    const gateOut = fs.readFileSync(gateOutTabPath, 'utf8');
    const helper = fs.readFileSync(gatePrintDraftHookPath, 'utf8');

    expect(gateIn).toContain('useGatePrintReturnDraft<GateInPrintDraft>');
    expect(gateOut).toContain('useGatePrintReturnDraft<GateOutPrintDraft>');
    expect(helper).toContain('window.localStorage.setItem');
    expect(helper).toContain('window.localStorage.removeItem');
  });

  it('preserves the gate-in payment draft before opening a print preview', () => {
    const gateIn = fs.readFileSync(gateInTabPath, 'utf8');

    expect(gateIn).toContain('GATE_IN_PRINT_DRAFT_KEY');
    expect(gateIn).toContain('gateInPrintDraft.saveDraft');
    expect(gateIn).toContain('gateInPrintDraft.clearDraft');
    expect(gateIn).not.toContain('localStorage.setItem(GATE_IN_PRINT_DRAFT_KEY');
    expect(gateIn).not.toContain('localStorage.removeItem(GATE_IN_PRINT_DRAFT_KEY');
    expect(gateIn).not.toContain('sessionStorage.setItem(GATE_IN_PRINT_DRAFT_KEY');
    expect(gateIn).toContain('restoreGateInPrintDraft');
    expect(gateIn).toContain('persistGateInPrintDraft');
  });

  it('preserves gate-in billing charge state when returning from receipt print', () => {
    const gateIn = fs.readFileSync(gateInTabPath, 'utf8');

    expect(gateIn).toContain('gateInBillingData');
    expect(gateIn).toContain('gateInSelectedCharges: Array.from(gateInSelectedCharges)');
    expect(gateIn).toContain('gateInChargeOverrides');
    expect(gateIn).toContain('gateInCustomCharges');
    expect(gateIn).toContain('gateInSelectedCustom: Array.from(gateInSelectedCustom)');
    expect(gateIn).toContain('if (draft.gateInBillingData) setGateInBillingData(draft.gateInBillingData)');
    expect(gateIn).toContain('if (draft.gateInSelectedCharges) setGateInSelectedCharges(new Set(draft.gateInSelectedCharges))');
    expect(gateIn).toContain('if (draft.gateInSelectedCustom) setGateInSelectedCustom(new Set(draft.gateInSelectedCustom))');
    expect(gateIn).toContain('restoredGateInBillingSnapshotRef.current = Boolean(draft.gateInBillingData)');
  });

  it('preserves gate-out billing and release state when returning from receipt print', () => {
    const gateOut = fs.readFileSync(gateOutTabPath, 'utf8');

    expect(gateOut).toContain('GATE_OUT_PRINT_DRAFT_KEY');
    expect(gateOut).toContain('gateOutPrintDraft.saveDraft');
    expect(gateOut).toContain('gateOutPrintDraft.clearDraft');
    expect(gateOut).not.toContain('localStorage.setItem(GATE_OUT_PRINT_DRAFT_KEY');
    expect(gateOut).not.toContain('localStorage.removeItem(GATE_OUT_PRINT_DRAFT_KEY');
    expect(gateOut).not.toContain('sessionStorage.setItem(GATE_OUT_PRINT_DRAFT_KEY');
    expect(gateOut).toContain('restoreGateOutPrintDraft');
    expect(gateOut).toContain('persistGateOutPrintDraft');
    expect(gateOut).toContain('selectedContainer');
    expect(gateOut).toContain('selectedGateOutRequest');
    expect(gateOut).toContain('billingData');
    expect(gateOut).toContain('selectedCharges: Array.from(selectedCharges)');
    expect(gateOut).toContain('selectedCustom: Array.from(selectedCustom)');
    expect(gateOut).toContain('if (draft.billingData) setBillingData(draft.billingData)');
    expect(gateOut).toContain('if (draft.selectedCharges) setSelectedCharges(new Set(draft.selectedCharges))');
    expect(gateOut).toContain('if (draft.selectedCustom) setSelectedCustom(new Set(draft.selectedCustom))');
  });

  it('guards sample previews from real print-log posting', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('isSamplePreview');
    expect(source).toMatch(/if \(!realDocumentId \|\| isSamplePreview\)/);
    expect(source).not.toMatch(/if \(!realDocumentId \|\| testPrint \|\| isSamplePreview\)/);
    expect(source).toContain("searchParams.get('preview') === 'sample'");
    expect(source).toContain("payload?.document.document_type === 'sample'");
  });

  it('opens settings test prints as sample-only without a real invoice id', () => {
    const source = fs.readFileSync(templateManagerPath, 'utf8');

    expect(source).toContain('const testPrint = async (options?: PreviewParamOptions) =>');
    expect(source).toContain("openPrintPreview(previewParams('sample', true, options));");
    expect(source).toContain("params.testPrint = '1'");
    expect(source).toContain('calibrationProfileId');
    expect(source).not.toContain('realPreview(true)');
  });
});
