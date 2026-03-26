'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDate } from '@/lib/utils';
import {
  Loader2, BarChart3, Wrench, Package, Download,
  FileSpreadsheet, FileText, TrendingDown, TrendingUp,
  AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw,
} from 'lucide-react';

// ── Types ──

interface DwellSummary {
  total_in_yard: number; avg_dwell_days: number; max_dwell_days: number;
  overdue_count: number; within_7_days: number; within_8_14_days: number;
  within_15_30_days: number; over_30_days: number;
}

interface DwellByLine {
  shipping_line: string; container_count: number; avg_dwell_days: number;
  max_dwell_days: number; min_dwell_days: number; total_dwell_days: number; overdue_count: number;
}

interface DwellOverdue {
  container_id: number; container_number: string; shipping_line: string;
  size: string; type: string; zone_name: string; bay: number; row: number; tier: number;
  dwell_days: number; gate_in_date: string; pending_invoice_count: number;
}

interface MnRSummary {
  total_eor: number; approved_count: number; rejected_count: number;
  pending_count: number; completed_count: number;
  total_estimated: number; total_actual: number; avg_estimated: number; avg_actual: number;
}

interface MnRByStatus {
  status: string; count: number; total_estimated: number; total_actual: number; avg_cost: number;
}

interface MnRTrend { month: string; total: number; approved: number; rejected: number; total_actual_cost: number; }

interface MnREOR {
  eor_number: string; container_number: string; size: string; type: string;
  shipping_line: string; estimated_cost: number; actual_cost: number; status: string;
  created_at: string; approved_at: string; created_name: string; notes: string;
}

// ── Constants ──

const STATUS_TH: Record<string, string> = {
  draft: 'ร่าง', submitted: 'รอพิจารณา', approved: '✅ อนุมัติ',
  rejected: '❌ ปฏิเสธ', in_progress: '🔧 กำลังซ่อม', completed: '🎉 เสร็จสิ้น', cancelled: 'ยกเลิก',
};

const STATUS_COLOR: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const inputClass = 'h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

