'use client';

import { Loader2 } from 'lucide-react';

export interface GateInVisibilityPreviewRow {
  customerId: number;
  customerName?: string | null;
  entityType: string;
  entityRef?: string | null;
  accessRole: string;
  validUntil?: string | null;
  permissionScope?: Record<string, unknown>;
}

interface GateInVisibilityPreviewPanelProps {
  rows: GateInVisibilityPreviewRow[];
  loading: boolean;
  error: string;
}

export default function GateInVisibilityPreviewPanel({
  rows,
  loading,
  error,
}: GateInVisibilityPreviewPanelProps) {
  return (
    <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">Portal Visibility Preview</p>
          <p className="text-[10px] leading-4 text-slate-400">จะแสดง grant ที่ระบบจะสร้าง ไม่ได้ตั้ง field policy รายครั้ง</p>
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-cyan-600" />}
      </div>
      <div className="mt-3 space-y-2">
        {error ? (
          <p className="text-xs text-rose-500">{error}</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-cyan-100 bg-white/70 px-3 py-2 text-xs text-slate-400 dark:border-cyan-900/40 dark:bg-slate-800/70">
            ยังไม่มี party ที่จะได้รับสิทธิ์
          </p>
        ) : rows.map((row, index) => (
          <div key={`${row.customerId}-${row.entityType}-${row.accessRole}-${index}`} className="rounded-lg bg-white/80 p-2 text-xs dark:bg-slate-800/70">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{row.customerName || `Customer #${row.customerId}`}</p>
            <p className="mt-0.5 text-slate-400">{row.entityType} · {row.accessRole}</p>
            <p className="mt-1 text-[10px] text-slate-400">Grade default: hidden</p>
          </div>
        ))}
      </div>
    </div>
  );
}
