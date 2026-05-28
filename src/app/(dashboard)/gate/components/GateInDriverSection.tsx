'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { ScanLine, User, X } from 'lucide-react';
import { inputClass, labelClass } from '../types';
import type { GateInFormState } from './GateInContainerSection';

interface GateCustomerOption {
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_trucking: boolean;
  is_forwarder: boolean;
  credit_term: number;
}

interface GateInDriverSectionProps {
  gateInForm: GateInFormState;
  setGateInForm: Dispatch<SetStateAction<GateInFormState>>;
  customerList: GateCustomerOption[];
  truckCompanySearch: string;
  setTruckCompanySearch: Dispatch<SetStateAction<string>>;
  truckCompanyOpen: boolean;
  setTruckCompanyOpen: Dispatch<SetStateAction<boolean>>;
  truckCompanyRef: RefObject<HTMLDivElement | null>;
  setShowOCR: Dispatch<SetStateAction<'container' | 'plate' | 'seal' | null>>;
}

export default function GateInDriverSection({
  gateInForm,
  setGateInForm,
  customerList,
  truckCompanySearch,
  setTruckCompanySearch,
  truckCompanyOpen,
  setTruckCompanyOpen,
  truckCompanyRef,
  setShowOCR,
}: GateInDriverSectionProps) {
  return (
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
        <div>
          <label className={labelClass}>บริษัทรถขนส่ง</label>
          <div className="relative" ref={truckCompanyRef}>
            <input type="text"
              placeholder="พิมพ์ชื่อบริษัทเพื่อค้นหา..."
              value={truckCompanySearch || gateInForm.truck_company}
              onChange={e => {
                setTruckCompanySearch(e.target.value);
                setTruckCompanyOpen(true);
                setGateInForm({ ...gateInForm, truck_company: e.target.value });
              }}
              onFocus={() => setTruckCompanyOpen(true)}
              className={inputClass}
            />
            {gateInForm.truck_company && !truckCompanyOpen && (
              <button onClick={() => { setGateInForm({ ...gateInForm, truck_company: '' }); setTruckCompanySearch(''); setTruckCompanyOpen(true); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            )}
            {truckCompanyOpen && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl">
                {customerList
                  .filter(c => c.is_trucking)
                  .filter(c => {
                    const q = truckCompanySearch.toLowerCase();
                    return !q || c.customer_name.toLowerCase().includes(q);
                  })
                  .slice(0, 15)
                  .map(c => (
                    <button key={c.customer_id}
                      onClick={() => {
                        setGateInForm({ ...gateInForm, truck_company: c.customer_name });
                        setTruckCompanySearch(c.customer_name);
                        setTruckCompanyOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between ${
                        gateInForm.truck_company === c.customer_name ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-700 dark:text-slate-200'
                      }`}>
                      <span>{c.customer_name}</span>
                      <span className="text-[10px] text-slate-400">รถบรรทุก</span>
                    </button>
                  ))}
                {customerList.filter(c => c.is_trucking).filter(c => !truckCompanySearch || c.customer_name.toLowerCase().includes(truckCompanySearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">ไม่พบบริษัทรถบรรทุก</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
