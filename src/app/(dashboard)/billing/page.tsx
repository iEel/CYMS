'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDateTime } from '@/lib/utils';
import {
  Loader2, Calculator, Receipt, CreditCard, FileText, Plus, Search,
  CheckCircle2, XCircle, Clock, RotateCcw, DollarSign, TrendingUp,
  AlertTriangle, Lock, Unlock, Ban, ArrowDownToLine,
  Printer, FileDown, FileSpreadsheet, BarChart3, ChevronLeft, ChevronRight, Users, Eye,
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
  ref_invoice_id?: number; ref_invoice_number?: string;
  replaces_invoice_id?: number; replaces_invoice_number?: string;
  balance_amount?: number | null;
}

interface ClearanceRow {
  clearance_id: number;
  transaction_type: 'gate_in' | 'gate_out';
  container_number: string;
  customer_name: string;
  clearance_type: 'paid' | 'credit' | 'no_charge' | 'waived';
  original_amount: number;
  final_amount: number;
  reason?: string;
  invoice_id?: number;
  invoice_number?: string;
  invoice_status?: string;
  transaction_id?: number;
  eir_number?: string;
  booking_ref?: string;
  approved_by_name?: string;
  created_by_name?: string;
  created_at: string;
}

interface ClearanceStats {
  total_count: number;
  paid_count: number;
  credit_count: number;
  no_charge_count: number;
  waived_count: number;
  paid_amount: number;
  credit_amount: number;
  waived_amount: number;
  gate_in_amount: number;
  gate_out_amount: number;
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
  const [activeTab, setActiveTab] = useState<'invoices' | 'clearance' | 'create' | 'tariffs' | 'hold' | 'documents' | 'export' | 'reports' | 'demurrage' | 'ar_aging'>('invoices');

  // Credit Note Modal
  const [cnModal, setCnModal] = useState<{ open: boolean; invoice: InvoiceRow | null }>({ open: false, invoice: null });
  const [cnReason, setCnReason] = useState('');
  const [cnAmount, setCnAmount] = useState(0);
  const [cnLoading, setCnLoading] = useState(false);
  const [cnResult, setCnResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cnCreateRevised, setCnCreateRevised] = useState(false);
  const [cnRevisedDescription, setCnRevisedDescription] = useState('');
  const [cnRevisedQuantity, setCnRevisedQuantity] = useState(1);
  const [cnRevisedUnitPrice, setCnRevisedUnitPrice] = useState(0);
  const yardId = session?.activeYardId || 1;

