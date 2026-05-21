'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDateTime } from '@/lib/utils';
import {
  Loader2, Calculator, Receipt, CreditCard, FileText, Plus, Search,
  CheckCircle2, XCircle, Clock, RotateCcw, DollarSign,
  AlertTriangle, Lock, Unlock, Ban, ArrowDownToLine,
  Printer, FileDown, FileSpreadsheet, BarChart3, Users, Eye, QrCode,
} from 'lucide-react';
import DemurrageTab from './DemurrageTab';
import BillingClearanceTab from './BillingClearanceTab';
import BillingReports from './BillingReports';
import CreditControlTab from './CreditControlTab';
import ARAgingTab from './ARAgingTab';
import TariffSimulatorPanel from './TariffSimulatorPanel';
import type { ClearanceRow, ClearanceStats, CreditCustomer } from './billingTypes';

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
  document_type?: string; yard_id?: number;
  ref_invoice_id?: number; ref_invoice_number?: string;
  replaces_invoice_id?: number; replaces_invoice_number?: string;
  balance_amount?: number | null;
}

interface Stats {
  total_outstanding: number; total_paid: number; total_overdue: number; pending_count: number;
}

interface PaymentPromptPayConfig {
  enabled: boolean;
  promptpay_id: string;
  merchant_name: string;
}

const CHARGE_LABELS: Record<string, string> = {
  storage: '📦 ค่าฝากตู้', lolo: '🏗️ ค่ายก LOLO', mnr: '🔧 ค่าซ่อม M&R',
  washing: '🫧 ค่าล้างตู้', pti: '🔌 ค่า PTI', reefer: '❄️ ค่าปลั๊กเย็น', other: '📋 อื่นๆ',
};
const UNIT_LABELS: Record<string, string> = {
  per_day: '/ วัน', per_move: '/ ครั้ง', per_container: '/ ตู้', fixed: 'คงที่',
};

