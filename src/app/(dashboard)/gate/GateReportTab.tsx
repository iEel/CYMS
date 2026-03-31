'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  BarChart3, ArrowDownToLine, ArrowUpFromLine,
  Calendar, FileText, Download, Printer, RefreshCw,
  TrendingUp, Package, User, Clock, Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Types ───
interface DailyTx {
  transaction_id: number;
  eir_number: string;
  created_at: string;
  driver_name?: string;
  truck_plate?: string;
  seal_number?: string;
  booking_ref?: string;
  container_number?: string;
  size?: string;
  container_type?: string;
  shipping_line?: string;
  is_laden?: boolean;
  zone_name?: string;
  bay?: number;
  row?: number;
  tier?: number;
  operator_name?: string;
}

interface DailySummary {
  total: number;
  laden: number;
  empty: number;
  size_20: number;
  size_40: number;
  size_45: number;
}

interface DailyData {
  type: string;
  date: string;
  summary: DailySummary;
  transactions: DailyTx[];
  byShippingLine: { shipping_line: string; count: number }[];
}

interface SummaryKPI {
  total: number;
  laden: number;
  empty: number;
  avg_per_day: number;
  date_range_days: number;
  peak_date?: string;
  peak_count?: number;
}

interface SummaryData {
  type: string;
  date_from: string;
  date_to: string;
  kpi: SummaryKPI;
  dailyTrend: { date: string; count: number; laden: number; empty: number }[];
  byShippingLine: { shipping_line: string; count: number; laden: number; empty: number }[];
  bySize: { size: string; count: number }[];
  byType: { container_type: string; count: number }[];
  byHour: { hour: number; count: number }[];
  byOperator: { operator_name: string; count: number }[];
}

// ─── Helpers ───
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
}
function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

