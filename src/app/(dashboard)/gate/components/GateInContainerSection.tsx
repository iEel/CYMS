'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Package, ScanLine, Ship } from 'lucide-react';
import { inputClass, labelClass } from '../types';

export interface GateInFormState {
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  is_laden: boolean;
  seal_number: string;
  driver_name: string;
  driver_license: string;
  truck_plate: string;
  truck_company: string;
  booking_ref: string;
  notes: string;
  actual_gross_weight_kg: string;
  weight_source: string;
}

export interface GateInBookingOption {
  booking_id: number;
  booking_number: string;
  customer_id?: number | null;
  booking_customer_id?: number | null;
  shipping_line_id?: number | null;
  forwarder_id?: number | null;
  shipper_id?: number | null;
  consignee_id?: number | null;
  trucking_company_id?: number | null;
  bill_to_customer_id?: number | null;
  booking_customer_name?: string | null;
  shipping_line_name?: string | null;
  forwarder_name?: string | null;
  shipper_name?: string | null;
  consignee_name?: string | null;
  trucking_company_name?: string | null;
  bill_to_customer_name?: string | null;
  vessel_name?: string | null;
  voyage_number?: string | null;
}

interface GateInBoxtechResult {
  source?: string;
  customer?: { customer_id: number; customer_name: string; credit_term: number } | null;
  unknown_prefix?: boolean;
  customer_source?: string;
}

interface GateInContainerSectionProps {
  gateInForm: GateInFormState;
  setGateInForm: Dispatch<SetStateAction<GateInFormState>>;
  containerValid: boolean | null;
  checkDigitError: string;
  boxtechLoading: boolean;
  boxtechResult: GateInBoxtechResult | null;
  boxtechTareWeightKg: number | null;
  boxtechMaxGrossWeightKg: number | null;
  cargoWeightEstimateKg: number | null;
  weightOverMaxGross: boolean;
  selectedBooking: GateInBookingOption | null;
  bookingSearch: string;
  bookingResults: GateInBookingOption[];
  showBookingPicker: boolean;
  setShowBookingPicker: Dispatch<SetStateAction<boolean>>;
  bookingSearchLoading: boolean;
  bookingSearchError: string;
  isSoc: boolean;
  setIsSoc: Dispatch<SetStateAction<boolean>>;
  setShowOCR: Dispatch<SetStateAction<'container' | 'plate' | 'seal' | null>>;
  applyGateInBooking: (booking: GateInBookingOption | null) => void;
  handleBookingSearchChange: (value: string) => void;
  searchBookings: () => void;
}

