import type { ZipEntry } from './zipArchive';

export interface PortalBundleInvoice {
  invoice_id: number;
  invoice_number: string;
  status: string;
  grand_total: number;
  document_type?: string | null;
}

export interface PortalBundleEir {
  eir_number: string;
  container_number?: string | null;
  transaction_type?: string | null;
  created_at?: string | null;
}

export interface PortalBundleInput {
  baseUrl: string;
  generatedAt: string;
  statement: Record<string, unknown>;
  invoices: PortalBundleInvoice[];
  eirs: PortalBundleEir[];
  includeInvoiceDownloads?: boolean;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function makeUrl(baseUrl: string, pathname: string, params: Record<string, string | number>) {
  const url = new URL(pathname, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function buildPortalDocumentBundleEntries(input: PortalBundleInput): ZipEntry[] {
  const includeInvoiceDownloads = input.includeInvoiceDownloads !== false;
  const invoiceRows = [
    ['invoice_number', 'status', 'grand_total', 'invoice_pdf_url', 'receipt_pdf_url'],
    ...input.invoices.map(invoice => {
      const isPaid = invoice.status === 'paid';
      const isCreditNote = invoice.status === 'credit_note'
        || invoice.document_type === 'credit_note'
        || invoice.invoice_number?.startsWith('CN-');
      return [
        invoice.invoice_number,
        invoice.status,
        invoice.grand_total,
        includeInvoiceDownloads ? makeUrl(input.baseUrl, '/api/portal/invoice-pdf', {
          invoice_id: invoice.invoice_id,
          type: isCreditNote ? 'credit_note' : 'invoice',
        }) : '',
        includeInvoiceDownloads && isPaid ? makeUrl(input.baseUrl, '/api/portal/invoice-pdf', {
          invoice_id: invoice.invoice_id,
          type: 'receipt',
        }) : '',
      ];
    }),
  ].map(row => row.map(csvCell).join(',')).join('\n');

  const eirRows = [
    ['eir_number', 'container_number', 'transaction_type', 'created_at', 'eir_pdf_url'],
    ...input.eirs.map(eir => [
      eir.eir_number,
      eir.container_number || '',
      eir.transaction_type || '',
      eir.created_at || '',
      makeUrl(input.baseUrl, '/api/portal/eir-pdf', { eir_number: eir.eir_number }),
    ]),
  ].map(row => row.map(csvCell).join(',')).join('\n');

  const entries: ZipEntry[] = [
    {
      name: 'README.txt',
      data: [
        'CYMS Customer Portal Document Bundle',
        `Generated at: ${input.generatedAt}`,
        '',
        'Files:',
        ...(Object.keys(input.statement).length > 0 ? ['- statement.json: AR statement summary'] : []),
        ...(input.invoices.length > 0 ? ['- invoices.csv: invoice/receipt records'] : []),
        '- eir-documents.csv: EIR PDF download links',
      ].join('\n'),
    },
    { name: 'eir-documents.csv', data: `${eirRows}\n` },
  ];

  if (Object.keys(input.statement).length > 0) {
    entries.splice(1, 0, { name: 'statement.json', data: JSON.stringify(input.statement, null, 2) });
  }
  if (input.invoices.length > 0) {
    entries.splice(entries.length - 1, 0, { name: 'invoices.csv', data: `${invoiceRows}\n` });
  }

  return entries;
}
