import sql from 'mssql';
import { amountToThaiBahtText } from '@/lib/thaiBahtText';

export type ContinuousPrintLine = {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
  container_refs?: string[];
  job_refs?: string[];
};

export type ContinuousPrintPayload = {
  company: {
    name: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
    branch_type: string;
    branch_number: string;
    yard_name: string;
    yard_code: string;
  };
  customer: {
    name: string;
    tax_id: string;
    address: string;
    branch_type: string;
    branch_number: string;
  };
  document: {
    document_title: string;
    document_type: string;
    invoice_id: number;
    invoice_number: string;
    receipt_number: string;
    document_number: string;
    issue_date: string;
    due_date: string;
    paid_at: string;
    status: string;
    ref_invoice_number: string;
    replaces_invoice_number: string;
  };
  lines: ContinuousPrintLine[];
  totals: {
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    grand_total: number;
    amount_text_th: string;
  };
  payment: {
    method: string;
    status: string;
    receipt_number: string;
    paid_at: string;
  };
};

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
  document_type?: unknown;
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
  branch_type: 'head_office',
  branch_number: '00000',
  yard_name: '',
  yard_code: '',
};

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

function buildLines(row: InvoiceRow, notes: ParsedNotes): ContinuousPrintLine[] {
  if (Array.isArray(notes.charges) && notes.charges.length > 0) {
    return notes.charges.map((charge) => lineFromCharge(charge as RawCharge, row));
  }

  return [lineFromCharge({
    description: row.description || row.charge_type,
    quantity: row.quantity,
    unit_price: row.unit_price,
    subtotal: row.total_amount,
    container_number: row.container_number,
  }, row)];
}

function documentTitle(type: string, row: InvoiceRow) {
  const invoiceNumber = asString(row.invoice_number);
  const isCreditNote = row.status === 'credit_note' || row.document_type === 'credit_note' || invoiceNumber.startsWith('CN-');
  if (isCreditNote) return 'ใบลดหนี้';
  if (type === 'receipt') return 'ใบเสร็จรับเงิน / ใบกำกับภาษี';
  return 'ใบกำกับภาษี / ใบแจ้งหนี้';
}

function normalizePayload(row: InvoiceRow, type: string): ContinuousPrintPayload {
  const notes = parseNotes(row.notes);
  const lines = buildLines(row, notes);
  const subtotal = money(row.total_amount, lines.reduce((sum, line) => sum + line.amount, 0));
  const vatAmount = money(row.vat_amount, 0);
  const grandTotal = money(row.grand_total, subtotal + vatAmount);
  const vatRate = subtotal === 0 ? 0 : Number((vatAmount / subtotal).toFixed(4));
  const receiptNumber = asString(row.receipt_number);
  const documentNumber = type === 'receipt' && receiptNumber ? receiptNumber : asString(row.invoice_number);

  return {
    company: {
      ...DEFAULT_COMPANY,
      name: asString(row.company_name, DEFAULT_COMPANY.name),
      tax_id: asString(row.company_tax_id),
      address: asString(row.company_address),
      phone: asString(row.company_phone),
      email: asString(row.company_email),
      branch_type: asString(row.yard_branch_type, DEFAULT_COMPANY.branch_type),
      branch_number: asString(row.yard_branch_number, DEFAULT_COMPANY.branch_number),
      yard_name: asString(row.yard_name),
      yard_code: asString(row.yard_code),
    },
    customer: {
      name: asString(row.customer_name, 'ลูกค้าทั่วไป'),
      tax_id: asString(row.customer_tax_id),
      address: asString(row.customer_address),
      branch_type: asString(row.customer_branch_type, 'head_office'),
      branch_number: asString(row.customer_branch_number, '00000'),
    },
    document: {
      document_title: documentTitle(type, row),
      document_type: type,
      invoice_id: asNumber(row.invoice_id),
      invoice_number: asString(row.invoice_number),
      receipt_number: receiptNumber,
      document_number: documentNumber,
      issue_date: dateText(row.created_at),
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
    },
  };
}

export function buildSampleContinuousPrintPayload(): ContinuousPrintPayload {
  return normalizePayload({
    invoice_id: 7,
    invoice_number: 'INV-202605-000007',
    receipt_number: 'RCPT-202605-000007',
    status: 'issued',
    document_type: 'invoice',
    description: 'Storage charge',
    quantity: 2,
    unit_price: 500,
    total_amount: 1000,
    vat_amount: 70,
    grand_total: 1070,
    created_at: '2026-05-26T00:00:00.000Z',
    due_date: '2026-06-25T00:00:00.000Z',
    customer_name: 'ACME Logistics',
    customer_tax_id: '0105559000000',
    customer_address: '99 Test Road, Bangkok',
    customer_branch_type: 'head_office',
    customer_branch_number: '00000',
    container_number: 'TCLU1234567',
    yard_name: 'Bangkok Yard',
    yard_code: 'BKK',
  }, 'invoice');
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
        ISNULL(y.branch_number, '00000') AS yard_branch_number
      FROM Invoices i
      LEFT JOIN Invoices ref ON i.ref_invoice_id = ref.invoice_id
      LEFT JOIN Invoices repl ON i.replaces_invoice_id = repl.invoice_id
      LEFT JOIN Customers c ON i.customer_id = c.customer_id
      LEFT JOIN Containers ct ON i.container_id = ct.container_id
      LEFT JOIN Yards y ON i.yard_id = y.yard_id
      WHERE i.invoice_id = @invoiceId
      ORDER BY i.created_at DESC
    `);

  const row = result.recordset[0];
  if (!row) throw new Error('Invoice not found');

  return normalizePayload(row, options.type);
}
