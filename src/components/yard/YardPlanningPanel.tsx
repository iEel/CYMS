'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarDays, Flame, Gauge, Layers, Loader2, Plus } from 'lucide-react';
import { buildYardPlanningSnapshot, type YardMoveRecommendation, type YardPlanningContainer, type YardPlanningZone } from '@/lib/yardPlanning';
import { useToast } from '@/components/providers/ToastProvider';

interface Props {
  zones: YardPlanningZone[];
  containers: YardPlanningContainer[];
  yardId?: number;
  canCreateWorkOrder?: boolean;
  onWorkOrderCreated?: () => void;
}

const riskClass: Record<string, string> = {
  critical: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40',
  high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40',
  watch: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40',
};

export default function YardPlanningPanel({ zones, containers, yardId, canCreateWorkOrder = false, onWorkOrderCreated }: Props) {
  const { toast } = useToast();
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const snapshot = useMemo(() => buildYardPlanningSnapshot({ zones, containers }), [zones, containers]);
  const hotZones = snapshot.zone_heatmap.slice(0, 5);

  const createWorkOrder = async (item: YardMoveRecommendation) => {
    if (!yardId || !item.container_id || !item.to_zone_id) return;
    const key = `${item.container_number}-${item.action}`;
    setCreatingKey(key);
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          order_type: item.order_type,
          container_id: item.container_id,
          from_zone_id: item.from_zone_id || null,
          from_bay: item.from_bay || null,
          from_row: item.from_row || null,
          from_tier: item.from_tier || null,
          to_zone_id: item.to_zone_id,
          to_bay: item.to_bay || null,
          to_row: item.to_row || null,
          to_tier: item.to_tier || null,
          priority: Math.min(Math.max(Math.ceil(item.priority / 10), 1), 5),
          notes: `Yard planning: ${item.action} — ${item.reason}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast('error', 'สร้าง Work Order ไม่สำเร็จ', data.error || item.container_number);
        return;
      }
      toast('success', 'สร้าง Work Order แล้ว', `${item.container_number} → ${item.to_slot}`);
      onWorkOrderCreated?.();
    } catch (error) {
      console.error(error);
      toast('error', 'สร้าง Work Order ไม่สำเร็จ', item.container_number);
    } finally {
      setCreatingKey(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Gauge size={16} /> Yard Planning
          </h3>
          <p className="text-xs text-slate-400 mt-1">Heatmap อายุ slot, move recommendation, release forecast และ congestion risk</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Ready" value={snapshot.daily_release_forecast.ready_today} color="text-emerald-600" />
          <Metric label="3 วัน" value={snapshot.daily_release_forecast.next_3_days} color="text-blue-600" />
          <Metric label="Blocked" value={snapshot.daily_release_forecast.blocked} color="text-rose-600" />
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Flame size={14} /> Slot Aging Heatmap
          </div>
          <div className="space-y-2">
            {hotZones.length === 0 ? (
              <EmptyState text="ยังไม่มีข้อมูล zone" />
            ) : hotZones.map(zone => (
              <div key={zone.zone_name} className={`rounded-lg border p-3 ${riskClass[zone.risk] || riskClass.low}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">Zone {zone.zone_name}</span>
                  <span className="text-[10px] uppercase font-bold">{zone.risk}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/70 dark:bg-slate-900/40 overflow-hidden">
                  <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(zone.occupancy_pct, 100)}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                  <span>Occ {zone.occupancy_pct.toFixed(0)}%</span>
                  <span>Avg {zone.avg_age_days}d</span>
                  <span>Max {zone.max_age_days}d</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <ArrowRightLeft size={14} /> Move Recommendations
          </div>
          <div className="space-y-2">
            {snapshot.move_recommendations.length === 0 ? (
              <EmptyState text="ยังไม่มี move ที่ควรเร่ง" />
            ) : snapshot.move_recommendations.slice(0, 5).map(item => {
              const key = `${item.container_number}-${item.action}`;
              const canCreate = canCreateWorkOrder && Boolean(yardId && item.container_id && item.to_zone_id);
              return (
              <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-800 dark:text-white">{item.container_number}</span>
                  <span className="text-[10px] text-blue-600 font-semibold">P{item.priority}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{item.from_slot}</p>
                {item.to_slot && <p className="text-[10px] text-emerald-600 mt-1">→ {item.to_slot}</p>}
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.reason}</p>
                {canCreate && (
                  <button
                    onClick={() => createWorkOrder(item)}
                    disabled={creatingKey === key}
                    className="mt-2 h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {creatingKey === key ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    สร้าง WO
                  </button>
                )}
              </div>
            );})}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <CalendarDays size={14} /> Forecast
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ForecastCard label="วันนี้" value={snapshot.daily_release_forecast.ready_today} tone="emerald" />
            <ForecastCard label="3 วัน" value={snapshot.daily_release_forecast.next_3_days} tone="blue" />
            <ForecastCard label="ติดเงื่อนไข" value={snapshot.daily_release_forecast.blocked} tone="rose" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Layers size={14} /> Congestion
            </div>
            {snapshot.congestion_forecast.length === 0 ? (
              <EmptyState text="ยังไม่มี congestion risk สูง" />
            ) : snapshot.congestion_forecast.slice(0, 4).map(item => (
              <div key={item.zone_name} className={`rounded-lg border p-3 ${riskClass[item.risk] || riskClass.watch}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Zone {item.zone_name}</span>
                  <span className="text-[10px] uppercase font-bold">{item.risk}</span>
                </div>
                <p className="text-xs mt-1">{item.message}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="min-w-16 rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ForecastCard({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'blue' | 'rose' }) {
  const cls = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
  }[tone];
  return (
    <div className={`rounded-lg p-3 ${cls}`}>
      <p className="text-[10px] font-medium">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-400">{text}</div>;
}
