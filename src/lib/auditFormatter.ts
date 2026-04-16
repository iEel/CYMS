export interface RawAuditLog {
  log_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  created_at: string;
  full_name?: string | null;
  username?: string | null;
}

export interface ReadableAuditLog extends RawAuditLog {
  actor_name: string;
  title: string;
  summary: string;
  fields: Array<{ label: string; value: string }>;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

const ACTIONS: Record<string, { title: string; tone: ReadableAuditLog['tone'] }> = {
  gate_in: { title: 'รับตู้เข้า Gate-In', tone: 'success' },
  gate_out: { title: 'ปล่อยตู้ออก Gate-Out', tone: 'info' },
  container_create: { title: 'สร้างข้อมูลตู้', tone: 'success' },
  container_update: { title: 'แก้ไขข้อมูลตู้', tone: 'warning' },
  invoice_create: { title: 'สร้างใบแจ้งหนี้', tone: 'info' },
  invoice_issue: { title: 'ออกใบแจ้งหนี้', tone: 'info' },
  invoice_pay: { title: 'บันทึกชำระเงิน', tone: 'success' },
  invoice_cancel: { title: 'ยกเลิกใบแจ้งหนี้', tone: 'danger' },
  credit_note_create: { title: 'สร้างใบลดหนี้', tone: 'warning' },
  billing_clearance_create: { title: 'บันทึก Billing Clearance', tone: 'info' },
  booking_create: { title: 'สร้าง Booking', tone: 'success' },
  booking_update: { title: 'แก้ไข Booking', tone: 'warning' },
  edi_send_success: { title: 'ส่ง EDI สำเร็จ', tone: 'success' },
  edi_send_failed: { title: 'ส่ง EDI ไม่สำเร็จ', tone: 'danger' },
  edi_auto_send_success: { title: 'ส่ง EDI อัตโนมัติสำเร็จ', tone: 'success' },
  edi_auto_send_failed: { title: 'ส่ง EDI อัตโนมัติไม่สำเร็จ', tone: 'danger' },
  mnr_create: { title: 'สร้างงานซ่อม M&R', tone: 'warning' },
  mnr_complete: { title: 'ซ่อมเสร็จ', tone: 'success' },
  yard_audit: { title: 'ตรวจนับลาน', tone: 'info' },
  container_move: { title: 'ย้ายตำแหน่งตู้', tone: 'warning' },
};

const FIELD_LABELS: Record<string, string> = {
  container_number: 'เลขตู้',
  invoice_number: 'เลขที่เอกสาร',
  cn_number: 'เลขที่ใบลดหนี้',
  ref_invoice: 'อ้างอิงใบเดิม',
  revised_invoice_number: 'ใบแจ้งหนี้ใหม่',
  customer_id: 'ลูกค้า',
  charge_type: 'ประเภทค่าบริการ',
  grand_total: 'ยอดรวม',
  credit_amount: 'ยอดลดหนี้',
  remaining_amount: 'ยอดคงเหลือ',
  clearance_type: 'ประเภท Clearance',
  transaction_type: 'ประเภทรายการ',
  original_amount: 'ยอดเดิม',
  final_amount: 'ยอดสุทธิ',
  booking_number: 'Booking',
  booking_type: 'ประเภท Booking',
  container_count: 'จำนวนตู้',
  status: 'สถานะ',
  container_grade: 'เกรดตู้',
  zone_id: 'โซน',
  bay: 'Bay',
  row: 'Row',
  tier: 'Tier',
  reason: 'เหตุผล',
  action: 'การทำงาน',
  error: 'ข้อผิดพลาด',
  filename: 'ไฟล์',
  record_count: 'จำนวนรายการ',
};

function parseDetails(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: raw };
  } catch {
    return { note: raw };
  }
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '-';
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function labelFor(key: string) {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

export function formatAuditLog(log: RawAuditLog): ReadableAuditLog {
  const details = parseDetails(log.details);
  const actionInfo = ACTIONS[log.action] || {
    title: log.action.replace(/_/g, ' '),
    tone: 'neutral' as const,
  };
  const actorName = log.full_name || log.username || 'ระบบ';
  const fields = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 12)
    .map(([key, value]) => ({ label: labelFor(key), value: stringifyValue(value) }));
  const summary = fields.length > 0
    ? fields.slice(0, 4).map(f => `${f.label}: ${f.value}`).join(' • ')
    : `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}`;

  return {
    ...log,
    actor_name: actorName,
    title: actionInfo.title,
    summary,
    fields,
    tone: actionInfo.tone,
  };
}

export function formatAuditLogs(logs: RawAuditLog[]) {
  return logs.map(formatAuditLog);
}
