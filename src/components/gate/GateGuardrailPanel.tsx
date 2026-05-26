'use client';

import { AlertTriangle, BadgeCheck, Camera, ShieldCheck, Truck } from 'lucide-react';
import type { GateOperationalGuardrailsSnapshot } from '@/lib/gateOperationalGuardrails';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  snapshot: GateOperationalGuardrailsSnapshot;
}

const severityClass = {
  blocked: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
};

export default function GateGuardrailPanel({ title, snapshot }: Props) {
  const visibleAlerts = snapshot.alerts.slice(0, 4);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck size={16} /> {title}
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">duplicate alert, driver/truck master และ photo evidence check</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-300">
          <StatusPill label="Driver" value={`${snapshot.driver_profile.completed}/${snapshot.driver_profile.total}`} ok={snapshot.driver_profile.status === 'complete'} />
          <StatusPill label="Photo" value={`${snapshot.photo_status.completed}/${snapshot.photo_status.required || 0}`} ok={snapshot.photo_status.ok} />
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <InfoBox icon={<Truck size={14} />} label="Driver master" value={driverStatusText(snapshot.driver_profile.status)} detail={snapshot.driver_profile.missing_fields.join(', ') || 'ข้อมูลครบ'} />
            <InfoBox icon={<Camera size={14} />} label="Photo evidence" value={snapshot.photo_status.ok ? 'ครบตามเงื่อนไข' : 'ยังมีจุดที่ควรเพิ่ม'} detail={snapshot.photo_status.missing_categories.join(', ') || 'พร้อมออกเอกสาร'} />
            <InfoBox icon={<BadgeCheck size={14} />} label="Preflight" value={snapshot.has_blocker ? 'มี blocker' : visibleAlerts.length ? 'มี warning' : 'พร้อม'} detail={visibleAlerts.length ? `${visibleAlerts.length} รายการต้องตรวจ` : 'ไม่พบความเสี่ยงเด่น'} />
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck size={14} /> ไม่พบ duplicate seal/plate หรือ evidence gap สำคัญ
            </div>
          ) : (
            <div className="space-y-2">
              {visibleAlerts.map(alert => (
                <div key={alert.key} className={`rounded-lg border px-3 py-2 text-xs ${severityClass[alert.severity]}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold">{alert.title}</p>
                      <p className="mt-0.5">{alert.message}</p>
                      {alert.action && <p className="mt-1 font-medium opacity-80">{alert.action}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <span className={`px-2 py-1 rounded-full border font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'}`}>
      {label} {value}
    </span>
  );
}

function InfoBox({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 uppercase">
        {icon} {label}
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-white mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{detail}</p>
    </div>
  );
}

function driverStatusText(status: GateOperationalGuardrailsSnapshot['driver_profile']['status']) {
  if (status === 'complete') return 'ข้อมูลครบ';
  if (status === 'partial') return 'ยังไม่ครบ';
  return 'ยังไม่มีข้อมูล';
}
