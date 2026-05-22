'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  CloudOff,
  DoorOpen,
  MapPinned,
  PackageSearch,
  Search,
  Smartphone,
  Thermometer,
  Wifi,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

interface MobileAction {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
  tone: string;
  permissions: string[];
  primary?: boolean;
}

const actions: MobileAction[] = [
  {
    title: 'Gate',
    subtitle: 'Gate In / Gate Out / EIR',
    href: '/gate',
    icon: <DoorOpen size={24} />,
    tone: 'bg-blue-600 text-white',
    permissions: ['gate.in', 'gate.out'],
    primary: true,
  },
  {
    title: 'Yard',
    subtitle: 'ค้นตู้และจัดตำแหน่งลาน',
    href: '/yard',
    icon: <MapPinned size={24} />,
    tone: 'bg-emerald-600 text-white',
    permissions: ['yard.location.assign', 'yard.slot.move'],
    primary: true,
  },
  {
    title: 'Reefer',
    subtitle: 'โหมดเดินตรวจและบันทึกอุณหภูมิ',
    href: '/reefer',
    icon: <Thermometer size={24} />,
    tone: 'bg-cyan-600 text-white',
    permissions: ['reefer.check.record', 'reefer.check.read'],
    primary: true,
  },
  {
    title: 'M&R',
    subtitle: 'ตรวจสภาพและใบประเมินซ่อม',
    href: '/mnr',
    icon: <Wrench size={24} />,
    tone: 'bg-amber-500 text-white',
    permissions: ['mnr.eor.create', 'mnr.eor.update', 'survey.inspect'],
  },
  {
    title: 'Booking',
    subtitle: 'เช็ค booking และ progress',
    href: '/booking',
    icon: <ClipboardList size={24} />,
    tone: 'bg-indigo-600 text-white',
    permissions: ['booking.manage'],
  },
  {
    title: 'ค้นหาตู้',
    subtitle: 'เปิดหน้าจัดการลานเพื่อค้นหา',
    href: '/yard',
    icon: <PackageSearch size={24} />,
    tone: 'bg-slate-700 text-white',
    permissions: ['yard.location.assign', 'yard.slot.move', 'survey.inspect'],
  },
];

const quickActions: MobileAction[] = [
  {
    title: 'Gate In',
    subtitle: 'รับตู้เข้าลานพร้อมรูป/EIR',
    href: '/gate?action=gate-in',
    icon: <ArrowDownToLine size={22} />,
    tone: 'bg-blue-600 text-white',
    permissions: ['gate.in'],
    primary: true,
  },
  {
    title: 'Gate Out',
    subtitle: 'ปล่อยตู้และออก EIR Out',
    href: '/gate?action=gate-out',
    icon: <ArrowUpFromLine size={22} />,
    tone: 'bg-emerald-600 text-white',
    permissions: ['gate.out'],
    primary: true,
  },
  {
    title: 'Reefer Walk',
    subtitle: 'คิวเดินตรวจอุณหภูมิ RF',
    href: '/reefer?mode=walk',
    icon: <Thermometer size={22} />,
    tone: 'bg-cyan-600 text-white',
    permissions: ['reefer.check.record', 'reefer.check.read'],
    primary: true,
  },
  {
    title: 'Yard Search',
    subtitle: 'ค้นเลขตู้/ตำแหน่งเร็ว',
    href: '/yard?mode=search',
    icon: <Search size={22} />,
    tone: 'bg-slate-700 text-white',
    permissions: ['yard.location.assign', 'yard.slot.move', 'survey.inspect'],
    primary: true,
  },
];

export default function MobileOpsPage() {
  const { hasAnyPermission, permissionsLoading } = useAuth();
  const visibleActions = actions.filter(action => permissionsLoading || hasAnyPermission(action.permissions));
  const visibleQuickActions = quickActions.filter(action => permissionsLoading || hasAnyPermission(action.permissions));
  const primaryActions = visibleActions.filter(action => action.primary);
  const secondaryActions = visibleActions.filter(action => !action.primary);
  const [online, setOnline] = useState(true);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    updateStatus();
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Smartphone size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">PWA Quick Start</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              หน้านี้ออกแบบสำหรับมือถือ/PWA เท่านั้น บน desktop ให้ใช้เมนูหลัก Gate, Yard, Reefer, M&R หรือ Booking ทาง Sidebar เพื่อไม่ให้ workflow ซ้ำกัน
            </p>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Smartphone size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">โหมดมือถือ</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">PWA Quick Start สำหรับงานหน้าลานที่ต้องแตะเร็วและเห็นสถานะชัด</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatusTile
            title="สถานะซิงค์"
            value={online ? 'Online' : 'Offline Queue'}
            icon={online ? <Wifi size={16} /> : <CloudOff size={16} />}
            tone={online ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}
          />
          <StatusTile
            title="ติดตั้ง PWA"
            value={standalone ? 'Installed' : 'Add to Home Screen'}
            icon={<Smartphone size={16} />}
            tone="text-slate-700 bg-slate-100"
          />
        </div>

        {visibleActions.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
            ยังไม่มีสิทธิ์ใช้งาน PWA Quick Start
          </div>
        ) : (
          <>
            {visibleQuickActions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Quick Actions</p>
                <div className="grid grid-cols-2 gap-3">
                  {visibleQuickActions.map(action => (
                    <MobileActionButton key={action.title} action={action} />
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {primaryActions.map(action => (
                <MobileActionButton key={action.title} action={action} large />
              ))}
            </div>

            {secondaryActions.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {secondaryActions.map(action => (
                  <MobileActionButton key={action.title} action={action} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusTile({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold opacity-80">
        {icon}
        {title}
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function MobileActionButton({ action, large = false }: { action: MobileAction; large?: boolean }) {
  return (
    <Link
      href={action.href}
      className={`${action.tone} flex min-h-[92px] items-center gap-3 rounded-xl p-4 shadow-sm transition-transform active:scale-[0.99] ${
        large ? 'min-h-[104px]' : ''
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
        {action.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold">{action.title}</span>
        <span className="mt-1 block text-xs opacity-85">{action.subtitle}</span>
      </span>
    </Link>
  );
}
