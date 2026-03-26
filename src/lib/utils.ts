import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Date/Time formatting — dd/mm/yyyy, Asia/Bangkok (UTC+7), 24-hour
 */
const TZ = 'Asia/Bangkok';

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }); // → 19/03/2026
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const datePart = d.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ,
  });
  const timePart = d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
  });
  return `${datePart} ${timePart}`; // → 19/03/2026 14:30
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: TZ,
  }); // → 14:30:00
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit', timeZone: TZ,
  }); // → 19 มี.ค. 69
}

export function formatContainerNumber(num: string): string {
  // ISO 6346 format: XXXX 123456-7
  if (num.length === 11) {
    return `${num.slice(0, 4)} ${num.slice(4, 10)}-${num.slice(10)}`;
  }
  return num;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'bg-emerald-500',
    in_yard: 'bg-blue-500',
    in_transit: 'bg-amber-500',
    under_repair: 'bg-rose-500',
    gated_out: 'bg-gray-400',
    pending: 'bg-amber-500',
    approved: 'bg-emerald-500',
    rejected: 'bg-rose-500',
    hold: 'bg-rose-600',
  };
  return colors[status] || 'bg-gray-400';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: 'พร้อมใช้งาน',
    in_yard: 'อยู่ในลาน',
    in_transit: 'กำลังขนส่ง',
    under_repair: 'กำลังซ่อม',
    gated_out: 'ออกจากลานแล้ว',
    pending: 'รอดำเนินการ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ',
    hold: 'ระงับ',
  };
  return labels[status] || status;
}

/**
 * Calculate dwell days using Calendar Days method.
 * วันเข้า = Day 1 (นับวันเข้าเป็นวันแรก)
 * ตัดเวลาออก ใช้เฉพาะวันที่ เทียบกัน
 * เช่น เข้า 1 มี.ค. → วันนี้ 1 มี.ค. = 1 วัน
 */
export function calcDwellDays(gateInDate: string | Date): number {
  const start = new Date(gateInDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1);
}
