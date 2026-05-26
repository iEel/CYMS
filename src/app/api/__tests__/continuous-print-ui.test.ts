import fs from 'fs';
import path from 'path';

describe('continuous print UI', () => {
  const root = process.cwd();
  const pagePath = path.join(root, 'src/app/billing/print/continuous/page.tsx');
  const componentPath = path.join(root, 'src/components/billing/ContinuousTaxReceipt.tsx');
  const settingsPath = path.join(root, 'src/app/(dashboard)/settings/page.tsx');

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
});
