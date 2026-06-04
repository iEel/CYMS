'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ArrowUpFromLine, CheckCircle2, Loader2, ScanLine, Truck, User } from 'lucide-react';
import PhotoCapture from '@/components/gate/PhotoCapture';
import { RawImage } from '@/components/ui/RawImage';
import { inputClass, labelClass } from '../types';

export interface GateOutFormState {
  driver_name: string;
  driver_license: string;
  truck_plate: string;
  seal_number: string;
  booking_ref: string;
  notes: string;
}

export type GateOutPhase = 'search' | 'pending_pickup' | 'confirm_release';

interface DriverPortalUserOption {
  user_id: number;
  full_name: string;
  username: string;
}

interface GateOutReleaseRequestSectionProps {
  gateOutPhase: GateOutPhase;
  gateOutForm: GateOutFormState;
  setGateOutForm: Dispatch<SetStateAction<GateOutFormState>>;
  driverUsers: DriverPortalUserOption[];
  selectedDriverUserId: number | null;
  setSelectedDriverUserId: Dispatch<SetStateAction<number | null>>;
  driverUsersLoading: boolean;
  setShowOCR: Dispatch<SetStateAction<'plate' | 'seal' | null>>;
  loadBookingByNumber: (bookingNumber: string) => void;
  handleRequestRelease: () => void;
  releaseLoading: boolean;
  canRequestMove: boolean;
  billingBlocked: boolean;
  handleMarkAtGate: () => void;
  gateOutPhotos: string[];
  setGateOutPhotos: Dispatch<SetStateAction<string[]>>;
  handleGateOut: () => void;
  gateOutLoading: boolean;
  canGateOut: boolean;
}

export default function GateOutReleaseRequestSection({
  gateOutPhase,
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
  billingBlocked,
  handleMarkAtGate,
  gateOutPhotos,
  setGateOutPhotos,
  handleGateOut,
  gateOutLoading,
  canGateOut,
}: GateOutReleaseRequestSectionProps) {
  return (
    <>
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
                <label className={labelClass}>Booking Ref (ถ้ามี)</label>
                <input type="text" value={gateOutForm.booking_ref}
                  onChange={e => setGateOutForm({ ...gateOutForm, booking_ref: e.target.value })}
                  onBlur={e => loadBookingByNumber(e.target.value)}
                  className={inputClass} placeholder="BK-123456" />
              </div>
              <div>
                <label className={labelClass}>Driver Portal User</label>
                <select
                  value={selectedDriverUserId || ''}
                  onChange={e => setSelectedDriverUserId(e.target.value ? Number(e.target.value) : null)}
                  className={inputClass}
                  disabled={driverUsersLoading || driverUsers.length === 0}
                >
                  <option value="">{driverUsersLoading ? 'กำลังโหลดคนขับ...' : 'ไม่ผูกผู้ใช้ Driver Portal'}</option>
                  {driverUsers.map(driver => (
                    <option key={driver.user_id} value={driver.user_id}>
                      {driver.full_name || driver.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>หมายเหตุ</label>
                <input type="text" value={gateOutForm.notes} onChange={e => setGateOutForm({ ...gateOutForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." />
              </div>
            </div>
          </div>

          <button onClick={handleRequestRelease}
            disabled={releaseLoading || !canRequestMove || billingBlocked}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-all w-full justify-center">
            {releaseLoading ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
            ขอดึงตู้ → สร้างคำสั่งรถยก
          </button>
        </div>
      )}

      {gateOutPhase === 'pending_pickup' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-center">
            <div className="text-3xl mb-2">🚛</div>
            <h4 className="font-bold text-amber-700 dark:text-amber-400">รอรถยกนำตู้มาที่ประตู...</h4>
            <p className="text-xs text-amber-500 mt-1">คำสั่งงานถูกส่งไปหน้าปฏิบัติการแล้ว กรุณารอจนกว่าตู้จะมาถึง</p>
          </div>

          <button onClick={handleMarkAtGate}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all w-full justify-center">
            <CheckCircle2 size={16} /> ตู้ถึงประตูแล้ว → ตรวจสภาพ & ปล่อยออก
          </button>
        </div>
      )}

      {gateOutPhase === 'confirm_release' && (
        <div className="space-y-4">
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

          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
              📸 ถ่ายรูปตู้ขาออก <span className="text-[10px] font-normal text-slate-400">(ไม่บังคับ — เพื่อบันทึกสภาพตู้ก่อนออก)</span>
            </h4>
            {gateOutPhotos.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {gateOutPhotos.map((photo, i) => (
                  <div key={i} className="relative">
                    <RawImage src={photo} alt={`Exit photo ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
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
                folder="gate"
              />
            )}
          </div>

          <button onClick={handleGateOut} disabled={gateOutLoading || !canGateOut}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all w-full justify-center">
            {gateOutLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpFromLine size={16} />}
            ✅ ยืนยันปล่อยตู้ออก + ออก EIR
          </button>
        </div>
      )}
    </>
  );
}
