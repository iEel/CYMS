import fs from 'fs';
import path from 'path';

describe('large page decomposition', () => {
  const root = process.cwd();
  const billingPage = fs.readFileSync(path.join(root, 'src/app/(dashboard)/billing/page.tsx'), 'utf8');
  const bookingPage = fs.readFileSync(path.join(root, 'src/app/(dashboard)/booking/page.tsx'), 'utf8');

  it('wires focused billing document panels from the billing page', () => {
    expect(billingPage).toContain('BillingDocumentActions');
    expect(billingPage).toContain('BillingStatementHistory');
  });

  it('wires focused booking create/import panels from the booking page', () => {
    expect(bookingPage).toContain('BookingCreateForm');
    expect(bookingPage).toContain('BookingImportTemplatePanel');
  });
});
