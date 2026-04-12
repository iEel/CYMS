'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Loader2, Search, FileText, ShieldCheck,
  CheckCircle2, XCircle, AlertTriangle,
  Send, FileDown, Filter,
} from 'lucide-react';

interface ValidationResult {
  check: string; status: 'pass' | 'warning' | 'fail'; detail: string;
}

export default function EDIPage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'validate' | 'codeco'>('validate');
  const yardId = session?.activeYardId || 1;

  // Validate
  const [valForm, setValForm] = useState({ container_number: '', seal_number: '' });
  const [valLoading, setValLoading] = useState(false);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [valOverall, setValOverall] = useState('');

  const handleValidate = async () => {
    if (!valForm.container_number) return;
    setValLoading(true); setValidations([]); setValOverall('');
    try {
      const res = await fetch('/api/edi/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...valForm, yard_id: yardId }),
      });
      const data = await res.json();
      setValidations(data.validations || []);
      setValOverall(data.overall_status || '');
    } catch (err) { console.error(err); }
    finally { setValLoading(false); }
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">EDI & ข้อมูลล่วงหน้า</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ตรวจสอบเลขซีล, ส่ง CODECO ให้สายเรือ</p>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'validate' as const, label: 'ตรวจเลขซีล', icon: <ShieldCheck size={14} /> },
          { id: 'codeco' as const, label: 'CODECO', icon: <Send size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== VALIDATE TAB =================== */}
      {activeTab === 'validate' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><ShieldCheck size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">Seal Cross-Validation</h3>
                <p className="text-xs text-slate-400">ตรวจเลขตู้/ซีลเทียบ Booking ในระบบ</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>เลขตู้ *</label><input type="text" value={valForm.container_number} onChange={e => setValForm({ ...valForm, container_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="ABCU1234567" /></div>
              <div><label className={labelClass}>เลขซีล</label><input type="text" value={valForm.seal_number} onChange={e => setValForm({ ...valForm, seal_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="SEAL123456" /></div>
            </div>
            <button onClick={handleValidate} disabled={valLoading || !valForm.container_number}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {valLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} ตรวจสอบ
            </button>
          </div>

          {validations.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
              <div className={`p-3 rounded-xl text-sm font-semibold ${
                valOverall === 'pass' ? 'bg-emerald-50 text-emerald-700' : valOverall === 'fail' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {valOverall === 'pass' ? '✅ ผ่านทุกรายการ' : valOverall === 'fail' ? '❌ ตรวจไม่ผ่าน' : '⚠️ มีข้อสังเกต'}
              </div>
              <div className="space-y-2">
                {validations.map((v, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                    v.status === 'pass' ? 'border-emerald-200 bg-emerald-50/50' : v.status === 'fail' ? 'border-rose-200 bg-rose-50/50' : 'border-amber-200 bg-amber-50/50'
                  }`}>
                    {v.status === 'pass' ? <CheckCircle2 size={16} className="text-emerald-500" /> :
                     v.status === 'fail' ? <XCircle size={16} className="text-rose-500" /> :
                     <AlertTriangle size={16} className="text-amber-500" />}
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-white">{v.check}</p>
                      <p className="text-xs text-slate-400">{v.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== CODECO TAB =================== */}
      {activeTab === 'codeco' && <CodecoOutbound yardId={yardId} />}
    </div>
  );
}

/* ===================== CODECO OUTBOUND COMPONENT ===================== */
interface CodecoTx {
  message_type: string; transaction_type: string; eir_number: string;
  date: string; container_number: string; size: string; type: string;
  shipping_line: string; laden_empty: string; seal_number: string;
  truck_plate: string; driver_name: string; booking_ref: string; yard_code: string;
}

function CodecoOutbound({ yardId }: { yardId: number }) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [txType, setTxType] = useState('all');
  const [slFilter, setSlFilter] = useState('');
  const [shippingLines, setShippingLines] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<CodecoTx[]>([]);
  const [summary, setSummary] = useState({ total: 0, gate_in: 0, gate_out: 0 });
  const [loading, setLoading] = useState(false);
  const [codecoPage, setCodecoPage] = useState(1);
  const codecoPerPage = 25;

  // SFTP Endpoints
  interface Endpoint { endpoint_id: number; name: string; host: string; shipping_line: string; type: string; format: string; is_active: boolean; last_sent_at: string; last_status: string; }
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEp, setSelectedEp] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    validationErrors?: { transaction_id: number; container_number: string; field: string; message: string }[];
    errorCount?: number;
  } | null>(null);

  const buildUrl = useCallback((format = 'json') => {
    let url = `/api/edi/codeco?yard_id=${yardId}&format=${format}`;
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo) url += `&date_to=${dateTo}`;
    if (txType && txType !== 'all') url += `&type=${txType}`;
    if (slFilter) url += `&shipping_line=${encodeURIComponent(slFilter)}`;
    return url;
  }, [yardId, dateFrom, dateTo, txType, slFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildUrl('json'));
      const data = await res.json();
      if (!data.error) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || { total: 0, gate_in: 0, gate_out: 0 });
        setShippingLines(data.shipping_lines || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [buildUrl]);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch('/api/edi/endpoints');
      const data = await res.json();
      const active = (data.endpoints || []).filter((e: Endpoint) => e.is_active);
      setEndpoints(active);
      if (active.length > 0 && !selectedEp) setSelectedEp(active[0].endpoint_id);
    } catch { /* */ }
  }, [selectedEp]);

  useEffect(() => { fetchData(); fetchEndpoints(); }, [fetchData, fetchEndpoints]);

  const handleSftpSend = async () => {
    if (!selectedEp || summary.total === 0) return;
    setSending(true); setSendResult(null);
    try {
      const res = await fetch('/api/edi/codeco/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint_id: selectedEp, yard_id: yardId,
          date_from: dateFrom, date_to: dateTo,
          type: txType !== 'all' ? txType : undefined,
          shipping_line: slFilter || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSendResult({ success: true, message: data.message });
        fetchEndpoints(); // refresh last_sent
      } else {
        setSendResult({
          success: false,
          message: data.error || 'เกิดข้อผิดพลาด',
          validationErrors: data.validation_errors,
          errorCount: data.error_count,
        });
      }
    } catch { setSendResult({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' }); }
    finally { setSending(false); }
  };

  const fmtDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  const inputClass = "h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-700 dark:text-white";

  // CODECO pagination
  const codecoTotalPages = Math.ceil(transactions.length / codecoPerPage);
  const codecoPaginated = transactions.slice((codecoPage - 1) * codecoPerPage, codecoPage * codecoPerPage);

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
            <Send size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">CODECO — Container Departure/Arrival Message</h3>
            <p className="text-xs text-slate-400">สร้างข้อมูล EDI ส่งให้สายเรือ — แจ้ง Gate-In / Gate-Out events</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">จากวันที่</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ถึงวันที่</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ประเภท</label>
            <select value={txType} onChange={e => setTxType(e.target.value)} className={inputClass}>
              <option value="all">ทั้งหมด</option>
              <option value="gate_in">Gate-In</option>
              <option value="gate_out">Gate-Out</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">สายเรือ</label>
            <select value={slFilter} onChange={e => setSlFilter(e.target.value)} className={inputClass}>
              <option value="">ทั้งหมด</option>
              {shippingLines.map(sl => <option key={sl} value={sl}>{sl}</option>)}
            </select>
          </div>
          <button onClick={fetchData} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 flex items-center gap-1">
            <Filter size={12} /> กรอง
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.total}</p>
          <p className="text-xs text-slate-400">รายการทั้งหมด</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{summary.gate_in}</p>
          <p className="text-xs text-slate-400">Gate-In</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{summary.gate_out}</p>
          <p className="text-xs text-slate-400">Gate-Out</p>
        </div>
      </div>

      {/* Send CODECO */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-white mb-3 flex items-center gap-2"><Send size={14} /> ส่ง CODECO</h4>
        {endpoints.length === 0 ? (
          <p className="text-xs text-slate-400">ยังไม่มี Endpoint — ไปตั้งค่าที่ <b>ตั้งค่า → EDI Configuration</b></p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">เลือก Endpoint</label>
              <select value={selectedEp} onChange={e => setSelectedEp(parseInt(e.target.value))} className={inputClass + ' w-full'}>
                {endpoints.map(ep => (
                  <option key={ep.endpoint_id} value={ep.endpoint_id}>
                    {ep.type === 'email' ? '📧' : ep.type === 'api' ? '🌐' : ep.type === 'ftp' ? '📂' : '📁'} {ep.name} ({ep.type === 'email' || ep.type === 'api' ? ep.host : `${ep.host}:${ep.format}`}) {ep.shipping_line ? `— ${ep.shipping_line}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const sel = endpoints.find(e => e.endpoint_id === selectedEp);
              return sel ? (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${
                  sel.type === 'email' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' :
                  sel.type === 'api' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                  sel.type === 'ftp' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                  'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20'
                }`}>
                  {sel.type === 'email' ? '📧 Email' : sel.type === 'api' ? '🌐 API' : sel.type === 'ftp' ? '📂 FTP' : '📁 SFTP'} • {sel.format}
                </span>
              ) : null;
            })()}
            <button onClick={handleSftpSend} disabled={sending || summary.total === 0}
              className="h-9 px-5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-all">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'กำลังส่ง...' : `ส่ง ${summary.total} รายการ`}
            </button>
          </div>
        )}
        {sendResult && (
          <div className={`mt-3 p-3 rounded-xl text-sm ${sendResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {sendResult.message}
            {sendResult.validationErrors && sendResult.validationErrors.length > 0 && (
              <div className="mt-2 space-y-1 text-xs">
                <p className="font-semibold">พบข้อมูลไม่ครบ {sendResult.errorCount || sendResult.validationErrors.length} จุด ตัวอย่าง:</p>
                {sendResult.validationErrors.slice(0, 8).map((err, idx) => (
                  <p key={`${err.transaction_id}-${err.field}-${idx}`} className="font-mono">
                    {err.container_number} • {err.field} • {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Download Buttons */}
      <div className="flex gap-2">
        {([
          { format: 'edifact', label: 'EDIFACT (.edi)', ext: 'edi', mime: 'text/plain' },
          { format: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv' },
          { format: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
        ] as const).map(dl => (
          <button key={dl.format} onClick={async () => {
            try {
              const res = await fetch(buildUrl(dl.format));
              if (!res.ok) { const err = await res.json(); toast('error', err.error || 'Error'); return; }
              let blob: Blob;
              if (dl.format === 'json') {
                const data = await res.json();
                blob = new Blob([JSON.stringify(data, null, 2)], { type: dl.mime });
              } else {
                blob = await res.blob();
              }
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `CODECO_${slFilter || 'ALL'}_${new Date().toISOString().split('T')[0]}.${dl.ext}`;
              a.click();
              URL.revokeObjectURL(url);
            } catch { toast('error', 'ไม่สามารถดาวน์โหลดได้'); }
          }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 transition-all">
            <FileDown size={14} /> {dl.label}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-2">
            <FileText size={14} /> CODECO Messages ({transactions.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">ไม่พบรายการ Gate ในช่วงวันที่เลือก</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                <tr>
                  <th className="text-center px-3 py-2.5">ประเภท</th>
                  <th className="text-left px-3 py-2.5">วันที่/เวลา</th>
                  <th className="text-left px-3 py-2.5">เลขตู้</th>
                  <th className="text-left px-3 py-2.5">ขนาด</th>
                  <th className="text-left px-3 py-2.5">สายเรือ</th>
                  <th className="text-center px-3 py-2.5">สถานะ</th>
                  <th className="text-left px-3 py-2.5">ซีล</th>
                  <th className="text-left px-3 py-2.5">ทะเบียนรถ</th>
                  <th className="text-left px-3 py-2.5">EIR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {codecoPaginated.map((tx, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        tx.transaction_type === 'gate_in' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>{tx.transaction_type === 'gate_in' ? 'เข้า' : 'ออก'}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{fmtDate(tx.date)}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-white">{tx.container_number}</td>
                    <td className="px-3 py-2">{tx.size}&apos;{tx.type}</td>
                    <td className="px-3 py-2">{tx.shipping_line || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${tx.laden_empty === 'LADEN' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {tx.laden_empty === 'LADEN' ? 'มีสินค้า' : 'เปล่า'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">{tx.seal_number || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">{tx.truck_plate || '-'}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{tx.eir_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CODECO Pagination */}
        {!loading && codecoTotalPages > 1 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400">แสดง {(codecoPage - 1) * codecoPerPage + 1}–{Math.min(codecoPage * codecoPerPage, transactions.length)} จาก {transactions.length} รายการ</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCodecoPage(1)} disabled={codecoPage === 1} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">«</button>
              <button onClick={() => setCodecoPage(p => Math.max(1, p - 1))} disabled={codecoPage === 1} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">‹</button>
              {Array.from({ length: Math.min(5, codecoTotalPages) }, (_, i) => {
                let page: number;
                if (codecoTotalPages <= 5) page = i + 1;
                else if (codecoPage <= 3) page = i + 1;
                else if (codecoPage >= codecoTotalPages - 2) page = codecoTotalPages - 4 + i;
                else page = codecoPage - 2 + i;
                return <button key={page} onClick={() => setCodecoPage(page)} className={`w-8 h-8 rounded-lg text-xs font-medium ${page === codecoPage ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{page}</button>;
              })}
              <button onClick={() => setCodecoPage(p => Math.min(codecoTotalPages, p + 1))} disabled={codecoPage === codecoTotalPages} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">›</button>
              <button onClick={() => setCodecoPage(codecoTotalPages)} disabled={codecoPage === codecoTotalPages} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
