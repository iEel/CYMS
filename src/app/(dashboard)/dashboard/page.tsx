'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import Link from 'next/link';
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
} from 'lucide-react';

// KPI สำหรับ Demo
const demoKPIs = [
  {
    title: 'ตู้คอนเทนเนอร์ทั้งหมด',
    value: '1,247',
    change: '+12',
    changeType: 'up' as const,
    changeLabel: 'จากเมื่อวาน',
    icon: <Container size={22} />,
    color: '#3B82F6',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    title: 'อัตราลานเต็ม',
    value: '73%',
    change: '+2.4%',
    changeType: 'up' as const,
    changeLabel: 'จากสัปดาห์ก่อน',
    icon: <BarChart3 size={22} />,
    color: '#10B981',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    title: 'รอเข้า Gate-In',
    value: '23',
    change: '-5',
    changeType: 'down' as const,
    changeLabel: 'จากเมื่อวาน',
    icon: <Truck size={22} />,
    color: '#F59E0B',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  {
    title: 'รายได้วันนี้',
    value: '฿ 284,500',
    change: '+18.2%',
    changeType: 'up' as const,
    changeLabel: 'จากเมื่อวาน',
    icon: <DollarSign size={22} />,
    color: '#8B5CF6',
    bgColor: 'bg-violet-50 dark:bg-violet-900/20',
  },
];

// รายการกิจกรรมล่าสุด Demo
const recentActivities = [
  { type: 'gate_in', text: 'TCLU1234567 เข้าลานจาก Gate 1', time: '2 นาทีที่แล้ว', status: 'success' },
  { type: 'gate_out', text: 'MSCU7654321 ออกจากลาน Gate 2', time: '15 นาทีที่แล้ว', status: 'success' },
  { type: 'alert', text: 'เลขซีล MSCU7654321 ไม่ตรงกับ Manifest', time: '22 นาทีที่แล้ว', status: 'warning' },
  { type: 'repair', text: 'EOR-2024-0089 อนุมัติแล้วโดยสายเรือ', time: '1 ชั่วโมงที่แล้ว', status: 'success' },
  { type: 'payment', text: 'รับชำระเงิน ฿45,000 จาก Evergreen Line', time: '2 ชั่วโมงที่แล้ว', status: 'success' },
  { type: 'alert', text: 'Bay A-12 เกินความสูง Max Tier (5/4)', time: '3 ชั่วโมงที่แล้ว', status: 'danger' },
];

// Quick Actions
const quickActions = [
  { label: 'Gate-In ตู้ใหม่', icon: <Truck size={18} />, href: '/gate', color: '#3B82F6' },
  { label: 'ค้นหาตู้', icon: <Package size={18} />, href: '/yard', color: '#10B981' },
  { label: 'สร้าง EOR', icon: <Activity size={18} />, href: '/mnr', color: '#F59E0B' },
  { label: 'วางบิล', icon: <DollarSign size={18} />, href: '/billing', color: '#8B5CF6' },
];

export default function DashboardPage() {
  const { session } = useAuth();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          แดชบอร์ด
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          สวัสดีครับ, {session?.fullName} — ภาพรวมการทำงานประจำวัน
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {demoKPIs.map((kpi, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700
              p-5 hover:shadow-md transition-all duration-200 group cursor-default"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl ${kpi.bgColor} flex items-center justify-center`}
                style={{ color: kpi.color }}
              >
                {kpi.icon}
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg
                ${kpi.changeType === 'up'
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400'
                }
              `}>
                {kpi.changeType === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {kpi.change}
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{kpi.value}</p>
            <p className="text-xs text-slate-400">{kpi.title}</p>
            <p className="text-[10px] text-slate-400 mt-1">{kpi.changeLabel}</p>
          </div>
        ))}
      </div>

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

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">กิจกรรมล่าสุด</h2>
            <Link href="/gate" className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1">
              ดูทั้งหมด <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentActivities.map((act, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                  ${act.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' :
                    act.status === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' :
                    'bg-rose-50 dark:bg-rose-900/20 text-rose-500'}
                `}>
                  {act.status === 'success' ? <CheckCircle size={14} /> :
                   act.status === 'warning' ? <AlertTriangle size={14} /> :
                   <AlertTriangle size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{act.text}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {act.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Yard Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4">สรุปสถานะตู้ในลาน</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'พร้อมใช้งาน', count: 423, color: '#10B981' },
            { label: 'อยู่ในลาน', count: 687, color: '#3B82F6' },
            { label: 'กำลังขนส่ง', count: 45, color: '#F59E0B' },
            { label: 'กำลังซ่อม', count: 32, color: '#EF4444' },
            { label: 'ระงับ (Hold)', count: 18, color: '#DC2626' },
            { label: 'ออกจากลาน', count: 42, color: '#64748B' },
          ].map((item, i) => (
            <div key={i} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
              <p className="text-2xl font-bold mb-1" style={{ color: item.color }}>
                {item.count.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
