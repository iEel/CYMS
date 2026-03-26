'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamic import recharts to avoid SSR issues
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false, loading: () => <div className="w-full h-[200px] flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={20} /></div> });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });

interface ChartsData {
  gateActivity: Array<{ date: string; gate_in: number; gate_out: number }>;
  revenueTrend: Array<{ date: string; revenue: number }>;
  byShippingLine: Array<{ name: string; value: number }>;
  dwellDistribution: Array<{ name: string; value: number; color: string }>;
  rangeLabel?: string;
}

type RangeKey = '7d' | '30d' | '90d';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 วัน' },
  { key: '30d', label: '30 วัน' },
  { key: '90d', label: '3 เดือน' },
];

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-600">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-bold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function DashboardCharts({ charts, activeRange, onRangeChange, loading }: {
  charts: ChartsData;
  activeRange: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  loading?: boolean;
}) {
  const totalDwell = charts.dwellDistribution.reduce((s, d) => s + d.value, 0);
  const rangeLabel = charts.rangeLabel || '7 วัน';

  return (
    <div className="space-y-4">
      {/* Range Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          📈 แนวโน้มการทำงาน
          {loading && <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </h2>
        <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onRangeChange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                activeRange === opt.key
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gate Activity — Bar Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">
          📊 Gate Activity ({rangeLabel})
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={charts.gateActivity} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="gate_in" name="Gate-In" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gate_out" name="Gate-Out" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Gate-In</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Gate-Out</span>
        </div>
      </div>

      {/* Revenue Trend — Area Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">
          💰 Revenue Trend ({rangeLabel})
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={charts.revenueTrend}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" name="รายได้" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#revGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Container by Shipping Line — Horizontal Bar Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">
          🚢 ตู้ตามสายเรือ (Top 6)
        </h3>
        {charts.byShippingLine.length === 0 ? (
          <div className="flex items-center justify-center h-[160px] text-slate-400 text-sm">ไม่มีข้อมูล</div>
        ) : (() => {
          const maxVal = Math.max(...charts.byShippingLine.map(d => d.value), 1);
          const total = charts.byShippingLine.reduce((s, d) => s + d.value, 0);
          return (
            <div className="space-y-2.5">
              {charts.byShippingLine.map((item, i) => {
                const pct = Math.max((item.value / maxVal) * 100, 3);
                const sharePct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[140px]">{item.name}</span>
                      <span className="font-bold text-slate-800 dark:text-white ml-2 shrink-0">
                        {item.value} <span className="text-slate-400 font-normal">({sharePct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-5 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                        style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      >
                        {pct > 20 && (
                          <span className="text-[10px] font-bold text-white">{item.value}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-slate-400 text-right pt-1">รวม {total} ตู้</p>
            </div>
          );
        })()}
      </div>

      {/* Dwell Time Distribution — Horizontal Bars */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">
          ⏱ Dwell Time Distribution
        </h3>
        <div className="space-y-3">
          {charts.dwellDistribution.map((item, i) => {
            const pct = totalDwell > 0 ? (item.value / totalDwell) * 100 : 0;
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{item.name}</span>
                  <span className="font-bold text-slate-800 dark:text-white">{item.value} <span className="text-slate-400 font-normal">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="w-full h-6 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: item.color }}
                  >
                    {pct > 15 && <span className="text-[10px] font-bold text-white">{pct.toFixed(0)}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3 text-right">รวม {totalDwell} ตู้ในลาน</p>
      </div>
      </div>
    </div>
  );
}
