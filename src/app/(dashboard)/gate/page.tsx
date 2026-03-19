'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatTime, formatDateTime } from '@/lib/utils';
import {
  DoorOpen, LogOut, History, Loader2, Search, CheckCircle2, Truck,
  FileText, Plus, ArrowDownToLine, ArrowUpFromLine, Package, User,
  CreditCard, Hash, ClipboardCheck, Printer, X, ChevronDown,
  ScanLine, ArrowRightLeft,
} from 'lucide-react';
import CameraOCR from '@/components/gate/CameraOCR';
import PhotoCapture from '@/components/gate/PhotoCapture';
import SignaturePad from '@/components/gate/SignaturePad';
import ContainerInspection from '@/components/gate/ContainerInspection';
import EIRDocument from '@/components/gate/EIRDocument';

interface Transaction {
  transaction_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  transaction_type: 'gate_in' | 'gate_out';
  driver_name: string;
  truck_plate: string;
  eir_number: string;
  created_at: string;
  full_name: string;
}

interface ContainerResult {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  status: string;
  zone_name?: string;
  zone_id?: number;
  bay?: number;
  row?: number;
  tier?: number;
}

export default function GatePage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'gate_in' | 'gate_out' | 'history' | 'transfer'>('gate_in');

  // Gate-In form
  const [gateInForm, setGateInForm] = useState({
    container_number: '', size: '20', type: 'GP', shipping_line: '',
    is_laden: false, seal_number: '', driver_name: '', driver_license: '',
    truck_plate: '', booking_ref: '', notes: '',
  });
  const [sealPhoto, setSealPhoto] = useState('');
  const [driverSignature, setDriverSignature] = useState('');
  const [showOCR, setShowOCR] = useState<'container' | 'plate' | 'seal' | null>(null);
  const [showInspection, setShowInspection] = useState(false);
  const [inspectionReport, setInspectionReport] = useState<{ points: unknown[]; condition_grade: string; inspector_notes: string; photos: string[] } | null>(null);

  // Transfer
  const [transferForm, setTransferForm] = useState({ container_search: '', to_yard_id: '', driver_name: '', truck_plate: '', notes: '' });
  const [transferResults, setTransferResults] = useState<ContainerResult[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<ContainerResult | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferResult, setTransferResult] = useState<{ success: boolean; message: string } | null>(null);
  const [gateInLoading, setGateInLoading] = useState(false);
  const [gateInResult, setGateInResult] = useState<{ success: boolean; message: string; eir_number?: string; assigned_location?: { zone_name: string; bay: number; row: number; tier: number; reason: string } } | null>(null);

  // Gate-Out
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContainerResult[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerResult | null>(null);
  const [gateOutForm, setGateOutForm] = useState({
    driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '',
  });
  const [gateOutLoading, setGateOutLoading] = useState(false);
  const [gateOutResult, setGateOutResult] = useState<{ success: boolean; message: string; eir_number?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [gateOutPhotos, setGateOutPhotos] = useState<string[]>([]);
  const [gateOutPhase, setGateOutPhase] = useState<'search' | 'pending_pickup' | 'confirm_release'>('search');
  const [releaseLoading, setReleaseLoading] = useState(false);

  // Billing at Gate-Out
  interface BillingCharge { charge_type: string; description: string; quantity: number; unit_price: number; subtotal: number; free_days: number; billable_days: number; }
  interface BillingData {
    container: Record<string, unknown>;
    customer: { customer_id: number; customer_name: string; credit_term: number } | null;
    is_credit: boolean;
    credit_term: number;
    charges: BillingCharge[];
    summary: { total_before_vat: number; vat_rate: number; vat_amount: number; grand_total: number };
    existing_invoices: { invoice_id: number; invoice_number: string; grand_total: number; status: string }[];
    has_hold: boolean;
  }
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [billingPaid, setBillingPaid] = useState(false);
  const [billingInvoiceNumber, setBillingInvoiceNumber] = useState('');

  // History
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // EIR Preview
  const [showEIR, setShowEIR] = useState<string | null>(null);
  const [eirData, setEirData] = useState<Record<string, string | number | boolean | null> | null>(null);

  const yardId = session?.activeYardId || 1;

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/gate?yard_id=${yardId}&date=today`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  }, [yardId]);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, fetchHistory]);

  // Gate-In submit
  const handleGateIn = async () => {
    if (!gateInForm.container_number) return;
    setGateInLoading(true);
    setGateInResult(null);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'gate_in',
          yard_id: yardId,
          ...gateInForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGateInResult({ success: true, message: `✅ รับตู้ ${gateInForm.container_number} เข้าลานสำเร็จ`, eir_number: data.eir_number, assigned_location: data.assigned_location });
        setGateInForm({ container_number: '', size: '20', type: 'GP', shipping_line: '', is_laden: false, seal_number: '', driver_name: '', driver_license: '', truck_plate: '', booking_ref: '', notes: '' });
      } else {
        setGateInResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateInResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateInLoading(false); }
  };

  // Search containers for Gate-Out
  const searchContainers = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&search=${searchQuery}`);
      const data = await res.json();
      const allResults = Array.isArray(data) ? data : [];
      // Show containers physically in yard: in_yard or hold (ค้างจ่าย)
      setSearchResults(allResults.filter((c: ContainerResult) => c.status === 'in_yard' || c.status === 'hold'));
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  // Select container for gate-out + check if work order already exists
  const selectContainerForGateOut = async (c: ContainerResult) => {
    setSelectedContainer(c);
    setGateOutPhase('search');
    setBillingData(null);
    setBillingPaid(false);
    setBillingInvoiceNumber('');

    // Fetch billing info
    setBillingLoading(true);
    try {
      const billRes = await fetch('/api/billing/gate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, container_id: c.container_id }),
      });
      const billData = await billRes.json();
      setBillingData(billData);
      if (billData.is_credit) setPaymentMethod('credit');
    } catch (err) { console.error(err); }
    finally { setBillingLoading(false); }

    // Check existing work orders
    try {
      const res = await fetch(`/api/operations?yard_id=${yardId}`);
      const data = await res.json();
      const gateOutOrders = (data.orders || []).filter(
        (o: { container_number: string; notes?: string; status: string }) =>
          o.container_number === c.container_number &&
          o.notes?.includes('Gate-Out') &&
          o.status !== 'cancelled'
      );
      if (gateOutOrders.length > 0) {
        const activeWO = gateOutOrders.find(
          (o: { status: string }) => ['pending', 'assigned', 'in_progress'].includes(o.status)
        );
        if (activeWO) {
          setGateOutPhase('pending_pickup');
        } else {
          setGateOutPhase('confirm_release');
        }
        try {
          const saved = localStorage.getItem(`gateout_driver_${c.container_number}`);
          if (saved) setGateOutForm(JSON.parse(saved));
        } catch { /* ignore */ }
      }
    } catch (err) { console.error(err); }
  };

  // Phase 1: Request release (create Work Order for forklift)
  const handleRequestRelease = async () => {
    if (!selectedContainer) return;
    setReleaseLoading(true);
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          order_type: 'move',
          container_id: selectedContainer.container_id,
          from_zone_id: selectedContainer.zone_id,
          from_bay: selectedContainer.bay,
          from_row: selectedContainer.row,
          from_tier: selectedContainer.tier,
          priority: 2,
          notes: `Gate-Out → ดึงตู้ ${selectedContainer.container_number} จาก Zone ${selectedContainer.zone_name || '-'} B${selectedContainer.bay}-R${selectedContainer.row}-T${selectedContainer.tier} ไปที่ประตู`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Save driver info to localStorage for Phase 3
        try {
          localStorage.setItem(
            `gateout_driver_${selectedContainer.container_number}`,
            JSON.stringify(gateOutForm)
          );
        } catch { /* ignore */ }
        setGateOutPhase('pending_pickup');
      }
    } catch (err) { console.error(err); }
    finally { setReleaseLoading(false); }
  };

  // Phase 2: Confirm release (gate_out + EIR)
  const handleGateOut = async () => {
    if (!selectedContainer) return;
    setGateOutLoading(true);
    setGateOutResult(null);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'gate_out',
          yard_id: yardId,
          container_id: selectedContainer.container_id,
          container_number: selectedContainer.container_number,
          ...(gateOutPhotos.length > 0 ? { damage_report: { exit_photos: gateOutPhotos } } : {}),
          ...gateOutForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGateOutResult({ success: true, message: `✅ ปล่อยตู้ ${selectedContainer.container_number} ออกจากลานสำเร็จ`, eir_number: data.eir_number });
        setSelectedContainer(null);
        setSearchResults([]);
        setSearchQuery('');
        setGateOutForm({ driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '' });
        setGateOutPhotos([]);
        setGateOutPhase('search');
        // Clear localStorage
        try { localStorage.removeItem(`gateout_driver_${selectedContainer.container_number}`); } catch { /* ignore */ }
      } else {
        setGateOutResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateOutResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateOutLoading(false); }
  };

  // View EIR
  const viewEIR = async (eirNumber: string) => {
    setShowEIR(eirNumber);
    try {
      const res = await fetch(`/api/gate/eir?eir_number=${eirNumber}`);
      const data = await res.json();
      setEirData(data.eir || null);
    } catch (err) { console.error(err); }
  };

  // OCR callback
  const handleOCRResult = (text: string) => {
    if (showOCR === 'container') setGateInForm(f => ({ ...f, container_number: text }));
    else if (showOCR === 'plate') setGateInForm(f => ({ ...f, truck_plate: text }));
    else if (showOCR === 'seal') setGateInForm(f => ({ ...f, seal_number: text }));
    setShowOCR(null);
  };

  // Transfer search
  const searchTransfer = async () => {
    if (!transferForm.container_search) return;
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&status=in_yard&search=${transferForm.container_search}`);
      const data = await res.json();
      setTransferResults(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  // Transfer submit
  const handleTransfer = async () => {
    if (!selectedTransfer || !transferForm.to_yard_id) return;
    setTransferLoading(true);
    setTransferResult(null);
    try {
      const res = await fetch('/api/gate/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: selectedTransfer.container_id,
          from_yard_id: yardId,
          to_yard_id: parseInt(transferForm.to_yard_id),
          driver_name: transferForm.driver_name,
          truck_plate: transferForm.truck_plate,
          notes: transferForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferResult({ success: true, message: data.message });
        setSelectedTransfer(null);
        setTransferResults([]);
        setTransferForm({ container_search: '', to_yard_id: '', driver_name: '', truck_plate: '', notes: '' });
      } else {
        setTransferResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch { setTransferResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setTransferLoading(false); }
  };

  const inputClass = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">ประตู Gate</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">จัดการรถเข้า-ออกลาน, ออกเอกสาร EIR</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'gate_in' as const, label: 'Gate-In (รับเข้า)', icon: <ArrowDownToLine size={14} />, color: 'emerald' },
          { id: 'gate_out' as const, label: 'Gate-Out (ปล่อยออก)', icon: <ArrowUpFromLine size={14} />, color: 'blue' },
          { id: 'history' as const, label: 'ประวัติวันนี้', icon: <History size={14} />, color: 'slate' },
          { id: 'transfer' as const, label: 'ย้ายข้ามลาน', icon: <ArrowRightLeft size={14} />, color: 'purple' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== GATE-IN TAB =================== */}
      {activeTab === 'gate_in' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                <ArrowDownToLine size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">รับตู้เข้าลาน (Gate-In)</h3>
                <p className="text-xs text-slate-400">กรอกข้อมูลตู้, คนขับ, และทะเบียนรถ → ระบบจะสร้าง EIR อัตโนมัติ</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Container Info */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><Package size={12} /> ข้อมูลตู้</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className={labelClass}>เลขตู้ *</label>
                  <div className="flex gap-1">
                    <input type="text" placeholder="ABCU1234567" value={gateInForm.container_number}
                      onChange={e => setGateInForm({ ...gateInForm, container_number: e.target.value.toUpperCase() })}
                      className={`${inputClass} font-mono flex-1`} />
                    <button onClick={() => setShowOCR('container')} className="px-2.5 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 text-xs flex items-center gap-1 border border-blue-200 dark:border-blue-800" title="สแกน OCR">
                      <ScanLine size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>ขนาด</label>
                  <select value={gateInForm.size} onChange={e => setGateInForm({ ...gateInForm, size: e.target.value })} className={inputClass}>
                    <option value="20">20 ฟุต</option>
                    <option value="40">40 ฟุต</option>
                    <option value="45">45 ฟุต</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ประเภท</label>
                  <select value={gateInForm.type} onChange={e => setGateInForm({ ...gateInForm, type: e.target.value })} className={inputClass}>
                    <option value="GP">GP (แห้ง)</option>
                    <option value="HC">HC (High Cube)</option>
                    <option value="RF">RF (ตู้เย็น)</option>
                    <option value="OT">OT (Open Top)</option>
                    <option value="FR">FR (Flat Rack)</option>
                    <option value="TK">TK (Tank)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>สายเรือ</label>
                  <input type="text" placeholder="เช่น Evergreen" value={gateInForm.shipping_line}
                    onChange={e => setGateInForm({ ...gateInForm, shipping_line: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>เลขซีล</label>
                  <div className="flex gap-1">
                    <input type="text" placeholder="SEAL123456" value={gateInForm.seal_number}
                      onChange={e => setGateInForm({ ...gateInForm, seal_number: e.target.value.toUpperCase() })} className={`${inputClass} font-mono flex-1`} />
                    <button onClick={() => setShowOCR('seal')} className="px-2.5 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 text-xs flex items-center gap-1 border border-blue-200 dark:border-blue-800" title="สแกน OCR">
                      <ScanLine size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>สถานะตู้</label>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setGateInForm({ ...gateInForm, is_laden: false })}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-all ${!gateInForm.is_laden ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}>
                      ตู้เปล่า
                    </button>
                    <button onClick={() => setGateInForm({ ...gateInForm, is_laden: true })}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-all ${gateInForm.is_laden ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}>
                      มีสินค้า
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Booking Ref</label>
                  <input type="text" placeholder="BK-123456" value={gateInForm.booking_ref}
                    onChange={e => setGateInForm({ ...gateInForm, booking_ref: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Driver Info */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><User size={12} /> ข้อมูลคนขับ / รถ</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>ชื่อคนขับ</label>
                  <input type="text" placeholder="ชื่อ-นามสกุล" value={gateInForm.driver_name}
                    onChange={e => setGateInForm({ ...gateInForm, driver_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>เลขใบขับขี่</label>
                  <input type="text" placeholder="1234567890" value={gateInForm.driver_license}
                    onChange={e => setGateInForm({ ...gateInForm, driver_license: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ทะเบียนรถ</label>
                  <div className="flex gap-1">
                    <input type="text" placeholder="1กก 1234" value={gateInForm.truck_plate}
                      onChange={e => setGateInForm({ ...gateInForm, truck_plate: e.target.value })} className={`${inputClass} flex-1`} />
                    <button onClick={() => setShowOCR('plate')} className="px-2.5 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 text-xs flex items-center gap-1 border border-blue-200 dark:border-blue-800" title="สแกน OCR">
                      <ScanLine size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Seal Photo (required for Laden) */}
            {gateInForm.is_laden && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <PhotoCapture label="ถ่ายรูปซีล (บังคับสำหรับตู้ Laden)" required onCapture={setSealPhoto} value={sealPhoto} />
              </div>
            )}

            {/* Container Inspection */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><ClipboardCheck size={12} /> ตรวจสภาพตู้</h4>
              {!showInspection && !inspectionReport && (
                <button onClick={() => setShowInspection(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all text-sm flex items-center justify-center gap-2">
                  <ClipboardCheck size={16} /> เปิดแบบฟอร์มตรวจสภาพตู้
                </button>
              )}
              {showInspection && (
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                  <ContainerInspection
                    onComplete={(report) => {
                      setInspectionReport(report);
                      setShowInspection(false);
                    }}
                    onCancel={() => setShowInspection(false)}
                  />
                </div>
              )}
              {inspectionReport && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                        inspectionReport.condition_grade === 'A' ? 'bg-emerald-500' :
                        inspectionReport.condition_grade === 'B' ? 'bg-amber-500' :
                        inspectionReport.condition_grade === 'C' ? 'bg-orange-500' : 'bg-red-600'
                      }`}>{inspectionReport.condition_grade}</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">✅ ตรวจแล้ว — เกรด {inspectionReport.condition_grade}</p>
                        <p className="text-[10px] text-slate-400">พบ {inspectionReport.points.length} จุดเสียหาย · {inspectionReport.photos.length} รูปถ่าย</p>
                      </div>
                    </div>
                    <button onClick={() => { setInspectionReport(null); setShowInspection(true); }}
                      className="text-xs text-blue-500 hover:text-blue-700">ตรวจใหม่</button>
                  </div>
                </div>
              )}
            </div>

            {/* Driver Signature */}
            <SignaturePad label="ลายเซ็นคนขับรับมอบ" onComplete={setDriverSignature} />
            {driverSignature && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs">
                <CheckCircle2 size={14} /> ลงลายเซ็นแล้ว
              </div>
            )}

            {/* Notes */}
            <div>
              <label className={labelClass}>หมายเหตุ</label>
              <input type="text" placeholder="หมายเหตุเพิ่มเติม..." value={gateInForm.notes}
                onChange={e => setGateInForm({ ...gateInForm, notes: e.target.value })} className={inputClass} />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleGateIn} disabled={gateInLoading || !gateInForm.container_number}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
                {gateInLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                รับตู้เข้าลาน + ออก EIR
              </button>
            </div>

            {/* Result */}
            {gateInResult && (
              <div className={`p-4 rounded-xl text-sm ${gateInResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                <p className="font-medium">{gateInResult.message}</p>
                {gateInResult.assigned_location && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                    <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase mb-1">📍 วางตู้ที่</p>
                    <p className="text-base font-bold">
                      {gateInResult.assigned_location.zone_name} — Bay {gateInResult.assigned_location.bay}, Row {gateInResult.assigned_location.row}, Tier {gateInResult.assigned_location.tier}
                    </p>
                    <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-0.5">{gateInResult.assigned_location.reason}</p>
                  </div>
                )}
                {gateInResult.eir_number && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs">EIR: <span className="font-mono font-bold">{gateInResult.eir_number}</span></span>
                    <button onClick={() => viewEIR(gateInResult.eir_number!)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs hover:bg-emerald-200 transition-colors">
                      <FileText size={12} /> ดู EIR
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== GATE-OUT TAB =================== */}
      {activeTab === 'gate_out' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <ArrowUpFromLine size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">ปล่อยตู้ออกจากลาน (Gate-Out)</h3>
                <p className="text-xs text-slate-400">ค้นหาตู้ที่อยู่ในลาน → กรอกคนขับ/ทะเบียน → ปล่อยออก</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Search */}
            <div>
              <label className={labelClass}>ค้นหาตู้ในลาน</label>
              <div className="flex gap-2">
                <input type="text" placeholder="พิมพ์เลขตู้ หรือสายเรือ..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchContainers()}
                  className={`${inputClass} font-mono flex-1`} />
                <button onClick={searchContainers} disabled={searching}
                  className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-all">
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} ค้นหา
                </button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && !selectedContainer && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400">พบ {searchResults.length} ตู้ — กดเลือกตู้ที่จะปล่อยออก</p>
                {searchResults.map(c => (
                  <button key={c.container_id} onClick={() => selectContainerForGateOut(c)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                        <Package size={16} />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-slate-800 dark:text-white text-sm">{c.container_number}</p>
                        <p className="text-xs text-slate-400">{c.size}&apos;{c.type} • {c.shipping_line || '-'}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{c.zone_name ? `Zone ${c.zone_name} B${c.bay}-R${c.row}-T${c.tier}` : 'ไม่มีพิกัด'}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Container + 2-Phase Gate-Out */}
            {selectedContainer && (
              <div className="space-y-4">
                {/* Step Indicator */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                    gateOutPhase === 'search' ? 'bg-blue-500 text-white' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {gateOutPhase === 'search' ? '①' : '✓'} ขอดึงตู้
                  </div>
                  <div className="w-6 h-0.5 bg-slate-200" />
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                    gateOutPhase === 'pending_pickup' ? 'bg-amber-500 text-white animate-pulse' :
                    gateOutPhase === 'confirm_release' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {gateOutPhase === 'confirm_release' ? '②' : gateOutPhase === 'pending_pickup' ? '⏳' : '②'} รอรถยก
                  </div>
                  <div className="w-6 h-0.5 bg-slate-200" />
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                    gateOutPhase === 'confirm_release' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    ③ ปล่อยตู้ + EIR
                  </div>
                </div>

                {/* Container Info Card */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-500 font-medium mb-1">ตู้ที่จะปล่อยออก</p>
                      <p className="font-mono font-bold text-lg text-slate-800 dark:text-white">{selectedContainer.container_number}</p>
                      <p className="text-sm text-slate-500">{selectedContainer.size}&apos;{selectedContainer.type} • {selectedContainer.shipping_line || '-'} • {selectedContainer.zone_name ? `Zone ${selectedContainer.zone_name} B${selectedContainer.bay}-R${selectedContainer.row}-T${selectedContainer.tier}` : ''}</p>
                    </div>
                    <button onClick={() => { setSelectedContainer(null); setGateOutPhase('search'); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                  </div>
                </div>

                {/* ===== PHASE 1: ขอดึงตู้ ===== */}
                {gateOutPhase === 'search' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><User size={12} /> ข้อมูลคนขับ / รถ</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className={labelClass}>ชื่อคนขับ</label>
                          <input type="text" value={gateOutForm.driver_name} onChange={e => setGateOutForm({ ...gateOutForm, driver_name: e.target.value })} className={inputClass} placeholder="ชื่อ-นามสกุล" />
                        </div>
                        <div>
                          <label className={labelClass}>เลขใบขับขี่</label>
                          <input type="text" value={gateOutForm.driver_license} onChange={e => setGateOutForm({ ...gateOutForm, driver_license: e.target.value })} className={inputClass} placeholder="1234567890" />
                        </div>
                        <div>
                          <label className={labelClass}>ทะเบียนรถ</label>
                          <input type="text" value={gateOutForm.truck_plate} onChange={e => setGateOutForm({ ...gateOutForm, truck_plate: e.target.value })} className={inputClass} placeholder="1กก 1234" />
                        </div>
                        <div>
                          <label className={labelClass}>เลขซีล</label>
                          <input type="text" value={gateOutForm.seal_number} onChange={e => setGateOutForm({ ...gateOutForm, seal_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="SEAL123456" />
                        </div>
                        <div>
                          <label className={labelClass}>Booking Ref</label>
                          <input type="text" value={gateOutForm.booking_ref} onChange={e => setGateOutForm({ ...gateOutForm, booking_ref: e.target.value })} className={inputClass} placeholder="BK-123456" />
                        </div>
                        <div>
                          <label className={labelClass}>หมายเหตุ</label>
                          <input type="text" value={gateOutForm.notes} onChange={e => setGateOutForm({ ...gateOutForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." />
                        </div>
                      </div>
                    </div>

                    {/* ===== BILLING CARD ===== */}
                    {billingLoading ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm text-slate-400">
                        <Loader2 size={16} className="animate-spin" /> กำลังคำนวณค่าบริการ...
                      </div>
                    ) : billingData && billingData.charges.length > 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                            💰 ค่าบริการ ({billingData.container.dwell_days as number} วัน)
                          </h4>
                          {billingData.is_credit && billingData.customer && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                              🏢 เครดิต {billingData.credit_term} วัน • {billingData.customer.customer_name}
                            </span>
                          )}
                        </div>

                        {/* Charges Table */}
                        <div className="px-4 py-2 divide-y divide-slate-100 dark:divide-slate-700/50">
                          {billingData.charges.map((ch, i) => (
                            <div key={i} className="py-2 flex items-center justify-between text-sm">
                              <div>
                                <p className="text-slate-700 dark:text-slate-200">{ch.description}</p>
                                <p className="text-[10px] text-slate-400">
                                  {ch.billable_days > 0 ? `${ch.quantity} วัน × ฿${ch.unit_price.toLocaleString()} (ฟรี ${ch.free_days} วัน)` : `${ch.quantity} × ฿${ch.unit_price.toLocaleString()}`}
                                </p>
                              </div>
                              <span className="font-mono font-semibold text-slate-800 dark:text-white">฿{ch.subtotal.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>

                        {/* Summary */}
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>รวมก่อน VAT</span>
                            <span>฿{billingData.summary.total_before_vat.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>VAT 7%</span>
                            <span>฿{billingData.summary.vat_amount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-base font-bold text-slate-800 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-600">
                            <span>ยอดรวมทั้งสิ้น</span>
                            <span className="text-emerald-600">฿{billingData.summary.grand_total.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Payment Action */}
                        {!billingPaid && (
                          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                            {billingData.is_credit ? (
                              /* Credit Customer → Auto Invoice */
                              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3">
                                <div>
                                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🏢 ลูกค้าเครดิต — วางบิลอัตโนมัติ</p>
                                  <p className="text-[10px] text-blue-500">สร้างใบแจ้งหนี้ (pending) → ปล่อยตู้ได้เลย</p>
                                </div>
                                <button
                                  onClick={async () => {
                                    if (!selectedContainer || !billingData?.customer) return;
                                    try {
                                      const res = await fetch('/api/billing/invoices', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          yard_id: yardId,
                                          customer_id: billingData.customer.customer_id,
                                          container_id: selectedContainer.container_id,
                                          charge_type: 'storage',
                                          description: `ค่าบริการ Gate-Out ${selectedContainer.container_number} (${billingData.container.dwell_days} วัน)`,
                                          quantity: 1,
                                          unit_price: billingData.summary.total_before_vat,
                                          due_date: new Date(Date.now() + billingData.credit_term * 86400000).toISOString(),
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        setBillingPaid(true);
                                        setBillingInvoiceNumber(data.invoice_number || '');
                                      }
                                    } catch (err) { console.error(err); }
                                  }}
                                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 whitespace-nowrap"
                                >📄 วางบิล</button>
                              </div>
                            ) : (
                              /* Cash Customer → Pay at Gate */
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 whitespace-nowrap">วิธีชำระ:</span>
                                  {(['cash', 'transfer'] as const).map(m => (
                                    <button key={m} onClick={() => setPaymentMethod(m)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        paymentMethod === m ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                      }`}>
                                      {m === 'cash' ? '💵 เงินสด' : '💳 โอน'}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={async () => {
                                    if (!selectedContainer || !billingData) return;
                                    try {
                                      // Find or create customer from shipping_line
                                      let custId = billingData.customer?.customer_id;
                                      if (!custId) {
                                        // Use a default general customer
                                        custId = 1;
                                      }
                                      const res = await fetch('/api/billing/invoices', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          yard_id: yardId,
                                          customer_id: custId,
                                          container_id: selectedContainer.container_id,
                                          charge_type: 'storage',
                                          description: `ค่าบริการ Gate-Out ${selectedContainer.container_number} (${billingData.container.dwell_days} วัน) — ชำระ ${paymentMethod === 'cash' ? 'เงินสด' : 'โอน'}`,
                                          quantity: 1,
                                          unit_price: billingData.summary.total_before_vat,
                                        }),
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        // Mark as paid immediately
                                        await fetch('/api/billing/invoices', {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ invoice_id: data.invoice.invoice_id, action: 'pay' }),
                                        });
                                        setBillingPaid(true);
                                        setBillingInvoiceNumber(data.invoice_number || '');
                                      }
                                    } catch (err) { console.error(err); }
                                  }}
                                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all"
                                >💰 รับชำระเงิน ฿{billingData.summary.grand_total.toLocaleString()}</button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Paid Confirmation */}
                        {billingPaid && (
                          <div className="px-4 py-3 border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 flex items-center gap-2 text-xs text-emerald-600 font-bold">
                            <CheckCircle2 size={14} /> {billingData.is_credit ? 'วางบิลแล้ว' : 'ชำระเงินแล้ว'} — {billingInvoiceNumber}
                          </div>
                        )}
                      </div>
                    ) : billingData && billingData.charges.length === 0 ? (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-600 flex items-center gap-2">
                        <CheckCircle2 size={14} /> ไม่มีค่าบริการ (อยู่ในช่วง Free Days หรือไม่มี Tariff)
                      </div>
                    ) : null}

                    <button onClick={handleRequestRelease}
                      disabled={releaseLoading || !!(billingData && billingData.charges.length > 0 && !billingPaid && !billingData.is_credit)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all w-full justify-center">
                      {releaseLoading ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                      ขอดึงตู้ → สร้างคำสั่งรถยก
                    </button>
                  </div>
                )}

                {/* ===== PHASE 2: รอรถยกมาส่ง ===== */}
                {gateOutPhase === 'pending_pickup' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-center">
                      <div className="text-3xl mb-2">🚛</div>
                      <h4 className="font-bold text-amber-700 dark:text-amber-400">รอรถยกนำตู้มาที่ประตู...</h4>
                      <p className="text-xs text-amber-500 mt-1">คำสั่งงานถูกส่งไปหน้าปฏิบัติการแล้ว กรุณารอจนกว่าตู้จะมาถึง</p>
                    </div>

                    <button onClick={() => setGateOutPhase('confirm_release')}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all w-full justify-center">
                      <CheckCircle2 size={16} /> ตู้ถึงประตูแล้ว → ตรวจสภาพ & ปล่อยออก
                    </button>
                  </div>
                )}

                {/* ===== PHASE 3: ตรวจสภาพ + ปล่อยตู้ + ออก EIR ===== */}
                {gateOutPhase === 'confirm_release' && (
                  <div className="space-y-4">
                    {/* Driver Info Summary */}
                    {(gateOutForm.driver_name || gateOutForm.truck_plate) && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                        <h4 className="text-[10px] font-semibold text-emerald-500 uppercase mb-2">ข้อมูลคนขับ (จากขั้นตอนที่ 1)</h4>
                        <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <div><span className="text-slate-400">ชื่อ:</span> {gateOutForm.driver_name || '-'}</div>
                          <div><span className="text-slate-400">ใบขับขี่:</span> {gateOutForm.driver_license || '-'}</div>
                          <div><span className="text-slate-400">ทะเบียน:</span> {gateOutForm.truck_plate || '-'}</div>
                        </div>
                      </div>
                    )}

                    {/* Exit Photos (optional) */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
                        📸 ถ่ายรูปตู้ขาออก <span className="text-[10px] font-normal text-slate-400">(ไม่บังคับ — เพื่อบันทึกสภาพตู้ก่อนออก)</span>
                      </h4>
                      {gateOutPhotos.length > 0 && (
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {gateOutPhotos.map((photo, i) => (
                            <div key={i} className="relative">
                              <img src={photo} alt={`Exit photo ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                              <button onClick={() => setGateOutPhotos(gateOutPhotos.filter((_, idx) => idx !== i))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {gateOutPhotos.length < 4 && (
                        <PhotoCapture
                          onCapture={(photo: string) => setGateOutPhotos([...gateOutPhotos, photo])}
                          label={`ถ่ายรูปตู้ขาออก (${gateOutPhotos.length}/4)`}
                        />
                      )}
                    </div>

                    <button onClick={handleGateOut} disabled={gateOutLoading}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all w-full justify-center">
                      {gateOutLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpFromLine size={16} />}
                      ✅ ยืนยันปล่อยตู้ออก + ออก EIR
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {gateOutResult && (
              <div className={`p-4 rounded-xl text-sm ${gateOutResult.success ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                <p className="font-medium">{gateOutResult.message}</p>
                {gateOutResult.eir_number && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs">EIR: <span className="font-mono font-bold">{gateOutResult.eir_number}</span></span>
                    <button onClick={() => viewEIR(gateOutResult.eir_number!)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs hover:bg-blue-200 transition-colors">
                      <FileText size={12} /> ดู EIR
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== HISTORY TAB =================== */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <History size={18} /> ประวัติ Gate วันนี้
            </h3>
            <button onClick={fetchHistory} className="text-xs text-blue-500 hover:text-blue-700 font-medium">รีเฟรช</button>
          </div>

          {historyLoading ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีรายการวันนี้</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs text-slate-500 uppercase">
                    <th className="px-4 py-3">เวลา</th>
                    <th className="px-4 py-3">ประเภท</th>
                    <th className="px-4 py-3">เลขตู้</th>
                    <th className="px-4 py-3">ขนาด</th>
                    <th className="px-4 py-3">คนขับ</th>
                    <th className="px-4 py-3">ทะเบียน</th>
                    <th className="px-4 py-3">EIR</th>
                    <th className="px-4 py-3">ผู้ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {transactions.map(tx => (
                    <tr key={tx.transaction_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatTime(tx.created_at).slice(0, 5)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          tx.transaction_type === 'gate_in'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {tx.transaction_type === 'gate_in' ? <ArrowDownToLine size={10} /> : <ArrowUpFromLine size={10} />}
                          {tx.transaction_type === 'gate_in' ? 'IN' : 'OUT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-white">{tx.container_number}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.size}&apos;{tx.type}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.driver_name || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{tx.truck_plate || '-'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => viewEIR(tx.eir_number)}
                          className="text-xs text-blue-500 hover:text-blue-700 font-mono font-medium hover:underline">
                          {tx.eir_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.full_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================== TRANSFER TAB =================== */}
      {activeTab === 'transfer' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">ย้ายตู้ข้ามสาขา (Inter-Yard Transfer)</h3>
                <p className="text-xs text-slate-400">เลือกตู้ → ระบุลานปลายทาง → สถานะเปลี่ยนเป็น In-Transit</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className={labelClass}>ค้นหาตู้ในลาน</label>
              <div className="flex gap-2">
                <input type="text" placeholder="พิมพ์เลขตู้..." value={transferForm.container_search}
                  onChange={e => setTransferForm({ ...transferForm, container_search: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && searchTransfer()}
                  className={`${inputClass} flex-1 font-mono`} />
                <button onClick={searchTransfer}
                  className="px-4 h-10 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 flex items-center gap-1">
                  <Search size={14} /> ค้นหา
                </button>
              </div>
            </div>

            {transferResults.length > 0 && (
              <div className="space-y-1.5">
                {transferResults.map(c => (
                  <button key={c.container_id} onClick={() => setSelectedTransfer(c)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm ${
                      selectedTransfer?.container_id === c.container_id
                        ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'
                    }`}>
                    <span className="font-mono font-semibold text-slate-800 dark:text-white">{c.container_number}</span>
                    <span className="text-slate-400 ml-2">{c.size}&apos;{c.type} · {c.shipping_line}</span>
                    {c.zone_name && <span className="text-slate-400 ml-2">@ {c.zone_name} B{c.bay}-R{c.row}-T{c.tier}</span>}
                  </button>
                ))}
              </div>
            )}

            {selectedTransfer && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>ลานปลายทาง *</label>
                    <select value={transferForm.to_yard_id} onChange={e => setTransferForm({ ...transferForm, to_yard_id: e.target.value })} className={inputClass}>
                      <option value="">เลือกลาน...</option>
                      <option value="1">ลานตู้สาขาหลัก</option>
                      <option value="2">ลานตู้สาขา 2</option>
                      <option value="3">ลานตู้สาขา 3</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>คนขับ</label>
                    <input type="text" placeholder="ชื่อ-นามสกุล" value={transferForm.driver_name}
                      onChange={e => setTransferForm({ ...transferForm, driver_name: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>ทะเบียนรถ</label>
                    <input type="text" placeholder="1กก 1234" value={transferForm.truck_plate}
                      onChange={e => setTransferForm({ ...transferForm, truck_plate: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>หมายเหตุ</label>
                  <input type="text" placeholder="เหตุผลในการย้าย..." value={transferForm.notes}
                    onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} className={inputClass} />
                </div>
                <button onClick={handleTransfer} disabled={transferLoading || !transferForm.to_yard_id}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-all">
                  {transferLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                  ย้ายตู้ข้ามสาขา
                </button>
              </>
            )}

            {transferResult && (
              <div className={`p-4 rounded-xl text-sm ${transferResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700'}`}>
                <p className="font-medium">{transferResult.message}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================== OCR MODAL =================== */}
      {showOCR && (
        <CameraOCR
          label={showOCR === 'container' ? 'สแกนเลขตู้' : showOCR === 'plate' ? 'สแกนทะเบียนรถ' : 'สแกนเลขซีล'}
          onResult={handleOCRResult}
          onClose={() => setShowOCR(null)}
        />
      )}

      {/* =================== EIR MODAL (A3) =================== */}
      {showEIR && eirData && (
        <EIRDocument
          data={eirData as any}
          onClose={() => { setShowEIR(null); setEirData(null); }}
        />
      )}
      {showEIR && !eirData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <Loader2 size={32} className="animate-spin mx-auto text-blue-500" />
            <p className="text-sm text-slate-500 mt-3">กำลังโหลด EIR...</p>
          </div>
        </div>
      )}
    </div>
  );
}
