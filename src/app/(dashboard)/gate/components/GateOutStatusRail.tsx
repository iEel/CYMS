import { AlertTriangle, CheckCircle2, Loader2, Users, X } from 'lucide-react';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';

import GateDecisionBar from '@/components/gate/GateDecisionBar';
import GateGuardrailPanel from '@/components/gate/GateGuardrailPanel';
import type { PortalVisibilityPreviewRow } from '../hooks/useGateOutVisibilityPreview';
import type { BillingCharge, BillingClearance, BillingData, ContainerResult, GateOutBooking } from '../types';
import GateOutReleaseRequestSection, { type GateOutFormState, type GateOutPhase } from './GateOutReleaseRequestSection';

interface GateOutStatusRailProps {
  gateOutDecisionSignals: ComponentProps<typeof GateDecisionBar>['signals'];
  gateOutGuardrails: ComponentProps<typeof GateGuardrailPanel>['snapshot'];
  visibilityPreview: PortalVisibilityPreviewRow[];
  visibilityPreviewLoading: boolean;
  visibilityPreviewError: string;
}

type DriverPortalUserOption = {
  user_id: number;
  full_name: string;
  username: string;
};

export default function GateOutStatusRail({
  gateOutDecisionSignals,
  gateOutGuardrails,
  visibilityPreview,
  visibilityPreviewLoading,
  visibilityPreviewError,
}: GateOutStatusRailProps) {
  return (
    <aside className="gate-out-side-rail space-y-3 xl:sticky xl:top-20 xl:self-start">
      <GateDecisionBar signals={gateOutDecisionSignals} compact />
      {gateOutGuardrails.alerts.length > 0 && (
        <GateGuardrailPanel title="Gate-Out checks" snapshot={gateOutGuardrails} compact />
      )}
      <section className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Portal Visibility Preview</p>
            <p className="text-[10px] text-slate-400">แสดงว่าจะ grant ให้ใครบ้าง ไม่ใช่จุดตั้ง field policy</p>
          </div>
          {visibilityPreviewLoading && <Loader2 size={14} className="animate-spin text-cyan-600" />}
        </div>
        <div className="mt-3 space-y-2">
          {visibilityPreviewError ? (
            <p className="text-xs text-rose-500">{visibilityPreviewError}</p>
          ) : visibilityPreview.length === 0 ? (
            <p className="text-xs text-slate-400">ยังไม่มี party ที่จะได้รับสิทธิ์</p>
          ) : visibilityPreview.slice(0, 5).map((row, index) => (
            <div key={`${row.customerId}-${row.entityType}-${row.accessRole}-${index}`} className="rounded-lg bg-white/80 p-2 text-xs dark:bg-slate-800/70">
              <p className="font-semibold text-slate-700 dark:text-slate-200">{row.customerName || `Customer #${row.customerId}`}</p>
              <p className="mt-0.5 text-slate-400">{row.entityType} · {row.accessRole}</p>
              <p className="mt-1 text-[10px] text-slate-400">Grade default: hidden</p>
            </div>
          ))}
          {visibilityPreview.length > 5 && (
            <p className="text-[10px] text-cyan-600">+{visibilityPreview.length - 5} party เพิ่มเติม</p>
          )}
        </div>
      </section>
    </aside>
  );
}


