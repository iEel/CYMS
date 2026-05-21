'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CloudOff,
  Loader2,
  RefreshCcw,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import {
  clearSynced,
  listQueuedRequests,
  remove,
  retryQueuedRequest,
  type QueuedRequest,
} from '@/lib/offlineQueue';
import { useToast } from '@/components/providers/ToastProvider';

type OutboxFilter = 'all' | 'queued' | 'conflict' | 'synced';

const statusMeta: Record<NonNullable<QueuedRequest['status']>, {
  label: string;
  tone: string;
  icon: ReactNode;
}> = {
  queued: {
    label: 'รอซิงค์',
    tone: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: <Clock3 size={13} />,
  },
  conflict: {
    label: 'ต้องตรวจ',
    tone: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <AlertTriangle size={13} />,
  },
  synced: {
    label: 'ซิงค์แล้ว',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: <CheckCircle2 size={13} />,
  },
};

function itemStatus(item: QueuedRequest): NonNullable<QueuedRequest['status']> {
  return item.status || 'queued';
}

function formatQueuedAt(timestamp: number) {
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatOperation(item: QueuedRequest) {
  return item.operation?.replace(/_/g, ' ') || item.url.split('?')[0];
}

export default function OfflineOutbox() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<OutboxFilter>('all');
  const [items, setItems] = useState<QueuedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [clearing, setClearing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listQueuedRequests());
    } catch (error) {
      console.error(error);
      toast('error', 'โหลด Offline Outbox ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadItems();
    const refresh = () => loadItems();
    window.addEventListener('cyms:queued', refresh);
    window.addEventListener('cyms:sync', refresh);
    window.addEventListener('cyms:offline-queue-changed', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.removeEventListener('cyms:queued', refresh);
      window.removeEventListener('cyms:sync', refresh);
      window.removeEventListener('cyms:offline-queue-changed', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [loadItems]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[itemStatus(item)] += 1;
        return acc;
      },
      { queued: 0, conflict: 0, synced: 0 }
    );
  }, [items]);

  const visibleItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(item => itemStatus(item) === filter);
  }, [filter, items]);

  const activeCount = counts.queued + counts.conflict;
  const badgeTone = counts.conflict > 0 ? 'bg-amber-500' : 'bg-blue-500';

  const setItemBusy = (id: number, busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleRetry = async (item: QueuedRequest) => {
    if (!item.id) return;
    setItemBusy(item.id, true);
    try {
      const result = await retryQueuedRequest(item.id);
      if (result.status === 'synced') {
        toast('success', 'ซิงค์รายการสำเร็จ', formatOperation(item));
      } else if (result.status === 'conflict') {
        toast('warning', 'รายการนี้มี conflict', formatOperation(item));
      } else {
        toast('error', 'ยังซิงค์ไม่สำเร็จ', result.error || formatOperation(item));
      }
      await loadItems();
    } finally {
      setItemBusy(item.id, false);
    }
  };

  const handleRemove = async (item: QueuedRequest) => {
    if (!item.id) return;
    await remove(item.id);
    toast('info', 'ลบรายการออกจาก outbox แล้ว', formatOperation(item));
    await loadItems();
  };

  const handleClearSynced = async () => {
    setClearing(true);
    try {
      const count = await clearSynced();
      toast('success', 'ล้างรายการที่ซิงค์แล้ว', `${count} รายการ`);
      await loadItems();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Offline Outbox"
        aria-label="เปิด Offline Outbox"
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
          activeCount > 0
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        {activeCount > 0 ? <CloudOff size={18} /> : <Wifi size={18} />}
        {activeCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full ${badgeTone} text-white text-[10px] font-bold flex items-center justify-center px-1`}>
            {Math.min(activeCount, 99)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[min(420px,calc(100vw-2rem))] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <CloudOff size={15} /> Offline Outbox
              </h3>
              <p className="text-[10px] text-slate-400 truncate">{counts.queued} queued · {counts.conflict} conflict · {counts.synced} synced</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadItems}
                disabled={loading}
                aria-label="รีเฟรช outbox"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="ปิด outbox"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-1 overflow-x-auto">
            {(['all', 'queued', 'conflict', 'synced'] as OutboxFilter[]).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === option
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {option === 'all' ? 'ทั้งหมด' : statusMeta[option].label}
              </button>
            ))}
            <button
              onClick={handleClearSynced}
              disabled={counts.synced === 0 || clearing}
              className="ml-auto h-8 px-3 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {clearing ? 'กำลังล้าง' : 'Clear synced'}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/70">
            {loading && items.length === 0 ? (
              <div className="p-5 flex items-center justify-center gap-2 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin" /> กำลังโหลด
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">ไม่มีรายการในสถานะนี้</div>
            ) : (
              visibleItems.map((item) => {
                const status = itemStatus(item);
                const meta = statusMeta[status];
                const busy = item.id ? busyIds.has(item.id) : false;
                return (
                  <div key={item.id || `${item.url}-${item.timestamp}`} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${meta.tone}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{formatOperation(item)}</p>
                        <p className="text-[11px] text-slate-400 truncate">{item.method} {item.url}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                          <span>{formatQueuedAt(item.timestamp)}</span>
                          <span>retry {item.retries || 0}</span>
                          {item.lastHttpStatus ? <span>HTTP {item.lastHttpStatus}</span> : null}
                        </div>
                        {(item.conflictReason || item.lastError) && (
                          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-300 truncate">{item.conflictReason || item.lastError}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {status !== 'synced' && (
                          <button
                            onClick={() => handleRetry(item)}
                            disabled={busy}
                            aria-label="ลองซิงค์อีกครั้ง"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(item)}
                          aria-label="ลบรายการ"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
