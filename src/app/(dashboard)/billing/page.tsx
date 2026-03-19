'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Loader2, Calculator, Receipt, CreditCard, FileText, Plus, Search,
  CheckCircle2, XCircle, Clock, RotateCcw, DollarSign, TrendingUp,
  AlertTriangle, Lock, Unlock, Ban, ArrowDownToLine,
  Printer, FileDown, Zap, FileSpreadsheet,
} from 'lucide-react';

interface TariffRow {
  tariff_id: number; charge_type: string; description: string; rate: number;
  unit: string; free_days: number; customer_name: string; is_active: boolean;
}

interface InvoiceRow {
  invoice_id: number; invoice_number: string; customer_name: string;
  container_number: string; charge_type: string; description: string;
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
  const [activeTab, setActiveTab] = useState<'invoices' | 'create' | 'tariffs' | 'hold' | 'documents' | 'export'>('invoices');
  const yardId = session?.activeYardId || 1;

  // Invoices
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total_outstanding: 0, total_paid: 0, total_overdue: 0, pending_count: 0 });
  const [invLoading, setInvLoading] = useState(false);
  const [invFilter, setInvFilter] = useState('');

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
  const [customers, setCustomers] = useState<Array<{ customer_id: number; customer_name: string; customer_type: string; tax_id?: string; branch_type?: string; branch_number?: string }>>([]);
  const [custSearch, setCustSearch] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [selectedCust, setSelectedCust] = useState<{ customer_id: number; customer_name: string; customer_type: string; tax_id?: string; branch_type?: string; branch_number?: string } | null>(null);

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
    await fetch('/api/billing/invoices', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: id, action }),
    });
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

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'invoices' as const, label: 'ใบแจ้งหนี้', icon: <Receipt size={14} /> },
          { id: 'create' as const, label: 'สร้างบิล', icon: <Plus size={14} /> },
          { id: 'tariffs' as const, label: 'Tariff', icon: <Calculator size={14} /> },
          { id: 'hold' as const, label: 'Hold', icon: <Lock size={14} /> },
          { id: 'documents' as const, label: 'เอกสาร', icon: <Printer size={14} /> },
          { id: 'export' as const, label: 'ERP', icon: <FileDown size={14} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
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
              {invoices.map(inv => (
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
                          <span>• {formatDate(inv.created_at)}</span>
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
                        ({selectedCust.customer_type === 'shipping_line' ? 'สายเรือ' : selectedCust.customer_type === 'trucker' ? 'รถบรรทุก' : 'ทั่วไป'})
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
                                {c.customer_type === 'shipping_line' ? '🚢 สายเรือ' : c.customer_type === 'trucker' ? '🚛 รถบรรทุก' : '🏢 ทั่วไป'}
                                {c.tax_id && <span> • {c.tax_id}</span>}
                                {c.branch_type === 'head_office' ? ' • สำนักงานใหญ่' : c.branch_number ? ` • สาขา ${c.branch_number}` : ''}
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
              {invoices.filter(i => ['issued', 'overdue'].includes(i.status)).length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">ไม่มีบิลค้างชำระ</div>
              ) : invoices.filter(i => ['issued', 'overdue'].includes(i.status)).map(inv => (
                <div key={inv.invoice_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-amber-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{inv.invoice_number}</span>
                          {inv.container_number && <span className="text-xs text-slate-400">🏷️ {inv.container_number}</span>}
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
                    <button onClick={() => {
                      const receiptWin = window.open('', '_blank');
                      if (receiptWin) {
                        receiptWin.document.write(`<html><head><title>Receipt ${inv.invoice_number}</title>
                          <style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:auto}
                          h1{font-size:18px;border-bottom:2px solid #000;padding-bottom:8px}
                          table{width:100%;border-collapse:collapse;margin:20px 0}
                          td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}
                          .total{font-size:16px;font-weight:bold}
                          .footer{margin-top:40px;text-align:center;font-size:11px;color:#888}
                          @media print{button{display:none}}</style></head><body>
                          <h1>ใบเสร็จรับเงิน / Receipt</h1>
                          <p><b>เลขที่:</b> ${inv.invoice_number}</p>
                          <p><b>ลูกค้า:</b> ${inv.customer_name}</p>
                          <p><b>วันที่ชำระ:</b> ${inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('th-TH') : '-'}</p>
                          <table><tr><th>รายการ</th><th>จำนวน</th><th>หน่วยละ</th><th>รวม</th></tr>
                          <tr><td>${inv.description}</td><td>${inv.quantity}</td><td>฿${inv.unit_price.toLocaleString()}</td><td>฿${inv.total_amount.toLocaleString()}</td></tr>
                          <tr><td colspan="3">VAT 7%</td><td>฿${inv.vat_amount.toLocaleString()}</td></tr>
                          <tr class="total"><td colspan="3">รวมสุทธิ</td><td>฿${inv.grand_total.toLocaleString()}</td></tr></table>
                          <p class="footer">CYMS - Container Yard Management System</p>
                          <button onclick="window.print()" style="padding:8px 20px;background:#3B82F6;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:20px">🖨️ พิมพ์</button>
                          </body></html>`);
                        receiptWin.document.close();
                      }
                    }} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 flex items-center gap-1">
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
                alert(`ERP Export สำเร็จ\n\nรายการ: ${data.total_entries}\nDebit: ฿${data.total_debit?.toLocaleString()}\nCredit: ฿${data.total_credit?.toLocaleString()}`);
              }} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 transition-all">
                <Search size={16} /> ดูตัวอย่าง JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
