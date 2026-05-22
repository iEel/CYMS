'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';

interface NotificationItem {
  id: string;
  source: string;
  type: string;
  title: string;
  detail: string;
  time: string;
  href?: string;
  unread?: boolean;
}

type SourceFilter = 'all' | 'gate' | 'work_order';

export default function NotificationCenterPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        yard_id: String(session?.activeYardId || 1),
        limit: '100',
        source: sourceFilter,
      });
      const res = await fetch(`/api/notifications?${params.toString()}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setSourceCounts(data.source_counts || {});
    } catch {
      toast('error', 'โหลด Notification Center ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [session?.activeYardId, sourceFilter, toast]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter(item => !unreadOnly || item.unread);
  }, [notifications, unreadOnly]);

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session?.userId }),
      });
      const data = await res.json();
      if (data.success) {
        toast('success', 'อ่านทั้งหมดแล้ว');
        fetchNotifications();
      } else {
        toast('error', data.error || 'อัปเดตสถานะอ่านไม่สำเร็จ');
      }
    } catch {
      toast('error', 'อัปเดตสถานะอ่านไม่สำเร็จ');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
            <Bell size={22} className="text-blue-600" /> Notification Center
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">รวมกิจกรรม Gate และ Work Order พร้อม deep link ไปจัดการต่อ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetchNotifications} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </button>
          <button onClick={markAllRead} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">
            <CheckCircle2 size={14} /> อ่านทั้งหมดแล้ว
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Unread" value={unreadCount} />
        <Metric label="Gate" value={sourceCounts.gate || 0} />
        <Metric label="Work Orders" value={sourceCounts.work_order || 0} />
        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Unread only
          <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: 'all' as const, label: 'ทั้งหมด' },
          { id: 'gate' as const, label: 'Gate' },
          { id: 'work_order' as const, label: 'Work Order' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setSourceFilter(item.id)}
            className={`h-9 rounded-lg px-3 text-xs font-semibold ${
              sourceFilter === item.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></div>
        ) : visibleNotifications.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">ไม่มีการแจ้งเตือนในเงื่อนไขนี้</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {visibleNotifications.map(item => (
              <Link
                key={item.id}
                href={item.href || '#'}
                className={`grid gap-2 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 md:grid-cols-[1fr_auto] ${item.unread ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.unread && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    <p className="font-semibold text-slate-800 dark:text-white">{item.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{item.source}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                </div>
                <p className="text-xs font-semibold text-slate-400">{formatDateTime(item.time)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">{Number(value || 0).toLocaleString()}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