interface GateOutSelectedStatusCardsProps {
  selectedContainer: ContainerResult | null;
  setSelectedContainer: Dispatch<SetStateAction<ContainerResult | null>>;
  gateOutPhase: GateOutPhase;
  setGateOutPhase: Dispatch<SetStateAction<GateOutPhase>>;
  billingData: BillingData | null;
  selectedBooking: GateOutBooking | null;
  bookingProgressText: (booking: GateOutBooking) => string;
  bookingWarning: string;
  applyGateOutBooking: (booking: GateOutBooking | null, container?: ContainerResult | null) => Promise<void>;
  showBookingPicker: boolean;
  setShowBookingPicker: Dispatch<SetStateAction<boolean>>;
  bookingSearch: string;
  setBookingSearch: Dispatch<SetStateAction<string>>;
  searchBookings: () => Promise<void>;
  bookingLoading: boolean;
  bookingResults: GateOutBooking[];
  setBookingResults: Dispatch<SetStateAction<GateOutBooking[]>>;
  resolvedCustomer: { customer_id: number; customer_name: string; credit_term: number } | null;
  billingLoading: boolean;
  showCustomerPicker: boolean;
  setShowCustomerPicker: Dispatch<SetStateAction<boolean>>;
  customerSearch: string;
  setCustomerSearch: Dispatch<SetStateAction<string>>;
  filteredGateOutCustomers: CustomerOption[];
  handleBillingCustomerChange: (customerId: number) => Promise<void>;
  manualCustomerId: number | null;
  selectedCharges: Set<number>;
  setSelectedCharges: Dispatch<SetStateAction<Set<number>>>;
  chargeOverrides: Record<number, number>;
  setChargeOverrides: Dispatch<SetStateAction<Record<number, number>>>;
  customCharges: BillingCharge[];
  setCustomCharges: Dispatch<SetStateAction<BillingCharge[]>>;
  selectedCustom: Set<number>;
  setSelectedCustom: Dispatch<SetStateAction<Set<number>>>;
  selectedTotal: number;
  selectedVat: number;
  selectedGrand: number;
  billingPaid: boolean;
  resolvedIsCredit: boolean;
  canCreateInvoice: boolean;
  originalSelectedTotal: number;
  canWaive: boolean;
  paymentMethod: 'cash' | 'transfer' | 'credit';
  setPaymentMethod: Dispatch<SetStateAction<'cash' | 'transfer' | 'credit'>>;
  canReceivePayment: boolean;
  billingClearance: BillingClearance | null;
  billingInvoiceNumber: string;
  billingInvoiceId: number | null;
  billingCleared: boolean;
  gateOutForm: GateOutFormState;
  setGateOutForm: Dispatch<SetStateAction<GateOutFormState>>;
  driverUsers: DriverPortalUserOption[];
  selectedDriverUserId: number | null;
  setSelectedDriverUserId: Dispatch<SetStateAction<number | null>>;
  driverUsersLoading: boolean;
  setShowOCR: Dispatch<SetStateAction<'plate' | 'seal' | null>>;
  loadBookingByNumber: (bookingNumber: string, container?: ContainerResult | null) => Promise<void>;
  handleRequestRelease: () => Promise<void>;
  releaseLoading: boolean;
  canRequestMove: boolean;
  handleMarkAtGate: () => Promise<void>;
  gateOutPhotos: string[];
  setGateOutPhotos: Dispatch<SetStateAction<string[]>>;
  handleGateOut: () => Promise<void>;
  gateOutLoading: boolean;
  canGateOut: boolean;
  onCreateCreditInvoice: () => Promise<void>;
  onRequestApproval: () => Promise<void>;
  onCreatePaidInvoice: () => Promise<void>;
  onConfirmNoCharge: () => Promise<void>;
  onPrintBillingDocument: (continuous?: boolean) => void;
}

type CustomerOption = {
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_trucking: boolean;
  is_forwarder: boolean;
  credit_term: number;
};

