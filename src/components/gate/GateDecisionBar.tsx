'use client';

import { AlertTriangle, CheckCircle2, Circle, Clock3, ShieldCheck } from 'lucide-react';
import type { GateDecisionSignal, GateDecisionSignals } from '@/lib/gateWorkflow';

interface GateDecisionBarProps {
  signals: GateDecisionSignals;
}

const toneClass: Record<GateDecisionSignal['status'], string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40',
  active: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40',
  pending: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700',
  blocked: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40',
};

function StatusIcon({ status }: { status: GateDecisionSignal['status'] }) {
  if (status === 'ok') return <CheckCircle2 size={14} />;
  if (status === 'active') return <Clock3 size={14} />;
  if (status === 'blocked') return <AlertTriangle size={14} />;
  return <Circle size={14} />;
}

export default function GateDecisionBar({ signals }: GateDecisionBarProps) {
  return (
    <section className="sticky top-16 z-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur px-3 py-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
          {signals.items.map(item => (
            <div key={item.key} className={`rounded-lg border px-3 py-2 min-h-[64px] ${toneClass[item.status]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-normal">{item.label}</span>
                <StatusIcon status={item.status} />
              </div>
              <p className="mt-1 text-sm font-bold leading-tight">{item.value}</p>
              <p className="mt-0.5 text-[10px] leading-4 opacity-80 line-clamp-2">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className={`rounded-lg border px-3 py-2 min-w-[220px] ${
          signals.canProceed
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300'
        }`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ShieldCheck size={14} />
            <span>{signals.canProceed ? 'พร้อมดำเนินการ' : 'Next decision'}</span>
          </div>
          <p className="mt-1 text-sm font-bold leading-tight">{signals.nextAction}</p>
        </div>
      </div>
    </section>
  );
}
