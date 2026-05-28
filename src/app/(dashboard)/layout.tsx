'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { installAuthFetchPatch } from '@/lib/authFetch';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    installAuthFetchPatch(window);
  }, []);

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login');
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">กำลังโหลดระบบ...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A]">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="ปิดเมนูหลัก"
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        data-layout="dashboard-shell"
        className={`min-w-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]'}`}
      >
        <Topbar onOpenMobileMenu={() => setMobileSidebarOpen(true)} />
        <main className="min-w-0 p-3 sm:p-4 lg:p-6 page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
