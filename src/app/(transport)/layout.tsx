'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardList, LogOut, Menu, Route, Ship, X } from 'lucide-react';

import { useAuth } from '@/components/providers/AuthProvider';
import { installAuthFetchPatch } from '@/lib/authFetch';

const transportRoles = ['trucking_coordinator', 'driver_user'];

const navItems = [
  { label: 'งานขนส่ง', href: '/transport', icon: <ClipboardList size={18} /> },
];

export default function TransportLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    installAuthFetchPatch(window);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.role !== 'customer') {
      router.replace('/dashboard');
      return;
    }
    if (!transportRoles.includes(String(session.customerPortalRole))) {
      router.replace('/portal');
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (
    !session ||
    session.role !== 'customer' ||
    !transportRoles.includes(String(session.customerPortalRole))
  ) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Ship size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold">CYMS Transport</p>
            <p className="text-[11px] text-slate-500">{session.fullName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(value => !value)}
          className="rounded-lg border border-slate-200 p-2 text-slate-600"
          aria-label="เมนู"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-[65px] z-30 border-b border-slate-200 bg-white p-3 shadow-sm md:hidden">
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.href}
                type="button"
                onClick={() => { router.push(item.href); setMobileOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  pathname === item.href ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 hidden w-[236px] flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Route size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold">CYMS Transport</h1>
            <p className="max-w-[150px] truncate text-[11px] text-slate-500">{session.fullName}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                pathname === item.href ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut size={18} />
          ออกจากระบบ
        </button>
      </aside>

      <main className="min-h-screen p-4 md:ml-[236px] md:p-6">
        {children}
      </main>
    </div>
  );
}
