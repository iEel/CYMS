import fs from 'fs';
import path from 'path';

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

    expect(source).toContain("openPrintPreview({ preview: 'sample', mode: config.mode, copyMode: config.copy_mode, testPrint: '1' })");
    expect(source).not.toContain('realPreview(true)');
  });
});
