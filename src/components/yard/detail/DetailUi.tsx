'use client';

import { ExternalLink } from 'lucide-react';

export function InfoField({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''} ${highlight ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}

export function DocumentRow({ label, number, onClick }: { label: string; number: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
    >
      <div>
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="font-mono text-xs font-semibold text-slate-800 dark:text-white">{number}</p>
      </div>
      <ExternalLink size={12} className="text-slate-400" />
    </button>
  );
}

export function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-xs font-bold ${color || 'text-slate-700 dark:text-slate-200'}`}>{value}</p>
    </div>
  );
}
