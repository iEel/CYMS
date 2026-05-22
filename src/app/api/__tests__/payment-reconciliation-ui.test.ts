import fs from 'fs';
import path from 'path';

describe('Payment reconciliation UI', () => {
  it('adds a billing tab for importing and matching bank statement rows', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/billing/page.tsx'), 'utf8');

    expect(source).toContain('payment_reconciliation');
    expect(source).toContain('/api/billing/payment-reconciliation');
    expect(source).toContain('Payment Reconciliation');
    expect(source).toContain('นำเข้า Statement');
    expect(source).toContain('Match Invoice');
  });
});
