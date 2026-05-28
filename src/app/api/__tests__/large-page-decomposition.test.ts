import fs from 'fs';
import path from 'path';

describe('large page decomposition', () => {
  const root = process.cwd();
  const billingPage = fs.readFileSync(path.join(root, 'src/app/(dashboard)/billing/page.tsx'), 'utf8');
  const bookingPage = fs.readFileSync(path.join(root, 'src/app/(dashboard)/booking/page.tsx'), 'utf8');

  function renderedComponentTag(source: string, componentName: string) {
    const match = source.match(new RegExp(`<${componentName}\\b[\\s\\S]*?\\n\\s*/>`));
    expect(match?.[0]).toBeTruthy();
    return match?.[0] || '';
  }

  it('renders billing document actions with behavior-critical callbacks', () => {
    const tag = renderedComponentTag(billingPage, 'BillingDocumentActions');

    expect(tag).toContain('invoices={invoices}');
    expect(tag).toContain('canCreateInvoice={canCreateInvoice}');
    expect(tag).toContain('statementBusyKey={statementBusyKey}');
    expect(tag).toContain('onIssueStatement={issueBillingStatement}');
    expect(tag).toContain('onPrintSummary={() => window.print()}');
    expect(tag).toContain("onPrintReceipt={(invoice) => window.open(`/billing/print?id=${invoice.invoice_id}&type=receipt`, '_blank')}");
    expect(tag).toContain("onPrintContinuousReceipt={(invoice) => window.open(`/billing/print/continuous?id=${invoice.invoice_id}&type=receipt`, '_blank')}");
  });

  it('renders billing statement history with row, state, and refresh/open callbacks', () => {
    const tag = renderedComponentTag(billingPage, 'BillingStatementHistory');

    expect(tag).toContain('statements={statements}');
    expect(tag).toContain('loading={statementsLoading}');
    expect(tag).toContain('yardId={yardId}');
    expect(tag).toContain('onRefresh={fetchStatements}');
    expect(tag).toContain("onOpenStatement={(statement) => window.open(`/billing/print/statement?id=${statement.statement_id}&yard_id=${yardId}`, '_blank')}");
  });

  it('renders booking import template panel with import and template callbacks', () => {
    const tag = renderedComponentTag(bookingPage, 'BookingImportTemplatePanel');

    expect(tag).toContain('fileRef={fileRef}');
    expect(tag).toContain('fileRows={fileRows}');
    expect(tag).toContain('fileName={fileName}');
    expect(tag).toContain('fileBatchLoading={fileBatchLoading}');
    expect(tag).toContain('fileBatchResult={fileBatchResult}');
    expect(tag).toContain('canManageBookings={canManageBookings}');
    expect(tag).toContain('onFileUpload={handleFileUpload}');
    expect(tag).toContain('onDownloadTemplate={downloadTemplate}');
    expect(tag).toContain('onBatchImport={handleBatchImport}');
    expect(tag).toContain('mapRow={mapRow}');
  });

  it('renders booking create form with controlled state and submit callback', () => {
    const tag = renderedComponentTag(bookingPage, 'BookingCreateForm');

    expect(tag).toContain('createForm={createForm}');
    expect(tag).toContain('setCreateForm={setCreateForm}');
    expect(tag).toContain('containerNumbers={containerNumbers}');
    expect(tag).toContain('setContainerNumbers={setContainerNumbers}');
    expect(tag).toContain('createLoading={createLoading}');
    expect(tag).toContain('createResult={createResult}');
    expect(tag).toContain('canManageBookings={canManageBookings}');
    expect(tag).toContain('onSubmit={handleCreate}');
    expect(tag).toContain('businessRelationshipFields={(');
  });
});