export default function GateInContainerSection({
  gateInForm,
  setGateInForm,
  containerValid,
  checkDigitError,
  boxtechLoading,
  boxtechResult,
  boxtechTareWeightKg,
  boxtechMaxGrossWeightKg,
  cargoWeightEstimateKg,
  weightOverMaxGross,
  selectedBooking,
  bookingSearch,
  bookingResults,
  showBookingPicker,
  setShowBookingPicker,
  bookingSearchLoading,
  bookingSearchError,
  isSoc,
  setIsSoc,
  setShowOCR,
  applyGateInBooking,
  handleBookingSearchChange,
  searchBookings,
}: GateInContainerSectionProps) {
  return (
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
              {boxtechTareWeightKg && (
                <span className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                  Tare {Number(boxtechTareWeightKg).toLocaleString()} kg
                </span>
              )}
              {boxtechMaxGrossWeightKg && (
                <span className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                  Max Gross {Number(boxtechMaxGrossWeightKg).toLocaleString()} kg
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
          <label className={labelClass}>Tare Weight</label>
          <input
            readOnly
            value={boxtechTareWeightKg ? `${Number(boxtechTareWeightKg).toLocaleString()} kg` : '-'}
            className={`${inputClass} bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-default`}
          />
        </div>
        <div>
          <label className={labelClass}>Max Gross</label>
          <input
            readOnly
            value={boxtechMaxGrossWeightKg ? `${Number(boxtechMaxGrossWeightKg).toLocaleString()} kg` : '-'}
            className={`${inputClass} bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-default`}
          />
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
        {gateInForm.is_laden && (
          <>
            <div>
              <label className={labelClass}>Actual Gross / VGM (kg)</label>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="เช่น 24500"
                value={gateInForm.actual_gross_weight_kg}
                onChange={e => setGateInForm({ ...gateInForm, actual_gross_weight_kg: e.target.value })}
                className={`${inputClass} ${weightOverMaxGross ? '!border-rose-400 ring-1 ring-rose-200' : ''}`}
              />
              <p className="mt-1 text-[10px] text-slate-400">น้ำหนักรวมจริงของตู้พร้อมสินค้า แยกจาก Tare/Max Gross ของ BoxTech</p>
            </div>
            <div>
              <label className={labelClass}>แหล่งน้ำหนัก</label>
              <select
                value={gateInForm.weight_source}
                onChange={e => setGateInForm({ ...gateInForm, weight_source: e.target.value })}
                className={inputClass}
              >
                <option value="manual">Manual</option>
                <option value="scale">Scale</option>
                <option value="vgm_document">VGM Document</option>
              </select>
              <p className="mt-1 text-[10px] text-slate-400">
                {cargoWeightEstimateKg != null ? `Net Cargo estimate ${cargoWeightEstimateKg.toLocaleString()} kg` : 'กรอก Actual Gross เพื่อคำนวณน้ำหนักสินค้าโดยประมาณ'}
              </p>
            </div>
            {weightOverMaxGross && (
              <div className="md:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                Actual Gross/VGM เกิน Max Gross ของตู้ กรุณาตรวจสอบก่อนรับเข้า
              </div>
            )}
          </>
        )}
        <div className="md:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-900/10">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className={labelClass}>Booking</label>
              <p className="text-[10px] text-slate-400">เลือก Booking เพื่อดึง party และสร้าง grants ให้ถูกต้อง</p>
            </div>
            {selectedBooking && (
              <button onClick={() => applyGateInBooking(null)} className="text-xs text-slate-400 hover:text-rose-500">ไม่ใช้ Booking</button>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={bookingSearch}
              onChange={e => handleBookingSearchChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') searchBookings();
              }}
              onFocus={() => setShowBookingPicker(true)}
              className={inputClass}
              placeholder="ค้นหา Booking No."
            />
            <button
              onClick={searchBookings}
              disabled={bookingSearchLoading}
              className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {bookingSearchLoading ? 'กำลังค้นหา' : 'ค้นหา'}
            </button>
          </div>
          {bookingSearchError && <p className="mt-1 text-[10px] text-rose-500">{bookingSearchError}</p>}
          {boxtechResult?.customer_source === 'booking' && (
            <span className="text-xs text-emerald-600 flex items-center gap-1 mt-1">&#x1F4CB; ยึดตาม Booking</span>
          )}
          {showBookingPicker && (
            <div className="mt-2 space-y-1">
              {bookingResults.map(booking => (
                <button key={booking.booking_id} onClick={() => applyGateInBooking(booking)} className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs dark:bg-slate-800">
                  <span className="font-mono font-semibold">{booking.booking_number}</span>
                  <span className="ml-2 text-slate-400">{booking.booking_customer_name || '-'}</span>
                </button>
              ))}
            </div>
          )}
          {selectedBooking && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <InfoMini label="Booking Customer" value={selectedBooking.booking_customer_name || '-'} />
              <InfoMini label="Shipping Line" value={selectedBooking.shipping_line_name || '-'} />
              <InfoMini label="Forwarder" value={selectedBooking.forwarder_name || '-'} />
              <InfoMini label="Shipper" value={selectedBooking.shipper_name || '-'} />
              <InfoMini label="Consignee" value={selectedBooking.consignee_name || '-'} />
              <InfoMini label="Trucking Company" value={selectedBooking.trucking_company_name || '-'} />
              <InfoMini label="Bill To Customer" value={selectedBooking.bill_to_customer_name || '-'} />
            </div>
          )}
        </div>
        <div>
          <label className={labelClass}>ประเภทกรรมสิทธิ์</label>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setIsSoc(false)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-all ${!isSoc ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-600' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}>
              COC (ของสายเรือ)
            </button>
            <button onClick={() => setIsSoc(true)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-all ${isSoc ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}>
              SOC (ของลูกค้า)
            </button>
          </div>
        </div>
      </div>
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
