'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Loader2, Calculator, Receipt, CreditCard, FileText, Plus, Search,
  CheckCircle2, XCircle, Clock, RotateCcw, DollarSign, TrendingUp,
  AlertTriangle, Lock, Unlock, Ban, ArrowDownToLine,
  Printer, FileDown, Zap, FileSpreadsheet, BarChart3, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import DemurrageTab from './DemurrageTab';

interface TariffRow {
  tariff_id: number; charge_type: string; description: string; rate: number;
  unit: string; free_days: number; customer_name: string; is_active: boolean;
}

interface InvoiceRow {
  invoice_id: number; invoice_number: string; customer_name: string;
  container_number: string; container_status: string; charge_type: string; description: string;
  quantity: number; unit_price: number; total_amount: number;
  vat_amount: number; grand_total: number; status: string;
  due_date: string; paid_at: string; created_at: string;
}

interface Stats {
  total_outstanding: number; total_paid: number; total_overdue: number; pending_count: number;
}

const CHARGE_LABELS: Record<string, string> = {
  storage: '📦 ค่าฝากตู้', lolo: '🏗️ ค่ายก LOLO', mnr: '🔧 ค่าซ่อม M&R',
  washing: '🫧 ค่าล้างตู้', pti: '🔌 ค่า PTI', reefer: '❄️ ค่าปลั๊กเย็น', other: '📋 อื่นๆ',
};
const UNIT_LABELS: Record<string, string> = {
  per_day: '/ วัน', per_move: '/ ครั้ง', per_container: '/ ตู้', fixed: 'คงที่',
};