  // Invoices
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total_outstanding: 0, total_paid: 0, total_overdue: 0, pending_count: 0 });
  const [invLoading, setInvLoading] = useState(false);
  const [invFilter, setInvFilter] = useState('');
  const [invChargeFilter, setInvChargeFilter] = useState('');
  const [invSearch, setInvSearch] = useState('');
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

  // Billing clearance audit
  const [clearances, setClearances] = useState<ClearanceRow[]>([]);
  const [clearanceStats, setClearanceStats] = useState<ClearanceStats | null>(null);
  const [clearanceLoading, setClearanceLoading] = useState(false);

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

  const fetchClearances = useCallback(async () => {
    setClearanceLoading(true);
    try {
      const res = await fetch(`/api/billing/clearance?yard_id=${yardId}`);
      const data = await res.json();
      setClearances(data.clearances || []);
      setClearanceStats(data.stats || null);
    } catch (err) { console.error(err); }
    finally { setClearanceLoading(false); }
  }, [yardId]);

  useEffect(() => {
    if (activeTab === 'invoices' || activeTab === 'hold' || activeTab === 'documents' || activeTab === 'reports') fetchInvoices();
    if (activeTab === 'invoices') fetchClearances();
    if (activeTab === 'clearance' || activeTab === 'documents' || activeTab === 'reports') fetchClearances();
    if (activeTab === 'tariffs') fetchTariffs();
    if (activeTab === 'create' && customers.length === 0) {
      fetch('/api/settings/customers').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setCustomers(d.filter((c: { is_active: boolean }) => c.is_active));
      }).catch(() => {});
    }
  }, [activeTab, fetchInvoices, fetchTariffs, fetchClearances, customers.length]);

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
  const invFiltered = invoices.filter(inv => {
    const matchesCharge = !invChargeFilter || inv.charge_type === invChargeFilter;
    const q = invSearch.toLowerCase();
    const matchesSearch = !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q) ||
      inv.container_number?.toLowerCase().includes(q) ||
      inv.description?.toLowerCase().includes(q);
    return matchesCharge && matchesSearch;
  });
  const invTotalPages = Math.ceil(invFiltered.length / invPerPage);
  const invPaginated = invFiltered.slice((invPage - 1) * invPerPage, invPage * invPerPage);

  const openCreditNoteModal = (invoice: InvoiceRow) => {
    const remainingAmount = invoice.balance_amount != null ? Math.max(invoice.balance_amount, 0) : invoice.grand_total;
    const suggestedUnitPrice = Math.max(remainingAmount / 1.07, 0);
    setCnModal({ open: true, invoice });
    setCnAmount(remainingAmount);
    setCnReason('');
    setCnResult(null);
    setCnCreateRevised(false);
    setCnRevisedDescription(invoice.description ? `${invoice.description} (แก้ไขจาก ${invoice.invoice_number})` : `ออกใหม่แทน ${invoice.invoice_number}`);
    setCnRevisedQuantity(1);
    setCnRevisedUnitPrice(Number(suggestedUnitPrice.toFixed(2)));
  };

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
          { label: 'ยกเว้น/ไม่เก็บ', value: clearanceStats?.waived_amount || 0, color: 'text-amber-600', icon: <Ban size={16} />, count: (clearanceStats?.waived_count || 0) + (clearanceStats?.no_charge_count || 0) },
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
          { id: 'clearance' as const, label: 'Clearance', icon: <CheckCircle2 size={14} /> },
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
              <input value={invSearch} onChange={e => { setInvSearch(e.target.value); setInvPage(1); }}
                placeholder="ค้นหาเลขบิล/ลูกค้า/ตู้"
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs outline-none focus:border-blue-500" />
              <select value={invChargeFilter} onChange={e => { setInvChargeFilter(e.target.value); setInvPage(1); }}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
                <option value="">ทุกประเภท</option>
                {Object.entries(CHARGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={invFilter} onChange={e => setInvFilter(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
                <option value="">ทุกสถานะ</option>
                <option value="draft">ร่าง</option><option value="issued">แจ้งหนี้</option>
                <option value="paid">ชำระแล้ว</option><option value="overdue">เกินกำหนด</option>
                <option value="cancelled">ยกเลิก</option><option value="credit_note">ใบลดหนี้</option>
              </select>
              <button onClick={fetchInvoices} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
            </div>
          </div>
          {invLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : invFiltered.length === 0 ? (
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
                          <span>• {inv.charge_type === 'storage' ? 'Gate-Out/Storage' : inv.charge_type === 'gate_in' ? 'Gate-In' : 'Manual/Service'}</span>
                        </div>
                        {(inv.ref_invoice_number || inv.replaces_invoice_number || inv.balance_amount != null) && (
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            {inv.ref_invoice_number && <span>อ้างอิง {inv.ref_invoice_number}</span>}
                            {inv.replaces_invoice_number && <span>ออกใหม่แทน {inv.replaces_invoice_number}</span>}
                            {inv.balance_amount != null && !['credit_note', 'cancelled'].includes(inv.status) && (
                              <span>คงเหลือหลังลดหนี้ ฿{Math.max(inv.balance_amount, 0).toLocaleString()}</span>
                            )}
                          </div>
                        )}
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
                        {inv.container_number && (
                          <button onClick={() => setActiveTab('clearance')}
                            className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 flex items-center gap-1"><Eye size={10} /> Clearance</button>
                        )}
                        {['issued', 'paid'].includes(inv.status) && Math.max(inv.balance_amount ?? inv.grand_total, 0) > 0 && (
                          <button onClick={() => openCreditNoteModal(inv)}
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

      {/* =================== BILLING CLEARANCE TAB =================== */}
      {activeTab === 'clearance' && (
        <BillingClearanceTab
          clearances={clearances}
          stats={clearanceStats}
          loading={clearanceLoading}
          onRefresh={fetchClearances}
        />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Storage / ค่าฝาก</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">ตั้งที่ ตั้งค่าระบบ → ค่าฝาก รองรับ rate ขั้นบันได แยกขนาดตู้ และ rate เฉพาะลูกค้า</p>
            </div>
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Gate In</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">ใช้ Tariff หน่วย per_container เช่น Gate fee, LOLO, PTI, Washing ที่คิดตอนรับตู้</p>
            </div>
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Gate Out</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Storage คิดจากค่าฝากขั้นบันได ส่วนรายการเสริมยังใช้ Tariff และพนักงานเลือก/แก้ราคาได้ก่อนออกบิล</p>
            </div>
          </div>
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
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
              {(() => {
                const remainingAmount = cnModal.invoice.balance_amount != null ? Math.max(cnModal.invoice.balance_amount, 0) : cnModal.invoice.grand_total;
                const revisedGrandTotal = cnCreateRevised ? cnRevisedQuantity * cnRevisedUnitPrice * 1.07 : 0;
                return (
                  <>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">ลูกค้า</span><span className="font-medium text-slate-800 dark:text-white">{cnModal.invoice.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">ประเภท</span><span>{CHARGE_LABELS[cnModal.invoice.charge_type] || cnModal.invoice.charge_type}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">ยอดบิลเดิม</span><span className="font-bold text-blue-600">฿{cnModal.invoice.grand_total.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">ยอดที่ยังลดหนี้ได้</span><span className="font-bold text-amber-600">฿{remainingAmount.toLocaleString()}</span></div>
              </div>
              <div><label className={labelClass}>เหตุผลการลดหนี้ *</label>
                <input type="text" value={cnReason} onChange={e => setCnReason(e.target.value)} className={inputClass} placeholder="เช่น คิดค่าบริการเกิน, คืนเงินมัดจำ..." />
              </div>
              <div><label className={labelClass}>ยอดลดหนี้ (฿) *</label>
                <input type="number" min={0.01} max={remainingAmount} step={0.01} value={cnAmount || ''}
                  onChange={e => setCnAmount(Math.min(parseFloat(e.target.value) || 0, remainingAmount))}
                  className={inputClass} />
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setCnAmount(remainingAmount)} className="text-[10px] text-blue-500 hover:text-blue-700">เต็มจำนวน</button>
                  <button onClick={() => setCnAmount(remainingAmount / 2)} className="text-[10px] text-blue-500 hover:text-blue-700">50%</button>
                  <button onClick={() => setCnAmount(remainingAmount * 0.25)} className="text-[10px] text-blue-500 hover:text-blue-700">25%</button>
                </div>
              </div>
              {cnAmount > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-amber-700">ยอดลดหนี้ (ก่อน VAT)</span><span className="font-semibold">฿{(cnAmount / 1.07).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-amber-700">VAT 7%</span><span className="font-semibold">฿{(cnAmount - cnAmount / 1.07).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between border-t border-amber-200 pt-1"><span className="text-amber-800 font-bold">ยอดลดหนี้สุทธิ</span><span className="text-lg font-bold text-amber-800">-฿{cnAmount.toLocaleString()}</span></div>
                  {Math.abs(cnAmount - remainingAmount) < 0.01 && (
                    <p className="text-[10px] text-rose-500 mt-1">⚠️ ลดครบยอดคงเหลือ — บิลต้นฉบับจะถูกยกเลิกอัตโนมัติ</p>
                  )}
                </div>
              )}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input type="checkbox" checked={cnCreateRevised} onChange={e => setCnCreateRevised(e.target.checked)} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium text-slate-800 dark:text-white">สร้างใบแจ้งหนี้ใหม่แทนใบเดิม</span>
                  <span className="block text-xs text-slate-400 mt-0.5">ใช้เมื่อยอดเดิมผิดและต้องออกเอกสารใหม่ต่อจากใบลดหนี้</span>
                </span>
              </label>
              {cnCreateRevised && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 space-y-3">
                  <div>
                    <label className={labelClass}>รายละเอียดใบใหม่</label>
                    <input type="text" value={cnRevisedDescription} onChange={e => setCnRevisedDescription(e.target.value)} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>จำนวน</label>
                      <input type="number" min={0.01} step={0.01} value={cnRevisedQuantity || ''} onChange={e => setCnRevisedQuantity(parseFloat(e.target.value) || 0)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>ราคาต่อหน่วยก่อน VAT</label>
                      <input type="number" min={0.01} step={0.01} value={cnRevisedUnitPrice || ''} onChange={e => setCnRevisedUnitPrice(parseFloat(e.target.value) || 0)} className={inputClass} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-blue-700">
                    <span>ยอดใบใหม่รวม VAT 7%</span>
                    <span className="font-bold">฿{revisedGrandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
                  </>
                );
              })()}
              {cnResult && (
                <div className={`p-3 rounded-xl text-sm ${cnResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {cnResult.message}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button onClick={() => setCnModal({ open: false, invoice: null })} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200">ยกเลิก</button>
              <button
                disabled={cnLoading || !cnReason || cnAmount <= 0 || (cnCreateRevised && (!cnRevisedDescription || cnRevisedQuantity <= 0 || cnRevisedUnitPrice <= 0))}
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
                        create_revised_invoice: cnCreateRevised,
                        revised_invoice: cnCreateRevised ? {
                          description: cnRevisedDescription,
                          quantity: cnRevisedQuantity,
                          unit_price: cnRevisedUnitPrice,
                        } : undefined,
                        user_id: session?.userId,
                        yard_id: yardId,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      const revisedText = data.revised_invoice_number ? ` และใบแจ้งหนี้ใหม่ ${data.revised_invoice_number}` : '';
                      const remainingText = data.remaining_amount > 0 ? ` | ยอดคงเหลือเดิม ฿${data.remaining_amount.toLocaleString()}` : '';
                      setCnResult({ success: true, message: `✅ สร้างใบลดหนี้ ${data.cn_number}${revisedText} — ยอด -฿${cnAmount.toLocaleString()} อ้างอิง ${data.ref_invoice}${remainingText}` });
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

function clearanceLabel(type: string) {
  const map: Record<string, { label: string; color: string }> = {
    paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-600' },
    credit: { label: 'Credit', color: 'bg-blue-50 text-blue-600' },
    no_charge: { label: 'No Charge', color: 'bg-slate-100 text-slate-600' },
    waived: { label: 'Waived', color: 'bg-amber-50 text-amber-600' },
  };
  return map[type] || { label: type, color: 'bg-slate-100 text-slate-500' };
}

interface BillingControlRow {
  row_type: 'clearance' | 'missing_clearance' | 'outstanding_invoice' | 'credit_note';
  severity: 'ok' | 'watch' | 'review' | 'danger';
  event_at: string;
  transaction_type?: 'gate_in' | 'gate_out' | null;
  container_number?: string | null;
  customer_name?: string | null;
  eir_number?: string | null;
  booking_ref?: string | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  control_type: string;
  original_amount: number;
  final_amount: number;
  impact_amount: number;
  reason?: string | null;
  actor_name?: string | null;
  title: string;
}

interface BillingControlReport {
  type: 'control';
  period_type: string;
  date_from: string;
  date_to: string;
  summary: {
    paid_count: number;
    credit_count: number;
    no_charge_count: number;
    waived_count: number;
    paid_amount: number;
    credit_amount: number;
    waived_amount: number;
    no_charge_amount: number;
    missing_clearance_count: number;
    outstanding_invoice_count: number;
    outstanding_amount: number;
    credit_note_count: number;
    credit_note_amount: number;
  };
  rows: BillingControlRow[];
}

function controlSeverityBadge(severity: BillingControlRow['severity']) {
  const map: Record<BillingControlRow['severity'], { label: string; color: string }> = {
    ok: { label: 'OK', color: 'bg-emerald-50 text-emerald-600' },
    watch: { label: 'Watch', color: 'bg-blue-50 text-blue-600' },
    review: { label: 'Review', color: 'bg-amber-50 text-amber-600' },
    danger: { label: 'Action', color: 'bg-rose-50 text-rose-600' },
  };
  return map[severity] || map.review;
}

function controlTypeLabel(type: string) {
  const map: Record<string, string> = {
    paid: 'Paid',
    credit: 'Credit',
    no_charge: 'No Charge',
    waived: 'Waived',
    missing_clearance: 'Missing Clearance',
    outstanding: 'Outstanding',
    credit_note: 'Credit Note',
  };
  return map[type] || type;
}

function BillingClearanceTab({
  clearances,
  stats,
  loading,
  onRefresh,
}: {
  clearances: ClearanceRow[];
  stats: ClearanceStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState('');
  const [txFilter, setTxFilter] = useState('');
  const [search, setSearch] = useState('');

  const rows = clearances.filter(row => {
    const q = search.toLowerCase();
    return (!typeFilter || row.clearance_type === typeFilter)
      && (!txFilter || row.transaction_type === txFilter)
      && (!q ||
        row.container_number?.toLowerCase().includes(q) ||
        row.customer_name?.toLowerCase().includes(q) ||
        row.invoice_number?.toLowerCase().includes(q) ||
        row.eir_number?.toLowerCase().includes(q));
  });

  const reportRows = rows.filter(r => ['credit', 'no_charge', 'waived'].includes(r.clearance_type));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Paid', value: stats?.paid_amount || 0, count: stats?.paid_count || 0, color: 'text-emerald-600' },
          { label: 'Credit', value: stats?.credit_amount || 0, count: stats?.credit_count || 0, color: 'text-blue-600' },
          { label: 'Waived', value: stats?.waived_amount || 0, count: stats?.waived_count || 0, color: 'text-amber-600' },
          { label: 'Gate In', value: stats?.gate_in_amount || 0, count: 0, color: 'text-cyan-600' },
          { label: 'Gate Out', value: stats?.gate_out_amount || 0, count: 0, color: 'text-violet-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-400">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.color}`}>฿{kpi.value.toLocaleString()}</p>
            {kpi.count > 0 && <p className="text-[10px] text-slate-400">{kpi.count} รายการ</p>}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><CheckCircle2 size={16} /> Billing Clearance ({rows.length})</h3>
            <p className="text-xs text-slate-400 mt-1">หลักฐานเคลียร์เงินก่อน Gate/EIR พร้อม link ย้อนกลับเอกสาร</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ตู้/EIR/ลูกค้า/บิล" className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
              <option value="">ทุก clearance</option>
              <option value="paid">Paid</option>
              <option value="credit">Credit</option>
              <option value="no_charge">No Charge</option>
              <option value="waived">Waived</option>
            </select>
            <select value={txFilter} onChange={e => setTxFilter(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
              <option value="">Gate In/Out</option>
              <option value="gate_in">Gate-In</option>
              <option value="gate_out">Gate-Out</option>
            </select>
            <button onClick={onRefresh} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีรายการ Billing Clearance</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">เวลา</th>
                  <th className="text-left px-4 py-2.5">Gate/EIR</th>
                  <th className="text-left px-4 py-2.5">ตู้/ลูกค้า</th>
                  <th className="text-center px-4 py-2.5">Clearance</th>
                  <th className="text-right px-4 py-2.5">ยอดเดิม</th>
                  <th className="text-right px-4 py-2.5">ยอดสุทธิ</th>
                  <th className="text-left px-4 py-2.5">เหตุผล/ผู้อนุมัติ</th>
                  <th className="text-center px-4 py-2.5">เอกสาร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map(row => {
                  const badge = clearanceLabel(row.clearance_type);
                  return (
                    <tr key={row.clearance_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-2 text-slate-500">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-2">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">{row.transaction_type === 'gate_in' ? 'Gate-In' : 'Gate-Out'}</p>
                        {row.eir_number ? <button onClick={() => window.open(`/eir/${row.eir_number}`, '_blank')} className="font-mono text-blue-500 hover:text-blue-700">{row.eir_number}</button> : <span className="text-slate-400">-</span>}
                        {row.booking_ref && <p className="font-mono text-[10px] text-slate-400">BK: {row.booking_ref}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-mono font-semibold text-slate-800 dark:text-white">{row.container_number || '-'}</p>
                        <p className="text-slate-400">{row.customer_name || '-'}</p>
                      </td>
                      <td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded-lg font-semibold ${badge.color}`}>{badge.label}</span></td>
                      <td className="px-4 py-2 text-right font-mono">฿{(row.original_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">฿{(row.final_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 max-w-[240px]">
                        <p className="truncate text-slate-600 dark:text-slate-300">{row.reason || '-'}</p>
                        {(row.approved_by_name || row.created_by_name) && <p className="text-[10px] text-slate-400">โดย {row.approved_by_name || row.created_by_name}</p>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {row.invoice_id ? (
                          <button onClick={() => window.open(`/billing/print?id=${row.invoice_id}&type=${row.clearance_type === 'paid' ? 'receipt' : 'invoice'}`, '_blank')}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200">
                            {row.invoice_number || 'Print'}
                          </button>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Ban size={16} /> รายงานควบคุม No Charge / Waived / Credit</h3>
          <p className="text-xs text-slate-400 mt-1">ใช้ตรวจสอบรายการที่ไม่มีรับเงินสดทันทีหรือมีการยกเว้นค่าใช้จ่าย</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {reportRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-400 text-center">ไม่มีรายการควบคุมพิเศษใน filter นี้</div>
          ) : reportRows.slice(0, 30).map(row => {
            const badge = clearanceLabel(row.clearance_type);
            return (
              <div key={`report-${row.clearance_id}`} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${badge.color}`}>{badge.label}</span>
                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{row.container_number || '-'}</span>
                    {row.eir_number && <span className="font-mono text-xs text-slate-400">{row.eir_number}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{row.customer_name || '-'} • {row.reason || 'ไม่มีเหตุผลระบุ'} • {formatDateTime(row.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">ผลกระทบ</p>
                  <p className="font-bold text-amber-600">฿{((row.original_amount || 0) - (row.final_amount || 0)).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BillingReports({ yardId }: { yardId: number }) {
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
