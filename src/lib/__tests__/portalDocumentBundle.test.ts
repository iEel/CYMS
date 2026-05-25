import { buildPortalDocumentBundleEntries } from '../portalDocumentBundle';
import { createZipArchive } from '../zipArchive';

describe('portal document bundle helpers', () => {
  it('creates bundle entries for statement, invoices, and EIR documents', () => {
    const entries = buildPortalDocumentBundleEntries({
      baseUrl: 'https://cyms.example.test',
      generatedAt: '2026-05-21T08:00:00.000Z',
      statement: { outstanding: 1200, open_count: 2 },
      invoices: [{ invoice_id: 10, invoice_number: 'INV-10', status: 'issued', grand_total: 1200 }],
      eirs: [{ eir_number: 'EIR-1', container_number: 'MSKU1234567', transaction_type: 'gate_in', created_at: '2026-05-21T07:00:00.000Z' }],
    });

    expect(entries.map(entry => entry.name)).toEqual([
      'README.txt',
      'statement.json',
      'invoices.csv',
      'eir-documents.csv',
    ]);
    expect(String(entries[2].data)).toContain('https://cyms.example.test/api/portal/invoice-pdf?invoice_id=10&type=invoice');
    expect(String(entries[3].data)).toContain('https://cyms.example.test/api/portal/eir-pdf?eir_number=EIR-1');
  });

  it('omits statement and invoice files when the route passes empty invoice data', () => {
    const entries = buildPortalDocumentBundleEntries({
      baseUrl: 'https://cyms.example.test',
      generatedAt: '2026-05-21T08:00:00.000Z',
      statement: {},
      invoices: [],
      eirs: [{ eir_number: 'EIR-1' }],
    });

    expect(entries.map(entry => entry.name)).toEqual(['README.txt', 'eir-documents.csv']);
    expect(entries.map(entry => String(entry.data)).join('\n')).not.toContain('statement.json');
    expect(entries.map(entry => String(entry.data)).join('\n')).not.toContain('invoices.csv');
  });

  it('removes invoice PDF links when invoice download is not allowed', () => {
    const entries = buildPortalDocumentBundleEntries({
      baseUrl: 'https://cyms.example.test',
      generatedAt: '2026-05-21T08:00:00.000Z',
      statement: { outstanding: 1200, open_count: 2 },
      invoices: [{ invoice_id: 10, invoice_number: 'INV-10', status: 'paid', grand_total: 1200 }],
      eirs: [],
      includeInvoiceDownloads: false,
    });

    const invoiceCsv = String(entries.find(entry => entry.name === 'invoices.csv')?.data);
    expect(invoiceCsv).toContain('INV-10');
    expect(invoiceCsv).not.toContain('/api/portal/invoice-pdf');
  });

  it('generates a valid downloadable zip archive', () => {
    const zip = createZipArchive([
      { name: 'hello.txt', data: 'hello world' },
      { name: 'nested/readme.txt', data: 'portal bundle' },
    ]);

    expect(zip.subarray(0, 4).toString('binary')).toBe('PK\u0003\u0004');
    expect(zip.includes(Buffer.from('hello.txt'))).toBe(true);
    expect(zip.includes(Buffer.from('nested/readme.txt'))).toBe(true);
  });
});
