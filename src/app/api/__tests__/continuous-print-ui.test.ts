import fs from 'fs';
import path from 'path';
import { lineItemsBoxStyle, lineItemValue } from '@/components/billing/ContinuousTaxReceipt';
import type { DocumentTemplateConfig } from '@/lib/documentTemplateTypes';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/ContinuousTaxReceipt.tsx'), 'utf8');
type LineItemColumn = DocumentTemplateConfig['sections']['line_items']['columns'][number];

describe('continuous tax receipt section-driven line items', () => {
  it('reads line item geometry from template config', () => {
    expect(source).toContain('const lineItemsSection = config.sections.line_items');
    expect(source).toContain('lineItemsSection.x_mm');
    expect(source).toContain('lineItemsSection.row_height_mm');
    expect(source).toContain('lineItemsSection.max_rows');
  });

  it('renders configured columns proportionally without letting the table escape the page', () => {
    expect(source).toContain('lineItemsSection.columns.map');
    expect(source).toContain('tableLayout:');
    expect(source).toContain('overflow:');
  });

  it('clips the full-form line item box to the configured section height', () => {
    expect(source).toContain('height: `${heightMm}mm`');
    expect(source).not.toContain('minHeight: `${heightMm}mm`');
  });

  it('includes the configured header band in the line item section height', () => {
    expect(source).toContain('const headerHeightMm = Math.max(0, lineItemsSection.start_y_mm - lineItemsSection.y_mm)');
    expect(source).toContain('const heightMm = headerHeightMm + lineItemsSection.row_height_mm * lineItemsSection.max_rows');
    expect(source).toContain('height: `${headerHeightMm}mm`');
  });

  it('formats line item values from configured column formats', () => {
    expect(source).toContain("function lineItemValue(line: ContinuousPrintLine, column: LineItemColumn)");
    expect(source).toContain("if (column.format === 'currency:THB')");
    expect(source).toContain("if (column.format === 'number')");
    expect(source).toContain("if (key === 'amount') return line.amount");
    expect(source).toContain('money(numericValue)');
    expect(source).toContain('lineItemValue(line, column)');
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
    expect(source).toContain('.ctr-lines, .ctr-lines tr, .ctr-lines th, .ctr-lines td { box-sizing: border-box; }');
    expect(source).toContain('line-height: 1.1');
    expect(source).toContain('padding: 0.2mm 0.8mm');
  });
});

describe('continuous print UI', () => {
  const root = process.cwd();
  const pagePath = path.join(root, 'src/app/billing/print/continuous/page.tsx');
  const componentPath = path.join(root, 'src/components/billing/ContinuousTaxReceipt.tsx');
  const settingsPath = path.join(root, 'src/app/(dashboard)/settings/page.tsx');
  const templateManagerPath = path.join(root, 'src/app/(dashboard)/settings/DocumentTemplateManager.tsx');
  const previewRoutePath = path.join(root, 'src/app/api/document-templates/preview/route.ts');
  const billingPagePath = path.join(root, 'src/app/(dashboard)/billing/page.tsx');
  const billingClearanceTabPath = path.join(root, 'src/app/(dashboard)/billing/BillingClearanceTab.tsx');
  const gateInTabPath = path.join(root, 'src/app/(dashboard)/gate/GateInTab.tsx');
  const gateOutTabPath = path.join(root, 'src/app/(dashboard)/gate/GateOutTab.tsx');

  it('loads continuous print preview data from the planned preview route', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('/api/document-templates/preview');
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

  it('keeps the full-form continuous receipt table inside the paper frame', () => {
    const source = fs.readFileSync(componentPath, 'utf8');

    expect(source).toContain('box-sizing: border-box');
    expect(source).toContain('const totalColumnWidthMm');
    expect(source).toContain('<colgroup>');
    expect(source).toContain('overflow-wrap: anywhere');
  });

  it('provides a back action from the print preview to the template designer', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('handleBackToTemplate');
    expect(source).toContain('กลับไปแก้ Template');
    expect(source).toContain('/settings?tab=document-templates');
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

      expect(source).toContain('/billing/print/continuous?id=');
    });
  });

  it('guards sample previews from real print-log posting', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('isSamplePreview');
    expect(source).toMatch(/if \(!realDocumentId \|\| isSamplePreview\)/);
    expect(source).not.toMatch(/if \(!realDocumentId \|\| testPrint \|\| isSamplePreview\)/);
    expect(source).toContain("searchParams.get('preview') === 'sample'");
    expect(source).toContain("payload.document.document_type === 'sample'");
  });

  it('opens settings test prints as sample-only without a real invoice id', () => {
    const source = fs.readFileSync(templateManagerPath, 'utf8');

    expect(source).toContain('const testPrint = async () =>');
    expect(source).toContain("openPrintPreview(previewParams('sample', true));");
    expect(source).toContain("params.testPrint = '1'");
    expect(source).not.toContain('realPreview(true)');
  });
});
