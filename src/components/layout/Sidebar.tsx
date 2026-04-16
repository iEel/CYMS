'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  LayoutDashboard,
  Container,
  DoorOpen,
  Truck,
  FileText,
  Wrench,
  Receipt,
  Settings,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LogOut,
  BarChart3,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  {
    label: 'แดชบอร์ด',
    href: '/dashboard',
    icon: <LayoutDashboard size={20} />,
    roles: ['yard_manager', 'supervisor', 'gate_clerk', 'surveyor', 'yard_planner', 'rs_driver', 'billing_officer', 'customer'],
  },
  {
    label: 'จัดการลาน',
    href: '/yard',
    icon: <Container size={20} />,
    roles: ['yard_manager', 'supervisor', 'surveyor', 'yard_planner'],
  },
  {
    label: 'ประตู Gate',
    href: '/gate',
    icon: <DoorOpen size={20} />,
    roles: ['yard_manager', 'supervisor', 'gate_clerk', 'surveyor'],
  },
  {
    label: 'Booking',
    href: '/booking',
    icon: <ClipboardList size={20} />,
    roles: ['yard_manager', 'supervisor', 'gate_clerk', 'yard_planner'],
  },
  {
    label: 'ปฏิบัติการ',
    href: '/operations',
    icon: <Truck size={20} />,
    roles: ['yard_manager', 'supervisor', 'yard_planner', 'rs_driver', 'surveyor'],
  },
  {
    label: 'EDI & ข้อมูลล่วงหน้า',
    href: '/edi',
    icon: <FileText size={20} />,
    roles: ['yard_manager', 'supervisor', 'gate_clerk', 'billing_officer'],
  },
  {
    label: 'ซ่อมบำรุง M&R',
    href: '/mnr',
    icon: <Wrench size={20} />,
    roles: ['yard_manager', 'supervisor', 'billing_officer', 'surveyor', 'customer'],
  },
  {
    label: 'บัญชี & การเงิน',
    href: '/billing',
    icon: <Receipt size={20} />,
    roles: ['yard_manager', 'supervisor', 'billing_officer'],
  },
  {
    label: 'รายงาน',
    href: '/reports',
    icon: <BarChart3 size={20} />,
    roles: ['yard_manager', 'supervisor', 'billing_officer', 'surveyor', 'yard_planner'],
  },
  {
    label: 'ตั้งค่าระบบ',
    href: '/settings',
    icon: <Settings size={20} />,
    roles: ['yard_manager'],
  },
  {
    label: 'ประวัติการใช้งาน',
    href: '/audit-trail',
    icon: <ClipboardList size={20} />,
    roles: ['yard_manager', 'supervisor'],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const userRole = session?.role;

  const filteredMenu = menuItems.filter(
    (item) => userRole && item.roles.includes(userRole)
  );

  return (
    <aside
      className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[72px]' : 'w-[260px]'}
      `}
      style={{ backgroundColor: '#1E293B' }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-[#3B82F6] flex items-center justify-center flex-shrink-0">
            <Container size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="transition-opacity duration-200">
              <h1 className="text-white font-bold text-lg leading-tight">CYMS</h1>
              <p className="text-slate-400 text-[10px] leading-tight">Container Yard Management</p>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {filteredMenu.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                ${isActive
                  ? 'bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              data-tooltip={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="border-t border-white/10 p-2 space-y-1">
        {/* User Info */}
        {!collapsed && session && (
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{session.fullName}</p>
            <p className="text-slate-400 text-xs truncate">
              {session.role === 'yard_manager' ? 'ผู้จัดการลาน' :
               session.role === 'supervisor' ? 'Supervisor / ผู้อนุมัติ' :
               session.role === 'gate_clerk' ? 'พนักงานประตู' :
               session.role === 'surveyor' ? 'พนักงานสำรวจ' :
               session.role === 'yard_planner' ? 'ผู้วางแผนลาน' :
               session.role === 'rs_driver' ? 'คนขับรถยก' :
               session.role === 'billing_officer' ? 'พนักงานบัญชี' :
               'ลูกค้า'}
            </p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200
            ${collapsed ? 'justify-center' : ''}
          `}
          data-tooltip={collapsed ? 'ออกจากระบบ' : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm font-medium">ออกจากระบบ</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-2 text-slate-500 hover:text-white transition-colors duration-200"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
