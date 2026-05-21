import type { BillingControlRow } from './billingTypes';

export const CHARGE_LABELS_RPT: Record<string, string> = {
  storage: '📦 ค่าฝากตู้', lolo: '🏗️ ค่ายก LOLO', mnr: '🔧 ค่าซ่อม M&R',
  washing: '🫧 ค่าล้างตู้', pti: '🔌 ค่า PTI', reefer: '❄️ ค่าปลั๊กเย็น', other: '📋 อื่นๆ',
};

export const loadPdfExport = () => import('@/lib/pdfExport');

export function clearanceLabel(type: string) {
  const map: Record<string, { label: string; color: string }> = {
    paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-600' },
    credit: { label: 'Credit', color: 'bg-blue-50 text-blue-600' },
    no_charge: { label: 'No Charge', color: 'bg-slate-100 text-slate-600' },
    waived: { label: 'Waived', color: 'bg-amber-50 text-amber-600' },
  };
  return map[type] || { label: type, color: 'bg-slate-100 text-slate-500' };
}

export function controlSeverityBadge(severity: BillingControlRow['severity']) {
  const map: Record<BillingControlRow['severity'], { label: string; color: string }> = {
    ok: { label: 'OK', color: 'bg-emerald-50 text-emerald-600' },
    watch: { label: 'Watch', color: 'bg-blue-50 text-blue-600' },
    review: { label: 'Review', color: 'bg-amber-50 text-amber-600' },
    danger: { label: 'Action', color: 'bg-rose-50 text-rose-600' },
  };
  return map[severity] || map.review;
}

export function controlTypeLabel(type: string) {
  const map: Record<string, string> = {
    paid: 'Paid',
    credit: 'Credit',
    no_charge: 'No Charge',
    waived: 'Waived',
    missing_clearance: 'Missing Clearance',
    outstanding: 'Outstanding',
    credit_note: 'Credit Note',
  };
  return map[type] || type;
}
