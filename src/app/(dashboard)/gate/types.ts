// Shared types for Gate module components

export interface Transaction {
  transaction_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  transaction_type: 'gate_in' | 'gate_out' | 'transfer' | 'transfer_in';
  driver_name: string;
  truck_plate: string;
  eir_number: string;
  created_at: string;
  full_name: string;
}

export interface ContainerResult {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  status: string;
  zone_name?: string;
  zone_id?: number;
  bay?: number;
  row?: number;
  tier?: number;
  gate_in_date?: string;
}

export interface BillingCharge {
  charge_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  free_days: number;
  billable_days: number;
}

export interface BillingData {
  container: Record<string, unknown>;
  customer: { customer_id: number; customer_name: string; credit_term: number } | null;
  owner?: { customer_id: number; customer_name: string; credit_term: number } | null;
  billing_customer?: { customer_id: number; customer_name: string; credit_term: number } | null;
  is_credit: boolean;
  credit_term: number;
  charges: BillingCharge[];
  summary: { total_before_vat: number; vat_rate: number; vat_amount: number; grand_total: number };
  existing_invoices: { invoice_id: number; invoice_number: string; grand_total: number; status: string }[];
  paid_invoices?: { invoice_id: number; invoice_number: string; grand_total: number; status: string; paid_at: string }[];
  already_paid?: boolean;
  has_hold: boolean;
}

export interface GateInBillingData {
  customer: { customer_id: number; customer_name: string; credit_term: number; tax_id?: string } | null;
  is_credit: boolean;
  credit_term: number;
  charges: BillingCharge[];
  summary: { total_before_vat: number; vat_rate: number; vat_amount: number; grand_total: number };
}

// Shared CSS class constants
export const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
export const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

// Optional charges that are unchecked by default
export const OPTIONAL_CHARGES = ['washing', 'pti', 'reefer', 'mnr'];
