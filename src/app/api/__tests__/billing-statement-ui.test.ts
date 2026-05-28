import fs from 'fs';
import path from 'path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('billing statement UI', () => {
  it('lets billing users issue and print consolidated statements from the documents tab', () => {
    const page = read('src/app/(dashboard)/billing/page.tsx');
    const documentActions = read('src/app/(dashboard)/billing/components/BillingDocumentActions.tsx');

    expect(page).toContain('/api/billing/statements');
    expect(page).toContain('/billing/print/statement?id=');
    expect(page).toContain('onIssueStatement={issueBillingStatement}');
    expect(documentActions).toContain('ออกเอกสารวางบิลรวม');
  });

  it('shows previously issued billing statements so users can reprint them later', () => {
    const page = read('src/app/(dashboard)/billing/page.tsx');
    const statementHistory = read('src/app/(dashboard)/billing/components/BillingStatementHistory.tsx');

    expect(page).toContain('fetchStatements');
    expect(page).toContain('<BillingStatementHistory');
    expect(page).toContain('onRefresh={fetchStatements}');
    expect(page).toContain('onOpenStatement={(statement) => window.open');
    expect(statementHistory).toContain('ประวัติใบวางบิลรวม');
    expect(statementHistory).toContain('เปิด/พิมพ์ซ้ำ');
  });

  it('receives invoice payments through the allocation endpoint instead of direct paid status updates', () => {
    const page = read('src/app/(dashboard)/billing/page.tsx');
    expect(page).toContain('/api/billing/payments');
    expect(page).toContain('receiveInvoicePayment');
  });

  it('has a dedicated statement print page backed by the statement API', () => {
    const printPage = read('src/app/billing/print/statement/page.tsx');
    expect(printPage).toContain('/api/billing/statements?yard_id=');
    expect(printPage).toContain('ใบวางบิล');
    expect(printPage).toContain('statement_number');
  });

  it('prints receipt numbers separately from invoice numbers when available', () => {
    const printPage = read('src/app/billing/print/page.tsx');
    expect(printPage).toContain('receipt_number');
    expect(printPage).toContain('displayDocumentNumber');
  });
});
