import sql from 'mssql';
import { amountToThaiBahtText } from '@/lib/thaiBahtText';
import type { ContinuousPrintLine, ContinuousPrintPayload } from './billingContinuousPrintTypes';
import {
  buildSampleContinuousPrintPayload as buildStaticSampleContinuousPrintPayload,
  mergeCompanyProfileIntoContinuousPrintPayload,
} from './billingContinuousPrintSample';
export type { ContinuousPrintLine, ContinuousPrintPayload } from './billingContinuousPrintTypes';
export { buildSampleContinuousPrintPayload } from './billingContinuousPrintSample';

type RequestLike = {
  input(name: string, type: unknown, value: unknown): RequestLike;
  query<T = Record<string, unknown>>(statement: string): Promise<{ recordset: T[] }>;
};

type DbLike = {
  request(): RequestLike;
};

type InvoiceRow = Record<string, unknown>;

type ParsedNotes = {
  charges?: unknown;
  payment_method?: unknown;
  payment_status?: unknown;
  cheque_no?: unknown;
  bank_name?: unknown;
  cheque_date?: unknown;
  payment_ref?: unknown;
  collector_name?: unknown;
  document_type?: unknown;
  reference_no?: unknown;
  tax_invoice_number?: unknown;
  red_ref_no?: unknown;
  ref_invoice_number?: unknown;
};

type RawCharge = {
  description?: unknown;
  quantity?: unknown;
  qty?: unknown;
  unit_price?: unknown;
  subtotal?: unknown;
  amount?: unknown;
  container_refs?: unknown;
  job_refs?: unknown;
  container_number?: unknown;
  job_ref?: unknown;
};

const DEFAULT_COMPANY = {
  name: 'บริษัท ลานตู้คอนเทนเนอร์ จำกัด',
  tax_id: '',
  address: '',
  phone: '',
  email: '',
  logo_url: '',
  branch_type: 'head_office',
  branch_number: '00000',
  yard_name: '',
  yard_code: '',
};

function branchName(branchType: unknown, branchNumber: unknown) {
  if (asString(branchType, 'head_office') === 'head_office') return 'สำนักงานใหญ่';
  const number = asString(branchNumber).trim();
  return number ? `สาขา ${number}` : 'สาขา';
}

function asString(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: unknown, fallback = 0) {
  return Number(asNumber(value, fallback).toFixed(2));
}

