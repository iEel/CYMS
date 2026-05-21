'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Ship,
} from 'lucide-react';

interface Container {
  container_id: number; container_number: string; size: string; type: string;
  shipping_line: string; status: string; is_laden: boolean;
  hold_status?: string | null;
  gate_in_date: string; gate_out_date: string;
  zone_name: string; yard_name: string;
  visibility_role?: string;
  dwell_days?: number;
  latest_booking_id?: number | null;
  latest_booking_number?: string | null;
  latest_booking_type?: string | null;
  latest_booking_status?: string | null;
  latest_eir_number?: string | null;
  latest_gate_type?: string | null;
  latest_gate_at?: string | null;
  open_invoice_count?: number;
  open_invoice_amount?: number;
}

interface ContainerSummary {
  total: number;
  in_yard: number;
  released: number;
  on_hold: number;
  repair: number;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  in_yard: { label: 'ในลาน', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  released: { label: 'ปล่อยออกแล้ว', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  gated_out: { label: 'ออกจากลาน', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  repair: { label: 'ซ่อม/ตรวจซ่อม', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  under_repair: { label: 'ซ่อม/ตรวจซ่อม', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  pending: { label: 'รอเข้าลาน', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const bookingTypeLabels: Record<string, string> = {
  import: 'นำเข้า',
  export: 'ส่งออก',
  empty_pickup: 'รับตู้เปล่า',
  empty_return: 'คืนตู้เปล่า',
};

export default function PortalContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [summary, setSummary] = useState<ContainerSummary>({ total: 0, in_yard: 0, released: 0, on_hold: 0, repair: 0 });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback((p = 1, status = statusFilter, term = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (status) params.set('status', status);
    if (term.trim()) params.set('search', term.trim());
    fetch(`/api/portal/containers?${params}`).then(r => r.json()).then(d => {
      setContainers(d.containers || []);
      setSummary(d.summary || { total: 0, in_yard: 0, released: 0, on_hold: 0, repair: 0 });
      setTotal(d.total || 0);
      setPage(d.page || 1);
      setTotalPages(d.totalPages || 1);
      setLoading(false);
      setLastUpdated(new Date());
    }).catch(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => loadData(1, statusFilter, search), 250);
    return () => window.clearTimeout(timeout);
  }, [loadData, search, statusFilter]);

  useEffect(() => {
    const interval = window.setInterval(() => loadData(page, statusFilter, search), 30000);
    return () => window.clearInterval(interval);
  }, [loadData, page, search, statusFilter]);

  const statusTabs = [
    { key: '', label: 'ทั้งหมด', value: summary.total },
    { key: 'in_yard', label: 'ในลาน', value: summary.in_yard },
    { key: 'released', label: 'ปล่อยออก', value: summary.released },
    { key: 'hold', label: 'ติด Hold', value: summary.on_hold },
    { key: 'repair', label: 'ซ่อม/ตรวจซ่อม', value: summary.repair },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Package size={22} className="text-blue-600" /> ตู้คอนเทนเนอร์
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Customer Container Inventory เฉพาะรายการที่บัญชีนี้มีสิทธิ์เห็น</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadData(page, statusFilter, search)}
            className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
            title="รีเฟรช">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {lastUpdated && lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input type="text" placeholder="ค้นเลขตู้..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white w-56" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
            <option value="">ทุกสถานะ</option>
            <option value="in_yard">ในลาน</option>
            <option value="released">ปล่อยออก</option>
            <option value="hold">ติด Hold</option>
            <option value="repair">ซ่อม/ตรวจซ่อม</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryTile icon={<Package size={16} />} label="ทั้งหมด" value={summary.total} tone="blue" />
        <SummaryTile icon={<Ship size={16} />} label="ในลาน" value={summary.in_yard} tone="emerald" />
        <SummaryTile icon={<CalendarDays size={16} />} label="ปล่อยออก" value={summary.released} tone="slate" />
        <SummaryTile icon={<AlertTriangle size={16} />} label="ติด Hold" value={summary.on_hold} tone="amber" />
        <SummaryTile icon={<FileText size={16} />} label="ซ่อม/ตรวจซ่อม" value={summary.repair} tone="rose" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusTabs.map(tab => (
          <button key={tab.key || 'all'} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`h-9 px-3 rounded-lg text-xs font-semibold border transition-colors ${
              statusFilter === tab.key
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600'
            }`}>
            {tab.label} <span className="ml-1 text-[10px] opacity-70">{tab.value}</span>
          </button>
        ))}
        {search && (
          <span className="text-[11px] text-slate-400">ผลค้นหา: {total} รายการ</span>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : containers.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2"><Filter size={14} /> ไม่พบข้อมูล</p>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
              {containers.map(c => (
                <div key={c.container_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800 dark:text-white">{c.container_number}</span>
                    <div className="flex items-center gap-1">
                      <VisibilityPill role={c.visibility_role} />
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(statusLabels[c.status] || statusLabels.pending).cls}`}>
                        {(statusLabels[c.status] || statusLabels.pending).label}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>{c.size}&apos; {c.type}</span>
                    <span>{c.shipping_line}</span>
                    {c.zone_name && <span>{c.zone_name}</span>}
                  </div>
                  <ContainerContext container={c} compact />
                  <p className="text-[10px] text-slate-400">
                    เข้า: {c.gate_in_date ? new Date(c.gate_in_date).toLocaleDateString('th-TH') : '-'}
                    {c.gate_out_date && ` → ออก: ${new Date(c.gate_out_date).toLocaleDateString('th-TH')}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/30">
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="p-3">เลขตู้</th>
                  <th className="p-3">ขนาด</th>
                  <th className="p-3">บริบท</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">สิทธิ์เห็นข้อมูล</th>
                  <th className="p-3">โซน</th>
                  <th className="p-3">Dwell</th>
                  <th className="p-3">เอกสาร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {containers.map(c => (
                  <tr key={c.container_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="p-3">
                      <p className="font-mono font-bold text-slate-800 dark:text-white">{c.container_number}</p>
                      <p className="text-[10px] text-slate-400">{c.is_laden ? 'Laden' : 'Empty'} · {c.shipping_line || '-'}</p>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{c.size}&apos; {c.type}</td>
                    <td className="p-3"><ContainerContext container={c} /></td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(statusLabels[c.status] || statusLabels.pending).cls}`}>
                        {(statusLabels[c.status] || statusLabels.pending).label}
                      </span>
                      {c.hold_status && <p className="text-[10px] text-amber-600 mt-1">Hold: {c.hold_status}</p>}
                    </td>
                    <td className="p-3"><VisibilityPill role={c.visibility_role} /></td>
                    <td className="p-3 text-slate-500">
                      <p>{c.zone_name || '-'}</p>
                      <p className="text-[10px] text-slate-400">{c.yard_name || '-'}</p>
                    </td>
                    <td className="p-3 text-slate-500 text-xs">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">{c.dwell_days ? `${c.dwell_days} วัน` : '-'}</p>
                      <p className="text-[10px] text-slate-400">In {formatShortDate(c.gate_in_date)}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-start gap-1">
                        {c.latest_eir_number ? (
                          <a href={`/api/portal/eir-pdf?eir_number=${encodeURIComponent(c.latest_eir_number)}`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800">
                            <Download size={12} /> EIR
                          </a>
                        ) : <span className="text-[11px] text-slate-400">ยังไม่มี EIR</span>}
                        {Number(c.open_invoice_count || 0) > 0 && (
                          <a href="/portal/invoices" className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-800">
                            <FileText size={12} /> Invoice {c.open_invoice_count}
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
            Math.max(0, page - 3), Math.min(totalPages, page + 2)
          ).map(p => (
            <button key={p} onClick={() => loadData(p, statusFilter, search)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                p === page ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-100'
              }`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: 'blue' | 'emerald' | 'slate' | 'amber' | 'rose' }) {
  const tones = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300',
    slate: 'text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-300',
  };
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      <p className="text-xl font-bold text-slate-800 dark:text-white mt-2">{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function ContainerContext({ container, compact = false }: { container: Container; compact?: boolean }) {
  return (
    <div className={compact ? 'flex flex-wrap gap-2 text-[10px]' : 'space-y-1 text-xs'}>
      {container.latest_booking_number && (
        <a href="/portal/bookings" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">
          <Ship size={compact ? 10 : 12} /> {container.latest_booking_number}
          {container.latest_booking_type && <span className="text-slate-400">({bookingTypeLabels[container.latest_booking_type] || container.latest_booking_type})</span>}
        </a>
      )}
      {container.latest_gate_at && (
        <p className="inline-flex items-center gap-1 text-slate-500">
          <Clock size={compact ? 10 : 12} /> Last gate {formatShortDate(container.latest_gate_at)}
        </p>
      )}
      {!container.latest_booking_number && !container.latest_gate_at && (
        <p className="text-slate-400">ยังไม่มี booking/gate ล่าสุด</p>
      )}
    </div>
  );
}

function formatShortDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function VisibilityPill({ role }: { role?: string }) {
  const labels: Record<string, string> = {
    owner: 'Owner',
    billing: 'Billing',
    booking_customer: 'Booking',
    invoice_customer: 'Invoice',
  };
  return (
    <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300">
      {labels[role || ''] || 'Grant'}
    </span>
  );
}
