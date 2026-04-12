'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Search, CheckCircle2, Truck,
  Package, User, FileText, X, Users,
  ArrowUpFromLine, AlertTriangle, ScanLine,
} from 'lucide-react';
import PhotoCapture from '@/components/gate/PhotoCapture';
import CameraOCR from '@/components/gate/CameraOCR';
import { BillingCharge, BillingData, ContainerResult, GateOutBooking, inputClass, labelClass, OPTIONAL_CHARGES } from './types';

interface GateOutTabProps {
  yardId: number;
  userId?: number;
  onViewEIR: (eirNumber: string) => void;
}

export default function GateOutTab({ yardId, userId, onViewEIR }: GateOutTabProps) {
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContainerResult[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Gate-Out form
  const [gateOutForm, setGateOutForm] = useState({
    driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '',
  });
  const [gateOutLoading, setGateOutLoading] = useState(false);
  const [gateOutResult, setGateOutResult] = useState<{ success: boolean; message: string; eir_number?: string } | null>(null);
  const [gateOutPhotos, setGateOutPhotos] = useState<string[]>([]);
  const [gateOutPhase, setGateOutPhase] = useState<'search' | 'pending_pickup' | 'confirm_release'>('search');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [showOCR, setShowOCR] = useState<'plate' | 'seal' | null>(null);

  // Billing
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [billingPaid, setBillingPaid] = useState(false);
  const [billingInvoiceNumber, setBillingInvoiceNumber] = useState('');
  const [billingInvoiceId, setBillingInvoiceId] = useState<number | null>(null);
  const [selectedCharges, setSelectedCharges] = useState<Set<number>>(new Set());
  const [chargeOverrides, setChargeOverrides] = useState<Record<number, number>>({});
  const [customCharges, setCustomCharges] = useState<BillingCharge[]>([]);
  const [selectedCustom, setSelectedCustom] = useState<Set<number>>(new Set());

  // Manual customer selection (when no auto-match)
  const [customerList, setCustomerList] = useState<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean; credit_term: number }[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [manualCustomerId, setManualCustomerId] = useState<number | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Booking selection for Gate-Out
  const [selectedBooking, setSelectedBooking] = useState<GateOutBooking | null>(null);
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingResults, setBookingResults] = useState<GateOutBooking[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [showBookingPicker, setShowBookingPicker] = useState(false);
  const [bookingWarning, setBookingWarning] = useState('');

  // Fetch customer list for manual selection
  useEffect(() => {
    fetch('/api/settings/customers')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCustomerList(data); })
      .catch(err => console.error('Load customers error:', err));
  }, []);

  // Resolved customer: auto-matched or manually selected
  const resolvedCustomer = useMemo(() => {
    if (manualCustomerId) {
      const c = customerList.find(c => c.customer_id === manualCustomerId);
      if (c) return { customer_id: c.customer_id, customer_name: c.customer_name, credit_term: c.credit_term };
    }
    return billingData?.billing_customer || billingData?.customer || null;
  }, [billingData?.billing_customer, billingData?.customer, manualCustomerId, customerList]);
  const resolvedIsCredit = resolvedCustomer ? (resolvedCustomer.credit_term || 0) > 0 : false;

  const filteredGateOutCustomers = useMemo(() => {
    if (!customerSearch) return customerList.slice(0, 10);
    const q = customerSearch.toLowerCase();
    return customerList.filter(c => c.customer_name.toLowerCase().includes(q)).slice(0, 10);
  }, [customerList, customerSearch]);

  const bookingProgressText = (booking: GateOutBooking) => {
    const total = booking.container_count || 0;
    const received = booking.received_containers ?? booking.received_count ?? 0;
    const released = booking.released_containers ?? booking.released_count ?? 0;
    return `${received}/${total} received, ${released}/${total} released`;
  };

  // Init selected charges
  const initSelectedCharges = (charges: BillingCharge[]) => {
    const selected = new Set<number>();
    charges.forEach((ch, i) => {
      if (!OPTIONAL_CHARGES.includes(ch.charge_type)) selected.add(i);
    });
    setSelectedCharges(selected);
    setChargeOverrides({});
    setCustomCharges([]);
    setSelectedCustom(new Set());
  };

  const getChargeSubtotal = (i: number) => {
    if (i in chargeOverrides) return chargeOverrides[i];
    return billingData?.charges[i]?.subtotal ?? 0;
  };

  const selectedTotal = (billingData ? billingData.charges
    .reduce((s, _, i) => s + (selectedCharges.has(i) ? getChargeSubtotal(i) : 0), 0) : 0)
    + customCharges.filter((_, i) => selectedCustom.has(i)).reduce((s, c) => s + c.subtotal, 0);
  const selectedVat = Math.round(selectedTotal * 0.07 * 100) / 100;
  const selectedGrand = selectedTotal + selectedVat;

  const buildFinalCharges = () => {
    const final: BillingCharge[] = [];
    if (billingData) {
      billingData.charges.forEach((ch, i) => {
        if (selectedCharges.has(i)) {
          final.push({ ...ch, subtotal: getChargeSubtotal(i), unit_price: i in chargeOverrides ? chargeOverrides[i] : ch.unit_price });
        }
      });
    }
    customCharges.forEach((ch, i) => { if (selectedCustom.has(i)) final.push(ch); });
    return final;
  };

  const loadGateOutBilling = async (container: ContainerResult, billingCustomerId?: number | null, bookingRef?: string) => {
    setBillingLoading(true);
    try {
      const billRes = await fetch('/api/billing/gate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          container_id: container.container_id,
          ...(billingCustomerId ? { billing_customer_id: billingCustomerId } : {}),
          ...(bookingRef ? { booking_ref: bookingRef } : {}),
        }),
      });
      const billData = await billRes.json();
      setBillingData(billData);
      if (billData.charges) initSelectedCharges(billData.charges);
      if (billData.billing_customer?.customer_id) setManualCustomerId(billData.billing_customer.customer_id);
      else if (billData.customer?.customer_id) setManualCustomerId(billData.customer.customer_id);
      if (billData.is_credit) setPaymentMethod('credit');
      else setPaymentMethod('cash');
    } catch (err) { console.error(err); }
    finally { setBillingLoading(false); }
  };

  const applyGateOutBooking = async (booking: GateOutBooking | null, container = selectedContainer) => {
    setSelectedBooking(booking);
    setBookingWarning('');
    const bookingRef = booking?.booking_number || '';
    setGateOutForm(prev => ({ ...prev, booking_ref: bookingRef }));
    setBillingPaid(false);
    setBillingInvoiceNumber('');
    setBillingInvoiceId(null);
    if (booking?.customer_id) setManualCustomerId(booking.customer_id);
    if (container) await loadGateOutBilling(container, booking?.customer_id || manualCustomerId, bookingRef);
  };

  const loadBookingByNumber = async (bookingNumber: string, container = selectedContainer) => {
    const ref = bookingNumber.trim();
    if (!ref) {
      await applyGateOutBooking(null, container);
      return;
    }

    setBookingLoading(true);
    try {
      const res = await fetch(`/api/edi/bookings?lookup=1&booking_number=${encodeURIComponent(ref)}&yard_id=${yardId}`);
      const data = await res.json();
      if (data.booking) {
        await applyGateOutBooking(data.booking, container);
      } else {
        setSelectedBooking(null);
        setBookingWarning(`ไม่พบ Booking ${ref}`);
      }
    } catch (err) { console.error('Booking ref lookup error:', err); }
    finally { setBookingLoading(false); }
  };

  const searchBookings = async () => {
    setBookingLoading(true);
    try {
      const url = `/api/edi/bookings?yard_id=${yardId}&search=${encodeURIComponent(bookingSearch)}&limit=10`;
      const res = await fetch(url);
      const data = await res.json();
      const rows = Array.isArray(data.bookings) ? data.bookings : [];
      setBookingResults(rows.filter((b: GateOutBooking) => !['cancelled', 'completed'].includes(b.status)));
    } catch (err) { console.error('Booking search error:', err); }
    finally { setBookingLoading(false); }
  };

  const handleBillingCustomerChange = async (customerId: number) => {
    if (!selectedContainer) return;
    setManualCustomerId(customerId);
    setShowCustomerPicker(false);
    setCustomerSearch('');
    setBillingPaid(false);
    setBillingInvoiceNumber('');
    setBillingInvoiceId(null);
    await loadGateOutBilling(selectedContainer, customerId, gateOutForm.booking_ref);
  };

  // Search containers
  const searchContainers = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/containers?yard_id=${yardId}&search=${searchQuery}`);
      const data = await res.json();
      const allResults = Array.isArray(data) ? data : [];
      setSearchResults(allResults.filter((c: ContainerResult) => c.status !== 'gated_out'));
    } catch (err) { console.error(err); }
    finally { setSearching(false); }
  };

  // Select container for gate-out
  const selectContainerForGateOut = async (c: ContainerResult) => {
    setSelectedContainer(c);
    setGateOutPhase('search');
    setBillingData(null);
    setManualCustomerId(null);
    setShowCustomerPicker(false);
    setCustomerSearch('');
    setSelectedBooking(null);
    setShowBookingPicker(false);
    setBookingResults([]);
    setBookingSearch('');
    setBookingWarning('');
    setBillingPaid(false);
    setBillingInvoiceNumber('');
    setBillingInvoiceId(null);

    let bookingRef = gateOutForm.booking_ref;
    try {
      const bkRes = await fetch(`/api/edi/bookings?lookup=1&container_id=${c.container_id}&yard_id=${yardId}`);
      const bkData = await bkRes.json();
      if (bkData.booking) {
        bookingRef = bookingRef || bkData.booking.booking_number;
        setSelectedBooking(bkData.booking);
        setGateOutForm(prev => ({ ...prev, booking_ref: prev.booking_ref || bkData.booking.booking_number }));
      }
    } catch (err) { console.error('Booking lookup error:', err); }

    await loadGateOutBilling(c, null, bookingRef);

    // Check existing work orders
    try {
      const res = await fetch(`/api/operations?yard_id=${yardId}`);
      const data = await res.json();
      const containerGateIn = c.gate_in_date ? new Date(c.gate_in_date) : null;
      const gateOutOrders = (data.orders || []).filter(
        (o: { container_number: string; notes?: string; status: string; created_at?: string }) =>
          o.container_number === c.container_number &&
          o.notes?.includes('Gate-Out') &&
          o.status !== 'cancelled' &&
          (!containerGateIn || !o.created_at || new Date(o.created_at) >= containerGateIn)
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

  // Phase 1: Request release
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
          priority: 3,
          notes: `Gate-Out → ดึงตู้ ${selectedContainer.container_number} จาก Zone ${selectedContainer.zone_name || '-'} B${selectedContainer.bay}-R${selectedContainer.row}-T${selectedContainer.tier} ไปที่ประตู${gateOutForm.truck_plate ? ` | 🚛 ${gateOutForm.truck_plate}` : ''}${gateOutForm.driver_name ? ` | 👤 ${gateOutForm.driver_name}` : ''}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
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

  // Phase 3: Confirm release
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
          user_id: userId,
          container_id: selectedContainer.container_id,
          container_number: selectedContainer.container_number,
          billing_customer_id: resolvedCustomer?.customer_id || undefined,
          ...(gateOutPhotos.length > 0 ? { damage_report: { exit_photos: gateOutPhotos } } : {}),
          ...gateOutForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGateOutResult({ success: true, message: `✅ ปล่อยตู้ ${selectedContainer.container_number} ออกจากลานสำเร็จ`, eir_number: data.eir_number });
        try { localStorage.removeItem(`gateout_driver_${selectedContainer.container_number}`); } catch { /* ignore */ }
        setSelectedContainer(null);
        setSearchResults([]);
        setSearchQuery('');
        setGateOutForm({ driver_name: '', driver_license: '', truck_plate: '', seal_number: '', booking_ref: '', notes: '' });
        setGateOutPhotos([]);
        setGateOutPhase('search');
        setBillingData(null);
        setBillingPaid(false);
        setBillingInvoiceNumber('');
        setBillingInvoiceId(null);
        setTimeout(() => setGateOutResult(null), 15000);
      } else {
        setGateOutResult({ success: false, message: `❌ ${data.error}` });
      }
    } catch (err) { console.error(err); setGateOutResult({ success: false, message: '❌ เกิดข้อผิดพลาด' }); }
    finally { setGateOutLoading(false); }
  };

  return (
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

            {/* Booking Summary + Picker */}
            <div className={`rounded-xl border overflow-hidden ${
              selectedBooking
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-900/10'
                : 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/10'
            }`}>
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold mb-1 ${selectedBooking ? 'text-indigo-600' : 'text-amber-600'}`}>Booking</p>
                  {selectedBooking ? (
                    <>
                      <p className="font-mono font-bold text-slate-800 dark:text-white">{selectedBooking.booking_number}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedBooking.customer_name || '-'} • {selectedBooking.vessel_name || '-'}{selectedBooking.voyage_number ? ` / ${selectedBooking.voyage_number}` : ''}
                      </p>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-2">
                        จำนวนตู้: {bookingProgressText(selectedBooking)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-amber-700 dark:text-amber-300">ยังไม่ได้ผูก Booking</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">เลือก Booking เพื่อคุมการปล่อยตู้และอัปเดตสถานะ received/released</p>
                    </>
                  )}
                  {bookingWarning && <p className="text-xs text-red-500 mt-2">{bookingWarning}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedBooking && (
                    <button onClick={() => applyGateOutBooking(null)}
                      className="px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-500 hover:text-red-600">
                      ไม่ใช้ Booking
                    </button>
                  )}
                  <button onClick={() => setShowBookingPicker(v => !v)}
                    className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
                    {selectedBooking ? 'เปลี่ยน Booking' : 'เลือก Booking'}
                  </button>
                </div>
              </div>

              {showBookingPicker && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <input type="text" value={bookingSearch} onChange={e => setBookingSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchBookings()}
                      placeholder="ค้นหา Booking No. หรือ Vessel..."
                      className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                    <button onClick={searchBookings} disabled={bookingLoading}
                      className="px-3 h-9 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">
                      {bookingLoading ? 'กำลังค้นหา...' : 'ค้นหา'}
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-1 space-y-1">
                    {bookingResults.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">ค้นหา Booking เพื่อเลือกผูกกับ Gate Out</p>
                    ) : bookingResults.map(b => (
                      <button key={b.booking_id} onClick={() => { applyGateOutBooking(b); setShowBookingPicker(false); setBookingSearch(''); setBookingResults([]); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold">{b.booking_number}</span>
                          <span className="text-[10px] text-indigo-500">{bookingProgressText(b)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{b.customer_name || '-'} • {b.vessel_name || '-'}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  <div className="flex items-center gap-2">
                    {resolvedCustomer ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${resolvedIsCredit ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'}`}>
                        {resolvedIsCredit ? `🏢 เครดิต ${resolvedCustomer.credit_term} วัน • ` : '🏢 '}{resolvedCustomer.customer_name}
                      </span>
                    ) : null}
                    <button onClick={() => setShowCustomerPicker(v => !v)}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:border-blue-300">
                      {resolvedCustomer ? 'เปลี่ยนคนจ่ายเงิน' : 'เลือกคนจ่ายเงิน'}
                    </button>
                  </div>
                </div>

                {showCustomerPicker && (
                  <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Billing Customer สำหรับ Gate Out</p>
                      {billingData.owner && (
                        <p className="text-[10px] text-slate-400">เจ้าของตู้: {billingData.owner.customer_name}</p>
                      )}
                    </div>
                    <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="พิมพ์ชื่อลูกค้าเพื่อค้นหา..."
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                    <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-1">
                      {filteredGateOutCustomers.length === 0 ? (
                        <p className="text-xs text-slate-400 p-2 text-center">ไม่พบลูกค้า — กรุณาเพิ่มที่ ตั้งค่า → ลูกค้า</p>
                      ) : filteredGateOutCustomers.map(c => (
                        <button key={c.customer_id} onClick={() => handleBillingCustomerChange(c.customer_id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${resolvedCustomer?.customer_id === c.customer_id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                          <span className="font-medium">{c.customer_name}</span>
                          <span className="text-[10px] text-slate-400">
                            {c.is_line ? 'สายเรือ' : c.is_trucking ? 'รถบรรทุก' : c.is_forwarder ? 'Forwarder' : 'ทั่วไป'}
                            {c.credit_term > 0 && ` • เครดิต ${c.credit_term} วัน`}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400">เมื่อเปลี่ยนคนจ่ายเงิน ระบบจะคำนวณค่าฝากและเครดิตเทอมใหม่ตามลูกค้ารายนั้น</p>
                  </div>
                )}

                {/* Customer Warning — No customer matched */}
                {!resolvedCustomer && (
                  <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">ไม่พบข้อมูลลูกค้า — กรุณาเลือกลูกค้าก่อนชำระเงิน</p>
                    </div>
                    {!showCustomerPicker ? (
                      <button onClick={() => setShowCustomerPicker(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors">
                        <Users size={12} /> เลือกลูกค้า
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
                          placeholder="พิมพ์ชื่อลูกค้าเพื่อค้นหา..."
                          className="w-full h-9 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500" />
                        <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-1">
                          {filteredGateOutCustomers.length === 0 ? (
                            <p className="text-xs text-slate-400 p-2 text-center">ไม่พบลูกค้า — กรุณาเพิ่มที่ ตั้งค่า → ลูกค้า</p>
                          ) : filteredGateOutCustomers.map(c => (
                            <button key={c.customer_id} onClick={() => handleBillingCustomerChange(c.customer_id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${manualCustomerId === c.customer_id ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700' : 'hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>
                              <span className="font-medium">{c.customer_name}</span>
                              <span className="text-[10px] text-slate-400">
                                {c.is_line ? 'สายเรือ' : c.is_trucking ? 'รถบรรทุก' : c.is_forwarder ? 'Forwarder' : 'ทั่วไป'}
                                {c.credit_term > 0 && ` • เครดิต ${c.credit_term} วัน`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Charges Table */}
                <div className="px-4 py-2 divide-y divide-slate-100 dark:divide-slate-700/50">
                  {billingData.charges.map((ch, i) => (
                    <div key={`t-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!selectedCharges.has(i) ? 'opacity-40' : ''}`}>
                      <input type="checkbox" checked={selectedCharges.has(i)}
                        onChange={() => {
                          setSelectedCharges(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <div className="flex-1">
                        <p className="text-slate-700 dark:text-slate-200">{ch.description}</p>
                        <p className="text-[10px] text-slate-400">
                          {ch.billable_days > 0
                            ? `${ch.quantity} วัน × ฿${ch.unit_price.toLocaleString()} (ฟรี ${ch.free_days} วัน)`
                            : ch.free_days > 0
                              ? `${ch.quantity} วัน — อยู่ในช่วงฟรี`
                              : `${ch.quantity} × ฿${ch.unit_price.toLocaleString()}`
                          }
                        </p>
                      </div>
                      {ch.subtotal === 0 && ch.free_days > 0 ? (
                        <span className="w-24 h-7 flex items-center justify-end px-2 text-emerald-500 text-xs font-bold">✅ ฟรี</span>
                      ) : (
                        <input type="number" value={i in chargeOverrides ? chargeOverrides[i] : ch.subtotal}
                          onChange={(e) => setChargeOverrides(prev => ({ ...prev, [i]: parseFloat(e.target.value) || 0 }))}
                          className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                      )}
                    </div>
                  ))}

                  {/* Custom charges */}
                  {customCharges.map((ch, i) => (
                    <div key={`c-${i}`} className={`py-2 flex items-center gap-3 text-sm transition-opacity ${!selectedCustom.has(i) ? 'opacity-40' : ''}`}>
                      <input type="checkbox" checked={selectedCustom.has(i)}
                        onChange={() => {
                          setSelectedCustom(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <div className="flex-1">
                        <input type="text" value={ch.description}
                          onChange={(e) => {
                            const arr = [...customCharges];
                            arr[i] = { ...arr[i], description: e.target.value };
                            setCustomCharges(arr);
                          }}
                          className="w-full h-7 px-2 text-sm rounded border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                          placeholder="ชื่อรายการ" />
                      </div>
                      <input type="number" value={ch.subtotal}
                        onChange={(e) => {
                          const arr = [...customCharges];
                          const val = parseFloat(e.target.value) || 0;
                          arr[i] = { ...arr[i], subtotal: val, unit_price: val };
                          setCustomCharges(arr);
                        }}
                        className="w-24 h-7 px-2 text-right font-mono font-semibold text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:border-blue-500" />
                      <button onClick={() => {
                        setCustomCharges(prev => prev.filter((_, j) => j !== i));
                        setSelectedCustom(prev => {
                          const next = new Set<number>();
                          prev.forEach(v => { if (v < i) next.add(v); else if (v > i) next.add(v - 1); });
                          return next;
                        });
                      }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                </div>

                {/* Add custom charge */}
                <div className="px-4 py-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                  <button onClick={() => {
                    const newCharge: BillingCharge = { charge_type: 'custom', description: '', quantity: 1, unit_price: 0, subtotal: 0, free_days: 0, billable_days: 0 };
                    setCustomCharges(prev => [...prev, newCharge]);
                    setSelectedCustom(prev => new Set([...prev, customCharges.length]));
                  }}
                    className="w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-colors flex items-center justify-center gap-1"
                  >+ เพิ่มรายการค่าบริการ</button>
                </div>

                {/* Summary */}
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>รวมก่อน VAT ({selectedCharges.size}/{billingData.charges.length} รายการ)</span>
                    <span>฿{selectedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>VAT 7%</span>
                    <span>฿{selectedVat.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-800 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-600">
                    <span>ยอดรวมทั้งสิ้น</span>
                    <span className="text-emerald-600">฿{selectedGrand.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Action */}
                {!billingPaid && (
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    {!resolvedCustomer ? (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
                          <AlertTriangle size={12} /> กรุณาเลือกลูกค้าก่อนชำระเงิน
                        </p>
                      </div>
                    ) : resolvedIsCredit ? (
                      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3">
                        <div>
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">🏢 ลูกค้าเครดิต — วางบิลอัตโนมัติ</p>
                          <p className="text-[10px] text-blue-500">สร้างใบแจ้งหนี้ (pending) → ปล่อยตู้ได้เลย</p>
                        </div>
                        <button onClick={async () => {
                          if (!selectedContainer || !resolvedCustomer) return;
                          try {
                            const creditTerm = resolvedCustomer.credit_term || 0;
                            const res = await fetch('/api/billing/invoices', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                yard_id: yardId, customer_id: resolvedCustomer.customer_id,
                                container_id: selectedContainer.container_id, charge_type: 'storage',
                                description: `ค่าบริการ Gate-Out ${selectedContainer.container_number} (${billingData.container.dwell_days} วัน)`,
                                quantity: 1, unit_price: selectedTotal,
                                due_date: new Date(Date.now() + creditTerm * 86400000).toISOString(),
                                notes: JSON.stringify({ charges: buildFinalCharges(), dwell_days: billingData.container.dwell_days, container_size: billingData.container.size }),
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setBillingPaid(true);
                              setBillingInvoiceNumber(data.invoice_number || '');
                              setBillingInvoiceId(data.invoice?.invoice_id || null);
                            }
                          } catch (err) { console.error(err); }
                        }}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 whitespace-nowrap"
                        >📄 วางบิล</button>
                      </div>
                    ) : (
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
                        <button disabled={!resolvedCustomer} onClick={async () => {
                          if (!selectedContainer || !billingData || !resolvedCustomer) return;
                          try {
                            const custId = resolvedCustomer.customer_id;
                            const res = await fetch('/api/billing/invoices', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                yard_id: yardId, customer_id: custId,
                                container_id: selectedContainer.container_id, charge_type: 'storage',
                                description: `ค่าบริการ Gate-Out ${selectedContainer.container_number} (${billingData.container.dwell_days} วัน) — ชำระ ${paymentMethod === 'cash' ? 'เงินสด' : 'โอน'}`,
                                quantity: 1, unit_price: selectedTotal,
                                notes: JSON.stringify({ charges: buildFinalCharges(), dwell_days: billingData.container.dwell_days, container_size: billingData.container.size }),
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              await fetch('/api/billing/invoices', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ invoice_id: data.invoice.invoice_id, action: 'pay' }),
                              });
                              setBillingPaid(true);
                              setBillingInvoiceNumber(data.invoice_number || '');
                              setBillingInvoiceId(data.invoice?.invoice_id || null);
                            }
                          } catch (err) { console.error(err); }
                        }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all"
                        >💰 รับชำระเงิน ฿{selectedGrand.toLocaleString()}</button>
                      </>
                    )}
                  </div>
                )}

                {/* Paid Confirmation */}
                {billingPaid && (
                  <div className="px-4 py-3 border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                      <CheckCircle2 size={14} /> {billingData.is_credit ? 'วางบิลแล้ว' : 'ชำระเงินแล้ว'} — {billingInvoiceNumber}
                    </span>
                    {(billingInvoiceId || billingData.paid_invoices?.[0]?.invoice_id) && (
                      <button onClick={() => {
                        const invId = billingInvoiceId || billingData.paid_invoices?.[0]?.invoice_id;
                        const printType = billingData.is_credit ? 'invoice' : 'receipt';
                        window.open(`/billing/print?id=${invId}&type=${printType}`, '_blank');
                      }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                      >🖨️ {billingData.is_credit ? 'พิมพ์ใบแจ้งหนี้' : 'พิมพ์ใบเสร็จ'}</button>
                    )}
                  </div>
                )}
              </div>
            ) : billingData && billingData.charges.length === 0 ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-600 flex items-center gap-2">
                <CheckCircle2 size={14} /> ไม่มีค่าบริการ (อยู่ในช่วง Free Days หรือไม่มี Tariff)
              </div>
            ) : null}

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
                      <div className="flex gap-1">
                        <input type="text" value={gateOutForm.truck_plate} onChange={e => setGateOutForm({ ...gateOutForm, truck_plate: e.target.value })} className={`${inputClass} flex-1`} placeholder="1กก 1234" />
                        <button onClick={() => setShowOCR('plate')} className="px-2.5 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 border border-blue-200 dark:border-blue-800" title="สแกนทะเบียน">
                          <ScanLine size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>เลขซีล</label>
                      <div className="flex gap-1">
                        <input type="text" value={gateOutForm.seal_number} onChange={e => setGateOutForm({ ...gateOutForm, seal_number: e.target.value })} className={`${inputClass} font-mono flex-1`} placeholder="SEAL123456" />
                        <button onClick={() => setShowOCR('seal')} className="px-2.5 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 border border-blue-200 dark:border-blue-800" title="สแกนซีล">
                          <ScanLine size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Booking Ref</label>
                      <input type="text" value={gateOutForm.booking_ref}
                        onChange={e => setGateOutForm({ ...gateOutForm, booking_ref: e.target.value })}
                        onBlur={e => loadBookingByNumber(e.target.value)}
                        className={inputClass} placeholder="BK-123456" />
                    </div>
                    <div>
                      <label className={labelClass}>หมายเหตุ</label>
                      <input type="text" value={gateOutForm.notes} onChange={e => setGateOutForm({ ...gateOutForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." />
                    </div>
                  </div>
                </div>

                <button onClick={handleRequestRelease}
                  disabled={releaseLoading || !!(billingData && billingData.charges.length > 0 && selectedGrand > 0 && !billingPaid)}
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

                {/* Exit Photos */}
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

        {/* Result Toast */}
        {gateOutResult && (
          <div className={`p-3 rounded-xl text-sm flex items-center justify-between gap-3 ${gateOutResult.success ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
            <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
              <span className="font-medium text-xs">{gateOutResult.message}</span>
              {gateOutResult.eir_number && (
                <>
                  <span className="text-xs font-mono">EIR: {gateOutResult.eir_number}</span>
                  <button onClick={() => onViewEIR(gateOutResult.eir_number!)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors">
                    <FileText size={12} /> พิมพ์ EIR
                  </button>
                </>
              )}
            </div>
            <button onClick={() => setGateOutResult(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* OCR Modal */}
      {showOCR && (
        <CameraOCR
          label={showOCR === 'plate' ? 'สแกนทะเบียนรถ' : 'สแกนเลขซีล'}
          mode={showOCR === 'plate' ? 'plate' : 'seal'}
          onResult={(text) => {
            if (showOCR === 'plate') setGateOutForm(f => ({ ...f, truck_plate: text }));
            else setGateOutForm(f => ({ ...f, seal_number: text }));
            setShowOCR(null);
          }}
          onClose={() => setShowOCR(null)}
        />
      )}
    </div>
  );
}
