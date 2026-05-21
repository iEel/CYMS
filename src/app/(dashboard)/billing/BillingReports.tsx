'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  DollarSign, FileDown, FileSpreadsheet, FileText, Loader2, Printer, Receipt,
  TrendingUp, Users,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { BillingControlReport, ClearanceRow, ClearanceStats } from './billingTypes';
import { CHARGE_LABELS_RPT, clearanceLabel, controlSeverityBadge, controlTypeLabel, loadPdfExport } from './billingUi';

export default function BillingReports({ yardId }: { yardId: number }) {
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [controlRows, setControlRows] = useState<ClearanceRow[]>([]);
  const [controlStats, setControlStats] = useState<ClearanceStats | null>(null);
  const [controlReport, setControlReport] = useState<BillingControlReport | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const dateParam = reportType === 'daily' ? selectedDate : selectedMonth;
      const res = await fetch(`/api/billing/reports?yard_id=${yardId}&type=${reportType}&date=${dateParam}`);
      const json = await res.json();
      if (!json.error) setData(json);
      const clearanceFrom = dateParam.length === 7 ? `${dateParam}-01` : dateParam;
      const clearanceTo = dateParam.length === 7
        ? new Date(Number(dateParam.slice(0, 4)), Number(dateParam.slice(5, 7)), 0).toISOString().slice(0, 10)
        : dateParam;
      const cRes = await fetch(`/api/billing/clearance?yard_id=${yardId}&date_from=${clearanceFrom}&date_to=${clearanceTo}`);
      const cJson = await cRes.json();
      setControlRows(cJson.clearances || []);
      setControlStats(cJson.stats || null);
      const controlRes = await fetch(`/api/billing/reports?yard_id=${yardId}&type=control&period=${reportType}&date=${dateParam}`);
      const controlJson = await controlRes.json();
      setControlReport(controlJson.error ? null : controlJson);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [yardId, reportType, selectedDate, selectedMonth]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const navigateDate = (dir: number) => {
    if (reportType === 'daily') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + dir);
      setSelectedDate(d.toISOString().slice(0, 10));
    } else {
      const d = new Date(selectedMonth + '-01');
      d.setMonth(d.getMonth() + dir);
      setSelectedMonth(d.toISOString().slice(0, 7));
    }
  };

  const thaiDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const thaiMonth = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  };

  const s = data?.summary;

  return (
    <div className="space-y-4">
      {/* Report Type + Date Picker */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
            <button onClick={() => setReportType('daily')}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${reportType === 'daily' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'}`}>
              📅 รายงานประจำวัน
            </button>
            <button onClick={() => setReportType('monthly')}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${reportType === 'monthly' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'}`}>
              📊 รายงานประจำเดือน
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigateDate(-1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 flex items-center justify-center">
              <ChevronLeft size={16} />
            </button>
            {reportType === 'daily' ? (
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white" />
            ) : (
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white" />
            )}
            <button onClick={() => navigateDate(1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 flex items-center justify-center">
              <ChevronRight size={16} />
            </button>
          </div>
          <button onClick={() => {
            if (reportType === 'daily') setSelectedDate(new Date().toISOString().slice(0, 10));
            else setSelectedMonth(new Date().toISOString().slice(0, 7));
          }} className="h-8 px-3 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400">
            วันนี้
          </button>
          <button onClick={() => {
            const dateParam = reportType === 'daily' ? selectedDate : selectedMonth;
            window.open(`/billing/print/report?type=${reportType}&date=${dateParam}&yard_id=${yardId}`, '_blank');
          }} className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs font-medium hover:bg-slate-200 flex items-center gap-1">
            <Printer size={12} /> พิมพ์
          </button>
          <button
            disabled={pdfLoading || !data}
            onClick={async () => {
              if (!data) return;
              setPdfLoading(true);
              try {
                const { generateBillingReportPDF } = await loadPdfExport();
                const dateLabel = reportType === 'daily' ? thaiDate(selectedDate) : thaiMonth(selectedMonth);
                let companyName = 'CYMS';
                try {
                  const cr = await fetch('/api/settings/company');
                  const cd = await cr.json();
                  if (cd?.company_name) companyName = cd.company_name;
                } catch { /* ignore */ }
                await generateBillingReportPDF(data, reportType, dateLabel, companyName);
              } catch (err) { console.error('PDF error:', err); }
              finally { setPdfLoading(false); }
            }}
            className="h-8 px-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-medium hover:bg-red-100 flex items-center gap-1 disabled:opacity-50"
          >
            {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} PDF
          </button>
          <button
            disabled={excelLoading || !data}
            onClick={async () => {
              if (!data) return;
              setExcelLoading(true);
              try {
                const { exportBillingReportExcel } = await import('@/lib/excelExport');
                const dateLabel = reportType === 'daily' ? selectedDate : selectedMonth;
                await exportBillingReportExcel(data, reportType, dateLabel);
              } catch (err) { console.error('Excel error:', err); }
              finally { setExcelLoading(false); }
            }}
            className="h-8 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-medium hover:bg-emerald-100 flex items-center gap-1 disabled:opacity-50"
          >
            {excelLoading ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
      ) : !s ? (
        <div className="p-12 text-center text-sm text-slate-400">ไม่มีข้อมูล</div>
      ) : (
        <>
          {/* Report Title */}
          <div className="text-center py-2">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              {reportType === 'daily' ? `รายงานประจำวัน — ${thaiDate(selectedDate)}` : `รายงานประจำเดือน — ${thaiMonth(selectedMonth)}`}
            </h2>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'ยอดเรียกเก็บ', value: s.total_billed, color: 'text-blue-600', icon: <Receipt size={16} /> },
              { label: 'เก็บเงินได้', value: s.total_collected, color: 'text-emerald-600', icon: <CheckCircle2 size={16} /> },
              { label: 'ค้างชำระ', value: s.total_outstanding, color: 'text-amber-600', icon: <Clock size={16} /> },
              { label: reportType === 'monthly' ? 'VAT รวม' : 'จำนวนบิล', value: reportType === 'monthly' ? s.total_vat : s.total_invoices, color: 'text-slate-700 dark:text-white', icon: reportType === 'monthly' ? <DollarSign size={16} /> : <FileText size={16} />, isCurrency: reportType === 'monthly' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">{kpi.icon} {kpi.label}</div>
                <p className={`text-xl font-bold ${kpi.color}`}>
                  {kpi.isCurrency !== false && typeof kpi.value === 'number' && kpi.label !== 'จำนวนบิล' ? `฿${kpi.value.toLocaleString()}` : kpi.value?.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'เครดิต', value: controlStats?.credit_amount || 0, count: controlRows.filter(r => r.clearance_type === 'credit').length, color: 'text-blue-600' },
              { label: 'No Charge', value: 0, count: controlRows.filter(r => r.clearance_type === 'no_charge').length, color: 'text-slate-600' },
              { label: 'Waived', value: controlRows.filter(r => r.clearance_type === 'waived').reduce((s, r) => s + ((r.original_amount || 0) - (r.final_amount || 0)), 0), count: controlRows.filter(r => r.clearance_type === 'waived').length, color: 'text-amber-600' },
              { label: 'รับเงินสด/โอน', value: controlStats?.paid_amount || 0, count: controlRows.filter(r => r.clearance_type === 'paid').length, color: 'text-emerald-600' },
            ].map(item => (
              <div key={item.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className={`text-lg font-bold ${item.color}`}>฿{item.value.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">{item.count} รายการ</p>
              </div>
            ))}
          </div>

          {controlReport && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <BarChart3 size={16} /> Billing Control Report
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    ตรวจความครบถ้วนของ Gate, Clearance, บิลค้างชำระ, No Charge, Waived, Credit และใบลดหนี้
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">ช่วงรายงาน</p>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-300">{controlReport.date_from} ถึง {controlReport.date_to}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
                {[
                  { label: 'Missing Clearance', value: controlReport.summary.missing_clearance_count, amount: 0, color: 'text-rose-600' },
                  { label: 'Outstanding', value: controlReport.summary.outstanding_invoice_count, amount: controlReport.summary.outstanding_amount, color: 'text-amber-600' },
                  { label: 'Credit Customer', value: controlReport.summary.credit_count, amount: controlReport.summary.credit_amount, color: 'text-blue-600' },
                  { label: 'No Charge/Waived', value: controlReport.summary.no_charge_count + controlReport.summary.waived_count, amount: controlReport.summary.no_charge_amount + controlReport.summary.waived_amount, color: 'text-slate-700 dark:text-slate-200' },
                  { label: 'Credit Note', value: controlReport.summary.credit_note_count, amount: controlReport.summary.credit_note_amount, color: 'text-amber-600' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <p className="text-[10px] text-slate-400">{item.label}</p>
                    <p className={`text-lg font-bold ${item.color}`}>{item.value.toLocaleString()} รายการ</p>
                    {item.amount > 0 && <p className="text-[10px] text-slate-400">฿{item.amount.toLocaleString()}</p>}
                  </div>
                ))}
              </div>

              {controlReport.rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">ไม่พบรายการที่ต้องควบคุมในช่วงนี้</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5">สถานะ</th>
                        <th className="text-left px-4 py-2.5">เวลา</th>
                        <th className="text-left px-4 py-2.5">รายการควบคุม</th>
                        <th className="text-left px-4 py-2.5">ตู้/ลูกค้า</th>
                        <th className="text-left px-4 py-2.5">เอกสาร</th>
                        <th className="text-right px-4 py-2.5">ยอดควบคุม</th>
                        <th className="text-left px-4 py-2.5">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {controlReport.rows.slice(0, 60).map((row, index) => {
                        const severity = controlSeverityBadge(row.severity);
                        return (
                          <tr key={`${row.row_type}-${row.invoice_id || row.eir_number || index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded-lg font-semibold ${severity.color}`}>{severity.label}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-500">{row.event_at ? formatDateTime(row.event_at) : '-'}</td>
                            <td className="px-4 py-2">
                              <p className="font-semibold text-slate-800 dark:text-white">{row.title}</p>
                              <p className="text-[10px] text-slate-400">{controlTypeLabel(row.control_type)}{row.transaction_type ? ` · ${row.transaction_type === 'gate_in' ? 'Gate-In' : 'Gate-Out'}` : ''}</p>
                            </td>
                            <td className="px-4 py-2">
                              <p className="font-mono font-semibold text-slate-800 dark:text-white">{row.container_number || '-'}</p>
                              <p className="text-slate-400">{row.customer_name || '-'}</p>
                            </td>
                            <td className="px-4 py-2">
                              {row.eir_number && <button onClick={() => window.open(`/eir/${row.eir_number}`, '_blank')} className="font-mono text-blue-500 hover:text-blue-700 block">{row.eir_number}</button>}
                              {row.invoice_id && <button onClick={() => window.open(`/billing/print?id=${row.invoice_id}&type=${row.control_type === 'paid' ? 'receipt' : 'invoice'}`, '_blank')} className="font-mono text-blue-500 hover:text-blue-700 block">{row.invoice_number || `#${row.invoice_id}`}</button>}
                              {row.booking_ref && <p className="font-mono text-[10px] text-slate-400">BK: {row.booking_ref}</p>}
                              {!row.eir_number && !row.invoice_id && !row.booking_ref && <span className="text-slate-400">-</span>}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <p className="font-mono font-bold text-slate-800 dark:text-white">฿{(row.impact_amount || row.final_amount || 0).toLocaleString()}</p>
                              {row.original_amount !== row.final_amount && <p className="text-[10px] text-slate-400">จาก ฿{(row.original_amount || 0).toLocaleString()}</p>}
                            </td>
                            <td className="px-4 py-2 max-w-[260px]">
                              <p className="truncate text-slate-600 dark:text-slate-300">{row.reason || '-'}</p>
                              {row.actor_name && <p className="text-[10px] text-slate-400">โดย {row.actor_name}</p>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {controlReport.rows.length > 60 && (
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
                      แสดง 60 รายการแรกจาก {controlReport.rows.length} รายการ
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Gate Activity */}
          {data.gateActivity && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3">🚪 กิจกรรม Gate</h3>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><ArrowDownToLine size={14} /></div>
                  <div><p className="text-lg font-bold text-emerald-600">{data.gateActivity.gate_in}</p><p className="text-[10px] text-slate-400">Gate-In</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600"><TrendingUp size={14} /></div>
                  <div><p className="text-lg font-bold text-amber-600">{data.gateActivity.gate_out}</p><p className="text-[10px] text-slate-400">Gate-Out</p></div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {controlRows.filter(r => ['credit', 'no_charge', 'waived'].includes(r.clearance_type)).length > 0 && (
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-white">🛡️ รายงานควบคุม Credit / No Charge / Waived</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {controlRows.filter(r => ['credit', 'no_charge', 'waived'].includes(r.clearance_type)).slice(0, 15).map(row => {
                    const badge = clearanceLabel(row.clearance_type);
                    return (
                      <div key={row.clearance_id} className="p-3 px-4 flex items-center justify-between">
                        <div>
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${badge.color}`}>{badge.label}</span>
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 ml-2">{row.container_number || '-'}</span>
                          <span className="text-xs text-slate-400 ml-2">{row.customer_name || '-'}</span>
                          {row.eir_number && <span className="font-mono text-[10px] text-slate-400 ml-2">{row.eir_number}</span>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-800 dark:text-white">฿{(row.final_amount || 0).toLocaleString()}</p>
                          {row.clearance_type === 'waived' && <p className="text-[10px] text-amber-600">ยกเว้น ฿{((row.original_amount || 0) - (row.final_amount || 0)).toLocaleString()}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Breakdown by Charge Type */}
            {data.byChargeType && data.byChargeType.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-white">📊 แยกตามประเภทค่าบริการ</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.byChargeType.map((ct: { charge_type: string; count: number; total: number }, i: number) => {
                    const maxTotal = Math.max(...data.byChargeType.map((c: { total: number }) => c.total));
                    const pct = maxTotal > 0 ? (ct.total / maxTotal) * 100 : 0;
                    return (
                      <div key={i} className="p-3 px-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600 dark:text-slate-300">{CHARGE_LABELS_RPT[ct.charge_type] || ct.charge_type}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-white">฿{ct.total.toLocaleString()} ({ct.count})</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Customers (monthly) */}
            {reportType === 'monthly' && data.topCustomers && data.topCustomers.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-2"><Users size={14} /> ลูกค้า Top 10</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.topCustomers.map((c: { customer_name: string; invoice_count: number; total: number }, i: number) => (
                    <div key={i} className="p-3 px-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                          {i + 1}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-300">{c.customer_name || 'ไม่ระบุ'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-slate-800 dark:text-white">฿{c.total.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 ml-1">({c.invoice_count} บิล)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Invoices Table (daily report) */}
            {reportType === 'daily' && data.invoices && data.invoices.length > 0 && (
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-white">📋 รายการบิลวันนี้ ({data.invoices.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5">เลขบิล</th>
                        <th className="text-left px-4 py-2.5">ลูกค้า</th>
                        <th className="text-left px-4 py-2.5">ประเภท</th>
                        <th className="text-left px-4 py-2.5">ตู้</th>
                        <th className="text-right px-4 py-2.5">ยอดรวม</th>
                        <th className="text-center px-4 py-2.5">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {data.invoices.map((inv: { invoice_id: number; invoice_number: string; customer_name: string; charge_type: string; container_number: string; grand_total: number; status: string }) => (
                        <tr key={inv.invoice_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-2 font-mono font-semibold text-slate-800 dark:text-white">{inv.invoice_number}</td>
                          <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{inv.customer_name || '-'}</td>
                          <td className="px-4 py-2">{CHARGE_LABELS_RPT[inv.charge_type] || inv.charge_type}</td>
                          <td className="px-4 py-2 font-mono text-slate-500">{inv.container_number || '-'}</td>
                          <td className="px-4 py-2 text-right font-semibold">฿{inv.grand_total?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                              inv.status === 'issued' ? 'bg-blue-50 text-blue-600' :
                              inv.status === 'cancelled' ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-500'
                            }`}>{inv.status === 'paid' ? 'ชำระ' : inv.status === 'issued' ? 'แจ้งหนี้' : inv.status === 'cancelled' ? 'ยกเลิก' : inv.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Daily Breakdown Chart (monthly) */}
          {reportType === 'monthly' && data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white">📈 ยอดรายวันในเดือน</h3>
              </div>
              <div className="p-4">
                <div className="flex items-end gap-1 h-40">
                  {data.dailyBreakdown.map((d: { date: string; total: number; collected: number; count: number }, i: number) => {
                    const maxVal = Math.max(...data.dailyBreakdown.map((x: { total: number }) => x.total));
                    const pct = maxVal > 0 ? (d.total / maxVal) * 100 : 0;
                    const collectedPct = maxVal > 0 ? (d.collected / maxVal) * 100 : 0;
                    const day = new Date(d.date).getDate();
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${new Date(d.date).toLocaleDateString('th-TH')}\nยอดรวม: ฿${d.total.toLocaleString()}\nเก็บได้: ฿${d.collected.toLocaleString()}\nจำนวน: ${d.count} บิล`}>
                        <div className="w-full relative" style={{ height: `${Math.max(pct, 2)}%` }}>
                          <div className="absolute bottom-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 rounded-t-sm" style={{ height: '100%' }} />
                          <div className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-sm" style={{ height: `${collectedPct > 0 ? (collectedPct / pct * 100) : 0}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-400">{day}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-200 dark:bg-blue-800 rounded" /> ยอดรวม</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 rounded" /> เก็บได้</span>
                </div>
              </div>
            </div>
          )}

          {/* Status Breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-white mb-3">📊 สรุปตามสถานะ</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'ทั้งหมด', value: s.total_invoices, bgColor: 'bg-slate-50 dark:bg-slate-700/50', color: 'text-slate-700 dark:text-white' },
                { label: 'ชำระแล้ว', value: s.paid_count, bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', color: 'text-emerald-600' },
                { label: 'ค้างชำระ', value: s.issued_count, bgColor: 'bg-blue-50 dark:bg-blue-900/20', color: 'text-blue-600' },
                { label: 'ยกเลิก', value: s.cancelled_count, bgColor: 'bg-slate-50 dark:bg-slate-700/50', color: 'text-slate-400' },
              ].map((item, i) => (
                <div key={i} className={`text-center p-3 rounded-xl ${item.bgColor}`}>
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