function dateText(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseNotes(value: unknown): ParsedNotes {
  if (typeof value !== 'string' || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as ParsedNotes : {};
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const refs = value.map((item) => asString(item).trim()).filter(Boolean);
    return refs.length > 0 ? refs : undefined;
  }

  const ref = asString(value).trim();
  return ref ? [ref] : undefined;
}

function lineFromCharge(charge: RawCharge, row: InvoiceRow): ContinuousPrintLine {
  const qty = asNumber(charge.qty ?? charge.quantity, 1);
  const unitPrice = money(charge.unit_price, 0);
  const amount = money(charge.amount ?? charge.subtotal, qty * unitPrice);
  const containerRefs = stringArray(charge.container_refs ?? charge.container_number ?? row.container_number);
  const jobRefs = stringArray(charge.job_refs ?? charge.job_ref);

  return {
    description: asString(charge.description || row.description || row.charge_type || 'Charge'),
    qty,
    unit_price: unitPrice,
    amount,
    ...(containerRefs ? { container_refs: containerRefs } : {}),
    ...(jobRefs ? { job_refs: jobRefs } : {}),
  };
}

function isRawCharge(value: unknown): value is RawCharge {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function fallbackLine(row: InvoiceRow): ContinuousPrintLine {
  return lineFromCharge({
    description: row.description || row.charge_type,
    quantity: row.quantity,
    unit_price: row.unit_price,
    subtotal: row.total_amount,
    container_number: row.container_number,
  }, row);
}

function buildLines(row: InvoiceRow, notes: ParsedNotes): ContinuousPrintLine[] {
  if (Array.isArray(notes.charges) && notes.charges.length > 0) {
    const lines = notes.charges
      .filter(isRawCharge)
      .map((charge) => lineFromCharge(charge, row));
    return lines.length > 0 ? lines : [fallbackLine(row)];
  }

  return [fallbackLine(row)];
}

function documentTitle(type: string, row: InvoiceRow) {
  const invoiceNumber = asString(row.invoice_number);
  const isCreditNote = row.status === 'credit_note' || row.document_type === 'credit_note' || invoiceNumber.startsWith('CN-');
  if (isCreditNote) return 'ใบลดหนี้';
  if (type === 'receipt' || type === 'tax_invoice_receipt') return 'ใบกำกับภาษี/ใบเสร็จรับเงิน';
  return 'ใบกำกับภาษี/ใบแจ้งหนี้';
}

function taxInvoiceNumberFor(row: InvoiceRow, notes: ParsedNotes, invoiceNumber: string) {
  return asString(row.tax_invoice_number || notes.tax_invoice_number || invoiceNumber);
}

function documentNumberFor(type: string, receiptNumber: string, taxInvoiceNumber: string, invoiceNumber: string) {
  if ((type === 'receipt' || type === 'tax_invoice_receipt') && receiptNumber) return receiptNumber;
  if (type === 'tax_invoice_receipt' && taxInvoiceNumber) return taxInvoiceNumber;
  return invoiceNumber;
}

function documentDateFor(type: string, row: InvoiceRow) {
  const explicitDate = dateText(row.document_date || row.issue_date);
  if (explicitDate) return explicitDate;
  if ((type === 'receipt' || type === 'tax_invoice_receipt') && row.paid_at) return dateText(row.paid_at);
  return dateText(row.created_at);
}

function normalizePayload(row: InvoiceRow, type: string): ContinuousPrintPayload {
  const notes = parseNotes(row.notes);
  const lines = buildLines(row, notes);
  const subtotal = money(row.total_amount, lines.reduce((sum, line) => sum + line.amount, 0));
  const vatAmount = money(row.vat_amount, 0);
  const grandTotal = money(row.grand_total, subtotal + vatAmount);
  const vatRate = subtotal === 0 ? 0 : Number((vatAmount / subtotal).toFixed(4));
  const receiptNumber = asString(row.receipt_number);
  const invoiceNumber = asString(row.invoice_number);
  const taxInvoiceNumber = taxInvoiceNumberFor(row, notes, invoiceNumber);
  const documentNumber = documentNumberFor(type, receiptNumber, taxInvoiceNumber, invoiceNumber);
  const companyName = asString(row.company_name, DEFAULT_COMPANY.name);
  const customerName = asString(row.customer_name, 'ลูกค้าทั่วไป');
  const issueDate = documentDateFor(type, row);
  const customerBranchType = asString(row.customer_branch_type, 'head_office');
  const customerBranchNumber = asString(row.customer_branch_number, '00000');

  return {
    company: {
      ...DEFAULT_COMPANY,
      name: companyName,
      company_name: companyName,
      tax_id: asString(row.company_tax_id),
      address: asString(row.company_address),
      phone: asString(row.company_phone),
      email: asString(row.company_email),
      logo_url: asString(row.company_logo_url),
      branch_type: asString(row.yard_branch_type, DEFAULT_COMPANY.branch_type),
      branch_number: asString(row.yard_branch_number, DEFAULT_COMPANY.branch_number),
      yard_name: asString(row.yard_name),
      yard_code: asString(row.yard_code),
    },
    customer: {
      name: customerName,
      customer_name: customerName,
      tax_id: asString(row.customer_tax_id),
      address: asString(row.customer_address),
      branch_type: customerBranchType,
      branch_number: customerBranchNumber,
      branch_name: branchName(customerBranchType, customerBranchNumber),
    },
    document: {
      document_title: documentTitle(type, row),
      document_type: type,
      invoice_id: asNumber(row.invoice_id),
      invoice_number: invoiceNumber,
      tax_invoice_number: taxInvoiceNumber,
      receipt_number: receiptNumber,
      document_number: documentNumber,
      reference_no: asString(row.reference_no || notes.reference_no || row.booking_number || row.ref_invoice_number),
      red_ref_no: asString(row.red_ref_no || notes.red_ref_no),
      issue_date: issueDate,
      document_date: issueDate,
      due_date: dateText(row.due_date),
      paid_at: dateText(row.paid_at),
      status: asString(row.status),
      ref_invoice_number: asString(row.ref_invoice_number || notes.ref_invoice_number),
      replaces_invoice_number: asString(row.replaces_invoice_number),
    },
    lines,
    totals: {
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      grand_total: grandTotal,
      amount_text_th: amountToThaiBahtText(grandTotal),
    },
    payment: {
      method: asString(notes.payment_method),
      status: asString(notes.payment_status || (type === 'receipt' ? 'paid' : row.status)),
      receipt_number: receiptNumber,
      paid_at: dateText(row.paid_at),
      cheque_no: asString(row.cheque_no || notes.cheque_no),
      bank_name: asString(row.bank_name || notes.bank_name),
      cheque_date: dateText(row.cheque_date || notes.cheque_date),
      payment_ref: asString(row.payment_ref || notes.payment_ref),
      collector_name: asString(row.collector_name || notes.collector_name),
    },
  };
}

export async function buildContinuousPrintPayload(
  db: DbLike,
  options: { invoiceId: number; type: string }
): Promise<ContinuousPrintPayload> {
  const result = await db.request()
    .input('invoiceId', sql.Int, options.invoiceId)
    .query<InvoiceRow>(`
      SELECT TOP 1
        i.*,
        ref.invoice_number AS ref_invoice_number,
        repl.invoice_number AS replaces_invoice_number,
        c.customer_name,
        c.tax_id AS customer_tax_id,
        c.address AS customer_address,
        ISNULL(c.branch_type, 'head_office') AS customer_branch_type,
        ISNULL(c.branch_number, '00000') AS customer_branch_number,
        ct.container_number,
        y.yard_name,
        y.yard_code,
        ISNULL(y.branch_type, 'head_office') AS yard_branch_type,
        ISNULL(y.branch_number, '00000') AS yard_branch_number,
        cp.company_name AS company_name,
        cp.tax_id AS company_tax_id,
        cp.address AS company_address,
        cp.phone AS company_phone,
        cp.email AS company_email,
        cp.logo_url AS company_logo_url
      FROM Invoices i
      LEFT JOIN Invoices ref ON i.ref_invoice_id = ref.invoice_id
      LEFT JOIN Invoices repl ON i.replaces_invoice_id = repl.invoice_id
      LEFT JOIN Customers c ON i.customer_id = c.customer_id
      LEFT JOIN Containers ct ON i.container_id = ct.container_id
      LEFT JOIN Yards y ON i.yard_id = y.yard_id
      OUTER APPLY (
        SELECT TOP 1
          company_name,
          tax_id,
          address,
          phone,
          email,
          logo_url
        FROM CompanyProfile
        ORDER BY company_id ASC
      ) cp
      WHERE i.invoice_id = @invoiceId
      ORDER BY i.created_at DESC
    `);

  const row = result.recordset[0];
  if (!row) throw new Error('Invoice not found');

  return normalizePayload(row, options.type);
}

export async function buildSampleContinuousPrintPayloadWithCompanyProfile(
  db: DbLike,
): Promise<ContinuousPrintPayload> {
  const result = await db.request()
    .query<InvoiceRow>(`
      SELECT TOP 1
        company_name,
        tax_id,
        address,
        phone,
        email,
        logo_url,
        ISNULL(branch_type, 'head_office') AS branch_type,
        ISNULL(branch_number, '00000') AS branch_number
      FROM CompanyProfile
      ORDER BY company_id ASC
    `);

  return mergeCompanyProfileIntoContinuousPrintPayload(
    buildStaticSampleContinuousPrintPayload(),
    result.recordset[0],
  );
}
