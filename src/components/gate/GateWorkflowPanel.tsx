'use client';

import { AlertTriangle, CheckCircle2, Circle, Clock3, LockKeyhole, Route } from 'lucide-react';
import type { GateWorkflowException, GateWorkflowStatus, GateWorkflowSummary } from '@/lib/gateWorkflow';

interface GateWorkflowPanelProps {
  title: string;
  workflow: GateWorkflowSummary;
}

function statusClass(status: GateWorkflowStatus) {
  switch (status) {
    case 'done':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300';
    case 'active':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'blocked':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
  }
}

function statusIcon(status: GateWorkflowStatus) {
  if (status === 'done') return <CheckCircle2 size={14} />;
  if (status === 'active') return <Clock3 size={14} />;
  if (status === 'blocked') return <LockKeyhole size={14} />;
  return <Circle size={14} />;
}

function exceptionClass(severity: GateWorkflowException['severity']) {
  if (severity === 'danger') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300';
  }
  if (severity === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300';
}

export default function GateWorkflowPanel({ title, workflow }: GateWorkflowPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/25 p-3 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-300">
            <Route size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Next: {workflow.nextAction}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        {workflow.steps.map((step) => (
          <div key={step.id} className={`rounded-lg border px-3 py-2 min-h-[74px] ${statusClass(step.status)}`}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              {statusIcon(step.status)}
              <span>{step.label}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 opacity-80">{step.detail}</p>
          </div>
        ))}
      </div>

      {workflow.exceptions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {workflow.exceptions.map((item) => (
            <div key={item.code} className={`rounded-lg border px-3 py-2 ${exceptionClass(item.severity)}`}>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <AlertTriangle size={13} />
                <span>{item.title}</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 opacity-85">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