function formatCurrency(n: number) {
  return `฿${(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── KPI Card ──

function KPICard({
  label, value, sub, icon, color = 'blue', large = false,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color?: string; large?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
    slate: 'bg-slate-50 dark:bg-slate-700 text-slate-600',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[color] || colors.blue}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        <p className={`font-bold text-slate-800 dark:text-white ${large ? 'text-2xl' : 'text-xl'}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DWELL REPORT TAB
// ════════════════════════════════════════════════════════════════

function DwellReportTab({ yardId }: { yardId: number }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    summary?: DwellSummary; byShippingLine?: DwellByLine[]; overdueList?: DwellOverdue[]; overdueDays?: number;
  } | null>(null);
  const [overdueDays, setOverdueDays] = useState(30);
  const [excelLoading, setExcelLoading] = useState(false);
  const { toast } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/dwell?yard_id=${yardId}&overdue_days=${overdueDays}`);
      const d = await res.json();
      setData(d);
    } catch { toast('error', 'โหลดรายงาน Dwell ล้มเหลว'); }
    finally { setLoading(false); }
  }, [yardId, overdueDays, toast]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExcel = async () => {
    if (!data) return;
    setExcelLoading(true);
    try {
      const { exportDwellReportExcel } = await import('@/lib/excelExport');
      await exportDwellReportExcel({
        summary: data.summary!,
        byShippingLine: data.byShippingLine || [],
        overdueList: data.overdueList || [],
        overdueDays,
      });
      toast('success', 'ดาวน์โหลด Excel สำเร็จ');
    } catch { toast('error', 'ส่งออก Excel ล้มเหลว'); }
    finally { setExcelLoading(false); }
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Overdue หากอยู่เกิน (วัน)</label>
          <select value={overdueDays} onChange={e => setOverdueDays(Number(e.target.value))}
            className={`${inputClass} w-40`}>
            {[14, 21, 30, 45, 60, 90].map(d => (
              <option key={d} value={d}>{d} วัน</option>
            ))}
          </select>
        </div>
        <button onClick={fetchReport} disabled={loading}
          className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          รีเฟรช
        </button>
        <button onClick={handleExcel} disabled={!data || excelLoading}
          className="h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-all ml-auto">
          {excelLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
          Excel
        </button>
      </div>

      {/* KPI Cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="ตู้ทั้งหมดในลาน" value={s.total_in_yard} icon={<Package size={20} />} color="blue" />
          <KPICard label="Avg Dwell Days" value={s.avg_dwell_days?.toFixed(1) || '0'} sub="วัน/ตู้" icon={<BarChart3 size={20} />} color="purple" />
          <KPICard label="Max Dwell Days" value={s.max_dwell_days || 0} sub="วันเก่าสุด" icon={<TrendingUp size={20} />} color="amber" />
          <KPICard label={`Overdue (>${overdueDays}d)`} value={s.overdue_count || 0} sub="ตู้ค้างนาน" icon={<AlertTriangle size={20} />} color={s.overdue_count > 0 ? 'rose' : 'emerald'} />
        </div>
      )}

      {/* Dwell Distribution */}
      {s && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-slate-700 dark:text-white text-sm mb-3">📊 การกระจาย Dwell Days</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '≤ 7 วัน', value: s.within_7_days, color: 'emerald' },
              { label: '8–14 วัน', value: s.within_8_14_days, color: 'blue' },
              { label: '15–30 วัน', value: s.within_15_30_days, color: 'amber' },
              { label: `> 30 วัน`, value: s.over_30_days, color: 'rose' },
            ].map(b => (
              <div key={b.label} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <p className={`text-2xl font-bold ${b.color === 'emerald' ? 'text-emerald-600' : b.color === 'blue' ? 'text-blue-600' : b.color === 'amber' ? 'text-amber-600' : 'text-rose-600'}`}>{b.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{b.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Shipping Line Table */}
      {data?.byShippingLine && data.byShippingLine.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            <h3 className="font-semibold text-slate-700 dark:text-white text-sm">สรุปตามสายเรือ</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">สายเรือ</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">จำนวนตู้</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Avg Dwell</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Max Dwell</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Min Dwell</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.byShippingLine.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">{row.shipping_line}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.container_count}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`font-semibold ${row.avg_dwell_days > 30 ? 'text-rose-600' : row.avg_dwell_days > 14 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {row.avg_dwell_days?.toFixed(1)} วัน
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.max_dwell_days}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.min_dwell_days}</td>
                    <td className="px-4 py-2.5 text-center">
                      {row.overdue_count > 0
                        ? <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold">{row.overdue_count}</span>
                        : <span className="text-slate-300 text-xs">-</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overdue List */}
      {data?.overdueList && data.overdueList.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-rose-100 dark:border-rose-800 flex items-center gap-2 bg-rose-50 dark:bg-rose-900/10">
            <AlertTriangle size={16} className="text-rose-500" />
            <h3 className="font-semibold text-rose-700 dark:text-rose-400 text-sm">⚠️ ตู้ Overdue (อยู่เกิน {overdueDays} วัน) — {data.overdueList.length} ตู้</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">เลขตู้</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">สายเรือ</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">ขนาด</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Zone/พิกัด</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-rose-500">Dwell Days</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Gate-In</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Invoice ค้าง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.overdueList.map((row, i) => (
                  <tr key={i} className="hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800 dark:text-white">{row.container_number}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.shipping_line}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">{row.size}&rsquo;{row.type}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{row.zone_name ? `${row.zone_name} B${row.bay}-R${row.row}-T${row.tier}` : '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="font-bold text-rose-600 dark:text-rose-400 text-base">{row.dwell_days}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-500">{formatDate(row.gate_in_date)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {row.pending_invoice_count > 0
                        ? <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 text-xs">ค้าง {row.pending_invoice_count}</span>
                        : <span className="text-slate-300 text-xs">-</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && data && (!data.byShippingLine || data.byShippingLine.length === 0) && (
        <div className="text-center py-12 text-slate-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>ไม่มีตู้คอนเทนเนอร์ในลานขณะนี้</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// M&R REPORT TAB
// ════════════════════════════════════════════════════════════════

function MnRReportTab({ yardId }: { yardId: number }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    summary?: MnRSummary; byStatus?: MnRByStatus[]; eorList?: MnREOR[]; trend?: MnRTrend[];
    dateFrom?: string; dateTo?: string;
  } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState('');
  const [excelLoading, setExcelLoading] = useState(false);
  const { toast } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ yard_id: String(yardId), date_from: dateFrom, date_to: dateTo });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/reports/mnr?${params}`);
      const d = await res.json();
      setData(d);
    } catch { toast('error', 'โหลดรายงาน M&R ล้มเหลว'); }
    finally { setLoading(false); }
  }, [yardId, dateFrom, dateTo, statusFilter, toast]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExcel = async () => {
    if (!data) return;
    setExcelLoading(true);
    try {
      const { exportMnRReportExcel } = await import('@/lib/excelExport');
      await exportMnRReportExcel({
        summary: data.summary!,
        byStatus: data.byStatus || [],
        eorList: data.eorList || [],
        trend: data.trend || [],
        dateFrom,
        dateTo,
      });
      toast('success', 'ดาวน์โหลด Excel M&R สำเร็จ');
    } catch { toast('error', 'ส่งออก Excel ล้มเหลว'); }
    finally { setExcelLoading(false); }
  };

  const s = data?.summary;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>วันเริ่ม</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>วันสิ้นสุด</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>สถานะ</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputClass} w-40`}>
            <option value="">ทั้งหมด</option>
            <option value="submitted">รอพิจารณา</option>
            <option value="approved">อนุมัติ</option>
            <option value="rejected">ปฏิเสธ</option>
            <option value="completed">เสร็จสิ้น</option>
          </select>
        </div>
        <button onClick={fetchReport} disabled={loading}
          className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          รีเฟรช
        </button>
        <button onClick={handleExcel} disabled={!data || excelLoading}
          className="h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-all ml-auto">
          {excelLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
          Excel
        </button>
      </div>

      {/* KPI Cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="ใบ EOR ทั้งหมด" value={s.total_eor} icon={<Wrench size={20} />} color="blue" />
          <KPICard label="อนุมัติ / เสร็จ" value={s.approved_count + s.completed_count}
            sub={`ปฏิเสธ: ${s.rejected_count}`} icon={<CheckCircle2 size={20} />} color="emerald" />
          <KPICard label="รอพิจารณา" value={s.pending_count} icon={<Clock size={20} />} color="amber" />
          <KPICard label="ค่าซ่อมจริงรวม" value={formatCurrency(s.total_actual)}
            sub={`ประเมิน: ${formatCurrency(s.total_estimated)}`} icon={<TrendingDown size={20} />} color="purple" />
        </div>
      )}

      {/* By Status */}
      {data?.byStatus && data.byStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-700 dark:text-white text-sm">📊 แยกตามสถานะ</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.byStatus.map((row, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[row.status] || STATUS_COLOR.draft}`}>
                    {STATUS_TH[row.status] || row.status}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">{row.count} ใบ</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{formatCurrency(row.total_actual)}</p>
                  <p className="text-xs text-slate-400">ประเมิน: {formatCurrency(row.total_estimated)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend */}
      {data?.trend && data.trend.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-700 dark:text-white text-sm">📈 Trend 6 เดือน</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  {['เดือน', 'ใบ EOR', 'อนุมัติ', 'ปฏิเสธ', 'ค่าซ่อมจริง (฿)'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.trend.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-white">{row.month}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.total}</td>
                    <td className="px-4 py-2.5 text-emerald-600">{row.approved}</td>
                    <td className="px-4 py-2.5 text-rose-500">{row.rejected}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-800 dark:text-white">{formatCurrency(row.total_actual_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EOR List */}
      {data?.eorList && data.eorList.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 dark:text-white text-sm">📋 รายการ EOR ({data.eorList.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  {['เลข EOR', 'เลขตู้', 'สายเรือ', 'สถานะ', 'ราคาประเมิน', 'ราคาจริง', 'ผู้สร้าง', 'วันสร้าง'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.eorList.map((eor, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">{eor.eor_number}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-800 dark:text-white">{eor.container_number}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{eor.shipping_line}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[eor.status] || STATUS_COLOR.draft}`}>
                        {STATUS_TH[eor.status] || eor.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm text-slate-700 dark:text-slate-200">{formatCurrency(eor.estimated_cost)}</td>
                    <td className="px-3 py-2.5 font-mono text-sm font-semibold text-emerald-600">{eor.actual_cost ? formatCurrency(eor.actual_cost) : '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{eor.created_name || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(eor.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && data && (!data.eorList || data.eorList.length === 0) && (
        <div className="text-center py-12 text-slate-400">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <p>ไม่พบข้อมูล EOR ในช่วงเวลานี้</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════

export default function ReportsPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'dwell' | 'mnr'>('dwell');
  const yardId = session?.activeYardId || 1;

  const TABS = [
    { id: 'dwell' as const, label: '📦 Container Dwell', icon: <Package size={15} /> },
    { id: 'mnr' as const, label: '🔧 M&R Report', icon: <Wrench size={15} /> },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
          <BarChart3 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">รายงาน (Reports)</h1>
          <p className="text-xs text-slate-400">Container Dwell Report · M&R Report · Export Excel</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            }`}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dwell' && <DwellReportTab yardId={yardId} />}
      {activeTab === 'mnr' && <MnRReportTab yardId={yardId} />}
    </div>
  );
}
