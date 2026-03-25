'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  LayoutDashboard, Package, FileText, ClipboardList, LogOut, Menu, X, Ship,
} from 'lucide-react';

// Global fetch interceptor — auto-attach JWT to API calls
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith('/api/') && !url.includes('/api/auth/login')) {
      const headers = new Headers(init?.headers);
      if (!headers.has('Authorization')) {
        try {
          const s = localStorage.getItem('cyms_session');
          if (s) {
            const session = JSON.parse(s);
            if (session?.token) headers.set('Authorization', `Bearer ${session.token}`);
          }
        } catch { /* */ }
      }
      const response = await originalFetch(input, { ...init, headers });
      if (response.status === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('cyms_session');
        window.location.href = '/login';
      }
      return response;
    }
    return originalFetch(input, init);
  };
}

const navItems = [
  { label: 'ภาพรวม', href: '/portal', icon: <LayoutDashboard size={18} /> },
  { label: 'ตู้คอนเทนเนอร์', href: '/portal/containers', icon: <Package size={18} /> },
  { label: 'ใบแจ้งหนี้', href: '/portal/invoices', icon: <FileText size={18} /> },
  { label: 'Booking', href: '/portal/bookings', icon: <ClipboardList size={18} /> },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) router.replace('/login');
    if (!isLoading && session && session.role !== 'customer') router.replace('/dashboard');
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!session || session.role !== 'customer') return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Ship size={20} className="text-blue-600" />
          <span className="font-semibold text-slate-800 dark:text-white text-sm">CYMS Portal</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[57px] z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur p-4 space-y-1">
          {navItems.map(item => (
            <button key={item.href} onClick={() => { router.push(item.href); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                pathname === item.href
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}>
              {item.icon} {item.label}
            </button>
          ))}
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 mt-4">
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </div>
      )}

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-white/80 dark:bg-slate-800/80 backdrop-blur border-r border-slate-200 dark:border-slate-700 p-4 fixed top-0 left-0 z-40">
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Ship size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 dark:text-white text-sm">CYMS Portal</h1>
              <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{session.fullName}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map(item => (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  pathname === item.href
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}>
                {item.icon} {item.label}
              </button>
            ))}
          </nav>

          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 mt-4 transition-all">
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-[240px] p-4 md:p-6 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
