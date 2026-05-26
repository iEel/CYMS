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
    company_name: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
    branch_type: string;
    branch_number: string;
    yard_name: string;
    yard_code: string;
  };
  customer: {
    name: string;
    customer_name: string;
    tax_id: string;
    address: string;
    branch_type: string;
    branch_number: string;
    branch_name: string;
  };
  document: {
    document_title: string;
    document_type: string;
    invoice_id: number;
    invoice_number: string;
    tax_invoice_number: string;
    receipt_number: string;
    document_number: string;
    issue_date: string;
    document_date: string;
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
