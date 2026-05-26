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
  is_soc?: boolean | number;
  container_owner_id?: number | null;
  tare_weight_kg?: number | null;
  max_gross_weight_kg?: number | null;
  boxtech_group_st?: string | null;
  boxtech_source?: string | null;
  boxtech_fetched_at?: string | null;
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

export type BillingClearanceType = 'paid' | 'credit' | 'no_charge' | 'waived';

export interface BillingClearance {
  clearance_id: number;
  clearance_type: BillingClearanceType;
  reason?: string;
  invoice_id?: number | null;
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

export interface GateOutBooking {
  booking_id: number;
  booking_number: string;
  booking_type?: string;
  vessel_name?: string;
  voyage_number?: string;
  status: string;
  customer_id?: number;
  customer_name?: string;
  booking_customer_id?: number | null;
  shipping_line_id?: number | null;
  forwarder_id?: number | null;
  shipper_id?: number | null;
  consignee_id?: number | null;
  trucking_company_id?: number | null;
  bill_to_customer_id?: number | null;
  booking_customer_name?: string | null;
  shipping_line_name?: string | null;
  forwarder_name?: string | null;
  shipper_name?: string | null;
  consignee_name?: string | null;
  trucking_company_name?: string | null;
  bill_to_customer_name?: string | null;
  container_count: number;
  container_size?: string;
  container_type?: string;
  received_count?: number;
  released_count?: number;
  linked_containers?: number;
  received_containers?: number;
  released_containers?: number;
}

export interface GateOutRequest {
  request_id: number;
  yard_id: number;
  container_id: number;
  container_number: string;
  size?: string;
  type?: string;
  shipping_line?: string;
  container_status?: string;
  zone_id?: number | null;
  zone_name?: string | null;
  bay?: number | null;
  row?: number | null;
  tier?: number | null;
  gate_in_date?: string | null;
  container_owner_id?: number | null;
  booking_id?: number | null;
  booking_ref?: string | null;
  booking_number?: string | null;
  booking_status?: string | null;
  customer_id?: number | null;
  booking_customer_id?: number | null;
  shipping_line_id?: number | null;
  forwarder_id?: number | null;
  shipper_id?: number | null;
  consignee_id?: number | null;
  trucking_company_id?: number | null;
  bill_to_customer_id?: number | null;
  booking_customer_name?: string | null;
  shipping_line_name?: string | null;
  forwarder_name?: string | null;
  shipper_name?: string | null;
  consignee_name?: string | null;
  trucking_company_name?: string | null;
  bill_to_customer_name?: string | null;
  container_count?: number | null;
  container_size?: string | null;
  container_type?: string | null;
  received_count?: number | null;
  released_count?: number | null;
  billing_customer_id?: number | null;
  billing_clearance_id?: number | null;
  clearance_type?: BillingClearanceType | null;
  clearance_invoice_id?: number | null;
  work_order_id?: number | null;
  work_order_status?: string | null;
  status?: 'requested' | 'moving' | 'at_gate' | 'released' | 'cancelled' | string;
  display_status?: 'requested' | 'moving' | 'at_gate' | 'released' | 'cancelled' | string;
  driver_name?: string | null;
  driver_license?: string | null;
  truck_plate?: string | null;
  seal_number?: string | null;
  notes?: string | null;
  requested_at?: string | null;
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