export default function BillingPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'invoices' | 'create' | 'tariffs' | 'hold' | 'documents' | 'export' | 'reports' | 'demurrage' | 'ar_aging'>('invoices');

  // Credit Note Modal
  const [cnModal, setCnModal] = useState<{ open: boolean; invoice: InvoiceRow | null }>({ open: false, invoice: null });
  const [cnReason, setCnReason] = useState('');
  const [cnAmount, setCnAmount] = useState(0);
  const [cnLoading, setCnLoading] = useState(false);
  const [cnResult, setCnResult] = useState<{ success: boolean; message: string } | null>(null);
  const yardId = session?.activeYardId || 1;

  // Invoices
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total_outstanding: 0, total_paid: 0, total_overdue: 0, pending_count: 0 });
  const [invLoading, setInvLoading] = useState(false);
  const [invFilter, setInvFilter] = useState('');
  const [invPage, setInvPage] = useState(1);
  const invPerPage = 25;

  // Tariffs
  const [tariffs, setTariffs] = useState<TariffRow[]>([]);
  const [tariffLoading, setTariffLoading] = useState(false);

  // Create
  const [createForm, setCreateForm] = useState({
    customer_id: '', container_number: '', charge_type: 'storage',
    description: '', quantity: 1, unit_price: 0, due_date: '', notes: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [customers, setCustomers] = useState<Array<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean; tax_id?: string }>>([]);
  const [custSearch, setCustSearch] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [selectedCust, setSelectedCust] = useState<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean; tax_id?: string } | null>(null);

  // Auto-calc
  const [autoCalcContainer, setAutoCalcContainer] = useState('');
  const [autoCalcLoading, setAutoCalcLoading] = useState(false);
  const [autoCalcResult, setAutoCalcResult] = useState<{ container: Record<string, unknown>; dwell_days: number; charges: Array<{ charge_type: string; description: string; quantity: number; unit_price: number; subtotal: number }>; summary: { total_before_vat: number; vat_amount: number; grand_total: number } } | null>(null);

  // Tariff create
  const [tariffForm, setTariffForm] = useState({
    charge_type: 'storage', description: '', rate: 0, unit: 'per_day', free_days: 0,
  });

  const fetchInvoices = useCallback(async () => {
    setInvLoading(true);
    try {
      let url = `/api/billing/invoices?yard_id=${yardId}`;
      if (invFilter) url += `&status=${invFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setInvoices(data.invoices || []);
      setStats(data.stats || { total_outstanding: 0, total_paid: 0, total_overdue: 0, pending_count: 0 });
    } catch (err) { console.error(err); }
    finally { setInvLoading(false); }
  }, [yardId, invFilter]);

  const fetchTariffs = useCallback(async () => {
    setTariffLoading(true);
    try {
      const res = await fetch(`/api/billing/tariffs?yard_id=${yardId}`);
      const data = await res.json();
      setTariffs((data.tariffs || []).filter((t: TariffRow) => t.is_active));
    } catch (err) { console.error(err); }
    finally { setTariffLoading(false); }
  }, [yardId]);

  useEffect(() => {
    if (activeTab === 'invoices' || activeTab === 'hold') fetchInvoices();
    if (activeTab === 'tariffs') fetchTariffs();
    if (activeTab === 'create' && customers.length === 0) {
      fetch('/api/settings/customers').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setCustomers(d.filter((c: { is_active: boolean }) => c.is_active));
      }).catch(() => {});
    }
  }, [activeTab, fetchInvoices, fetchTariffs, customers.length]);

  const updateInvoice = async (id: number, action: string) => {
    const res = await fetch('/api/billing/invoices', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: id, action }),
    });
    const data = await res.json();
    if (data.error) { toast('error', data.error); }
    fetchInvoices();
  };

  const handleCreateInvoice = async () => {
    if (!createForm.customer_id || !createForm.unit_price) return;
    setCreateLoading(true); setCreateResult(null);
    try {
      // Look up container if provided
      let containerId = null;
      if (createForm.container_number) {
        const cRes = await fetch(`/api/containers?search=${createForm.container_number}&yard_id=${yardId}`);
        const cData = await cRes.json();
        if (Array.isArray(cData) && cData.length > 0) containerId = cData[0].container_id;
      }

      const res = await fetch('/api/billing/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId, customer_id: parseInt(createForm.customer_id),
          container_id: containerId, charge_type: createForm.charge_type,
          description: createForm.description || CHARGE_LABELS[createForm.charge_type],
          quantity: createForm.quantity, unit_price: createForm.unit_price,
          due_date: createForm.due_date || null, notes: createForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const total = createForm.quantity * createForm.unit_price;
        setCreateResult({ success: true, message: `✅ สร้าง ${data.invoice_number} — ฿${(total * 1.07).toLocaleString()} (รวม VAT)` });
        setCreateForm({ ...createForm, description: '', quantity: 1, unit_price: 0, notes: '' });
      } else {
        setCreateResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); }
    finally { setCreateLoading(false); }
  };

  const handleCreateTariff = async () => {
    if (!tariffForm.rate) return;
    await fetch('/api/billing/tariffs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yard_id: yardId, ...tariffForm }),
    });
    setTariffForm({ ...tariffForm, description: '', rate: 0, free_days: 0 });
    fetchTariffs();
  };

  const deleteTariff = async (id: number) => {
    await fetch('/api/billing/tariffs', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tariff_id: id, action: 'delete' }),
    });
    fetchTariffs();
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: 'ร่าง', color: 'bg-slate-100 text-slate-500', icon: <Clock size={10} /> },
    issued: { label: 'แจ้งหนี้', color: 'bg-blue-50 text-blue-600', icon: <Receipt size={10} /> },
    paid: { label: 'ชำระแล้ว', color: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle2 size={10} /> },
    overdue: { label: 'เกินกำหนด', color: 'bg-rose-50 text-rose-500', icon: <AlertTriangle size={10} /> },
    cancelled: { label: 'ยกเลิก', color: 'bg-slate-100 text-slate-400', icon: <Ban size={10} /> },
    credit_note: { label: 'ใบลดหนี้', color: 'bg-amber-50 text-amber-600', icon: <ArrowDownToLine size={10} /> },
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  // Invoice pagination
  const invFiltered = invoices;
  const invTotalPages = Math.ceil(invFiltered.length / invPerPage);
  const invPaginated = invFiltered.slice((invPage - 1) * invPerPage, invPage * invPerPage);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">บัญชี & การเงิน</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ใบแจ้งหนี้, ตั้ง Tariff, Hold/Release, เอกสารบัญชี</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ค้างชำระ', value: stats.total_outstanding, color: 'text-blue-600', icon: <Receipt size={16} />, count: stats.pending_count },
          { label: 'ชำระแล้ว', value: stats.total_paid, color: 'text-emerald-600', icon: <CheckCircle2 size={16} /> },
          { label: 'เกินกำหนด', value: stats.total_overdue, color: 'text-rose-500', icon: <AlertTriangle size={16} /> },
          { label: 'รวมทั้งหมด', value: stats.total_outstanding + stats.total_paid, color: 'text-slate-800 dark:text-white', icon: <TrendingUp size={16} /> },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">{kpi.icon} {kpi.label}</div>
            <p className={`text-lg font-bold ${kpi.color}`}>฿{(kpi.value || 0).toLocaleString()}</p>
            {kpi.count !== undefined && <p className="text-[10px] text-slate-400 mt-0.5">{kpi.count} รายการ</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
        {[
          { id: 'invoices' as const, label: 'ใบแจ้งหนี้', icon: <Receipt size={14} /> },
          { id: 'create' as const, label: 'สร้างบิล', icon: <Plus size={14} /> },
          { id: 'tariffs' as const, label: 'Tariff', icon: <Calculator size={14} /> },
          { id: 'hold' as const, label: 'Hold', icon: <Lock size={14} /> },
          { id: 'ar_aging' as const, label: 'AR Aging', icon: <Users size={14} /> },
          { id: 'documents' as const, label: 'เอกสาร', icon: <Printer size={14} /> },
          { id: 'export' as const, label: 'ERP', icon: <FileDown size={14} /> },
          { id: 'reports' as const, label: 'รายงาน', icon: <BarChart3 size={14} /> },
          { id: 'demurrage' as const, label: 'Demurrage', icon: <AlertTriangle size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== INVOICES TAB =================== */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Receipt size={16} /> ใบแจ้งหนี้ ({invoices.length})</h3>
            <div className="flex items-center gap-2">
              <select value={invFilter} onChange={e => setInvFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
                <option value="">ทุกสถานะ</option>
                <option value="draft">ร่าง</option><option value="issued">แจ้งหนี้</option>
                <option value="paid">ชำระแล้ว</option><option value="overdue">เกินกำหนด</option>
              </select>
              <button onClick={fetchInvoices} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
            </div>
          </div>
          {invLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีใบแจ้งหนี้ — กดแท็บ &quot;สร้างบิล&quot; เพื่อเริ่ม</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {invPaginated.map(inv => (
                <div key={inv.invoice_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign size={16} className="text-blue-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{inv.invoice_number}</span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${statusConfig[inv.status]?.color}`}>
                            {statusConfig[inv.status]?.icon} {statusConfig[inv.status]?.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span>{inv.customer_name || 'ไม่ระบุ'}</span>
                          <span>• {CHARGE_LABELS[inv.charge_type] || inv.charge_type}</span>
                          {inv.container_number && <span>• 🏷️ {inv.container_number}</span>}
                          <span>• {formatDateTime(inv.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800 dark:text-white">฿{(inv.grand_total || 0).toLocaleString()}</span>
                      <div className="flex gap-1">
                        {inv.status === 'draft' && (
                          <button onClick={() => updateInvoice(inv.invoice_id, 'issue')}
                            className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100">แจ้งหนี้</button>
                        )}
                        {inv.status === 'issued' && (
                          <button onClick={() => updateInvoice(inv.invoice_id, 'pay')}
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"><CreditCard size={10} /> ชำระ</button>
                        )}
                        {/* Print: invoice for unpaid, receipt for paid */}
                        <button onClick={() => window.open(`/billing/print?id=${inv.invoice_id}&type=${inv.status === 'paid' ? 'receipt' : 'invoice'}`, '_blank')}
                          className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-500 text-xs font-medium hover:bg-slate-100 flex items-center gap-1"><Printer size={10} /> พิมพ์</button>
                        {['issued', 'paid'].includes(inv.status) && (
                          <button onClick={() => { setCnModal({ open: true, invoice: inv }); setCnAmount(inv.grand_total); setCnReason(''); setCnResult(null); }}
                            className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 flex items-center gap-1"><ArrowDownToLine size={10} /> ใบลดหนี้</button>
                        )}
                        {['draft', 'issued'].includes(inv.status) && (
                          <button onClick={() => updateInvoice(inv.invoice_id, 'cancel')} className="px-1 py-1 text-slate-400 hover:text-red-500"><XCircle size={14} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invoice Pagination */}
          {!invLoading && invTotalPages > 1 && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-400">แสดง {(invPage - 1) * invPerPage + 1}–{Math.min(invPage * invPerPage, invFiltered.length)} จาก {invFiltered.length} รายการ</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setInvPage(1)} disabled={invPage === 1} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">«</button>
                <button onClick={() => setInvPage(p => Math.max(1, p - 1))} disabled={invPage === 1} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">‹</button>
                {Array.from({ length: Math.min(5, invTotalPages) }, (_, i) => {
                  let page: number;
                  if (invTotalPages <= 5) page = i + 1;
                  else if (invPage <= 3) page = i + 1;
                  else if (invPage >= invTotalPages - 2) page = invTotalPages - 4 + i;
                  else page = invPage - 2 + i;
                  return <button key={page} onClick={() => setInvPage(page)} className={`w-8 h-8 rounded-lg text-xs font-medium ${page === invPage ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{page}</button>;
                })}
                <button onClick={() => setInvPage(p => Math.min(invTotalPages, p + 1))} disabled={invPage === invTotalPages} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">›</button>
                <button onClick={() => setInvPage(invTotalPages)} disabled={invPage === invTotalPages} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">»</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== CREATE TAB =================== */}
      {activeTab === 'create' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600"><FileText size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">สร้างบิลใหม่</h3>
                <p className="text-xs text-slate-400">เลือกลูกค้า + ประเภทค่าบริการ → คำนวณ + VAT 7%</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="relative"><label className={labelClass}>ลูกค้า *</label>
                {selectedCust ? (
                  <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
                    <span className="flex-1 text-sm text-slate-800 dark:text-white truncate">
                      {selectedCust.customer_name}
                      <span className="text-xs text-slate-400 ml-1">
                        ({selectedCust.is_line ? 'สายเรือ' : selectedCust.is_trucking ? 'รถบรรทุก' : selectedCust.is_forwarder ? 'Forwarder' : 'ทั่วไป'})
                      </span>
                    </span>
                    <button type="button" onClick={() => { setSelectedCust(null); setCreateForm({ ...createForm, customer_id: '' }); setCustSearch(''); }}
                      className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 flex items-center justify-center hover:bg-rose-200 hover:text-rose-600 text-xs">×</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" value={custSearch}
                      onChange={e => { setCustSearch(e.target.value); setCustOpen(true); }}
                      onFocus={() => setCustOpen(true)}
                      placeholder="พิมพ์ชื่อลูกค้า หรือเลขภาษี..."
                      className={inputClass} autoComplete="off" />
                    {custOpen && custSearch.length > 0 && (() => {
                      const q = custSearch.toLowerCase();
                      const filtered = customers.filter(c =>
                        c.customer_name.toLowerCase().includes(q) ||
                        (c.tax_id && c.tax_id.includes(custSearch))
                      );
                      return filtered.length > 0 ? (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {filtered.map(c => (
                            <button key={c.customer_id} type="button"
                              onClick={() => {
                                setSelectedCust(c);
                                setCreateForm({ ...createForm, customer_id: String(c.customer_id) });
                                setCustSearch('');
                                setCustOpen(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
                              <div className="text-sm font-medium text-slate-800 dark:text-white">{c.customer_name}</div>
                              <div className="text-[11px] text-slate-400">
                                {c.is_line ? '🚢 สายเรือ' : c.is_trucking ? '🚛 รถบรรทุก' : c.is_forwarder ? '📦 Forwarder' : '🏢 ทั่วไป'}
                                {c.tax_id && <span> • {c.tax_id}</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl px-4 py-3 text-xs text-slate-400">
                          ไม่พบลูกค้า &quot;{custSearch}&quot;
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div><label className={labelClass}>เลขตู้ (ถ้ามี)</label><input type="text" value={createForm.container_number} onChange={e => setCreateForm({ ...createForm, container_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="ABCU1234567" /></div>
              <div><label className={labelClass}>ประเภทค่าบริการ</label>
                <select value={createForm.charge_type} onChange={e => setCreateForm({ ...createForm, charge_type: e.target.value })} className={inputClass}>
                  {Object.entries(CHARGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div><label className={labelClass}>รายละเอียด</label><input type="text" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className={inputClass} placeholder={CHARGE_LABELS[createForm.charge_type]} /></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={labelClass}>จำนวน</label><input type="number" min={0.01} step={0.01} value={createForm.quantity} onChange={e => setCreateForm({ ...createForm, quantity: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
              <div><label className={labelClass}>ราคาต่อหน่วย (฿)</label><input type="number" min={0} step={0.01} value={createForm.unit_price} onChange={e => setCreateForm({ ...createForm, unit_price: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
              <div><label className={labelClass}>ครบกำหนด</label><input type="date" value={createForm.due_date} onChange={e => setCreateForm({ ...createForm, due_date: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>หมายเหตุ</label><input type="text" value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." /></div>
            </div>

            {createForm.unit_price > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-blue-600">ยอดรวม</span><span className="font-semibold text-blue-700">฿{(createForm.quantity * createForm.unit_price).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-blue-600">VAT 7%</span><span className="font-semibold text-blue-700">฿{(createForm.quantity * createForm.unit_price * 0.07).toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-blue-200 pt-1"><span className="text-blue-700 font-bold">ยอดสุทธิ</span><span className="text-lg font-bold text-blue-800">฿{(createForm.quantity * createForm.unit_price * 1.07).toLocaleString()}</span></div>
              </div>
            )}

            <button onClick={handleCreateInvoice} disabled={createLoading || !createForm.customer_id || !createForm.unit_price}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
              {createLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} สร้างใบแจ้งหนี้
            </button>

            {createResult && (
              <div className={`p-3 rounded-xl text-sm ${createResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {createResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== TARIFFS TAB =================== */}
      {activeTab === 'tariffs' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Calculator size={16} /> ตั้งค่า Tariff</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div>
                  <label className={labelClass}>ประเภท</label>
                  <select value={tariffForm.charge_type} onChange={e => setTariffForm({ ...tariffForm, charge_type: e.target.value })} className={inputClass}>
                    {Object.entries(CHARGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>รายละเอียด</label>
                  <input type="text" value={tariffForm.description} onChange={e => setTariffForm({ ...tariffForm, description: e.target.value })} className={inputClass} placeholder="เช่น ค่าฝากตู้ 20ft" />
                </div>
                <div>
                  <label className={labelClass}>ราคา (฿)</label>
                  <input type="number" min={0} step={0.01} value={tariffForm.rate || ''} onFocus={e => e.target.select()} onChange={e => setTariffForm({ ...tariffForm, rate: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>หน่วย</label>
                  <select value={tariffForm.unit} onChange={e => setTariffForm({ ...tariffForm, unit: e.target.value })} className={inputClass}>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className={labelClass}>Free Days</label>
                    <input type="number" min={0} value={tariffForm.free_days || ''} onFocus={e => e.target.select()} onChange={e => setTariffForm({ ...tariffForm, free_days: parseInt(e.target.value) || 0 })} className={inputClass} placeholder="0" />
                  </div>
                  <button onClick={handleCreateTariff} className="h-10 px-4 rounded-lg bg-blue-600 text-white text-xs font-medium whitespace-nowrap hover:bg-blue-700"><Plus size={12} /></button>
                </div>
              </div>
            </div>

            {tariffLoading ? (
              <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
            ) : tariffs.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">ยังไม่มี Tariff</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2.5">ประเภท</th>
                      <th className="text-left px-4 py-2.5">รายละเอียด</th>
                      <th className="text-right px-4 py-2.5">ราคา</th>
                      <th className="text-left px-4 py-2.5">หน่วย</th>
                      <th className="text-right px-4 py-2.5">Free Days</th>
                      <th className="text-center px-4 py-2.5">ลบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {tariffs.map(t => (
                      <tr key={t.tariff_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-2.5">{CHARGE_LABELS[t.charge_type]}</td>
                        <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{t.description || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-white">฿{t.rate.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-slate-500">{UNIT_LABELS[t.unit]}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{t.free_days}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => deleteTariff(t.tariff_id)} className="text-slate-400 hover:text-red-500"><XCircle size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== HOLD/RELEASE TAB =================== */}
      {activeTab === 'hold' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Lock size={16} /> Hold / Release Control</h3>
            <p className="text-xs text-slate-400 mt-1">ตู้ที่มีบิลค้างชำระจะถูก Hold — ชำระเงินจึง Release อัตโนมัติ</p>
          </div>
          {invLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : (
         <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {invoices.filter(i => ['issued', 'overdue'].includes(i.status) && i.container_status !== 'gated_out').length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">ไม่มีบิลค้างชำระ (เฉพาะตู้ในลาน)</div>
              ) : invoices.filter(i => ['issued', 'overdue'].includes(i.status) && i.container_status !== 'gated_out').map(inv => (
                <div key={inv.invoice_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-amber-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{inv.invoice_number}</span>
                          {inv.container_number && <span className="text-xs text-slate-400">🏷️ {inv.container_number}</span>}
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600">ในลาน</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{inv.customer_name} • ฿{inv.grand_total.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateInvoice(inv.invoice_id, 'hold')}
                        className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium hover:bg-rose-100 flex items-center gap-1"><Lock size={10} /> Hold</button>
                      <button onClick={() => updateInvoice(inv.invoice_id, 'release')}
                        className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 flex items-center gap-1"><Unlock size={10} /> Release</button>
                      <button onClick={() => updateInvoice(inv.invoice_id, 'pay')}
                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"><CreditCard size={10} /> ชำระ</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================== DOCUMENTS TAB (Statement, Receipt, Print) =================== */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Billing Statement */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><FileText size={16} /> ใบวางบิล (Billing Statement)</h3>
              <p className="text-xs text-slate-400 mt-0.5">รวมยอดค้างชำระตามลูกค้า</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {(() => {
                const grouped: Record<string, { customer: string; invoices: InvoiceRow[]; total: number }> = {};
                invoices.filter(i => ['issued', 'overdue'].includes(i.status)).forEach(inv => {
                  const key = inv.customer_name || 'ไม่ระบุลูกค้า';
                  if (!grouped[key]) grouped[key] = { customer: key, invoices: [], total: 0 };
                  grouped[key].invoices.push(inv);
                  grouped[key].total += inv.grand_total;
                });
                const entries = Object.values(grouped);
                if (entries.length === 0) return <div className="p-8 text-center text-sm text-slate-400">ไม่มีบิลค้างชำระ</div>;
                return entries.map(g => (
                  <div key={g.customer} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-slate-800 dark:text-white">{g.customer}</span>
                      <span className="font-bold text-blue-600">฿{g.total.toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      {g.invoices.map(inv => (
                        <div key={inv.invoice_id} className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono">{inv.invoice_number} — {inv.description}</span>
                          <span>฿{inv.grand_total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => window.print()} className="mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><Printer size={10} /> พิมพ์ Statement</button>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Receipt */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> ใบเสร็จรับเงิน (Receipt)</h3>
              <p className="text-xs text-slate-400 mt-0.5">บิลที่ชำระแล้ว สามารถออกใบเสร็จ</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {invoices.filter(i => i.status === 'paid').length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีบิลที่ชำระแล้ว</div>
              ) : invoices.filter(i => i.status === 'paid').slice(0, 20).map(inv => (
                <div key={inv.invoice_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{inv.invoice_number}</span>
                        <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">ชำระแล้ว</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{inv.customer_name} • {inv.description} • ฿{inv.grand_total.toLocaleString()}</p>
                    </div>
                    <button onClick={() => window.open(`/billing/print?id=${inv.invoice_id}&type=receipt`, '_blank')}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 flex items-center gap-1">
                      <Printer size={12} /> พิมพ์ใบเสร็จ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================== ERP EXPORT TAB =================== */}
      {activeTab === 'export' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-600"><FileSpreadsheet size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">ส่งออก ERP (Debit/Credit Export)</h3>
                <p className="text-xs text-slate-400">ส่งออกข้อมูลใบแจ้งหนี้เป็น CSV สำหรับโหลดเข้าระบบบัญชี</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">สถานะ</label>
                <select defaultValue="paid" className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" id="erp-status">
                  <option value="paid">ชำระแล้ว</option>
                  <option value="issued">แจ้งหนี้</option>
                  <option value="">ทุกสถานะ</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">จากวันที่</label>
                <input type="date" className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" id="erp-from" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">ถึงวันที่</label>
                <input type="date" className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm" id="erp-to" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                const status = (document.getElementById('erp-status') as HTMLSelectElement)?.value || '';
                const from = (document.getElementById('erp-from') as HTMLInputElement)?.value || '';
                const to = (document.getElementById('erp-to') as HTMLInputElement)?.value || '';
                let url = `/api/billing/erp-export?yard_id=${yardId}&format=csv`;
                if (status) url += `&status=${status}`;
                if (from) url += `&date_from=${from}`;
                if (to) url += `&date_to=${to}`;
                window.open(url, '_blank');
              }} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-all">
                <FileDown size={16} /> ดาวน์โหลด CSV
              </button>
              <button onClick={async () => {
                const status = (document.getElementById('erp-status') as HTMLSelectElement)?.value || '';
                const from = (document.getElementById('erp-from') as HTMLInputElement)?.value || '';
                const to = (document.getElementById('erp-to') as HTMLInputElement)?.value || '';
                let url = `/api/billing/erp-export?yard_id=${yardId}&format=json`;
                if (status) url += `&status=${status}`;
                if (from) url += `&date_from=${from}`;
                if (to) url += `&date_to=${to}`;
                const res = await fetch(url);
                const data = await res.json();
                // Show summary alert
                toast('success', 'ERP Export สำเร็จ', `รายการ: ${data.total_entries} | Debit: ฿${data.total_debit?.toLocaleString()} | Credit: ฿${data.total_credit?.toLocaleString()}`);
              }} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 transition-all">
                <Search size={16} /> ดูตัวอย่าง JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================== REPORTS TAB =================== */}
      {activeTab === 'reports' && <BillingReports yardId={yardId} />}

      {/* =================== AR AGING TAB =================== */}
      {activeTab === 'ar_aging' && <ARAgingTab yardId={yardId} />}

      {/* =================== DEMURRAGE TAB =================== */}
      {activeTab === 'demurrage' && (
        <DemurrageTab yardId={yardId} />
      )}

      {/* =================== CREDIT NOTE MODAL =================== */}
      {cnModal.open && cnModal.invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCnModal({ open: false, invoice: null })}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600"><ArrowDownToLine size={20} /></div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">ออกใบลดหนี้ (Credit Note)</h3>
                  <p className="text-xs text-slate-400">อ้างอิง {cnModal.invoice.invoice_number} — ฿{cnModal.invoice.grand_total.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">ลูกค้า</span><span className="font-medium text-slate-800 dark:text-white">{cnModal.invoice.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">ประเภท</span><span>{CHARGE_LABELS[cnModal.invoice.charge_type] || cnModal.invoice.charge_type}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">ยอดบิลเดิม</span><span className="font-bold text-blue-600">฿{cnModal.invoice.grand_total.toLocaleString()}</span></div>
              </div>
              <div><label className={labelClass}>เหตุผลการลดหนี้ *</label>
                <input type="text" value={cnReason} onChange={e => setCnReason(e.target.value)} className={inputClass} placeholder="เช่น คิดค่าบริการเกิน, คืนเงินมัดจำ..." />
              </div>
              <div><label className={labelClass}>ยอดลดหนี้ (฿) *</label>
                <input type="number" min={0.01} max={cnModal.invoice.grand_total} step={0.01} value={cnAmount || ''}
                  onChange={e => setCnAmount(Math.min(parseFloat(e.target.value) || 0, cnModal.invoice!.grand_total))}
                  className={inputClass} />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setCnAmount(cnModal.invoice!.grand_total)} className="text-[10px] text-blue-500 hover:text-blue-700">เต็มจำนวน</button>
                  <button onClick={() => setCnAmount(cnModal.invoice!.grand_total / 2)} className="text-[10px] text-blue-500 hover:text-blue-700">50%</button>
                  <button onClick={() => setCnAmount(cnModal.invoice!.grand_total * 0.25)} className="text-[10px] text-blue-500 hover:text-blue-700">25%</button>
                </div>
              </div>
              {cnAmount > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-amber-700">ยอดลดหนี้ (ก่อน VAT)</span><span className="font-semibold">฿{(cnAmount / 1.07).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-amber-700">VAT 7%</span><span className="font-semibold">฿{(cnAmount - cnAmount / 1.07).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between border-t border-amber-200 pt-1"><span className="text-amber-800 font-bold">ยอดลดหนี้สุทธิ</span><span className="text-lg font-bold text-amber-800">-฿{cnAmount.toLocaleString()}</span></div>
                  {Math.abs(cnAmount - cnModal.invoice.grand_total) < 0.01 && (
                    <p className="text-[10px] text-rose-500 mt-1">⚠️ ลดเต็มจำนวน — บิลต้นฉบับจะถูกยกเลิกอัตโนมัติ</p>
                  )}
                </div>
              )}
              {cnResult && (
                <div className={`p-3 rounded-xl text-sm ${cnResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {cnResult.message}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button onClick={() => setCnModal({ open: false, invoice: null })} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200">ยกเลิก</button>
              <button
                disabled={cnLoading || !cnReason || cnAmount <= 0}
                onClick={async () => {
                  setCnLoading(true); setCnResult(null);
                  try {
                    const res = await fetch('/api/billing/invoices', {
                      method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        invoice_id: cnModal.invoice!.invoice_id,
                        action: 'credit_note',
                        ref_invoice_id: cnModal.invoice!.invoice_id,
                        reason: cnReason,
                        credit_amount: cnAmount,
                        user_id: session?.userId,
                        yard_id: yardId,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setCnResult({ success: true, message: `✅ สร้างใบลดหนี้ ${data.cn_number} — ยอด -฿${cnAmount.toLocaleString()} อ้างอิง ${data.ref_invoice}` });
                      fetchInvoices();
                    } else {
                      setCnResult({ success: false, message: `❌ ${data.error}` });
                    }
                  } catch { setCnResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
                  finally { setCnLoading(false); }
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
              >
                {cnLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />} ออกใบลดหนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== BILLING REPORTS COMPONENT ===================== */
const CHARGE_LABELS_RPT: Record<string, string> = {
  storage: '📦 ค่าฝากตู้', lolo: '🏗️ ค่ายก LOLO', mnr: '🔧 ค่าซ่อม M&R',
  washing: '🫧 ค่าล้างตู้', pti: '🔌 ค่า PTI', reefer: '❄️ ค่าปลั๊กเย็น', other: '📋 อื่นๆ',
};

// Lazy import for PDF (avoid SSR bundling issues)
const loadPdfExport = () => import('@/lib/pdfExport');

function BillingReports({ yardId }: { yardId: number }) {
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const dateParam = reportType === 'daily' ? selectedDate : selectedMonth;
      const res = await fetch(`/api/billing/reports?yard_id=${yardId}&type=${reportType}&date=${dateParam}`);
      const json = await res.json();
      if (!json.error) setData(json);
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

/* ===================== AR AGING TAB ===================== */
interface ARCustomer {
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_trucking: boolean;
  is_forwarder: boolean;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d90plus: number;
  total: number;
  invoice_count: number;
  oldest_days: number;
}

function ARAgingTab({ yardId }: { yardId: number }) {
  const [data, setData] = useState<{
    summary: { current: number; d30: number; d60: number; d90: number; d90plus: number; total: number };
    customers: ARCustomer[];
    total_invoices: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/billing/ar-aging?yard_id=${yardId}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [yardId]);

  if (loading) return <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>;
  if (!data) return <div className="p-12 text-center text-sm text-slate-400">ไม่มีข้อมูล</div>;

  const s = data.summary;
  const buckets = [
    { label: 'Current', sublabel: 'ยังไม่ครบกำหนด', value: s.current, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', bar: 'bg-emerald-500' },
    { label: '1-30 วัน', sublabel: 'ค้างชำระ', value: s.d30, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', bar: 'bg-blue-500' },
    { label: '31-60 วัน', sublabel: 'ค้างชำระ', value: s.d60, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', bar: 'bg-amber-500' },
    { label: '61-90 วัน', sublabel: 'ค้างนาน', value: s.d90, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', bar: 'bg-orange-500' },
    { label: '90+ วัน', sublabel: 'เสี่ยงสูง', value: s.d90plus, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', bar: 'bg-rose-500' },
  ];

  const riskColor = (days: number) => days > 90 ? 'text-rose-600' : days > 60 ? 'text-orange-600' : days > 30 ? 'text-amber-600' : 'text-slate-600';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={16} /> ยอดค้างชำระ (AR Aging) — {data.total_invoices} รายการ
          </h3>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">฿{s.total.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">ยอดค้างรวม</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {buckets.map((b, i) => (
            <div key={i} className={`p-3 rounded-xl ${b.bg}`}>
              <p className={`text-lg font-bold ${b.color}`}>฿{b.value.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 font-medium">{b.label}</p>
              <p className="text-[9px] text-slate-400">{b.sublabel}</p>
            </div>
          ))}
        </div>
        {/* Horizontal bar */}
        {s.total > 0 && (
          <div className="mt-4 flex h-3 rounded-full overflow-hidden">
            {buckets.map((b, i) => {
              const pct = (b.value / s.total) * 100;
              if (pct === 0) return null;
              return <div key={i} className={`${b.bar} transition-all`} style={{ width: `${pct}%` }} title={`${b.label}: ฿${b.value.toLocaleString()} (${pct.toFixed(1)}%)`} />;
            })}
          </div>
        )}
      </div>

      {/* Customer Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">แยกตามลูกค้า ({data.customers.length})</h3>
        </div>
        {data.customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">ไม่มียอดค้างชำระ 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">ลูกค้า</th>
                  <th className="text-right px-3 py-2.5">Current</th>
                  <th className="text-right px-3 py-2.5">1-30 วัน</th>
                  <th className="text-right px-3 py-2.5">31-60 วัน</th>
                  <th className="text-right px-3 py-2.5">61-90 วัน</th>
                  <th className="text-right px-3 py-2.5">90+ วัน</th>
                  <th className="text-right px-4 py-2.5">รวม</th>
                  <th className="text-center px-3 py-2.5">บิล</th>
                  <th className="text-center px-3 py-2.5">เก่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.customers.map(c => (
                  <tr key={c.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">{c.customer_name}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{c.current > 0 ? `฿${c.current.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600">{c.d30 > 0 ? `฿${c.d30.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-amber-600">{c.d60 > 0 ? `฿${c.d60.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-orange-600">{c.d90 > 0 ? `฿${c.d90.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-rose-600 font-semibold">{c.d90plus > 0 ? `฿${c.d90plus.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-white">฿{c.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{c.invoice_count}</td>
                    <td className={`px-3 py-2.5 text-center font-medium ${riskColor(c.oldest_days)}`}>{c.oldest_days} วัน</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-900/30 font-bold text-xs">
                <tr>
                  <td className="px-4 py-2.5 text-slate-800 dark:text-white">รวมทั้งหมด</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">฿{s.current.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-blue-600">฿{s.d30.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-amber-600">฿{s.d60.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-orange-600">฿{s.d90.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600">฿{s.d90plus.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800 dark:text-white">฿{s.total.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{data.total_invoices}</td>
                  <td className="px-3 py-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
