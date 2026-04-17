'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Container,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Truck,
  ArrowRight,
  Activity,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Package,
  Loader2,
  DoorOpen,
  Receipt,
  Shield,
  User,
  ClipboardList,
  FileDown,
} from 'lucide-react';

const DashboardCharts = dynamic(() => import('./DashboardCharts'), { ssr: false });

// Action labels for audit log display
const actionDisplay: Record<string, { text: (d: Record<string, unknown>) => string; status: string }> = {
  gate_in:         { text: (d) => `${d.container_number || 'ตู้'} เข้าลาน (Gate-In)`, status: 'success' },
  gate_out:        { text: (d) => `${d.container_number || 'ตู้'} ออกจากลาน (Gate-Out)`, status: 'success' },
  wo_create:       { text: (d) => `สร้างคำสั่งงาน #${d.order_id || ''} ${d.order_type || ''}`, status: 'info' },
  wo_accept:       { text: (d) => `รับงาน #${d.order_id || ''}`, status: 'success' },
  wo_complete:     { text: (d) => `ทำงานเสร็จ #${d.order_id || ''}`, status: 'success' },
  wo_cancel:       { text: (d) => `ยกเลิกงาน #${d.order_id || ''}`, status: 'warning' },
  invoice_create:  { text: (d) => `สร้างใบแจ้งหนี้ ${d.invoice_number || ''}`, status: 'info' },
  invoice_pay:     { text: (d) => `ชำระเงินใบแจ้งหนี้ #${d.invoice_id || ''}`, status: 'success' },
  invoice_cancel:  { text: (d) => `ยกเลิกใบแจ้งหนี้ #${d.invoice_id || ''}`, status: 'danger' },
  customer_create: { text: (d) => `เพิ่มลูกค้า ${d.customer_name || ''}`, status: 'info' },
  customer_update: { text: (d) => `แก้ไขลูกค้า ${d.customer_name || ''}`, status: 'info' },
  user_create:     { text: (d) => `เพิ่มผู้ใช้ ${d.username || ''}`, status: 'info' },
  user_update:     { text: (d) => `แก้ไขผู้ใช้ ${d.full_name || ''}`, status: 'info' },
  login:           { text: () => `เข้าสู่ระบบ`, status: 'success' },
  permission_update: { text: () => `แก้ไขสิทธิ์ผู้ใช้`, status: 'warning' },
  zone_create:     { text: (d) => `เพิ่มโซน ${d.zone_name || ''}`, status: 'info' },
  zone_update:     { text: (d) => `แก้ไขโซน ${d.zone_name || ''}`, status: 'info' },
  company_update:  { text: () => `แก้ไขข้อมูลบริษัท`, status: 'info' },
  storage_rates_update: { text: () => `แก้ไขอัตราค่าฝาก`, status: 'info' },
};

const actionIcons: Record<string, React.ReactNode> = {
  gate_in: <DoorOpen size={14} />,
  gate_out: <DoorOpen size={14} />,
  wo_create: <Truck size={14} />,
  wo_accept: <Truck size={14} />,
  wo_complete: <CheckCircle size={14} />,
  wo_cancel: <AlertTriangle size={14} />,
  invoice_create: <Receipt size={14} />,
  invoice_pay: <DollarSign size={14} />,
  invoice_cancel: <Receipt size={14} />,
  login: <User size={14} />,
  permission_update: <Shield size={14} />,
};

// Quick Actions
const quickActions = [
  { label: 'Gate-In ตู้ใหม่', icon: <Truck size={18} />, href: '/gate', color: '#3B82F6' },
  { label: 'ค้นหาตู้', icon: <Package size={18} />, href: '/yard', color: '#10B981' },
  { label: 'สร้าง EOR', icon: <Activity size={18} />, href: '/mnr', color: '#F59E0B' },
  { label: 'วางบิล', icon: <DollarSign size={18} />, href: '/billing', color: '#8B5CF6' },
];

interface DashboardData {
  kpi: {
    containers: { value: number; change: number };
    occupancy: { value: number; totalSlots: number };
    gateInToday: { value: number; change: number };
    gateOutToday: { value: number; change: number };
    revenue: { value: number; change: number };
    pendingOrders: number;
  };
  statusSummary: {
    available: number;
    in_yard: number;
    gated_out_today: number;
    on_hold: number;
    reefer: number;
  };
  activities: Array<{
    log_id: number;
    action: string;
    entity_type: string;
    entity_id: number | null;
    details: string;
    created_at: string;
    full_name: string | null;
    username: string | null;
  }>;
  charts?: {
    gateActivity: Array<{ date: string; gate_in: number; gate_out: number }>;
    revenueTrend: Array<{ date: string; revenue: number }>;
    byShippingLine: Array<{ name: string; value: number }>;
    dwellDistribution: Array<{ name: string; value: number; color: string }>;
    rangeLabel?: string;
  };
}

