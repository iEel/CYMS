import fs from 'fs';
import path from 'path';

describe('dashboard component boundaries', () => {
  const root = process.cwd();

  it('keeps billing workflow tabs in focused component files', () => {
    const billingDir = path.join(root, 'src/app/(dashboard)/billing');
    const pageSource = fs.readFileSync(path.join(billingDir, 'page.tsx'), 'utf8');
    const extractedComponents = [
      'BillingClearanceTab',
      'BillingReports',
      'CreditControlTab',
      'ARAgingTab',
    ];

    for (const componentName of extractedComponents) {
      expect(fs.existsSync(path.join(billingDir, `${componentName}.tsx`))).toBe(true);
      expect(pageSource).not.toContain(`function ${componentName}(`);
    }
  });
});
