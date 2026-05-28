'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Loader2, Plus } from 'lucide-react';

export interface BookingCreateFormState {
  booking_number: string;
  booking_type: string;
  vessel_name: string;
  voyage_number: string;
  container_count: number;
  container_size: string;
  container_type: string;
  eta: string;
  valid_from: string;
  valid_to: string;
  seal_number: string;
  notes: string;
  booking_customer_id: number | null;
  shipping_line_id: number | null;
  forwarder_id: number | null;
  shipper_id: number | null;
  consignee_id: number | null;
  trucking_company_id: number | null;
  bill_to_customer_id: number | null;
}

interface BookingCreateFormProps {
  createForm: BookingCreateFormState;
  setCreateForm: Dispatch<SetStateAction<BookingCreateFormState>>;
  containerNumbers: string;
  setContainerNumbers: (value: string) => void;
  createLoading: boolean;
  createResult: { success: boolean; message: string } | null;
  canManageBookings: boolean;
  inputClass: string;
  labelClass: string;
  businessRelationshipFields: ReactNode;
  onSubmit: () => void;
}

export default function BookingCreateForm({
  createForm,
  setCreateForm,
  containerNumbers,
  setContainerNumbers,
  createLoading,
  createResult,
  canManageBookings,
  inputClass,
  labelClass,
  businessRelationshipFields,
  onSubmit,
}: BookingCreateFormProps) {
  return (
    <>
      <div className="mx-5 mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
        <p className="text-xs text-slate-400 font-medium mb-3">หรือ กรอกข้อมูลด้วยตนเอง</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2"><label className={labelClass}>เลข Booking *</label><input type="text" value={createForm.booking_number} onChange={e => setCreateForm({ ...createForm, booking_number: e.target.value })} className={`${inputClass} font-mono`} placeholder="BK-2024-001" /></div>
          <div><label className={labelClass}>ประเภท</label>
            <select value={createForm.booking_type} onChange={e => setCreateForm({ ...createForm, booking_type: e.target.value })} className={inputClass}>
              <option value="import">นำเข้า</option><option value="export">ส่งออก</option>
              <option value="empty_pickup">รับตู้เปล่า</option><option value="empty_return">คืนตู้เปล่า</option>
            </select>
          </div>
          <div><label className={labelClass}>จำนวนตู้</label><input type="number" min={1} value={createForm.container_count} onChange={e => setCreateForm({ ...createForm, container_count: parseInt(e.target.value) || 1 })} className={inputClass} /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={labelClass}>ชื่อเรือ</label><input type="text" value={createForm.vessel_name} onChange={e => setCreateForm({ ...createForm, vessel_name: e.target.value })} className={inputClass} placeholder="EVER GIVEN" /></div>
          <div><label className={labelClass}>Voyage No.</label><input type="text" value={createForm.voyage_number} onChange={e => setCreateForm({ ...createForm, voyage_number: e.target.value })} className={inputClass} placeholder="V001E" /></div>
          <div><label className={labelClass}>ขนาดตู้</label>
            <select value={createForm.container_size} onChange={e => setCreateForm({ ...createForm, container_size: e.target.value })} className={inputClass}>
              <option value="20">20 ฟุต</option><option value="40">40 ฟุต</option><option value="45">45 ฟุต</option>
            </select>
          </div>
          <div><label className={labelClass}>ประเภทตู้</label>
            <select value={createForm.container_type} onChange={e => setCreateForm({ ...createForm, container_type: e.target.value })} className={inputClass}>
              <option value="GP">GP (แห้ง)</option><option value="HC">HC (สูง)</option><option value="RF">RF (เย็น)</option><option value="OT">OT (เปิดบน)</option><option value="FR">FR (แร็ค)</option><option value="TK">TK (แท็งค์)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={labelClass}>ETA</label><input type="datetime-local" value={createForm.eta} onChange={e => setCreateForm({ ...createForm, eta: e.target.value })} className={inputClass} /></div>
          <div><label className={labelClass}>Valid From</label><input type="date" value={createForm.valid_from} onChange={e => setCreateForm({ ...createForm, valid_from: e.target.value })} className={inputClass} /></div>
          <div><label className={labelClass}>Valid To</label><input type="date" value={createForm.valid_to} onChange={e => setCreateForm({ ...createForm, valid_to: e.target.value })} className={inputClass} /></div>
          <div><label className={labelClass}>เลขซีล</label><input type="text" value={createForm.seal_number} onChange={e => setCreateForm({ ...createForm, seal_number: e.target.value })} className={inputClass} placeholder="SEAL123456" /></div>
        </div>
        {businessRelationshipFields}
        <div><label className={labelClass}>เลขตู้ล่วงหน้า (ถ้ามี — คั่นด้วย , หรือ Enter)</label>
          <textarea value={containerNumbers} onChange={e => setContainerNumbers(e.target.value)}
            className="w-full h-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white font-mono outline-none focus:border-blue-500"
            placeholder="ABCU1234567, TCLU7654321" />
        </div>
        <div><label className={labelClass}>หมายเหตุ</label><input type="text" value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} className={inputClass} placeholder="หมายเหตุ..." /></div>

        <button onClick={onSubmit} disabled={createLoading || !canManageBookings || !createForm.booking_number || !createForm.booking_customer_id}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-all">
          {createLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} สร้าง Booking
        </button>

        {createResult && (
          <div className={`p-3 rounded-xl text-sm ${createResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {createResult.message}
          </div>
        )}
      </div>
    </>
  );
}
