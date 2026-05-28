'use client';

import { ClipboardCheck, Clock, FileText, Receipt } from 'lucide-react';
import { calcDwellDays, formatShortDate } from '@/lib/utils';

interface YardSelectedContainer {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  status: string;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  shipping_line: string;
  is_laden: boolean;
  gate_in_date: string;
  container_grade?: string;
  hold_status?: string | null;
  booking_ref?: string | null;
}

interface YardSelectedContainerPanelProps {
  container: YardSelectedContainer;
  onOpenDetail: (containerId: number) => void;
  onOpenTimeline: (containerId: number) => void;
  onClearSelection: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  in_yard: { label: 'ในลาน', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  hold: { label: 'ค้างจ่าย', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  repair: { label: 'ซ่อม', color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
  gated_out: { label: 'ปล่อยแล้ว', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  released: { label: 'ปล่อยแล้ว', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  available: { label: 'ว่าง', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
};

const GRADE_INFO: Record<string, { color: string; bg: string }> = {
  A: { color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
  B: { color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
  C: { color: 'text-orange-700', bg: 'bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400' },
  D: { color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
};

export default function YardSelectedContainerPanel({
  container,
  onOpenDetail,
  onOpenTimeline,
  onClearSelection,
}: YardSelectedContainerPanelProps) {
  const selectedStatus = STATUS_LABELS[container.status] || STATUS_LABELS.available;
  const selectedGrade = (container.container_grade || 'A').toUpperCase();
  const selectedGradeInfo = GRADE_INFO[selectedGrade] || GRADE_INFO.A;
  const selectedDwellDays = container.gate_in_date ? calcDwellDays(container.gate_in_date) : null;
  const selectedLocation = container.bay && container.row && container.tier
    ? `Zone ${container.zone_name} • B${container.bay}-R${container.row}-T${container.tier}`
    : `Zone ${container.zone_name || '—'} • ยังไม่ระบุพิกัด`;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ตู้ที่เลือกในลาน</span>
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${selectedStatus.color}`}>
              {selectedStatus.label}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${selectedGradeInfo.bg} ${selectedGradeInfo.color}`}>
              Grade {selectedGrade}
            </span>
            {container.hold_status && (
              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Hold: {container.hold_status}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-mono text-xl font-bold text-slate-800 dark:text-white">{container.container_number}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {container.size}&apos;{container.type} • {container.shipping_line || '—'} • {container.is_laden ? 'มีสินค้า' : 'ตู้เปล่า'}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2">
              <p className="text-slate-400">พิกัด</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-700 dark:text-slate-200">{selectedLocation}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2">
              <p className="text-slate-400">เข้าลาน</p>
              <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-200">
                {container.gate_in_date ? formatShortDate(container.gate_in_date) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2">
              <p className="text-slate-400">อยู่ในลาน</p>
              <p className="mt-0.5 font-semibold text-slate-700 dark:text-slate-200">
                {selectedDwellDays ? `${selectedDwellDays} วัน` : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2">
              <p className="text-slate-400">Booking</p>
              <p className="mt-0.5 truncate font-semibold text-slate-700 dark:text-slate-200">
                {container.booking_ref || '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end">
          <button
            type="button"
            onClick={() => onOpenDetail(container.container_id)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <FileText size={14} /> เปิดรายละเอียด
          </button>
          <button
            type="button"
            onClick={() => onOpenTimeline(container.container_id)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-50 px-3 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300"
          >
            <Clock size={14} /> Timeline
          </button>
          <button
            type="button"
            disabled={!container.booking_ref}
            onClick={() => {
              if (container.booking_ref) {
                window.location.href = `/booking?search=${encodeURIComponent(container.booking_ref)}`;
              }
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            <ClipboardCheck size={14} /> Booking
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = `/billing?search=${encodeURIComponent(container.container_number)}`; }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-50 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300"
          >
            <Receipt size={14} /> Billing
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
