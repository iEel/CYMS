export interface ClearanceRow {
  clearance_id: number;
  transaction_type: 'gate_in' | 'gate_out';
  container_number: string;
  customer_name: string;
  clearance_type: 'paid' | 'credit' | 'no_charge' | 'waived';
  original_amount: number;
  final_amount: number;
  reason?: string;
  invoice_id?: number;
  invoice_number?: string;
  invoice_status?: string;
  transaction_id?: number;
  eir_number?: string;
  booking_ref?: string;
  approved_by_name?: string;
  created_by_name?: string;
  created_at: string;
}

export interface ClearanceStats {
  total_count: number;
  paid_count: number;
  credit_count: number;
  no_charge_count: number;
  waived_count: number;
  paid_amount: number;
  credit_amount: number;
  waived_amount: number;
  gate_in_amount: number;
  gate_out_amount: number;
}

export interface CreditCustomer {
  customer_id: number;
  customer_name: string;
  default_payment_type: string;
  credit_term: number;
  credit_limit: number;
  credit_hold: boolean;
  credit_hold_reason?: string;
  outstanding_amount: number;
  oldest_overdue_days: number;
  is_credit: boolean;
  over_limit: boolean;
  has_overdue: boolean;
}

export interface BillingControlRow {
  row_type: 'clearance' | 'missing_clearance' | 'outstanding_invoice' | 'credit_note';
  severity: 'ok' | 'watch' | 'review' | 'danger';
  event_at: string;
  transaction_type?: 'gate_in' | 'gate_out' | null;
  container_number?: string | null;
  customer_name?: string | null;
  eir_number?: string | null;
  booking_ref?: string | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  control_type: string;
  original_amount: number;
  final_amount: number;
  impact_amount: number;
  reason?: string | null;
  actor_name?: string | null;
  title: string;
}

export interface BillingControlReport {
  type: 'control';
  period_type: string;
  date_from: string;
  date_to: string;
  summary: {
    paid_count: number;
    credit_count: number;
    no_charge_count: number;
    waived_count: number;
    paid_amount: number;
    credit_amount: number;
    waived_amount: number;
    no_charge_amount: number;
    missing_clearance_count: number;
    outstanding_invoice_count: number;
    outstanding_amount: number;
    credit_note_count: number;
    credit_note_amount: number;
  };
  rows: BillingControlRow[];
}

export interface ARCustomer {
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_trucking: boolean;
  is_forwarder: boolean;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d90plus: number;
  total: number;
  invoice_count: number;
  oldest_days: number;
}
