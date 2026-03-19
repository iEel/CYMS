// ===================================
// User & Auth Types
// ===================================
export interface User {
  user_id: number;
  username: string;
  password_hash?: string;
  full_name: string;
  role: UserRole;
  email: string;
  phone: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export type UserRole =
  | 'yard_manager'
  | 'gate_clerk'
  | 'surveyor'
  | 'rs_driver'
  | 'billing_officer'
  | 'customer';

export interface AuthSession {
  userId: number;
  username: string;
  fullName: string;
  role: UserRole;
  yardIds: number[];
  activeYardId: number;
  token: string;
}

// ===================================
// Yard Types
// ===================================
export interface Yard {
  yard_id: number;
  yard_name: string;
  yard_code: string;
  address: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  created_at: string;
}

export interface YardZone {
  zone_id: number;
  yard_id: number;
  zone_name: string;
  zone_type: ZoneType;
  max_tier: number;
  max_bay: number;
  max_row: number;
  size_restriction: string;
  has_reefer_plugs: boolean;
}

export type ZoneType = 'dry' | 'reefer' | 'hazmat' | 'empty' | 'repair' | 'wash';

// ===================================
// Container Types
// ===================================
export interface Container {
  container_id: number;
  container_number: string;
  size: ContainerSize;
  type: ContainerType;
  status: ContainerStatus;
  yard_id: number;
  zone_id?: number;
  bay?: number;
  row?: number;
  tier?: number;
  shipping_line: string;
  is_laden: boolean;
  seal_number?: string;
  gate_in_date?: string;
  gate_out_date?: string;
  created_at: string;
  updated_at: string;
}

export type ContainerSize = '20' | '40' | '45';
export type ContainerType = 'GP' | 'HC' | 'RF' | 'OT' | 'FR' | 'TK';
export type ContainerStatus =
  | 'available'
  | 'in_yard'
  | 'in_transit'
  | 'under_repair'
  | 'gated_out'
  | 'hold';

// ===================================
// Audit Log
// ===================================
export interface AuditLog {
  log_id: number;
  user_id: number;
  yard_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  details: string;
  ip_address?: string;
  device_info?: string;
  created_at: string;
}

// ===================================
// Dashboard KPI
// ===================================
export interface DashboardKPI {
  totalContainers: number;
  yardOccupancy: number;
  pendingGateIn: number;
  todayRevenue: number;
  totalContainersChange: number;
  yardOccupancyChange: number;
  pendingGateInChange: number;
  todayRevenueChange: number;
}

// ===================================
// Navigation
// ===================================
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
  children?: NavItem[];
}

// ===================================
// Gate Transaction Types
// ===================================
export interface GateTransaction {
  transaction_id: number;
  container_id: number;
  yard_id: number;
  transaction_type: 'gate_in' | 'gate_out';
  driver_name: string;
  driver_license: string;
  truck_plate: string;
  seal_number: string;
  booking_ref: string;
  eir_number: string;
  notes: string;
  damage_report?: string; // JSON
  processed_by: number;
  created_at: string;
  // Joined fields
  container_number?: string;
  size?: string;
  type?: string;
  shipping_line?: string;
  full_name?: string;
}

export interface DamagePoint {
  side: 'front' | 'back' | 'left' | 'right' | 'top' | 'floor';
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  type: string; // 'dent','hole','rust','scratch','crack','missing_part'
  severity: 'minor' | 'major' | 'severe';
  note?: string;
}

export interface DamageReport {
  points: DamagePoint[];
  condition_grade: 'A' | 'B' | 'C' | 'D';
  inspector_notes: string;
}

export interface EIRData {
  eir_number: string;
  transaction_type: 'gate_in' | 'gate_out';
  date: string;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  seal_number: string;
  is_laden: boolean;
  driver_name: string;
  driver_license: string;
  truck_plate: string;
  booking_ref: string;
  yard_name: string;
  zone_name?: string;
  bay?: number;
  row?: number;
  tier?: number;
  processed_by: string;
  damage_report?: DamageReport;
  notes: string;
}

// ===================================
// Work Order Types
// ===================================
export type WorkOrderType = 'move' | 'gate_in' | 'gate_out' | 'shift' | 'restack';
export type WorkOrderStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface WorkOrder {
  order_id: number;
  yard_id: number;
  order_type: WorkOrderType;
  container_id: number;
  from_zone_id?: number;
  from_bay?: number;
  from_row?: number;
  from_tier?: number;
  to_zone_id?: number;
  to_bay?: number;
  to_row?: number;
  to_tier?: number;
  priority: number; // 1=urgent, 2=high, 3=normal, 4=low
  status: WorkOrderStatus;
  assigned_to?: number;
  notes?: string;
  created_by?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  // Joined fields
  container_number?: string;
  size?: string;
  type?: string;
  shipping_line?: string;
  from_zone_name?: string;
  to_zone_name?: string;
  assigned_name?: string;
  created_name?: string;
}

// ===================================
// Booking Types (EDI)
// ===================================
export type BookingType = 'import' | 'export' | 'empty_pickup' | 'empty_return';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Booking {
  booking_id: number;
  booking_number: string;
  yard_id: number;
  customer_id?: number;
  booking_type: BookingType;
  vessel_name?: string;
  voyage_number?: string;
  container_count: number;
  container_size?: string;
  container_type?: string;
  eta?: string;
  status: BookingStatus;
  seal_number?: string;
  notes?: string;
  created_at: string;
  // Joined
  customer_name?: string;
}

// ===================================
// Repair Order Types (M&R)
// ===================================
export type EORStatus = 'draft' | 'pending_approval' | 'approved' | 'in_repair' | 'completed' | 'rejected';

export interface RepairOrder {
  eor_id: number;
  eor_number: string;
  container_id: number;
  yard_id: number;
  customer_id?: number;
  damage_details?: string; // JSON
  estimated_cost: number;
  actual_cost?: number;
  status: EORStatus;
  approved_by?: string;
  approved_at?: string;
  created_by?: number;
  created_at: string;
  // Joined
  container_number?: string;
  size?: string;
  type?: string;
  customer_name?: string;
  created_name?: string;
}

export interface CEDEXCode {
  code: string;
  component: string;
  damage: string;
  repair: string;
  labor_hours: number;
  material_cost: number;
}

// ===================================
// Billing Types
// ===================================
export type ChargeType = 'storage' | 'lolo' | 'mnr' | 'washing' | 'pti' | 'reefer' | 'other';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled' | 'credit_note';

export interface Tariff {
  tariff_id: number;
  yard_id: number;
  charge_type: ChargeType;
  description: string;
  rate: number;
  unit: string; // 'per_day','per_move','per_container','fixed'
  free_days: number;
  customer_id?: number;
  is_active: boolean;
  created_at: string;
  customer_name?: string;
}

export interface Invoice {
  invoice_id: number;
  invoice_number: string;
  yard_id: number;
  customer_id: number;
  container_id?: number;
  charge_type: ChargeType;
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  vat_amount: number;
  grand_total: number;
  status: InvoiceStatus;
  due_date?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
  // Joined
  customer_name?: string;
  container_number?: string;
}
