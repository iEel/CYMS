'use client';

import { AlertTriangle, CheckCircle2, Circle, Clock3, ShieldCheck } from 'lucide-react';
import type { GateDecisionSignal, GateDecisionSignals } from '@/lib/gateWorkflow';

interface GateDecisionBarProps {
  signals: GateDecisionSignals;
}

const toneClass: Record<GateDecisionSignal['status'], string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40',
  active: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40',
  pending: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700',
  blocked: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40',
};

function StatusIcon({ status }: { status: GateDecisionSignal['status'] }) {
  if (status === 'ok') return <CheckCircle2 size={14} />;
  if (status === 'active') return <Clock3 size={14} />;
  if (status === 'blocked') return <AlertTriangle size={14} />;
  return <Circle size={14} />;
}

export default function GateDecisionBar({ signals }: GateDecisionBarProps) {
  const actionTone = signals.canProceed
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300'
    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300';

  return (
    <section className="sticky top-16 z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur px-3 py-3 shadow-sm">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
            <ShieldCheck size={14} />
            <span>สถานะก่อนบันทึก</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {signals.items.map(item => (
            <div key={item.key} className={`rounded-lg border px-3 py-2 min-h-[54px] ${toneClass[item.status]}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-normal opacity-80">{item.label}</div>
                  <p className="mt-0.5 text-sm font-bold leading-tight">{item.value}</p>
                </div>
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={item.status} />
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-4 opacity-80 line-clamp-1">{item.detail}</p>
            </div>
          ))}
          </div>
        </div>
        <div className={`rounded-lg border px-3 py-2 2xl:w-[300px] ${actionTone}`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {signals.canProceed ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
            <span>{signals.canProceed ? 'พร้อมบันทึก' : 'ขั้นตอนถัดไป'}</span>
          </div>
          <p className="mt-1 text-sm font-bold leading-tight">{signals.nextAction}</p>
        </div>
      </div>
    </section>
  );
}
