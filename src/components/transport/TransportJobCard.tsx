'use client';

import { CalendarClock, FileText, MapPin, Truck } from 'lucide-react';

import { TransportStatusPill } from './TransportStatusPills';
import type { TransportJob } from './types';

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TransportJobCard({
  job,
  onOpenEir,
}: {
  job: TransportJob;
  onOpenEir: (eirNumber: string) => void;
}) {
  const time = job.gateDatetime || job.requestedAt;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-bold tracking-normal text-slate-950">{job.containerNumber || '-'}</p>
          <p className="mt-1 text-sm text-slate-500">{job.bookingNumber || 'ไม่มี Booking'}</p>
        </div>
        <TransportStatusPill status={job.status} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2 text-slate-600">
          <MapPin size={16} className="mt-0.5 text-blue-600" />
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">ตำแหน่ง</dt>
            <dd className="font-medium text-slate-800">{job.yardName || '-'} {job.yardSlot ? `· ${job.yardSlot}` : ''}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2 text-slate-600">
          <Truck size={16} className="mt-0.5 text-blue-600" />
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">รถ / คนขับ</dt>
            <dd className="font-medium text-slate-800">{job.truckPlate || '-'} {job.driverName ? `· ${job.driverName}` : ''}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2 text-slate-600">
          <CalendarClock size={16} className="mt-0.5 text-blue-600" />
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">เวลา</dt>
            <dd className="font-medium text-slate-800">{formatDateTime(time)}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2 text-slate-600">
          <FileText size={16} className="mt-0.5 text-blue-600" />
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-400">EIR</dt>
            <dd className="font-medium text-slate-800">{job.eirNumber || '-'}</dd>
          </div>
        </div>
      </dl>

      {job.attentionReason && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {job.attentionReason}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!job.eirNumber}
          onClick={() => job.eirNumber && onOpenEir(job.eirNumber)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <FileText size={16} />
          ดู EIR
        </button>
      </div>
    </article>
  );
}
