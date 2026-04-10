'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

// Global fetch interceptor — auto-attach JWT to API calls
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // [Fix] ข้าม /api/auth/ ทั้งหมด — ไม่ใส่ token, ไม่ auto-logout
    // เพราะ auth routes จัดการ auth เอง (อ่าน cookie โดยตรง)
    if (url.startsWith('/api/') && !url.startsWith('/api/auth/')) {
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
      // Auto-logout on 401 — แต่เฉพาะเมื่อ session เคยถูก set แล้ว
      // (ป้องกัน race condition ตอน page กำลัง hydrate ยังไม่ได้ restore session)
      if (response.status === 401 && !window.location.pathname.includes('/login')) {
        const hasExistingSession = localStorage.getItem('cyms_session');
        if (hasExistingSession) {
          localStorage.removeItem('cyms_session');
          window.location.href = '/login';
        }
      }
      return response;
    }
    return originalFetch(input, init);
  };
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? '72px' : '260px' }}
      >
        <Topbar />
        <main className="p-6 page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}
