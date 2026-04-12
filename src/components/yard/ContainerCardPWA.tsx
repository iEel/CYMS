'use client';

import { useState } from 'react';
import {
  Search, MapPin, Package, Ship, ArrowUpFromLine, ClipboardCheck,
  ArrowRightLeft, ChevronDown, Box, Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { calcDwellDays } from '@/lib/utils';

interface ContainerCard {
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
}

interface Props {
  yardId: number;
  containers: ContainerCard[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  in_yard:  { label: 'ในลาน', color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  hold:     { label: 'ค้างจ่าย', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  repair:   { label: 'ซ่อม', color: 'text-rose-700', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  released: { label: 'ปล่อยแล้ว', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700' },
  in_transit: { label: 'ขนส่ง', color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

const GRADE_MAP: Record<string, { label: string; color: string; bg: string }> = {
  A: { label: 'สภาพดี', color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  B: { label: 'พอใช้', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  C: { label: 'ต้องซ่อม', color: 'text-orange-700', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  D: { label: 'Hold', color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30' },
};

export default function ContainerCardPWA({ containers }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = containers.filter(c => {
    if (search && !c.container_number.toLowerCase().includes(search.toLowerCase())
        && !c.shipping_line?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (gradeFilter && (c.container_grade || 'A').toUpperCase() !== gradeFilter) return false;
    return true;
  });

  const handleAction = () => {
    router.push('/gate');
  };

  return (
    <div className="space-y-3">
      {/* Search + Filter Bar - large touch targets */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขตู้ / สายเรือ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 dark:border-slate-600
              bg-white dark:bg-slate-700 text-base text-slate-800 dark:text-white outline-none
              focus:border-blue-500 transition-all"
          />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-12 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm appearance-none">
            <option value="">ทุกสถานะ</option>
            <option value="in_yard">ในลาน</option>
            <option value="hold">ค้างจ่าย</option>
            <option value="repair">ซ่อม</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
            className="h-12 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm appearance-none">
            <option value="">ทุกเกรด</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-400 flex items-center gap-1">
        <Package size={12} /> แสดง {Math.min(filtered.length, 30)} / {filtered.length} ตู้
      </p>

      {/* Container Cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">ไม่พบตู้ที่ค้นหา</div>
        )}
        {filtered.slice(0, 30).map(c => {
          const st = STATUS_MAP[c.status] || STATUS_MAP.in_yard;
          const grade = (c.container_grade || 'A').toUpperCase();
          const gradeInfo = GRADE_MAP[grade] || GRADE_MAP.A;
          const isSelected = selectedId === c.container_id;
          return (
            <div key={c.container_id}
              className={`bg-white dark:bg-slate-800 rounded-xl border transition-all ${
                isSelected
                  ? 'border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              onClick={() => setSelectedId(isSelected ? null : c.container_id)}>

              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Container icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      c.is_laden ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                    }`}>
                      <Box size={24} />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-lg text-slate-800 dark:text-white">{c.container_number}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono">{c.size}&apos;{c.type}</span>
                        {c.shipping_line && <><Ship size={10} /> {c.shipping_line}</>}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${st.color} ${st.bg}`}>
                    {st.label}
                  </span>
                </div>

                {/* Location bar */}
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-blue-400" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{c.zone_name || '—'}</span>
                  </span>
                  <span className="font-mono bg-slate-50 dark:bg-slate-700/50 px-2 py-0.5 rounded">
                    {c.bay && c.row && c.tier ? `B${c.bay}-R${c.row}-T${c.tier}` : '—'}
                  </span>
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    c.is_laden ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {c.is_laden ? 'LADEN' : 'EMPTY'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeInfo.color} ${gradeInfo.bg}`}>
                    Grade {grade}
                  </span>
                  {c.gate_in_date && (() => {
                    const days = calcDwellDays(c.gate_in_date);
                    const color = days <= 7 ? 'text-emerald-700 bg-emerald-100' : days <= 14 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';
                    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 ${color}`}><Clock size={10} />{days} วัน</span>;
                  })()}
                </div>
              </div>

              {/* Action Buttons (shown when selected) */}
              {isSelected && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleAction(); }}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 transition-colors active:scale-95">
                      <ArrowUpFromLine size={22} />
                      <span className="text-[10px] font-semibold">ปล่อยออก</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleAction(); }}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 hover:bg-violet-100 transition-colors active:scale-95">
                      <ClipboardCheck size={22} />
                      <span className="text-[10px] font-semibold">ตรวจสภาพ</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleAction(); }}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100 transition-colors active:scale-95">
                      <ArrowRightLeft size={22} />
                      <span className="text-[10px] font-semibold">ย้ายลาน</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 30 && (
        <p className="text-center text-xs text-slate-400 py-2">
          แสดง 30 รายการแรก จากทั้งหมด {filtered.length} ตู้
        </p>
      )}
    </div>
  );
}