interface ExceptionData {
  summary: { total_open: number; critical: number; warning: number; unavailable_checks: number };
  issues: Array<{
    code: string;
    title: string;
    severity: 'info' | 'warning' | 'critical';
    count: number;
    owner_role: string;
    recommended_action: string;
    unavailable?: boolean;
  }>;
}

type RangeKey = '7d' | '30d' | '90d';

export default function DashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState<RangeKey>('7d');
  const [chartsLoading, setChartsLoading] = useState(false);
  const [exceptions, setExceptions] = useState<ExceptionData | null>(null);

  const fetchDashboard = useCallback(async (range?: RangeKey) => {
    try {
      const yardId = session?.activeYardId || 1;
      const r = range || chartRange;
      const [res, exceptionRes] = await Promise.all([
        fetch(`/api/dashboard?yard_id=${yardId}&range=${r}`),
        fetch(`/api/reports/reconciliation?yard_id=${yardId}&limit=5`),
      ]);
      const json = await res.json();
      const exceptionJson = await exceptionRes.json();
      if (!json.error) setData(json);
      if (!exceptionJson.error) setExceptions(exceptionJson);
    } catch (e) {
      console.error('Dashboard fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [session?.activeYardId, chartRange]);

  const handleRangeChange = useCallback(async (range: RangeKey) => {
    setChartRange(range);
    setChartsLoading(true);
    try {
      const yardId = session?.activeYardId || 1;
      const [res, exceptionRes] = await Promise.all([
        fetch(`/api/dashboard?yard_id=${yardId}&range=${range}`),
        fetch(`/api/reports/reconciliation?yard_id=${yardId}&limit=5`),
      ]);
      const json = await res.json();
      const exceptionJson = await exceptionRes.json();
      if (!json.error) setData(json);
      if (!exceptionJson.error) setExceptions(exceptionJson);
    } catch (e) {
      console.error('Dashboard fetch failed:', e);
    } finally {
      setChartsLoading(false);
    }
  }, [session?.activeYardId]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hrs / 24);
    return `${days} วันที่แล้ว`;
  };

  const kpi = data?.kpi;
  const summary = data?.statusSummary;

  const kpiCards = kpi ? [
    {
      title: 'ตู้ในลาน',
      value: kpi.containers.value.toLocaleString(),
      change: `${kpi.containers.change >= 0 ? '+' : ''}${kpi.containers.change}`,
      changeType: kpi.containers.change >= 0 ? 'up' as const : 'down' as const,
      changeLabel: 'จากเมื่อวาน',
      icon: <Container size={22} />,
      color: '#3B82F6',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'อัตราลานเต็ม',
      value: `${kpi.occupancy.value}%`,
      change: `${kpi.occupancy.totalSlots.toLocaleString()} ช่อง`,
      changeType: kpi.occupancy.value > 85 ? 'down' as const : 'up' as const,
      changeLabel: 'ความจุทั้งหมด',
      icon: <BarChart3 size={22} />,
      color: '#10B981',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      title: 'Gate-In วันนี้',
      value: kpi.gateInToday.value.toString(),
      change: `${kpi.gateInToday.change >= 0 ? '+' : ''}${kpi.gateInToday.change}`,
      changeType: kpi.gateInToday.change >= 0 ? 'up' as const : 'down' as const,
      changeLabel: 'เทียบเมื่อวาน',
      icon: <Truck size={22} />,
      color: '#F59E0B',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      title: 'Gate-Out วันนี้',
      value: kpi.gateOutToday.value.toString(),
      change: `${kpi.gateOutToday.change >= 0 ? '+' : ''}${kpi.gateOutToday.change}`,
      changeType: kpi.gateOutToday.change >= 0 ? 'up' as const : 'down' as const,
      changeLabel: 'เทียบเมื่อวาน',
      icon: <DoorOpen size={22} />,
      color: '#EF4444',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: 'รายได้วันนี้',
      value: `฿ ${kpi.revenue.value.toLocaleString()}`,
      change: kpi.revenue.change !== 0 ? `${kpi.revenue.change >= 0 ? '+' : ''}${kpi.revenue.change}%` : '-',
      changeType: kpi.revenue.change >= 0 ? 'up' as const : 'down' as const,
      changeLabel: 'เทียบเมื่อวาน',
      icon: <DollarSign size={22} />,
      color: '#8B5CF6',
      bgColor: 'bg-violet-50 dark:bg-violet-900/20',
    },
  ] : [];

  const statusItems = summary ? [
    { label: 'พร้อมใช้งาน', count: summary.available, color: '#10B981' },
    { label: 'อยู่ในลาน', count: summary.in_yard, color: '#3B82F6' },
    { label: 'งานค้าง', count: kpi?.pendingOrders || 0, color: '#F59E0B' },
    { label: 'ระงับ (Hold)', count: summary.on_hold, color: '#DC2626' },
    { label: 'ตู้เย็น (Reefer)', count: summary.reefer, color: '#06B6D4' },
    { label: 'ออกวันนี้', count: summary.gated_out_today, color: '#64748B' },
  ] : [];

  const visibleExceptions = exceptions?.issues?.filter(issue => issue.count > 0 || issue.unavailable).slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            แดชบอร์ด
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            สวัสดีครับ, {session?.fullName} — ภาพรวมการทำงานประจำวัน
          </p>
        </div>
        <button
          onClick={() => {
            const yardId = session?.activeYardId || 1;
            window.open(`/dashboard/print?yard_id=${yardId}`, '_blank');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors print:hidden"
        >
          <FileDown size={16} /> Export PDF
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 size={32} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {kpiCards.map((kpiItem, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
                  p-5 hover:shadow-md transition-all duration-200 group cursor-default"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl ${kpiItem.bgColor} flex items-center justify-center`}
                    style={{ color: kpiItem.color }}
                  >
                    {kpiItem.icon}
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg
                    ${kpiItem.changeType === 'up'
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400'
                    }
                  `}>
                    {kpiItem.changeType === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {kpiItem.change}
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{kpiItem.value}</p>
                <p className="text-xs text-slate-400">{kpiItem.title}</p>
                <p className="text-[10px] text-slate-400 mt-1">{kpiItem.changeLabel}</p>
              </div>
            ))}
          </div>

          {/* Container Status Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4">สรุปสถานะตู้ในลาน</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statusItems.map((item, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-2xl font-bold mb-1" style={{ color: item.color }}>
                    {item.count.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Exception Dashboard */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-white">Exception Dashboard</h2>
                <p className="text-xs text-slate-400 mt-1">งานตกหล่นจาก Gate, Billing, Booking, M&R, EDI และเครดิตลูกค้า</p>
              </div>
              <Link href="/reports" className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1">
                เปิดรายงาน <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{exceptions?.summary?.total_open || 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">เปิดอยู่</p>
              </div>
              <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3">
                <p className="text-2xl font-bold text-rose-600">{exceptions?.summary?.critical || 0}</p>
                <p className="text-xs text-rose-500">Critical</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-2xl font-bold text-amber-600">{exceptions?.summary?.warning || 0}</p>
                <p className="text-xs text-amber-500">Warning</p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                <p className="text-2xl font-bold text-blue-600">{exceptions?.summary?.unavailable_checks || 0}</p>
                <p className="text-xs text-blue-500">Check ไม่พร้อม</p>
              </div>
            </div>
            {visibleExceptions.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {visibleExceptions.map(issue => (
                  <div key={issue.code} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{issue.title}</p>
                      <p className="text-xs text-slate-400 truncate">{issue.owner_role} · {issue.recommended_action}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-bold ${
                      issue.severity === 'critical'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      {issue.unavailable ? '-' : issue.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                ไม่พบ exception สำคัญในรอบตรวจล่าสุด
              </div>
            )}
          </div>

          {/* Charts Section */}
          {data?.charts && (
            <DashboardCharts
              charts={data.charts}
              activeRange={chartRange}
              onRangeChange={handleRangeChange}
              loading={chartsLoading}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4">คำสั่งด่วน</h2>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 dark:border-slate-700
                      hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm
                      transition-all duration-200 group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110"
                      style={{ backgroundColor: action.color }}
                    >
                      {action.icon}
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity — from AuditLog */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-800 dark:text-white">กิจกรรมล่าสุด</h2>
                <Link href="/audit-trail" className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1">
                  ดูทั้งหมด <ArrowRight size={12} />
                </Link>
              </div>
              <div className="space-y-3">
                {data?.activities && data.activities.length > 0 ? data.activities.map((act) => {
                  let details: Record<string, unknown> = {};
                  try { details = JSON.parse(act.details || '{}'); } catch { /* */ }
                  const display = actionDisplay[act.action] || { text: () => act.action, status: 'info' };
                  const statusClass = display.status === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                    : display.status === 'warning'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
                    : display.status === 'danger'
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500';
                  const icon = actionIcons[act.action] || <ClipboardList size={14} />;

                  return (
                    <div key={act.log_id} className="flex items-start gap-3 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${statusClass}`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {display.text(details)}
                          {act.full_name && <span className="text-slate-400 ml-1">— {act.full_name}</span>}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} /> {relativeTime(act.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-slate-400 py-4 text-center">ยังไม่มีกิจกรรม</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
