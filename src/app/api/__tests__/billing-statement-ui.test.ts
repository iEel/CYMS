import fs from 'fs';
import path from 'path';

describe('billing statement UI', () => {
  it('lets billing users issue and print consolidated statements from the documents tab', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/billing/page.tsx'), 'utf8');
    expect(page).toContain('/api/billing/statements');
    expect(page).toContain('ออกเอกสารวางบิลรวม');
    expect(page).toContain('/billing/print/statement?id=');
  });

  it('shows previously issued billing statements so users can reprint them later', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/billing/page.tsx'), 'utf8');
    expect(page).toContain('fetchStatements');
    expect(page).toContain('ประวัติใบวางบิลรวม');
    expect(page).toContain('เปิด/พิมพ์ซ้ำ');
  });

  it('receives invoice payments through the allocation endpoint instead of direct paid status updates', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/billing/page.tsx'), 'utf8');
    expect(page).toContain('/api/billing/payments');
    expect(page).toContain('receiveInvoicePayment');
  });

  it('has a dedicated statement print page backed by the statement API', () => {
    const printPage = fs.readFileSync(path.join(process.cwd(), 'src/app/billing/print/statement/page.tsx'), 'utf8');
    expect(printPage).toContain('/api/billing/statements?yard_id=');
    expect(printPage).toContain('ใบวางบิล');
    expect(printPage).toContain('statement_number');
  });

  it('prints receipt numbers separately from invoice numbers when available', () => {
    const printPage = fs.readFileSync(path.join(process.cwd(), 'src/app/billing/print/page.tsx'), 'utf8');
    expect(printPage).toContain('receipt_number');
    expect(printPage).toContain('displayDocumentNumber');
  });
});
