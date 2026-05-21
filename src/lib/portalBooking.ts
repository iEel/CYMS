export type PortalEtaCode = 'none' | 'completed' | 'overdue' | 'today' | 'soon' | 'scheduled';
export type PortalTone = 'slate' | 'emerald' | 'rose' | 'amber' | 'blue';

export interface PortalEtaStatus {
  code: PortalEtaCode;
  label: string;
  tone: PortalTone;
  days: number | null;
}

export interface PortalEmptyReturnInstruction {
  title: string;
  cut_off_date: string | null;
  cut_off_status: 'open' | 'due_today' | 'expired' | 'none';
  steps: string[];
}

export interface PortalBookingLike {
  booking_number?: string | null;
  booking_type?: string | null;
  status?: string | null;
  eta?: string | null;
  valid_to?: string | null;
  vessel_name?: string | null;
  voyage_number?: string | null;
  [key: string]: unknown;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayDiff(target: Date, now: Date) {
  const ms = startOfDay(target).getTime() - startOfDay(now).getTime();
  return Math.round(ms / 86_400_000);
}

export function deriveBookingEtaStatus(eta?: string | null, status?: string | null, now = new Date()): PortalEtaStatus {
  if (status === 'completed') {
    return { code: 'completed', label: 'Completed', tone: 'emerald', days: null };
  }

  const etaDate = parseDate(eta);
  if (!etaDate) {
    return { code: 'none', label: 'No ETA', tone: 'slate', days: null };
  }

  const days = dayDiff(etaDate, now);
  if (days < 0) return { code: 'overdue', label: `${Math.abs(days)} day overdue`, tone: 'rose', days };
  if (days === 0) return { code: 'today', label: 'ETA today', tone: 'amber', days };
  if (days <= 3) return { code: 'soon', label: `ETA in ${days} day${days === 1 ? '' : 's'}`, tone: 'blue', days };
  return { code: 'scheduled', label: `ETA in ${days} days`, tone: 'slate', days };
}

export function buildEmptyReturnInstruction(booking: PortalBookingLike, now = new Date()): PortalEmptyReturnInstruction | null {
  if (booking.booking_type !== 'empty_return') return null;

  const cutOff = parseDate(booking.valid_to);
  const cutOffDays = cutOff ? dayDiff(cutOff, now) : null;
  const vessel = [booking.vessel_name, booking.voyage_number].filter(Boolean).join(' ');
  const bookingNumber = booking.booking_number || 'booking นี้';
  const cutOffStatus: PortalEmptyReturnInstruction['cut_off_status'] =
    cutOffDays === null ? 'none' : cutOffDays < 0 ? 'expired' : cutOffDays === 0 ? 'due_today' : 'open';

  return {
    title: 'Empty Return Instruction',
    cut_off_date: booking.valid_to || null,
    cut_off_status: cutOffStatus,
    steps: [
      `คืนตู้เปล่าพร้อมเลข booking ${bookingNumber}`,
      vessel ? `อ้างอิงเรือ/เที่ยว ${vessel}` : 'ตรวจสอบเรือ/เที่ยวกับเอกสาร booking ก่อนเข้าประตู',
      cutOff ? `คืนภายในวันที่ ${cutOff.toLocaleDateString('th-TH')}` : 'ตรวจ cut-off กับทีมลานก่อนนำตู้เข้าคืน',
      'นำ EIR/เลขตู้/ทะเบียนรถให้ครบ และถ่ายรูปสภาพตู้ก่อนส่งมอบ',
    ],
  };
}

export function decoratePortalBooking<T extends PortalBookingLike>(booking: T, now = new Date()) {
  return {
    ...booking,
    eta_status: deriveBookingEtaStatus(booking.eta, booking.status, now),
    empty_return_instruction: buildEmptyReturnInstruction(booking, now),
  };
}

export function decoratePortalBookings<T extends PortalBookingLike>(bookings: T[], now = new Date()) {
  return bookings.map(booking => decoratePortalBooking(booking, now));
}
