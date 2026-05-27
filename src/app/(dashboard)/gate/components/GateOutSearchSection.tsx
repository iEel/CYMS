'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Loader2, Package, Search } from 'lucide-react';
import type { ContainerResult, GateOutBooking } from '../types';
import { inputClass, labelClass } from '../types';

interface GateOutContainerSearchResult {
  result_type: 'container';
  selectable: boolean;
  container: ContainerResult;
  booking: null;
  containers: [];
  message?: string | null;
}

interface GateOutBookingSearchResult {
  result_type: 'booking';
  selectable: boolean;
  container: null;
  booking: GateOutBooking;
  containers: ContainerResult[];
  message?: string | null;
}

export type GateOutSearchResult = GateOutContainerSearchResult | GateOutBookingSearchResult;

interface GateOutSearchSectionProps {
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  searching: boolean;
  searchResults: GateOutSearchResult[];
  selectedContainer: ContainerResult | null;
  searchContainers: () => void;
  selectContainerForGateOut: (container: ContainerResult, initialBooking?: GateOutBooking | null) => void;
  bookingProgressText: (booking: GateOutBooking) => string;
}

export default function GateOutSearchSection({
  searchQuery,
  setSearchQuery,
  searching,
  searchResults,
  selectedContainer,
  searchContainers,
  selectContainerForGateOut,
  bookingProgressText,
}: GateOutSearchSectionProps) {
  return (
    <>
      <div>
        <label className={labelClass}>ค้นหาตู้ในลาน</label>
        <div className="flex gap-2">
          <input type="text" placeholder="ค้นหาเลขตู้ หรือ Booking No." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchContainers()}
            className={`${inputClass} font-mono flex-1`} />
          <button onClick={searchContainers} disabled={searching}
            className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-all">
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} ค้นหา
          </button>
        </div>
      </div>

      {searchResults.length > 0 && !selectedContainer && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400">พบ {searchResults.length} รายการ — เลือกตู้ที่จะปล่อยออก</p>
          {searchResults.map((result, index) => {
            if (result.result_type === 'container') {
              const c = result.container;
              return (
                <button key={`container-${c.container_id}`} onClick={() => selectContainerForGateOut(c)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-blue-500">Container Match</p>
                      <p className="font-mono font-semibold text-slate-800 dark:text-white text-sm">{c.container_number}</p>
                      <p className="text-xs text-slate-400">{c.size}&apos;{c.type} • {c.shipping_line || '-'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{c.zone_name ? `Zone ${c.zone_name} B${c.bay}-R${c.row}-T${c.tier}` : 'ไม่มีพิกัด'}</span>
                </button>
              );
            }

            if (result.result_type === 'booking') {
              return (
                <div key={`booking-${result.booking.booking_id}-${index}`} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-900/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-indigo-500">Booking Match</p>
                      <p className="font-mono font-bold text-slate-800 dark:text-white">{result.booking.booking_number}</p>
                      <p className="text-xs text-slate-500">{result.booking.booking_customer_name || result.booking.customer_name || '-'} • {result.booking.vessel_name || '-'}</p>
                      <p className="text-[10px] text-indigo-500 mt-1">{bookingProgressText(result.booking)}</p>
                    </div>
                    {!result.selectable && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                        {result.message || 'พบ Booking แต่ยังไม่มีตู้ในลานสำหรับปล่อยออก'}
                      </span>
                    )}
                  </div>
                  {result.message && <p className="mt-2 text-xs text-amber-600">{result.message}</p>}
                  {result.containers.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {result.containers.map(container => (
                        <button key={container.container_id} disabled={!result.selectable}
                          onClick={() => selectContainerForGateOut(container, result.booking)}
                          className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-700 shadow-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold">{container.container_number}</span>
                            <span className="text-slate-400">{container.zone_name ? `Zone ${container.zone_name} B${container.bay}-R${container.row}-T${container.tier}` : 'ไม่มีพิกัด'}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">{container.size}&apos;{container.type} • {container.shipping_line || '-'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </>
  );
}