export default function BillingPage() {
  const { session, hasPermission } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'invoices' | 'clearance' | 'create' | 'tariffs' | 'hold' | 'documents' | 'export' | 'reports' | 'demurrage' | 'ar_aging' | 'credit_control' | 'payment_settings'>('invoices');

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
  const canCreateInvoice = hasPermission('billing.invoice.create');
  const canReceivePayment = hasPermission('billing.payment.receive');
  const canCreateCreditNote = hasPermission('billing.credit_note.create');
  const canCancelInvoice = hasPermission('billing.invoice.cancel');
  const canReleaseHold = hasPermission('yard.hold.release');
  const canManageSettings = hasPermission('settings.manage');

  // Invoices
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total_outstanding: 0, total_paid: 0, total_overdue: 0, pending_count: 0 });
  const [invLoading, setInvLoading] = useState(false);
  const [invFilter, setInvFilter] = useState('');
  const [invChargeFilter, setInvChargeFilter] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [invPage, setInvPage] = useState(1);
  const invPerPage = 25;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryTab = params.get('tab');
    const querySearch = params.get('search') || params.get('invoice_id') || '';
    if (queryTab && ['invoices', 'clearance', 'create', 'tariffs', 'hold', 'documents', 'export', 'reports', 'demurrage', 'ar_aging', 'credit_control', 'payment_settings'].includes(queryTab)) {
      setActiveTab(queryTab as typeof activeTab);
    }
    if (querySearch) {
      setActiveTab('invoices');
      setInvSearch(querySearch);
      setInvPage(1);
    }
  }, []);

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
  const [creditCustomers, setCreditCustomers] = useState<CreditCustomer[]>([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentPromptPayConfig>({ enabled: false, promptpay_id: '', merchant_name: '' });
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(false);
  const [paymentConfigSaving, setPaymentConfigSaving] = useState(false);

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

  const fetchCreditControl = useCallback(async () => {
    setCreditLoading(true);
    try {
      const res = await fetch(`/api/billing/credit-control?yard_id=${yardId}`);
      const data = await res.json();
      setCreditCustomers(data.customers || []);
    } catch (err) { console.error(err); }
    finally { setCreditLoading(false); }
  }, [yardId]);

  const fetchPaymentConfig = useCallback(async () => {
    setPaymentConfigLoading(true);
    try {
      const res = await fetch('/api/billing/payment-settings');
      const data = await res.json();
      if (data.config) setPaymentConfig(data.config);
    } catch (err) { console.error(err); }
    finally { setPaymentConfigLoading(false); }
  }, []);

  const savePaymentConfig = async () => {
    if (!canManageSettings) {
      toast('error', 'คุณไม่มีสิทธิ์ตั้งค่าการรับชำระเงิน');
      return;
    }
    setPaymentConfigSaving(true);
    try {
      const res = await fetch('/api/billing/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: paymentConfig, user_id: session?.userId }),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentConfig(data.config);
        toast('success', 'บันทึก PromptPay QR เรียบร้อย');
      } else {
        toast('error', data.error || 'ไม่สามารถบันทึกได้');
      }
    } catch {
      toast('error', 'เกิดข้อผิดพลาด');
    } finally {
      setPaymentConfigSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'invoices' || activeTab === 'hold' || activeTab === 'documents' || activeTab === 'reports') fetchInvoices();
    if (activeTab === 'invoices') fetchClearances();
    if (activeTab === 'clearance' || activeTab === 'documents' || activeTab === 'reports') fetchClearances();
    if (activeTab === 'credit_control') fetchCreditControl();
    if (activeTab === 'payment_settings') fetchPaymentConfig();
    if (activeTab === 'tariffs') fetchTariffs();
    if (activeTab === 'create' && customers.length === 0) {
      fetch('/api/settings/customers').then(r => r.json()).then(d => {
        if (Array.isArray(d)) setCustomers(d.filter((c: { is_active: boolean }) => c.is_active));
      }).catch(() => {});
    }
  }, [activeTab, fetchInvoices, fetchTariffs, fetchClearances, fetchCreditControl, fetchPaymentConfig, customers.length]);

  const updateInvoice = async (id: number, action: string) => {
    const invoice = invoices.find(inv => inv.invoice_id === id);
    const allowed =
      (action === 'issue' && canCreateInvoice) ||
      (action === 'pay' && canReceivePayment) ||
      (action === 'cancel' && canCancelInvoice) ||
      (action === 'hold' && canCreateInvoice) ||
      (action === 'release' && canReleaseHold);
    if (!allowed) {
      toast('error', 'คุณไม่มีสิทธิ์ทำรายการนี้');
      return;
    }
    const res = await fetch('/api/billing/invoices', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: id,
        action,
        invoice_number: invoice?.invoice_number,
        document_type: invoice?.document_type,
        previous_status: invoice?.status,
        grand_total: invoice?.grand_total,
        yard_id: invoice?.yard_id || yardId,
        user_id: session?.userId,
      }),
    });
    const data = await res.json();
    if (data.error) { toast('error', data.error); }
    fetchInvoices();
  };

  const handleCreateInvoice = async () => {
    if (!canCreateInvoice) {
      setCreateResult({ success: false, message: '❌ คุณไม่มีสิทธิ์ออกใบแจ้งหนี้' });
      return;
    }
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
    if (!canManageSettings) return;
    if (!tariffForm.rate) return;
    await fetch('/api/billing/tariffs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yard_id: yardId, ...tariffForm }),
    });
    setTariffForm({ ...tariffForm, description: '', rate: 0, free_days: 0 });
    fetchTariffs();
  };

  const deleteTariff = async (id: number) => {
    if (!canManageSettings) return;
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
      String(inv.invoice_id).includes(q) ||
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
          { id: 'credit_control' as const, label: 'Credit Control', icon: <CreditCard size={14} /> },
          { id: 'payment_settings' as const, label: 'Payment QR', icon: <QrCode size={14} /> },
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
                            disabled={!canCreateInvoice}
                            className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed">แจ้งหนี้</button>
                        )}
                        {inv.status === 'issued' && (
                          <button onClick={() => updateInvoice(inv.invoice_id, 'pay')}
                            disabled={!canReceivePayment}
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><CreditCard size={10} /> ชำระ</button>
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
                            disabled={!canCreateCreditNote}
                            className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><ArrowDownToLine size={10} /> ใบลดหนี้</button>
                        )}
                        {['draft', 'issued'].includes(inv.status) && (
                          <button onClick={() => updateInvoice(inv.invoice_id, 'cancel')} disabled={!canCancelInvoice} className="px-1 py-1 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"><XCircle size={14} /></button>
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

            <button onClick={handleCreateInvoice} disabled={createLoading || !canCreateInvoice || !createForm.customer_id || !createForm.unit_price}
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
                  <button onClick={handleCreateTariff} disabled={!canManageSettings} className="h-10 px-4 rounded-lg bg-blue-600 text-white text-xs font-medium whitespace-nowrap hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"><Plus size={12} /></button>
                </div>
              </div>
              <TariffSimulatorPanel
                draftTariff={tariffForm}
                savedTariffs={tariffs}
                chargeLabels={CHARGE_LABELS}
                unitLabels={UNIT_LABELS}
              />
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
                          <button onClick={() => deleteTariff(t.tariff_id)} disabled={!canManageSettings} className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"><XCircle size={14} /></button>
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
                        disabled={!canCreateInvoice}
                        className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><Lock size={10} /> Hold</button>
                      <button onClick={() => updateInvoice(inv.invoice_id, 'release')}
                        disabled={!canReleaseHold}
                        className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><Unlock size={10} /> Release</button>
                      <button onClick={() => updateInvoice(inv.invoice_id, 'pay')}
                        disabled={!canReceivePayment}
                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><CreditCard size={10} /> ชำระ</button>
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

      {/* =================== CREDIT CONTROL TAB =================== */}
      {activeTab === 'credit_control' && (
        <CreditControlTab
          customers={creditCustomers}
          loading={creditLoading}
          onRefresh={fetchCreditControl}
        />
      )}

      {/* =================== DEMURRAGE TAB =================== */}
      {activeTab === 'demurrage' && (
        <DemurrageTab yardId={yardId} />
      )}

      {/* =================== PAYMENT SETTINGS TAB =================== */}
      {activeTab === 'payment_settings' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><QrCode size={20} /></div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">PromptPay QR</h3>
                <p className="text-xs text-slate-400">แสดง QR ชำระเงินบนใบแจ้งหนี้ที่ยังไม่ชำระ</p>
              </div>
            </div>
            <button onClick={savePaymentConfig} disabled={paymentConfigSaving || paymentConfigLoading || !canManageSettings}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
              {paymentConfigSaving ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
              บันทึก
            </button>
          </div>
          {paymentConfigLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : (
            <div className="p-5 space-y-4 max-w-2xl">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input type="checkbox" checked={paymentConfig.enabled}
                  onChange={e => setPaymentConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">เปิดใช้ PromptPay QR บนใบแจ้งหนี้</span>
                  <span className="block text-xs text-slate-400 mt-0.5">ระบบสร้าง QR แบบ fixed amount ตามยอด `grand_total` ของ invoice</span>
                </span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>PromptPay ID</label>
                  <input value={paymentConfig.promptpay_id}
                    onChange={e => setPaymentConfig(prev => ({ ...prev, promptpay_id: e.target.value }))}
                    placeholder="เบอร์โทร / เลขภาษี / e-Wallet ID"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ชื่อผู้รับเงิน</label>
                  <input value={paymentConfig.merchant_name || ''}
                    onChange={e => setPaymentConfig(prev => ({ ...prev, merchant_name: e.target.value }))}
                    placeholder="ชื่อที่ต้องการแสดงใต้ QR"
                    className={inputClass} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 text-xs text-emerald-700 dark:text-emerald-400">
                QR นี้ช่วยให้ลูกค้าสแกนจ่ายได้สะดวก แต่ยังเป็น manual payment: หลังรับเงินแล้วให้กด “ชำระ” ที่ invoice เพื่อออกใบเสร็จในระบบ
              </div>
            </div>
          )}
        </div>
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
                disabled={cnLoading || !canCreateCreditNote || !cnReason || cnAmount <= 0 || (cnCreateRevised && (!cnRevisedDescription || cnRevisedQuantity <= 0 || cnRevisedUnitPrice <= 0))}
                onClick={async () => {
                  if (!canCreateCreditNote) {
                    setCnResult({ success: false, message: 'คุณไม่มีสิทธิ์ออกใบลดหนี้' });
                    return;
                  }
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
