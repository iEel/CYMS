'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import OfflineOutbox from '@/components/offline/OfflineOutbox';
import {
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  MapPin,
  User,
  X,
  SunDim,
  Loader2,
  Package,
  Truck,
  Receipt,
  ClipboardList,
} from 'lucide-react';
import { initOfflineSync } from '@/lib/offlineQueue';

interface YardOption {
  yard_id: number;
  yard_name: string;
  yard_code: string;
  is_active?: boolean;
}

interface SearchResult {
  id: string;
  kind: 'container' | 'gate' | 'invoice' | 'booking';
  title: string;
  subtitle: string;
  meta?: string;
  status?: string;
  href: string;
}

export default function Topbar() {
  const { session, switchYard } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [yardDropdownOpen, setYardDropdownOpen] = useState(false);
  const [yards, setYards] = useState<YardOption[]>([]);
  const [yardsLoading, setYardsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const yardRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Notifications
  interface NotifItem { id: string; source: string; type: string; title: string; detail: string; time: string; }
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [lastReadTime, setLastReadTime] = useState<string>('');
  const [now, setNow] = useState<number>(0);

  const getRelativeTime = (iso: string) => {
    const diff = (now || new Date(iso).getTime()) - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr`;
    return `${Math.floor(hrs / 24)} d`;
  };

  // Dark mode toggle
  useEffect(() => {
    const saved = localStorage.getItem('cyms_dark_mode');
    const savedHC = localStorage.getItem('cyms_high_contrast');
    if (saved === 'true') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    if (savedHC === 'true') {
      setIsHighContrast(true);
      document.documentElement.classList.add('high-contrast');
    }
    // NFR1 — Initialize offline sync
    initOfflineSync();
  }, []);

  useEffect(() => {
    const onQueued = (event: Event) => {
      const detail = (event as CustomEvent<{ operation?: string }>).detail;
      toast('info', 'บันทึกเข้าคิวออฟไลน์', detail?.operation || 'ระบบจะซิงค์เมื่อออนไลน์');
    };
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ success: number; failed: number; conflict: number }>).detail;
      if (detail?.conflict > 0) {
        toast('warning', 'ซิงค์บางรายการมี conflict', `สำเร็จ ${detail.success} / conflict ${detail.conflict}`);
      } else if (detail?.success > 0) {
        toast('success', 'ซิงค์งานออฟไลน์แล้ว', `${detail.success} รายการ`);
      }
    };
    window.addEventListener('cyms:queued', onQueued);
    window.addEventListener('cyms:sync', onSync);
    return () => {
      window.removeEventListener('cyms:queued', onQueued);
      window.removeEventListener('cyms:sync', onSync);
    };
  }, [toast]);

  useEffect(() => {
    if (!session?.userId) return;
    let cancelled = false;

    async function fetchYards() {
      setYardsLoading(true);
      try {
        const res = await fetch('/api/settings/yards');
        const data = await res.json();
        if (!cancelled) {
          setYards(Array.isArray(data) ? data.filter((yard: YardOption) => yard.is_active !== false) : []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setYards([]);
      } finally {
        if (!cancelled) setYardsLoading(false);
      }
    }

    fetchYards();
    return () => { cancelled = true; };
  }, [session?.userId]);

  // Fetch notifications (รวม last_read_at จาก DB ด้วย)
  const fetchNotifications = useCallback(async () => {
    try {
      const yid = session?.activeYardId || 1;
      const uid = session?.userId;
      const res = await fetch(`/api/notifications?yard_id=${yid}&limit=20${uid ? `&user_id=${uid}` : ''}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      // อัปเดต lastReadTime จาก DB (ซิงค์ข้าม browser ได้)
      if (data.last_read_at !== undefined) {
        setLastReadTime(data.last_read_at || '');
      }
    } catch (err) { console.error(err); }
  }, [session?.activeYardId, session?.userId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleDarkMode = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    localStorage.setItem('cyms_dark_mode', String(newVal));
    if (newVal) {
      document.documentElement.classList.add('dark');
      // Turn off high contrast when entering dark mode
      setIsHighContrast(false);
      localStorage.setItem('cyms_high_contrast', 'false');
      document.documentElement.classList.remove('high-contrast');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleHighContrast = () => {
    const newVal = !isHighContrast;
    setIsHighContrast(newVal);
    localStorage.setItem('cyms_high_contrast', String(newVal));
    if (newVal) {
      document.documentElement.classList.add('high-contrast');
      // Turn off dark mode when entering high contrast
      setIsDark(false);
      localStorage.setItem('cyms_dark_mode', 'false');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  };

  // Global API search with debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setShowSearch(false);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setShowSearch(true);
      try {
        const params = new URLSearchParams({ q: trimmed, limit: '12' });
        if (session?.activeYardId) params.set('yard_id', String(session.activeYardId));
        const res = await fetch(`/api/search?${params.toString()}`);
        const data = await res.json();
        if (!cancelled) {
          setSearchResults(Array.isArray(data.results) ? data.results : []);
          setShowSearch(true);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setSearchResults([]);
          setShowSearch(true);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, session?.activeYardId]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
      if (yardRef.current && !yardRef.current.contains(e.target as Node)) {
        setYardDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const accessibleYards = useMemo(() => {
    const allowed = session?.yardIds || [];
    return yards.filter(yard => allowed.length === 0 || allowed.includes(yard.yard_id));
  }, [yards, session?.yardIds]);

  const activeYard = accessibleYards.find(y => y.yard_id === session?.activeYardId)
    || (session?.activeYardId ? yards.find(y => y.yard_id === session.activeYardId) : undefined);

  useEffect(() => {
    if (!session || accessibleYards.length === 0) return;
    if (!accessibleYards.some(yard => yard.yard_id === session.activeYardId)) {
      switchYard(accessibleYards[0].yard_id);
    }
  }, [accessibleYards, session, switchYard]);

  const statusLabel: Record<string, { text: string; color: string }> = {
    in_yard: { text: 'ในลาน', color: 'bg-emerald-100 text-emerald-700' },
    gated_out: { text: 'ออกแล้ว', color: 'bg-slate-100 text-slate-500' },
    released: { text: 'ออกแล้ว', color: 'bg-slate-100 text-slate-500' },
    available: { text: 'ว่าง', color: 'bg-blue-100 text-blue-700' },
    hold: { text: 'Hold', color: 'bg-amber-100 text-amber-700' },
    damaged: { text: 'ชำรุด', color: 'bg-rose-100 text-rose-600' },
    reserved: { text: 'จอง', color: 'bg-amber-100 text-amber-700' },
    gate_in: { text: 'Gate-In', color: 'bg-emerald-100 text-emerald-700' },
    gate_out: { text: 'Gate-Out', color: 'bg-blue-100 text-blue-700' },
    draft: { text: 'ร่าง', color: 'bg-slate-100 text-slate-500' },
    issued: { text: 'แจ้งหนี้', color: 'bg-blue-100 text-blue-700' },
    paid: { text: 'ชำระแล้ว', color: 'bg-emerald-100 text-emerald-700' },
    overdue: { text: 'เกินกำหนด', color: 'bg-rose-100 text-rose-600' },
    cancelled: { text: 'ยกเลิก', color: 'bg-slate-100 text-slate-500' },
    pending: { text: 'รอยืนยัน', color: 'bg-amber-100 text-amber-700' },
    confirmed: { text: 'ยืนยันแล้ว', color: 'bg-blue-100 text-blue-700' },
    completed: { text: 'เสร็จ', color: 'bg-emerald-100 text-emerald-700' },
  };

  const getResultKind = (kind: SearchResult['kind']) => {
    switch (kind) {
      case 'container':
        return { label: 'ตู้', icon: <Package size={14} />, box: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300' };
      case 'gate':
        return { label: 'Gate', icon: <Truck size={14} />, box: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300' };
      case 'invoice':
        return { label: 'บิล', icon: <Receipt size={14} />, box: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300' };
      case 'booking':
        return { label: 'Booking', icon: <ClipboardList size={14} />, box: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300' };
      default:
        return { label: 'ผลลัพธ์', icon: <Search size={14} />, box: 'bg-slate-100 dark:bg-slate-700 text-slate-500' };
    }
  };

  const openFirstSearchResult = () => {
    const first = searchResults[0];
    if (!first) return;
    setShowSearch(false);
    setSearchQuery('');
    router.push(first.href);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-4">
      {/* Global Search */}
      <div ref={searchRef} className="flex-1 max-w-xl mx-auto relative">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขตู้, EIR, ใบแจ้งหนี้, Booking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchQuery.trim().length >= 2) setShowSearch(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowSearch(false);
              if (e.key === 'Enter') openFirstSearchResult();
            }}
            className="w-full h-10 pl-10 pr-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm
              text-slate-700 dark:text-slate-200 placeholder:text-slate-400
              border border-transparent focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20
              outline-none transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowSearch(false); }}
              aria-label="ล้างคำค้นหา"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearch && searchQuery.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50 max-h-80 overflow-y-auto">
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 font-medium">
                {isSearching ? 'กำลังค้นหา...' : `พบ ${searchResults.length} ผลลัพธ์`}
              </p>
              {isSearching && <Loader2 size={12} className="animate-spin text-blue-500" />}
            </div>
            {isSearching && searchResults.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-400">กำลังค้นหาข้อมูลในระบบ...</div>
            )}
            {!isSearching && searchResults.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-400">
                ไม่พบผลลัพธ์สำหรับ &quot;{searchQuery.trim()}&quot;
              </div>
            )}
            {searchResults.map((result) => {
              const st = statusLabel[result.status || ''] || { text: result.status || '-', color: 'bg-slate-100 text-slate-400' };
              const kind = getResultKind(result.kind);
              return (
                <Link
                  key={result.id}
                  href={result.href}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${kind.box}`}>
                    {kind.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-mono truncate">{result.title}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 shrink-0">{kind.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{result.subtitle}{result.meta ? ` • ${result.meta}` : ''}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${st.color}`}>{st.text}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <OfflineOutbox />

        {/* Yard Switcher */}
        <div ref={yardRef} className="relative">
          <button
            onClick={() => setYardDropdownOpen(!yardDropdownOpen)}
            aria-label="สลับลาน"
            className="flex items-center gap-2 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800
              text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700
              transition-all duration-200 border border-transparent"
          >
            <MapPin size={16} className="text-[#3B82F6]" />
            <span className="hidden sm:inline font-medium max-w-[180px] truncate">{activeYard?.yard_name || 'เลือกลาน'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${yardDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {yardDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 font-medium">สลับสาขาลาน</p>
              </div>
              {yardsLoading ? (
                <div className="px-4 py-5 flex items-center justify-center gap-2 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" /> กำลังโหลดลาน
                </div>
              ) : accessibleYards.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-400 text-center">ไม่มีลานที่เข้าถึงได้</div>
              ) : (
                accessibleYards.map((yard) => (
                  <button
                    key={yard.yard_id}
                    onClick={() => { switchYard(yard.yard_id); setYardDropdownOpen(false); }}
                    className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                      ${yard.yard_id === session?.activeYardId
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-[#3B82F6]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }
                    `}
                  >
                    <MapPin size={16} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{yard.yard_name}</p>
                      <p className="text-xs opacity-60 truncate">{yard.yard_code}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}
            aria-label="เปิดการแจ้งเตือน"
            className="relative w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center
              text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200"
          >
            <Bell size={18} />
            {notifications.filter(n => !lastReadTime || new Date(n.time) > new Date(lastReadTime)).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center px-1">
                {Math.min(notifications.filter(n => !lastReadTime || new Date(n.time) > new Date(lastReadTime)).length, 99)}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-white flex items-center gap-2">
                  <Bell size={14} /> การแจ้งเตือน
                </h3>
                <button onClick={async () => {
                  const uid = session?.userId;
                  if (!uid) return;
                  try {
                    const res = await fetch('/api/notifications', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: uid }),
                    });
                    const data = await res.json();
                    if (data.last_read_at) setLastReadTime(data.last_read_at);
                  } catch (err) { console.error(err); }
                }} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">
                  อ่านทั้งหมดแล้ว
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/50">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">ไม่มีการแจ้งเตือน</div>
                ) : (
                  notifications.map((n) => {
                    const isUnread = !lastReadTime || new Date(n.time) > new Date(lastReadTime);
                    const ago = getRelativeTime(n.time);
                    return (
                      <div key={n.id} className={`px-4 py-3 transition-colors ${
                        isUnread ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                            n.source === 'gate'
                              ? n.type === 'gate_in'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : 'bg-orange-100 dark:bg-orange-900/30'
                              : n.type === 'completed'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : n.type === 'pending'
                                  ? 'bg-blue-100 dark:bg-blue-900/30'
                                  : 'bg-slate-100 dark:bg-slate-700'
                          }`}>
                            {n.title.split(' ')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-tight ${
                              isUnread ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                            }`}>{n.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{n.detail}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">{ago}</span>
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

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          aria-label={isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center
            text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* High Contrast Toggle (NFR3b — สู้แสงแดด) */}
        <button
          onClick={toggleHighContrast}
          aria-label="สลับโหมดคอนทราสต์สูง"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
            isHighContrast
              ? 'bg-yellow-400 text-black ring-2 ring-yellow-500'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <SunDim size={18} />
        </button>

        {/* User Avatar */}
        <div className="w-10 h-10 rounded-xl bg-[#3B82F6] flex items-center justify-center text-white">
          <User size={18} />
        </div>
      </div>
    </header>
  );
}
