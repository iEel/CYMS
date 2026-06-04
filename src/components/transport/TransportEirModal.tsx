'use client';

import { X } from 'lucide-react';

type EirPayload = Record<string, unknown>;

const rows: Array<[string, string]> = [
  ['เลข EIR', 'eir_number'],
  ['สำเนา', 'copy_type_label'],
  ['เลขตู้', 'container_number'],
  ['ประเภทงาน', 'transaction_type'],
  ['Booking', 'booking_number'],
  ['ลาน', 'yard_code'],
  ['ซีล', 'seal_number'],
  ['คนขับ', 'driver_name'],
  ['โทรศัพท์', 'driver_phone'],
  ['ทะเบียนรถ', 'truck_plate'],
  ['บริษัทรถ', 'truck_company'],
];

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export function TransportEirModal({
  eir,
  copyLabel,
  loading,
  onClose,
}: {
  eir: EirPayload | null;
  copyLabel: 'Driver Copy' | 'Trucking Copy';
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 p-4">
      <div className="mx-auto flex max-h-[calc(100vh-32px)] max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">{copyLabel}</p>
            <h2 className="text-lg font-bold text-slate-950">{displayValue(eir?.eir_number)}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto p-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">กำลังโหลด...</div>
          ) : (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rows.map(([label, key]) => (
                <div key={key} className="rounded-lg border border-slate-200 p-3">
                  <dt className="text-xs font-semibold uppercase text-slate-400">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{displayValue(eir?.[key])}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
