'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Thermometer,
  X,
} from 'lucide-react';

interface PortalReeferItem {
  container_id: number;
  container_number: string;
  size?: string;
  type?: string;
  shipping_line?: string;
  container_status?: string;
  zone_name?: string;
  yard_name?: string;
  booking_number?: string | null;
  latest_measured_temp_c?: number | null;
  latest_set_point_c?: number | null;
  latest_supply_temp_c?: number | null;
  latest_return_temp_c?: number | null;
  latest_check_status?: string | null;
  latest_checked_at?: string | null;
  latest_photo_url?: string | null;
  latest_notes?: string | null;
}

interface PortalReeferHistory {
  check_id: number;
  container_id: number;
  measured_temp_c?: number | null;
  set_point_c?: number | null;
  supply_temp_c?: number | null;
  return_temp_c?: number | null;
  status: string;
  photo_url?: string | null;
  notes?: string | null;
  checked_at: string;
}

export default function PortalReeferPage() {
  const [items, setItems] = useState<PortalReeferItem[]>([]);
  const [history, setHistory] = useState<PortalReeferHistory[]>([]);
  const [selected, setSelected] = useState<PortalReeferItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portal/reefer');
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openHistory = async (item: PortalReeferItem) => {
    setSelected(item);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/portal/reefer?container_id=${item.container_id}`);
      const data = await res.json();
      setHistory(data.history || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const outOfRange = items.filter(item => item.latest_check_status === 'out_of_range').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <Thermometer size={22} className="text-cyan-600" /> ตู้เย็น
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">read-only ติดตามอุณหภูมิและประวัติตรวจอุณหภูมิของตู้ที่บัญชีนี้มีสิทธิ์เห็น</p>
        </div>
        <button onClick={loadData} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Summary label="RF ทั้งหมด" value={items.length} tone="cyan" />
        <Summary label="มีผลตรวจล่าสุด" value={items.filter(item => item.latest_checked_at).length} tone="emerald" />
        <Summary label="นอกช่วงอุณหภูมิ" value={outOfRange} tone="rose" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">ยังไม่มีตู้เย็นที่ผูกกับบัญชีนี้</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {items.map(item => (
              <button key={item.container_id} onClick={() => openHistory(item)} className="grid w-full gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/20 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-white">{item.container_number}</p>
                    <StatusBadge status={item.latest_check_status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {[item.size ? `${item.size}'` : '', item.type, item.shipping_line, item.zone_name || item.yard_name].filter(Boolean).join(' · ') || '-'}
                  </p>
                  {item.booking_number && <p className="mt-1 text-[11px] text-blue-600">Booking {item.booking_number}</p>}
                </div>
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{formatTemp(item.latest_measured_temp_c)}</p>
                  <p>Set point {formatTemp(item.latest_set_point_c)}</p>
                </div>
                <div className="text-xs text-slate-500">
                  <p>{item.latest_checked_at ? formatDateTime(item.latest_checked_at) : 'ยังไม่มีผลตรวจ'}</p>
                  {item.latest_notes && <p className="mt-1 line-clamp-1">{item.latest_notes}</p>}
                </div>
                <span className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-cyan-50 px-3 text-xs font-semibold text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                  <Eye size={14} /> ประวัติ
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-700">
              <div>
                <h2 className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                  <Thermometer size={18} className="text-cyan-600" /> {selected.container_number}
                </h2>
                <p className="mt-1 text-xs text-slate-400">ประวัติตรวจอุณหภูมิ read-only</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            {historyLoading ? (
              <div className="flex h-36 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
              </div>
            ) : history.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">ยังไม่มีประวัติตรวจอุณหภูมิ</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {history.map(check => (
                  <div key={check.check_id} className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={check.status} />
                        <span className="text-xs text-slate-400">{formatDateTime(check.checked_at)}</span>
                      </div>
                      {check.notes && <p className="mt-2 text-xs text-slate-500">{check.notes}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <p>Measured <span className="font-semibold text-slate-800 dark:text-white">{formatTemp(check.measured_temp_c)}</span></p>
                      <p>Set <span className="font-semibold text-slate-800 dark:text-white">{formatTemp(check.set_point_c)}</span></p>
                      <p>Supply <span className="font-semibold text-slate-800 dark:text-white">{formatTemp(check.supply_temp_c)}</span></p>
                      <p>Return <span className="font-semibold text-slate-800 dark:text-white">{formatTemp(check.return_temp_c)}</span></p>
                    </div>
                    {check.photo_url ? (
                      <a href={check.photo_url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">
                        ดูรูป
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">ไม่มีรูป</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'emerald' | 'rose' }) {
  const cls = {
    cyan: 'text-cyan-700 bg-cyan-50 dark:bg-cyan-900/20 dark:text-cyan-300',
    emerald: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300',
    rose: 'text-rose-700 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-300',
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${cls}`}><Thermometer size={17} /></div>
      <p className="text-2xl font-bold text-slate-800 dark:text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  if (status === 'out_of_range') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"><AlertTriangle size={12} /> นอกช่วง</span>;
  }
  if (status === 'unreadable' || status === 'power_issue') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><Clock size={12} /> ต้องตรวจซ้ำ</span>;
  }
  if (status === 'normal') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={12} /> ปกติ</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">ยังไม่ตรวจ</span>;
}

function formatTemp(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toFixed(1)}°C`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}
