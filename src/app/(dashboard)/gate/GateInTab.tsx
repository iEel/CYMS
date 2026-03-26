'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { validateContainerNumber } from '@/lib/containerValidation';
import {
  Loader2, CheckCircle2,
  Package, User, CreditCard,
  ClipboardCheck, Printer, X,
  ScanLine, AlertTriangle, Ship, FileText,
  ArrowDownToLine,
} from 'lucide-react';
import CameraOCR from '@/components/gate/CameraOCR';
import PhotoCapture from '@/components/gate/PhotoCapture';
import SignaturePad from '@/components/gate/SignaturePad';
import ContainerInspection from '@/components/gate/ContainerInspection';
import { BillingCharge, GateInBillingData, inputClass, labelClass, OPTIONAL_CHARGES } from './types';

interface GateInTabProps {
  yardId: number;
  userId?: number;
  onViewEIR: (eirNumber: string) => void;
}

export default function GateInTab({ yardId, userId, onViewEIR }: GateInTabProps) {
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

  // Check Digit + Boxtech states
  const [containerValid, setContainerValid] = useState<null | boolean>(null);
  const [checkDigitError, setCheckDigitError] = useState('');
  const [boxtechLoading, setBoxtechLoading] = useState(false);
  const [boxtechResult, setBoxtechResult] = useState<{
    shipping_line?: string; size?: string; type?: string; source?: string;
    customer?: { customer_id: number; customer_name: string; credit_term: number } | null;
    unknown_prefix?: boolean;
  } | null>(null);
  const boxtechAbortRef = useRef<AbortController | null>(null);

  // Gate-In Billing states
  const [gateInBillingData, setGateInBillingData] = useState<GateInBillingData | null>(null);
  const [gateInBillingLoading, setGateInBillingLoading] = useState(false);
  const [gateInPaymentMethod, setGateInPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [gateInBillingPaid, setGateInBillingPaid] = useState(false);
  const [gateInInvoiceNumber, setGateInInvoiceNumber] = useState('');
  const [gateInInvoiceId, setGateInInvoiceId] = useState<number | null>(null);
  const [gateInSelectedCharges, setGateInSelectedCharges] = useState<Set<number>>(new Set());
  const [gateInChargeOverrides, setGateInChargeOverrides] = useState<Record<number, number>>({});
  const [gateInCustomCharges, setGateInCustomCharges] = useState<BillingCharge[]>([]);
  const [gateInSelectedCustom, setGateInSelectedCustom] = useState<Set<number>>(new Set());
  const [gateInPayLoading, setGateInPayLoading] = useState(false);

  const [gateInLoading, setGateInLoading] = useState(false);
  const [gateInResult, setGateInResult] = useState<{ success: boolean; message: string; eir_number?: string; assigned_location?: { zone_name: string; bay: number; row: number; tier: number; reason: string } } | null>(null);

  // === Check Digit Validation + Boxtech Auto-Lookup ===
  useEffect(() => {
    const num = gateInForm.container_number.toUpperCase().replace(/[\s-]/g, '');
    
    if (num.length < 11) {
      setContainerValid(null);
      setCheckDigitError('');
      setBoxtechResult(null);
      return;
    }
    
    const result = validateContainerNumber(num);
    if (!result.valid) {
      setContainerValid(false);
      setCheckDigitError(result.error || 'Invalid');
      setBoxtechResult(null);
      return;
    }
    
    setContainerValid(true);
    setCheckDigitError('');
    
    if (boxtechAbortRef.current) boxtechAbortRef.current.abort();
    const controller = new AbortController();
    boxtechAbortRef.current = controller;
    
    setBoxtechLoading(true);
    fetch(`/api/boxtech?container_number=${num}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          setBoxtechResult(null);
          return;
        }
        setBoxtechResult(data);
        setGateInForm(prev => ({
          ...prev,
          shipping_line: data.shipping_line || prev.shipping_line,
          size: data.size || prev.size,
          type: data.type || prev.type,
        }));
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Boxtech lookup error:', err);
      })
      .finally(() => setBoxtechLoading(false));

    // Auto-lookup Booking Ref
    fetch(`/api/edi/bookings?lookup=1&container_number=${num}&yard_id=${yardId}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data.booking) {
          setGateInForm(prev => ({ ...prev, booking_ref: prev.booking_ref || data.booking.booking_number }));
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Booking lookup error:', err);
      });
    
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateInForm.container_number]);

  // Fetch gate-in billing when form has valid data
  useEffect(() => {
    if (containerValid !== true) {
      setGateInBillingData(null);
      setGateInBillingPaid(false);
      return;
    }
    setGateInBillingLoading(true);
    fetch('/api/billing/gate-in-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yard_id: yardId,
        container_number: gateInForm.container_number,
        size: gateInForm.size,
        shipping_line: gateInForm.shipping_line,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.charges) {
          setGateInBillingData(data);
          const selected = new Set<number>();
          data.charges.forEach((ch: BillingCharge, i: number) => {
            if (!OPTIONAL_CHARGES.includes(ch.charge_type)) selected.add(i);
          });
          setGateInSelectedCharges(selected);
          setGateInChargeOverrides({});
          setGateInCustomCharges([]);
          setGateInSelectedCustom(new Set());
          setGateInBillingPaid(false);
          setGateInInvoiceNumber('');
          setGateInInvoiceId(null);
        }
      })
      .catch(err => console.error('Gate-in billing fetch error:', err))
      .finally(() => setGateInBillingLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerValid, gateInForm.size, gateInForm.shipping_line]);

  // Gate-In billing helpers
  const getGateInChargeSubtotal = (i: number) => {
    if (i in gateInChargeOverrides) return gateInChargeOverrides[i];
    return gateInBillingData?.charges[i]?.subtotal ?? 0;
  };
  const gateInSelectedTotal = (gateInBillingData ? gateInBillingData.charges
    .reduce((s, _, i) => s + (gateInSelectedCharges.has(i) ? getGateInChargeSubtotal(i) : 0), 0) : 0)
    + gateInCustomCharges.filter((_, i) => gateInSelectedCustom.has(i)).reduce((s, c) => s + c.subtotal, 0);
  const gateInSelectedVat = Math.round(gateInSelectedTotal * 0.07 * 100) / 100;
  const gateInSelectedGrand = gateInSelectedTotal + gateInSelectedVat;
  const buildGateInFinalCharges = () => {
    const final: BillingCharge[] = [];
    if (gateInBillingData) {
      gateInBillingData.charges.forEach((ch, i) => {
        if (gateInSelectedCharges.has(i)) {
          final.push({ ...ch, subtotal: getGateInChargeSubtotal(i), unit_price: i in gateInChargeOverrides ? gateInChargeOverrides[i] : ch.unit_price });
        }
      });
    }
    gateInCustomCharges.forEach((ch, i) => { if (gateInSelectedCustom.has(i)) final.push(ch); });
    return final;
  };
  const hasGateInCharges = gateInBillingData && gateInBillingData.charges.length > 0;

  // Gate-In submit
  const handleGateIn = async () => {
    if (!gateInForm.container_number) return;
    if (containerValid === false) return;
    setGateInLoading(true);
    setGateInResult(null);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'gate_in',
          yard_id: yardId,
          user_id: userId,
          ...gateInForm,
          damage_report: inspectionReport || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (boxtechResult?.unknown_prefix) {
          fetch('/api/yard/audit-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              yard_id: yardId,
              action: 'unknown_prefix_alert',
              entity_type: 'container',
              entity_id: data.container_id,
              details: JSON.stringify({
                prefix: gateInForm.container_number.substring(0, 4),
                container_number: gateInForm.container_number,
                message: `Prefix ${gateInForm.container_number.substring(0, 4)} ไม่มีในระบบ — กรุณาเพิ่มใน Settings > Prefix Mapping`,
              }),
            }),
          }).catch(err => console.warn('Audit log for unknown prefix failed:', err));
        }

        setGateInResult({ success: true, message: `✅ รับตู้ ${gateInForm.container_number} เข้าลานสำเร็จ`, eir_number: data.eir_number, assigned_location: data.assigned_location });
        setGateInForm({ container_number: '', size: '20', type: 'GP', shipping_line: '', is_laden: false, seal_number: '', driver_name: '', driver_license: '', truck_plate: '', booking_ref: '', notes: '' });
        setInspectionReport(null);
        setBoxtechResult(null);
        setContainerValid(null);
        setTimeout(() => setGateInResult(null), 15000);
      } else {
        setGateInResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateInResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateInLoading(false); }
  };

  // OCR callback
  const handleOCRResult = (text: string) => {
    if (showOCR === 'container') setGateInForm(f => ({ ...f, container_number: text }));
    else if (showOCR === 'plate') setGateInForm(f => ({ ...f, truck_plate: text }));
    else if (showOCR === 'seal') setGateInForm(f => ({ ...f, seal_number: text }));
    setShowOCR(null);
  };

  return (
    <>
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
                    className={`${inputClass} font-mono flex-1 ${
                      containerValid === true ? '!border-emerald-400 ring-1 ring-emerald-200' :
                      containerValid === false ? '!border-rose-400 ring-1 ring-rose-200' : ''
                    }`} />
                  <button onClick={() => setShowOCR('container')} className="px-2.5 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 text-xs flex items-center gap-1 border border-blue-200 dark:border-blue-800" title="สแกน OCR">
                    <ScanLine size={14} />
                  </button>
                  {boxtechLoading && (
                    <div className="flex items-center px-2 text-blue-500">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  )}
                </div>
                {/* Check digit status */}
                {containerValid === true && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Check Digit OK
                    </span>
                    {boxtechResult?.source === 'boxtech' && (
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-1.5 py-0.5 rounded">✅ Boxtech</span>
                    )}
                    {boxtechResult?.customer && (
                      <span className="text-[10px] bg-violet-50 dark:bg-violet-900/20 text-violet-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Ship size={10} /> {boxtechResult.customer.customer_name}
                        {boxtechResult.customer.credit_term > 0 && ` (เครดิต ${boxtechResult.customer.credit_term} วัน)`}
                      </span>
                    )}
                    {boxtechResult?.unknown_prefix && (
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle size={10} /> ไม่รู้จัก prefix {gateInForm.container_number.substring(0, 4)}
                      </span>
                    )}
                  </div>
                )}
                {containerValid === false && (
                  <p className="text-[11px] text-rose-500 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} /> {checkDigitError}
                  </p>
                )}
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
                  <option value="DG">DG (สารอันตราย)</option>
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

          {/* Seal Photo */}
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

          {/* ===== GATE-IN BILLING CARD ===== */}
          {gateInBillingLoading ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> กำลังคำนวณค่าบริการ...
            </div>
          ) : gateInBillingData && gateInBillingData.charges.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-900/10 dark:to-emerald-900/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                  💰 ค่าบริการ Gate-In
                </h4>
                {gateInBillingData.is_credit && gateInBillingData.customer && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                    🏢 เครดิต {gateInBillingData.credit_term} วัน • {gateInBillingData.customer.customer_name}
                  </span>
                )}
              </div>

              {/* Charges Table */}
              <div className="px-4 py-2 divide-y divide-slate-100 dark:divide-slate-700/50">
                {gateInBillingData.charges.map((ch, i) => (
                  <div key={`gi-t-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!gateInSelectedCharges.has(i) ? 'opacity-40' : ''}`}>
                    <input type="checkbox" checked={gateInSelectedCharges.has(i)}
                      onChange={() => {
                        setGateInSelectedCharges(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-slate-200">{ch.description}</p>
                      <p className="text-[10px] text-slate-400">{ch.quantity} × ฿{ch.unit_price.toLocaleString()}</p>
                    </div>
                    <input type="number" value={i in gateInChargeOverrides ? gateInChargeOverrides[i] : ch.subtotal}
                      onChange={(e) => setGateInChargeOverrides(prev => ({ ...prev, [i]: parseFloat(e.target.value) || 0 }))}
                      className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                  </div>
                ))}

                {/* Custom charges */}
                {gateInCustomCharges.map((ch, i) => (
                  <div key={`gi-c-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!gateInSelectedCustom.has(i) ? 'opacity-40' : ''}`}>
                    <input type="checkbox" checked={gateInSelectedCustom.has(i)}
                      onChange={() => {
                        setGateInSelectedCustom(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <div className="flex-1">
                      <input type="text" value={ch.description}
                        onChange={(e) => { const arr = [...gateInCustomCharges]; arr[i] = { ...arr[i], description: e.target.value }; setGateInCustomCharges(arr); }}
                        className="w-full h-7 px-2 text-sm rounded border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                        placeholder="ชื่อรายการ" />
                    </div>
                    <input type="number" value={ch.subtotal}
                      onChange={(e) => { const arr = [...gateInCustomCharges]; const val = parseFloat(e.target.value) || 0; arr[i] = { ...arr[i], subtotal: val, unit_price: val }; setGateInCustomCharges(arr); }}
                      className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                    <button onClick={() => {
                      setGateInCustomCharges(prev => prev.filter((_, j) => j !== i));
                      setGateInSelectedCustom(prev => { const next = new Set<number>(); prev.forEach(v => { if (v < i) next.add(v); else if (v > i) next.add(v - 1); }); return next; });
                    }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>

              {/* Add custom charge */}
              <div className="px-4 py-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                <button onClick={() => {
                  const newCharge: BillingCharge = { charge_type: 'custom', description: '', quantity: 1, unit_price: 0, subtotal: 0, free_days: 0, billable_days: 0 };
                  setGateInCustomCharges(prev => [...prev, newCharge]);
                  setGateInSelectedCustom(prev => new Set([...prev, gateInCustomCharges.length]));
                }} className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-colors flex items-center justify-center gap-1"
                >+ เพิ่มรายการค่าบริการ</button>
              </div>

              {/* Summary */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>รวมก่อน VAT ({gateInSelectedCharges.size}/{gateInBillingData.charges.length} รายการ)</span>
                  <span>฿{gateInSelectedTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>VAT 7%</span>
                  <span>฿{gateInSelectedVat.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-800 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-600">
                  <span>ยอดรวมทั้งสิ้น</span>
                  <span className="text-emerald-600">฿{gateInSelectedGrand.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Action */}
              {!gateInBillingPaid && (
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  {gateInBillingData.is_credit ? (
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3">
                      <div>
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🏢 ลูกค้าเครดิต — วางบิลอัตโนมัติ</p>
                        <p className="text-[10px] text-blue-500">สร้างใบแจ้งหนี้ (pending) → รับตู้ได้เลย</p>
                      </div>
                      <button disabled={gateInPayLoading} onClick={async () => {
                        if (!gateInBillingData?.customer) return;
                        setGateInPayLoading(true);
                        try {
                          const res = await fetch('/api/billing/invoices', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              yard_id: yardId, customer_id: gateInBillingData.customer.customer_id,
                              charge_type: 'gate_in', description: `ค่าบริการ Gate-In ${gateInForm.container_number}`,
                              quantity: 1, unit_price: gateInSelectedTotal,
                              due_date: new Date(Date.now() + gateInBillingData.credit_term * 86400000).toISOString(),
                              notes: JSON.stringify({ charges: buildGateInFinalCharges(), transaction_type: 'gate_in', container_number: gateInForm.container_number }),
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setGateInBillingPaid(true);
                            setGateInInvoiceNumber(data.invoice_number || '');
                            setGateInInvoiceId(data.invoice?.invoice_id || null);
                          }
                        } catch (err) { console.error(err); }
                        finally { setGateInPayLoading(false); }
                      }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-1">
                        {gateInPayLoading ? <Loader2 size={12} className="animate-spin" /> : null} 📄 วางบิล
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap">วิธีชำระ:</span>
                        {(['cash', 'transfer'] as const).map(m => (
                          <button key={m} onClick={() => setGateInPaymentMethod(m)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              gateInPaymentMethod === m ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                            }`}>
                            {m === 'cash' ? '💵 เงินสด' : '💳 โอน'}
                          </button>
                        ))}
                      </div>
                      <button disabled={gateInPayLoading || gateInSelectedGrand <= 0} onClick={async () => {
                        setGateInPayLoading(true);
                        try {
                          let custId = gateInBillingData?.customer?.customer_id;
                          if (!custId) custId = 1;
                          const res = await fetch('/api/billing/invoices', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              yard_id: yardId, customer_id: custId,
                              charge_type: 'gate_in', description: `ค่าบริการ Gate-In ${gateInForm.container_number} — ชำระ${gateInPaymentMethod === 'cash' ? 'เงินสด' : 'โอน'}`,
                              quantity: 1, unit_price: gateInSelectedTotal,
                              notes: JSON.stringify({ charges: buildGateInFinalCharges(), transaction_type: 'gate_in', container_number: gateInForm.container_number }),
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            if (data.invoice?.invoice_id) {
                              await fetch('/api/billing/invoices', {
                                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ invoice_id: data.invoice.invoice_id, action: 'pay' }),
                              });
                            }
                            setGateInBillingPaid(true);
                            setGateInInvoiceNumber(data.invoice_number || '');
                            setGateInInvoiceId(data.invoice?.invoice_id || null);
                          }
                        } catch (err) { console.error(err); }
                        finally { setGateInPayLoading(false); }
                      }} className="w-full py-2.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {gateInPayLoading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                        💰 ชำระเงิน ฿{gateInSelectedGrand.toLocaleString()}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Paid confirmation */}
              {gateInBillingPaid && (
                <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-bold">✅ {gateInBillingData.is_credit ? 'วางบิลแล้ว' : 'ชำระเงินแล้ว'}</span>
                      {gateInInvoiceNumber && <span className="text-xs font-mono text-emerald-500">({gateInInvoiceNumber})</span>}
                    </div>
                    {gateInInvoiceId && (
                      <button onClick={() => window.open(`/billing/print?id=${gateInInvoiceId}&type=${gateInBillingData.is_credit ? 'invoice' : 'receipt'}`, '_blank')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                        <Printer size={12} /> 🖨️ พิมพ์{gateInBillingData.is_credit ? 'ใบแจ้งหนี้' : 'ใบเสร็จ'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Submit — Gate-In + EIR */}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleGateIn}
              disabled={gateInLoading || !gateInForm.container_number || containerValid === false || (!!hasGateInCharges && !gateInBillingPaid)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
              {gateInLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
              รับตู้เข้าลาน + ออก EIR
            </button>
            {hasGateInCharges && !gateInBillingPaid && (
              <span className="text-[11px] text-amber-500 flex items-center gap-1">
                <AlertTriangle size={12} /> กรุณาชำระเงินก่อนรับตู้
              </span>
            )}
          </div>

          {/* Result Toast */}
          {gateInResult && (
            <div className={`p-3 rounded-xl text-sm flex items-center justify-between gap-3 ${gateInResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
              <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                <span className="font-medium text-xs">{gateInResult.message}</span>
                {gateInResult.assigned_location && (
                  <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                    📍 {gateInResult.assigned_location.zone_name} B{gateInResult.assigned_location.bay}-R{gateInResult.assigned_location.row}-T{gateInResult.assigned_location.tier}
                  </span>
                )}
                {gateInResult.eir_number && (
                  <>
                    <span className="text-xs font-mono">EIR: {gateInResult.eir_number}</span>
                    <button onClick={() => onViewEIR(gateInResult.eir_number!)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700 transition-colors">
                      <FileText size={12} /> พิมพ์ EIR
                    </button>
                  </>
                )}
              </div>
              <button onClick={() => setGateInResult(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {showOCR && (
        <CameraOCR
          label={showOCR === 'container' ? 'สแกนเลขตู้' : showOCR === 'plate' ? 'สแกนทะเบียนรถ' : 'สแกนเลขซีล'}
          mode={showOCR === 'container' ? 'container' : showOCR === 'plate' ? 'plate' : 'seal'}
          onResult={handleOCRResult}
          onClose={() => setShowOCR(null)}
        />
      )}
    </>
  );
}
