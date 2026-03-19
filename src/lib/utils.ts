import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
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