// ─── Progress Bar ───
function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${w}%` }} />
    </div>
  );
}

// ─── KPI Card ───
function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Report Selector Cards ───
const REPORT_TYPES = [
  { id: 'daily_in', label: 'Daily Gate In', sub: 'รายงานตู้เข้ารายวัน', icon: <ArrowDownToLine size={24} />, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600', mode: 'daily' as const },
  { id: 'daily_out', label: 'Daily Gate Out', sub: 'รายงานตู้ออกรายวัน', icon: <ArrowUpFromLine size={24} />, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600', mode: 'daily' as const },
  { id: 'summary_in', label: 'Summary Gate In', sub: 'สรุปตู้เข้าช่วงเวลา', icon: <BarChart3 size={24} />, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600', mode: 'summary' as const },
  { id: 'summary_out', label: 'Summary Gate Out', sub: 'สรุปตู้ออกช่วงเวลา', icon: <TrendingUp size={24} />, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600', mode: 'summary' as const },
];

type ReportId = 'daily_in' | 'daily_out' | 'summary_in' | 'summary_out';

interface Props { yardId: number; onViewEIR?: (eirNumber: string) => void }

export default function GateReportTab({ yardId, onViewEIR }: Props) {
  const [selectedReport, setSelectedReport] = useState<ReportId | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const selectedInfo = REPORT_TYPES.find(r => r.id === selectedReport);

  const fetchReport = useCallback(async (reportId: ReportId) => {
    setLoading(true);
    try {
      const base = `/api/reports/gate?yard_id=${yardId}&type=${reportId}`;
      const url = selectedInfo?.mode === 'daily' || REPORT_TYPES.find(r=>r.id===reportId)?.mode === 'daily'
        ? `${base}&date=${date}`
        : `${base}&date_from=${dateFrom}&date_to=${dateTo}`;

      const res = await fetch(url);
      const data = await res.json();
      const mode = REPORT_TYPES.find(r => r.id === reportId)?.mode;
      if (mode === 'daily') setDailyData(data);
      else setSummaryData(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [yardId, date, dateFrom, dateTo, selectedInfo?.mode]);

  const handleSelectReport = (id: ReportId) => {
    setSelectedReport(id);
    setDailyData(null);
    setSummaryData(null);
    // fetch จะถูกเรียกโดย useEffect ด้านล่างอัตโนมัติ
  };

  // auto-fetch เมื่อเลือก report ใหม่ (ใช้ useEffect แทน setTimeout)
  useEffect(() => {
    if (selectedReport) fetchReport(selectedReport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport]);

  // ─── Excel Export ───
  const exportExcel = () => {
    if (dailyData) {
      const ws = XLSX.utils.json_to_sheet(dailyData.transactions.map((t, i) => ({
        '#': i + 1,
        'เลขตู้': t.container_number || '-',
        'ขนาด': t.size || '-',
        'ประเภท': t.container_type || '-',
        'สายเรือ': t.shipping_line || '-',
        'สภาพ': t.is_laden ? 'โหลด' : 'เปล่า',
        'คนขับ': t.driver_name || '-',
        'ทะเบียนรถ': t.truck_plate || '-',
        'เลข EIR': t.eir_number || '-',
        'ผู้ดำเนินการ': t.operator_name || '-',
        'เวลา': fmtTime(t.created_at),
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gate Report');
      XLSX.writeFile(wb, `GateReport_${selectedReport}_${date}.xlsx`);
    } else if (summaryData) {
      const ws = XLSX.utils.json_to_sheet(summaryData.dailyTrend.map(d => ({
        'วันที่': d.date,
        'รวม': d.count,
        'โหลด': d.laden,
        'เปล่า': d.empty,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Trend');

      const ws2 = XLSX.utils.json_to_sheet(summaryData.byShippingLine.map((r, i) => ({
        '#': i + 1, 'สายเรือ': r.shipping_line, 'รวม': r.count, 'โหลด': r.laden, 'เปล่า': r.empty,
      })));
      XLSX.utils.book_append_sheet(wb, ws2, 'By Shipping Line');
      XLSX.writeFile(wb, `GateSummary_${selectedReport}_${dateFrom}_${dateTo}.xlsx`);
    }
  };

  // ─── PDF Export ───
  const exportPDF = async () => {
    const { generateGateReportPDF, generateGateSummaryPDF } = await import('@/lib/pdfExport');
    if (dailyData) {
      generateGateReportPDF(dailyData, selectedReport as 'daily_in' | 'daily_out', date);
    } else if (summaryData) {
      generateGateSummaryPDF(summaryData, selectedReport as 'summary_in' | 'summary_out', dateFrom, dateTo);
    }
  };

  const hasData = dailyData || summaryData;
  const reportMode = selectedInfo?.mode;

  return (
    <div className="space-y-5">
      {/* ─── Report Selector ─── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
          <BarChart3 size={14} /> เลือกประเภทรายงาน
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {REPORT_TYPES.map(r => (
            <button
              key={r.id}
              onClick={() => handleSelectReport(r.id as ReportId)}
              className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                selectedReport === r.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${r.color} flex items-center justify-center mb-3`}>
                {r.icon}
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{r.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Date Picker + Controls ─── */}
      {selectedReport && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-end gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${selectedInfo?.color} `}>
            {selectedInfo?.icon && <span className="scale-75">{selectedInfo.icon}</span>}
            {selectedInfo?.label}
          </div>

          {reportMode === 'daily' ? (
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">วันที่</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">จากวันที่</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">ถึงวันที่</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
            </>
          )}

          <button
            onClick={() => selectedReport && fetchReport(selectedReport)}
            disabled={loading}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            ดึงรายงาน
          </button>

          {hasData && (
            <>
              <button
                onClick={exportPDF}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <FileText size={14} /> PDF
              </button>
              <button
                onClick={exportExcel}
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Download size={14} /> Excel
              </button>
              <button
                onClick={() => window.print()}
                className="h-9 px-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Printer size={14} /> พิมพ์
              </button>
            </>
          )}
        </div>
      )}

      {/* ─── Loading ─── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={28} className="animate-spin text-blue-500" />
          <span className="ml-3 text-slate-500 dark:text-slate-400">กำลังโหลดรายงาน...</span>
        </div>
      )}

      {/* ════════════ DAILY REPORT ════════════ */}
      {!loading && dailyData && (
        <div className="space-y-5" id="gate-report-print">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard icon={<Package size={18} className="text-slate-600" />} label="รวมทั้งหมด" value={dailyData.summary.total} color="bg-slate-100 dark:bg-slate-700" />
            <KPICard icon={<ArrowDownToLine size={18} className="text-emerald-600" />} label="โหลดสินค้า" value={dailyData.summary.laden} sub={`${pct(dailyData.summary.laden, dailyData.summary.total)}%`} color="bg-emerald-100 dark:bg-emerald-900/30" />
            <KPICard icon={<Package size={18} className="text-slate-400" />} label="เปล่า" value={dailyData.summary.empty} sub={`${pct(dailyData.summary.empty, dailyData.summary.total)}%`} color="bg-slate-100 dark:bg-slate-700" />
            <KPICard icon={<Layers size={18} className="text-blue-600" />} label="20 ฟุต" value={dailyData.summary.size_20} color="bg-blue-100 dark:bg-blue-900/30" />
            <KPICard icon={<Layers size={18} className="text-purple-600" />} label="40 ฟุต" value={dailyData.summary.size_40} color="bg-purple-100 dark:bg-purple-900/30" />
            <KPICard icon={<Layers size={18} className="text-orange-600" />} label="45 ฟุต" value={dailyData.summary.size_45} color="bg-orange-100 dark:bg-orange-900/30" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* By Shipping Line */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                <BarChart3 size={14} className="text-blue-500" /> แยกตามสายเรือ
              </h3>
              <div className="space-y-3">
                {dailyData.byShippingLine.length === 0
                  ? <p className="text-sm text-slate-400 text-center py-4">ไม่มีข้อมูล</p>
                  : dailyData.byShippingLine.map(r => (
                    <div key={r.shipping_line}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{r.shipping_line}</span>
                        <span className="text-slate-500">{r.count} ตู้</span>
                      </div>
                      <ProgressBar value={r.count} max={dailyData.summary.total} color="bg-blue-500" />
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Transaction Table (takes 2/3 width) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-2">
                  <FileText size={14} className="text-slate-500" />
                  รายการทั้งหมด
                  <span className="ml-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">{dailyData.transactions.length} รายการ</span>
                </h3>
              </div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                    <tr>
                      {['เวลา','เลขตู้','ขนาด','สายเรือ','สภาพ','คนขับ','ทะเบียน','EIR','ผู้ดำเนินการ'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {dailyData.transactions.length === 0
                      ? <tr><td colSpan={9} className="text-center py-8 text-slate-400">ไม่มีข้อมูล</td></tr>
                      : dailyData.transactions.map(t => (
                        <tr key={t.transaction_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtTime(t.created_at)}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-white whitespace-nowrap">{t.container_number || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.size ? `${t.size}'${t.container_type}` : '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.shipping_line || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.is_laden ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                              {t.is_laden ? 'โหลด' : 'เปล่า'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.driver_name || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.truck_plate || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {t.eir_number && onViewEIR
                              ? <button onClick={() => onViewEIR(t.eir_number!)} className="text-blue-500 hover:text-blue-700 hover:underline">{t.eir_number}</button>
                              : <span className="text-slate-500">{t.eir_number || '-'}</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.operator_name || '-'}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ SUMMARY REPORT ════════════ */}
      {!loading && summaryData && (
        <div className="space-y-5" id="gate-report-print">
          {/* Section 1: KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              icon={<Package size={18} className="text-blue-600" />}
              label="ตู้ทั้งหมด"
              value={summaryData.kpi.total.toLocaleString()}
              sub={`${summaryData.kpi.date_range_days} วัน`}
              color="bg-blue-100 dark:bg-blue-900/30"
            />
            <KPICard
              icon={<ArrowDownToLine size={18} className="text-emerald-600" />}
              label="โหลด / เปล่า"
              value={`${summaryData.kpi.laden} / ${summaryData.kpi.empty}`}
              sub={`โหลด ${pct(summaryData.kpi.laden, summaryData.kpi.total)}%`}
              color="bg-emerald-100 dark:bg-emerald-900/30"
            />
            <KPICard
              icon={<Calendar size={18} className="text-purple-600" />}
              label="เฉลี่ย / วัน"
              value={summaryData.kpi.avg_per_day}
              sub="ตู้/วัน"
              color="bg-purple-100 dark:bg-purple-900/30"
            />
            <KPICard
              icon={<TrendingUp size={18} className="text-orange-600" />}
              label="วัน Peak"
              value={summaryData.kpi.peak_count ?? 0}
              sub={summaryData.kpi.peak_date ? fmtDate(summaryData.kpi.peak_date) : '-'}
              color="bg-orange-100 dark:bg-orange-900/30"
            />
          </div>

          {/* Section 2: Daily Trend */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-purple-500" /> แนวโน้มรายวัน
            </h3>
            {summaryData.dailyTrend.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">ไม่มีข้อมูล</p>
              : (() => {
                  const maxCount = Math.max(...summaryData.dailyTrend.map(d => d.count), 1);
                  return (
                    <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2">
                      {summaryData.dailyTrend.map(d => {
                        const h = Math.max(Math.round((d.count / maxCount) * 100), 4);
                        return (
                          <div key={d.date as string} className="flex flex-col items-center gap-1 min-w-[32px] group">
                            <div className="relative w-full flex flex-col justify-end" style={{ height: 100 }}>
                              <div
                                className="w-full bg-blue-500 hover:bg-blue-600 rounded-t transition-all duration-300 cursor-pointer"
                                style={{ height: `${h}%` }}
                                title={`${fmtDate(d.date)}: ${d.count} ตู้`}
                              />
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                                {fmtDate(d.date)}<br/>{d.count} ตู้
                              </div>
                            </div>
                            <span className="text-[9px] text-slate-400 whitespace-nowrap">
                              {new Date(d.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
            }
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Section 3: By Shipping Line */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                <BarChart3 size={14} className="text-blue-500" /> Top 10 สายเรือ
              </h3>
              <div className="space-y-2.5">
                {summaryData.byShippingLine.map((r, i) => (
                  <div key={r.shipping_line}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{r.shipping_line}</span>
                      </span>
                      <span className="text-slate-500">{r.count} ตู้ <span className="text-slate-400">({pct(r.count, summaryData.kpi.total)}%)</span></span>
                    </div>
                    <ProgressBar value={r.count} max={summaryData.byShippingLine[0]?.count || 1} color="bg-blue-500" />
                  </div>
                ))}
                {summaryData.byShippingLine.length === 0 && <p className="text-sm text-slate-400 text-center py-4">ไม่มีข้อมูล</p>}
              </div>
            </div>

            {/* Section 4+5: By Size & Type */}
            <div className="space-y-4">
              {/* By Size */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                  <Layers size={14} className="text-purple-500" /> แยกตามขนาดตู้
                </h3>
                <div className="space-y-2">
                  {summaryData.bySize.map(r => (
                    <div key={r.size}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{r.size ? `${r.size} ฟุต` : 'ไม่ระบุ'}</span>
                        <span className="text-slate-500">{r.count} <span className="text-slate-400">({pct(r.count, summaryData.kpi.total)}%)</span></span>
                      </div>
                      <ProgressBar value={r.count} max={summaryData.kpi.total}
                        color={r.size === '20' ? 'bg-blue-500' : r.size === '40' ? 'bg-purple-500' : 'bg-orange-500'} />
                    </div>
                  ))}
                </div>
              </div>

              {/* By Type */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                  <Package size={14} className="text-emerald-500" /> แยกตามประเภทตู้
                </h3>
                <div className="flex flex-wrap gap-2">
                  {summaryData.byType.map(r => (
                    <div key={r.container_type}
                      className={`flex-1 min-w-[80px] rounded-lg p-2 text-center ${r.container_type === 'RF' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700/50'}`}
                    >
                      <p className={`text-lg font-bold ${r.container_type === 'RF' ? 'text-blue-600' : 'text-slate-800 dark:text-white'}`}>{r.count}</p>
                      <p className="text-xs text-slate-500">{r.container_type}</p>
                      <p className="text-[10px] text-slate-400">{pct(r.count, summaryData.kpi.total)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Section 6: By Hour Heatmap */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                <Clock size={14} className="text-orange-500" /> การกระจายตามชั่วโมง
              </h3>
              {(() => {
                const maxH = Math.max(...summaryData.byHour.map(h => h.count), 1);
                const hourMap: Record<number, number> = {};
                summaryData.byHour.forEach(h => { hourMap[h.hour] = h.count; });
                return (
                  <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: 24 }, (_, i) => {
                      const count = hourMap[i] || 0;
                      const intensity = count / maxH;
                      const bg = intensity === 0 ? 'bg-slate-100 dark:bg-slate-700' :
                        intensity < 0.3 ? 'bg-blue-100 dark:bg-blue-900/30' :
                        intensity < 0.6 ? 'bg-blue-300 dark:bg-blue-700' :
                        intensity < 0.85 ? 'bg-blue-500' : 'bg-blue-700';
                      return (
                        <div key={i} title={`${String(i).padStart(2,'0')}:00 — ${count} ตู้`}
                          className={`${bg} rounded p-1.5 cursor-default transition-colors group relative text-center`}>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">{String(i).padStart(2,'0')}</p>
                          <p className={`text-[10px] font-bold ${count > 0 ? 'text-white' : 'text-slate-300 dark:text-slate-600'}`}>{count || ''}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-slate-400">น้อย</span>
                <div className="flex gap-1">
                  {['bg-slate-100 dark:bg-slate-700','bg-blue-100','bg-blue-300','bg-blue-500','bg-blue-700'].map((c, i) => (
                    <div key={i} className={`w-5 h-3 rounded ${c}`} />
                  ))}
                </div>
                <span className="text-xs text-slate-400">มาก</span>
              </div>
            </div>

            {/* Section 7: By Operator */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
                <User size={14} className="text-slate-500" /> ผู้ดำเนินการ
              </h3>
              <div className="space-y-2.5">
                {summaryData.byOperator.length === 0
                  ? <p className="text-sm text-slate-400 text-center py-4">ไม่มีข้อมูล</p>
                  : summaryData.byOperator.map(r => (
                    <div key={r.operator_name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <User size={12} className="text-slate-500" />
                          </div>
                          <span className="text-slate-700 dark:text-slate-200 font-medium">{r.operator_name}</span>
                        </span>
                        <span className="text-slate-500">{r.count} รายการ</span>
                      </div>
                      <ProgressBar value={r.count} max={summaryData.byOperator[0]?.count || 1} color="bg-slate-500" />
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedReport && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">เลือกประเภทรายงานด้านบนเพื่อเริ่มต้น</p>
        </div>
      )}
    </div>
  );
}