export function GateOutSelectedStatusCards({
  selectedContainer,
  setSelectedContainer,
  gateOutPhase,
  setGateOutPhase,
  billingData,
  selectedBooking,
  bookingProgressText,
  bookingWarning,
  applyGateOutBooking,
  showBookingPicker,
  setShowBookingPicker,
  bookingSearch,
  setBookingSearch,
  searchBookings,
  bookingLoading,
  bookingResults,
  setBookingResults,
  resolvedCustomer,
  billingLoading,
  showCustomerPicker,
  setShowCustomerPicker,
  customerSearch,
  setCustomerSearch,
  filteredGateOutCustomers,
  handleBillingCustomerChange,
  manualCustomerId,
  selectedCharges,
  setSelectedCharges,
  chargeOverrides,
  setChargeOverrides,
  customCharges,
  setCustomCharges,
  selectedCustom,
  setSelectedCustom,
  selectedTotal,
  selectedVat,
  selectedGrand,
  billingPaid,
  resolvedIsCredit,
  canCreateInvoice,
  originalSelectedTotal,
  canWaive,
  paymentMethod,
  setPaymentMethod,
  canReceivePayment,
  billingClearance,
  billingInvoiceNumber,
  billingInvoiceId,
  billingCleared,
  gateOutForm,
  setGateOutForm,
  driverUsers,
  selectedDriverUserId,
  setSelectedDriverUserId,
  driverUsersLoading,
  setShowOCR,
  loadBookingByNumber,
  handleRequestRelease,
  releaseLoading,
  canRequestMove,
  handleMarkAtGate,
  gateOutPhotos,
  setGateOutPhotos,
  handleGateOut,
  gateOutLoading,
  canGateOut,
  onCreateCreditInvoice,
  onRequestApproval,
  onCreatePaidInvoice,
  onConfirmNoCharge,
  onPrintBillingDocument,
}: GateOutSelectedStatusCardsProps) {
  if (!selectedContainer) return null;

  return (
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
              {(selectedContainer.tare_weight_kg != null || selectedContainer.max_gross_weight_kg != null) && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase mb-2">ข้อมูลสเปกจาก BoxTech</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedContainer.tare_weight_kg != null && (
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Tare {Number(selectedContainer.tare_weight_kg).toLocaleString()} kg
                      </span>
                    )}
                    {selectedContainer.max_gross_weight_kg != null && (
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Max Gross {Number(selectedContainer.max_gross_weight_kg).toLocaleString()} kg
                      </span>
                    )}
                    <span className="text-xs text-slate-500">เป็นสเปกตู้ ไม่ใช่น้ำหนักจริง/VGM</span>
                  </div>
                </div>
              )}
            </div>

            {/* Booking Summary + Picker */}
            <div className={`rounded-xl border overflow-hidden ${
              selectedBooking
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/20'
            }`}>
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold mb-1 ${selectedBooking ? 'text-indigo-600' : 'text-slate-500'}`}>Booking (ถ้ามี)</p>
                  {selectedBooking ? (
                    <>
                      <p className="font-mono font-bold text-slate-800 dark:text-white">{selectedBooking.booking_number}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedBooking.customer_name || '-'} • {selectedBooking.vessel_name || '-'}{selectedBooking.voyage_number ? ` / ${selectedBooking.voyage_number}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Rule: เลขตู้ใน Booking หรือ Booking ว่างที่ลูกค้า/ขนาด/ประเภทตรงกัน • {selectedBooking.container_size || 'Any size'}&apos; / {selectedBooking.container_type || 'Any type'}
                      </p>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-2">
                        จำนวนตู้: {bookingProgressText(selectedBooking)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">ไม่ระบุ Booking</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ไม่มี Booking ก็ปล่อยได้ตาม workflow ปกติ</p>
                      <p className="text-[10px] text-slate-400 mt-1">ถ้าเลือกหรือกรอก Booking ระบบจะตรวจลูกค้า/ขนาด/ประเภท และอัปเดต received/released ให้</p>
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
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {b.customer_name || '-'} • {b.vessel_name || '-'} • {b.container_size || 'Any size'}&apos; / {b.container_type || 'Any type'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/20">
              <h4 className="mb-3 text-xs font-semibold uppercase text-slate-500">Business Relationship</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                <InfoMini label="Container Owner" value={billingData?.owner?.customer_name || selectedContainer.shipping_line || '-'} />
                <InfoMini label="Booking Customer" value={selectedBooking?.booking_customer_name || selectedBooking?.customer_name || '-'} />
                <InfoMini label="Shipping Line" value={selectedBooking?.shipping_line_name || selectedContainer.shipping_line || '-'} />
                <InfoMini label="Forwarder" value={selectedBooking?.forwarder_name || '-'} />
                <InfoMini label="Shipper" value={selectedBooking?.shipper_name || '-'} />
                <InfoMini label="Consignee" value={selectedBooking?.consignee_name || '-'} />
                <InfoMini label="Trucking Company" value={selectedBooking?.trucking_company_name || '-'} />
                <InfoMini label="Bill To Customer" value={selectedBooking?.bill_to_customer_name || resolvedCustomer?.customer_name || '-'} />
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
                        <button disabled={!canCreateInvoice} onClick={onCreateCreditInvoice}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >📄 วางบิล</button>
                      </div>
                    ) : (
                      <>
                        {selectedGrand <= 0 && (
                          <button disabled={!resolvedCustomer || !canWaive} onClick={onRequestApproval}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all">
                            <CheckCircle2 size={14} />
                            {originalSelectedTotal > 0 ? 'อนุมัติยกเว้นค่าใช้จ่าย' : 'ยืนยัน No Charge ฿0'}
                          </button>
                        )}
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
                        <button disabled={!resolvedCustomer || !canReceivePayment} onClick={onCreatePaidInvoice}
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
                      <CheckCircle2 size={14} /> {
                        billingClearance?.clearance_type === 'no_charge' ? 'No Charge' :
                        billingClearance?.clearance_type === 'waived' ? 'Waived' :
                        billingData.is_credit ? 'วางบิลแล้ว' : 'ชำระเงินแล้ว'
                      }{billingInvoiceNumber ? ` — ${billingInvoiceNumber}` : ''}
                    </span>
                    {(billingInvoiceId || billingData.paid_invoices?.[0]?.invoice_id) && (
                      <div className="flex flex-wrap justify-end gap-1">
                        <button onClick={() => onPrintBillingDocument(false)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                        >🖨️ {billingData.is_credit ? 'พิมพ์ใบแจ้งหนี้' : 'พิมพ์ใบเสร็จ'}</button>
                        <button onClick={() => onPrintBillingDocument(true)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-50"
                        >ฟอร์มต่อเนื่อง</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : billingData && billingData.charges.length === 0 ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-600 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><CheckCircle2 size={14} /> ไม่มีค่าบริการ (อยู่ในช่วง Free Days หรือไม่มี Tariff)</span>
                {!billingCleared && (
                  <button onClick={onConfirmNoCharge}
                    disabled={!canWaive}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    ยืนยัน No Charge
                  </button>
                )}
              </div>
            ) : null}

            <GateOutReleaseRequestSection
              gateOutPhase={gateOutPhase}
              gateOutForm={gateOutForm}
              setGateOutForm={setGateOutForm}
              driverUsers={driverUsers}
              selectedDriverUserId={selectedDriverUserId}
              setSelectedDriverUserId={setSelectedDriverUserId}
              driverUsersLoading={driverUsersLoading}
              setShowOCR={setShowOCR}
              loadBookingByNumber={loadBookingByNumber}
              handleRequestRelease={handleRequestRelease}
              releaseLoading={releaseLoading}
              canRequestMove={canRequestMove}
              billingBlocked={!!(billingData && !billingCleared)}
              handleMarkAtGate={handleMarkAtGate}
              gateOutPhotos={gateOutPhotos}
              setGateOutPhotos={setGateOutPhotos}
              handleGateOut={handleGateOut}
              gateOutLoading={gateOutLoading}
              canGateOut={canGateOut}
            />
          </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
