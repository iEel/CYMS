'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Settings,
  Thermometer,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import ActionInputDialog from '@/components/ui/ActionInputDialog';
import PhotoCapture from '@/components/gate/PhotoCapture';
import { isOfflineQueuedResponse, offlineFetch } from '@/lib/offlineQueue';

interface ReeferPolicy {
  policy_id?: number | null;
  scope_type: string;
  yard_id?: number | null;
  customer_id?: number | null;
  booking_id?: number | null;
  container_id?: number | null;
  interval_hours: number;
  warning_grace_minutes: number;
  min_temp_c?: number | null;
  max_temp_c?: number | null;
}

interface ReeferItem {
  container_id: number;
  container_number: string;
  size?: string;
  type?: string;
  shipping_line?: string;
  container_status?: string;
  is_laden?: boolean;
  zone_name?: string;
  bay?: number | null;
  row?: number | null;
  tier?: number | null;
  booking_id?: number | null;
  booking_number?: string | null;
  customer_id?: number | null;
  latest_measured_temp_c?: number | null;
  latest_set_point_c?: number | null;
  latest_check_status?: string | null;
  latest_checked_at?: string | null;
  latest_photo_url?: string | null;
  latest_notes?: string | null;
  active_exception_id?: number | null;
  active_exception_severity?: string | null;
  active_exception_status?: string | null;
  active_exception_reason?: string | null;
  active_exception_action?: string | null;
  active_exception_created_at?: string | null;
  escalation_level?: 'none' | 'supervisor' | 'critical';
  escalation_breached?: boolean;
  escalation_due_minutes?: number | null;
  escalation_age_minutes?: number | null;
  escalation_label?: string | null;
  escalation_action?: string | null;
  due_status: 'not_checked' | 'ok' | 'due' | 'overdue';
  policy: ReeferPolicy;
}

interface ReeferCheckHistory {
  check_id: number;
  container_id: number;
  booking_id?: number | null;
  measured_temp_c?: number | null;
  set_point_c?: number | null;
  supply_temp_c?: number | null;
  return_temp_c?: number | null;
  status: string;
  photo_url?: string | null;
  notes?: string | null;
  checked_by_user_id?: number | null;
  checked_by_name?: string | null;
  checked_at?: string | null;
  exception_id?: number | null;
  exception_severity?: string | null;
  exception_status?: string | null;
  exception_reason?: string | null;
  exception_action?: string | null;
}

interface PlugPlanSummary {
  reefer_zones: number;
  plug_capacity: number;
  current_rf: number;
  current_in_reefer_zone: number;
  current_unplugged_risk: number;
  upcoming_rf: number;
  projected_required_plugs: number;
  projected_shortage: number;
  utilization_percent: number;
}

interface PlugPlanBooking {
  booking_id: number;
  booking_number: string;
  status: string;
  customer_name?: string | null;
  container_count: number;
  eta?: string | null;
  valid_from?: string | null;
  policy_id?: number | null;
  interval_hours?: number | null;
}

interface PlugPlanData {
  summary: PlugPlanSummary;
  upcomingBookings: PlugPlanBooking[];
  byDay: Array<{ plan_date: string; expected_rf: number }>;
  generatedAt: string;
}

interface CheckForm {
  measured_temp_c: string;
  set_point_c: string;
  supply_temp_c: string;
  return_temp_c: string;
  status: string;
  photo_url: string;
  notes: string;
}

interface PolicyForm {
  policy_id: string;
  scope_type: string;
  customer_id: string;
  booking_id: string;
  container_id: string;
  interval_hours: string;
  warning_grace_minutes: string;
  min_temp_c: string;
  max_temp_c: string;
}

const initialCheckForm: CheckForm = {
  measured_temp_c: '',
  set_point_c: '',
  supply_temp_c: '',
  return_temp_c: '',
  status: 'normal',
  photo_url: '',
  notes: '',
};

const initialPolicyForm: PolicyForm = {
  policy_id: '',
  scope_type: 'yard',
  customer_id: '',
  booking_id: '',
  container_id: '',
  interval_hours: '4',
  warning_grace_minutes: '30',
  min_temp_c: '',
  max_temp_c: '',
};

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

export default function ReeferMonitoringPage() {
  const { session, hasPermission, hasAnyPermission } = useAuth();
  const activeYardId = session?.activeYardId || session?.yardIds?.[0];
  const canRecord = hasAnyPermission(['reefer.check.record']);
  const canManagePolicy = hasPermission('reefer.policy.manage');
  const canManageException = hasPermission('reefer.exception.manage');
  const [items, setItems] = useState<ReeferItem[]>([]);
  const [policies, setPolicies] = useState<ReeferPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [plugPlan, setPlugPlan] = useState<PlugPlanData | null>(null);
  const [plugPlanLoading, setPlugPlanLoading] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [tab, setTab] = useState<'queue' | 'policy'>('queue');
  const [selected, setSelected] = useState<ReeferItem | null>(null);
  const [historySelected, setHistorySelected] = useState<ReeferItem | null>(null);
  const [history, setHistory] = useState<ReeferCheckHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [checkForm, setCheckForm] = useState<CheckForm>(initialCheckForm);
  const [savingCheck, setSavingCheck] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState<'due' | 'exception' | 'all'>('due');
  const [queuedNotice, setQueuedNotice] = useState('');
  const [policyForm, setPolicyForm] = useState<PolicyForm>(initialPolicyForm);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState('');
  const [exceptionActionDialog, setExceptionActionDialog] = useState<{ item: ReeferItem; action: 'resolve' | 'ignore' } | null>(null);

  const loadQueue = useCallback(async () => {
    if (!activeYardId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reefer/checks?yard_id=${activeYardId}`);
      const data = await res.json();
      setItems(data.items || []);
      if (Array.isArray(data.policies)) setPolicies(data.policies);
    } finally {
      setLoading(false);
    }
  }, [activeYardId]);

  const loadPolicies = useCallback(async () => {
    if (!activeYardId || !canManagePolicy) return;
    setPolicyLoading(true);
    try {
      const res = await fetch(`/api/reefer/policies?yard_id=${activeYardId}`);
      const data = await res.json();
      if (Array.isArray(data.policies)) setPolicies(data.policies);
    } finally {
      setPolicyLoading(false);
    }
  }, [activeYardId, canManagePolicy]);

  const loadPlugPlan = useCallback(async () => {
    if (!activeYardId) return;
    setPlugPlanLoading(true);
    try {
      const res = await fetch(`/api/reefer/plug-plan?yard_id=${activeYardId}`);
      const data = await res.json();
      if (!data.error) setPlugPlan(data);
    } finally {
      setPlugPlanLoading(false);
    }
  }, [activeYardId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  useEffect(() => {
    loadPlugPlan();
  }, [loadPlugPlan]);

  const stats = useMemo(() => ({
    total: items.length,
    overdue: items.filter(item => item.due_status === 'overdue').length,
    due: items.filter(item => item.due_status === 'due' || item.due_status === 'not_checked').length,
    outOfRange: items.filter(item => item.latest_check_status === 'out_of_range').length,
    exceptions: items.filter(item => item.active_exception_id).length,
  }), [items]);

  const visibleItems = useMemo(() => {
    const term = quickSearch.trim().toUpperCase();
    return items.filter(item => {
      const text = [
        item.container_number,
        item.booking_number,
        item.shipping_line,
        item.zone_name,
        formatYardPosition(item),
      ].filter(Boolean).join(' ').toUpperCase();
      const matchesSearch = !term || text.includes(term);
      const matchesFilter = queueFilter === 'all'
        || (queueFilter === 'due' && ['not_checked', 'due', 'overdue'].includes(item.due_status))
        || (queueFilter === 'exception' && Boolean(item.active_exception_id));
      return matchesSearch && matchesFilter;
    });
  }, [items, quickSearch, queueFilter]);

  const historyStats = useMemo(() => ({
    total: history.length,
    abnormal: history.filter(check => check.status && check.status !== 'normal').length,
    withPhoto: history.filter(check => Boolean(check.photo_url)).length,
    latest: history[0],
  }), [history]);

  const openRecord = (item: ReeferItem) => {
    setSelected(item);
    setCheckError('');
    setQueuedNotice('');
    setCheckForm({
      measured_temp_c: item.latest_measured_temp_c != null ? String(item.latest_measured_temp_c) : '',
      set_point_c: item.latest_set_point_c != null ? String(item.latest_set_point_c) : '',
      supply_temp_c: '',
      return_temp_c: '',
      status: 'normal',
      photo_url: '',
      notes: '',
    });
  };

  const openHistory = async (item: ReeferItem) => {
    if (!activeYardId) return;
    setHistorySelected(item);
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/reefer/checks?yard_id=${activeYardId}&container_id=${item.container_id}&limit=1`);
      const data = await res.json();
      if (!res.ok) {
        setHistoryError(data.error || 'โหลดประวัติการตรวจไม่สำเร็จ');
        return;
      }
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch {
      setHistoryError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setHistoryLoading(false);
    }
  };

  const submitCheck = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !activeYardId) return;
    const checkedContainer = selected;
    setSavingCheck(true);
    setCheckError('');
    setQueuedNotice('');
    try {
      const res = await offlineFetch('/api/reefer/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...checkForm,
          yard_id: activeYardId,
          container_id: selected.container_id,
          measured_temp_c: checkForm.measured_temp_c === '' ? null : Number(checkForm.measured_temp_c),
          set_point_c: checkForm.set_point_c === '' ? null : Number(checkForm.set_point_c),
          supply_temp_c: checkForm.supply_temp_c === '' ? null : Number(checkForm.supply_temp_c),
          return_temp_c: checkForm.return_temp_c === '' ? null : Number(checkForm.return_temp_c),
        }),
      }, {
        operation: 'reefer_check',
      });
      const data = await res.json();
      if (isOfflineQueuedResponse(data)) {
        setQueuedNotice(data.message || 'บันทึกเข้าคิวออฟไลน์แล้ว ระบบจะซิงค์เมื่อออนไลน์');
        setSelected(null);
        setCheckForm(initialCheckForm);
        return;
      }
      if (!res.ok || !data.success) {
        setCheckError(data.error || 'บันทึกอุณหภูมิไม่สำเร็จ');
        return;
      }
      setSelected(null);
      setCheckForm(initialCheckForm);
      loadQueue();
      if (historySelected?.container_id === checkedContainer.container_id) {
        openHistory(historySelected);
      }
    } catch {
      setCheckError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setSavingCheck(false);
    }
  };

  const submitPolicy = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeYardId) return;
    setSavingPolicy(true);
    setPolicyError('');
    try {
      const res = await fetch('/api/reefer/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_id: policyForm.policy_id ? Number(policyForm.policy_id) : null,
          scope_type: policyForm.scope_type,
          yard_id: activeYardId,
          customer_id: policyForm.customer_id ? Number(policyForm.customer_id) : null,
          booking_id: policyForm.booking_id ? Number(policyForm.booking_id) : null,
          container_id: policyForm.container_id ? Number(policyForm.container_id) : null,
          interval_hours: Number(policyForm.interval_hours),
          warning_grace_minutes: Number(policyForm.warning_grace_minutes || 30),
          min_temp_c: policyForm.min_temp_c === '' ? null : Number(policyForm.min_temp_c),
          max_temp_c: policyForm.max_temp_c === '' ? null : Number(policyForm.max_temp_c),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPolicyError(data.error || 'บันทึก policy ไม่สำเร็จ');
        return;
      }
      setPolicyForm(initialPolicyForm);
      loadPolicies();
      loadQueue();
    } catch {
      setPolicyError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setSavingPolicy(false);
    }
  };

  const patchException = async (item: ReeferItem, action: 'acknowledge' | 'resolve' | 'ignore', note = '') => {
    if (!item.active_exception_id) return;

    await fetch('/api/reefer/exceptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exception_id: item.active_exception_id,
        action,
        resolution_note: note,
      }),
    });
    setExceptionActionDialog(null);
    loadQueue();
  };

  const updateException = async (item: ReeferItem, action: 'acknowledge' | 'resolve' | 'ignore') => {
    if (action === 'acknowledge') {
      await patchException(item, action);
      return;
    }
    setExceptionActionDialog({ item, action });
  };

  if (!activeYardId) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">ยังไม่ได้เลือกสาขาลาน</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
            <Thermometer size={24} className="text-cyan-600" /> ตู้เย็น Reefer
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">คิวตรวจอุณหภูมิ, รูปหลักฐานหน้าจอ, และ policy รอบตรวจที่กำหนดได้เอง</p>
        </div>
        <button
          onClick={() => { loadQueue(); loadPlugPlan(); }}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <RefreshCw size={16} className={loading || plugPlanLoading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="RF ทั้งหมด" value={stats.total} tone="cyan" />
        <Metric label="เกินกำหนด" value={stats.overdue} tone="rose" />
        <Metric label="ถึงรอบตรวจ" value={stats.due} tone="amber" />
        <Metric label="นอกช่วงอุณหภูมิ" value={stats.outOfRange} tone="red" />
        <Metric label="Exception เปิด" value={stats.exceptions} tone="rose" />
      </div>

      {plugPlan?.summary && (
        <div className={`rounded-xl border p-4 ${
          plugPlan.summary.projected_shortage > 0
            ? 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20'
            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                <Thermometer size={17} className="text-cyan-600" /> Plug Planning
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Capacity โซนมีปลั๊กเทียบกับตู้ RF ในลานและ Booking RF ที่กำลังจะเข้า
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              plugPlan.summary.projected_shortage > 0
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}>
              Shortage {plugPlan.summary.projected_shortage.toLocaleString()} plugs
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <PlugMetric label="Plug capacity" value={plugPlan.summary.plug_capacity} />
            <PlugMetric label="RF ในลาน" value={plugPlan.summary.current_rf} />
            <PlugMetric label="Upcoming RF" value={plugPlan.summary.upcoming_rf} />
            <PlugMetric label="Projected" value={plugPlan.summary.projected_required_plugs} />
            <PlugMetric label="Utilization" value={`${plugPlan.summary.utilization_percent}%`} />
          </div>
          {plugPlan.summary.current_unplugged_risk > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
              มีตู้ RF {plugPlan.summary.current_unplugged_risk.toLocaleString()} ตู้ที่ไม่ได้อยู่ในโซนมีปลั๊ก ควรตรวจพิกัด/ย้ายเข้าพื้นที่ reefer
            </div>
          )}
          {plugPlan.upcomingBookings.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {plugPlan.upcomingBookings.slice(0, 6).map(booking => (
                <div key={booking.booking_id} className="rounded-lg border border-white/70 bg-white/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white">{booking.booking_number}</p>
                      <p className="mt-0.5 text-slate-500">{booking.customer_name || '-'} · {booking.status}</p>
                    </div>
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                      {Number(booking.container_count || 0).toLocaleString()} RF
                    </span>
                  </div>
                  <p className="mt-2 text-slate-500">
                    ETA {booking.eta ? formatDateTime(booking.eta) : booking.valid_from ? formatDateTime(booking.valid_from) : '-'}
                    {' · '}Policy {booking.policy_id ? `ทุก ${booking.interval_hours || 4} ชม.` : 'ยังไม่มี'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('queue')} className={tabClass(tab === 'queue')}>
          <Clock size={14} /> คิวตรวจ
        </button>
        {canManagePolicy && (
          <button onClick={() => setTab('policy')} className={tabClass(tab === 'policy')}>
            <Settings size={14} /> กำหนดรอบตรวจ
          </button>
        )}
      </div>

      {queuedNotice && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm font-medium text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-900/20 dark:text-cyan-200">
          {queuedNotice}
        </div>
      )}

      {tab === 'queue' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                  <Thermometer size={17} className="text-cyan-600" /> โหมดเดินตรวจ
                </h2>
                <p className="mt-1 text-xs text-slate-400">สแกนหรือค้นเลขตู้แล้วบันทึกอุณหภูมิได้ทันที ถ้าออฟไลน์ระบบจะเก็บเข้าคิวซิงค์</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                แสดง {visibleItems.length.toLocaleString()} / {items.length.toLocaleString()}
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={quickSearch}
                  onChange={event => setQuickSearch(event.target.value)}
                  placeholder="สแกน/ค้นเลขตู้, Booking, สายเรือ หรือโซน"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <div className="grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
                <button onClick={() => setQueueFilter('due')} className={filterClass(queueFilter === 'due')}>ต้องตรวจ</button>
                <button onClick={() => setQueueFilter('exception')} className={filterClass(queueFilter === 'exception')}>Exception</button>
                <button onClick={() => setQueueFilter('all')} className={filterClass(queueFilter === 'all')}>ทั้งหมด</button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">ยังไม่มีตู้ RF ในลานนี้</p>
          ) : visibleItems.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">ไม่พบตู้ตามเงื่อนไขที่ค้นหา</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {visibleItems.map(item => (
                <div key={item.container_id} className="grid gap-3 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold text-slate-800 dark:text-white">{item.container_number}</p>
                      <DueBadge status={item.due_status} />
                      {item.latest_check_status === 'out_of_range' && <StatusBadge status="out_of_range" />}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {[item.size ? `${item.size}'` : '', item.type, item.shipping_line, item.zone_name].filter(Boolean).join(' · ') || '-'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                      ตำแหน่งปัจจุบัน: {formatYardPosition(item)}
                    </p>
                    {item.booking_number && <p className="mt-1 text-[11px] text-blue-600">Booking {item.booking_number}</p>}
                  </div>
                  <div className="text-xs text-slate-500">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      ล่าสุด {formatTemp(item.latest_measured_temp_c)}
                    </p>
                    <p>{item.latest_checked_at ? formatDateTime(item.latest_checked_at) : 'ยังไม่เคยตรวจ'}</p>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p>รอบทุก {item.policy?.interval_hours || 4} ชม.</p>
                    <p>ช่วง {formatRange(item.policy)}</p>
                        {item.active_exception_id && (
                          <div className="mt-2 rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                            <p className="font-semibold">Exception {item.active_exception_severity || 'high'}</p>
                            <p>{item.active_exception_action || 'ต้องตรวจสอบและปิดงาน'}</p>
                            {item.escalation_breached && (
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
                                Escalation: {item.escalation_label || item.escalation_level} · {item.escalation_age_minutes} นาที
                              </p>
                            )}
                          </div>
                        )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => openHistory(item)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <History size={14} /> ประวัติ
                    </button>
                    <button
                      onClick={() => openRecord(item)}
                      disabled={!canRecord}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Thermometer size={14} /> บันทึกอุณหภูมิ
                    </button>
                    {item.active_exception_id && canManageException && (
                      <div className="flex flex-wrap gap-1">
                        {item.active_exception_status === 'open' && (
                          <button onClick={() => updateException(item, 'acknowledge')} className="h-8 rounded-lg bg-amber-100 px-2 text-[11px] font-semibold text-amber-700 hover:bg-amber-200">
                            รับทราบ
                          </button>
                        )}
                        <button onClick={() => updateException(item, 'resolve')} className="h-8 rounded-lg bg-emerald-100 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-200">
                          ปิดงาน
                        </button>
                        <button onClick={() => updateException(item, 'ignore')} className="h-8 rounded-lg bg-slate-100 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">
                          Ignore
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={submitPolicy} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
              <Settings size={16} className="text-cyan-600" /> กำหนดรอบตรวจ
            </h2>
            {policyError && <p className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{policyError}</p>}
            <div className="space-y-3">
              <Field label="ระดับ policy">
                <select value={policyForm.scope_type} onChange={e => setPolicyForm({ ...policyForm, scope_type: e.target.value })} className={inputClass}>
                  <option value="yard">ทั้งลาน</option>
                  <option value="customer">เฉพาะลูกค้า</option>
                  <option value="booking">เฉพาะ Booking</option>
                  <option value="container">เฉพาะตู้</option>
                </select>
              </Field>
              {policyForm.scope_type === 'customer' && <Field label="Customer ID"><input className={inputClass} value={policyForm.customer_id} onChange={e => setPolicyForm({ ...policyForm, customer_id: e.target.value })} /></Field>}
              {policyForm.scope_type === 'booking' && <Field label="Booking ID"><input className={inputClass} value={policyForm.booking_id} onChange={e => setPolicyForm({ ...policyForm, booking_id: e.target.value })} /></Field>}
              {policyForm.scope_type === 'container' && <Field label="Container ID"><input className={inputClass} value={policyForm.container_id} onChange={e => setPolicyForm({ ...policyForm, container_id: e.target.value })} /></Field>}
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="รอบตรวจ (ชั่วโมง)">
                  <input type="number" min="1" max="720" required className={inputClass} value={policyForm.interval_hours} onChange={e => setPolicyForm({ ...policyForm, interval_hours: e.target.value })} />
                </Field>
                <Field label="Grace (นาที)">
                  <input type="number" min="1" max="1440" required className={inputClass} value={policyForm.warning_grace_minutes} onChange={e => setPolicyForm({ ...policyForm, warning_grace_minutes: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Min °C">
                  <input type="number" step="0.1" className={inputClass} value={policyForm.min_temp_c} onChange={e => setPolicyForm({ ...policyForm, min_temp_c: e.target.value })} />
                </Field>
                <Field label="Max °C">
                  <input type="number" step="0.1" className={inputClass} value={policyForm.max_temp_c} onChange={e => setPolicyForm({ ...policyForm, max_temp_c: e.target.value })} />
                </Field>
              </div>
              <button disabled={savingPolicy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                {savingPolicy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} บันทึก Policy
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-white">Policy ที่ใช้งาน</h2>
            {policyLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            ) : policies.length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มี policy เฉพาะ ระบบจะใช้ค่า default ทุก 4 ชั่วโมง</p>
            ) : (
              <div className="space-y-2">
                {policies.map((policy, index) => (
                  <button
                    key={policy.policy_id || `${policy.scope_type}-${index}`}
                    onClick={() => setPolicyForm({
                      policy_id: policy.policy_id ? String(policy.policy_id) : '',
                      scope_type: policy.scope_type || 'yard',
                      customer_id: policy.customer_id ? String(policy.customer_id) : '',
                      booking_id: policy.booking_id ? String(policy.booking_id) : '',
                      container_id: policy.container_id ? String(policy.container_id) : '',
                      interval_hours: String(policy.interval_hours || 4),
                      warning_grace_minutes: String(policy.warning_grace_minutes || 30),
                      min_temp_c: policy.min_temp_c != null ? String(policy.min_temp_c) : '',
                      max_temp_c: policy.max_temp_c != null ? String(policy.max_temp_c) : '',
                    })}
                    className="w-full rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{policyLabel(policy)}</p>
                      <span className="text-[11px] text-cyan-600">ทุก {policy.interval_hours} ชม.</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{formatRange(policy)} · grace {policy.warning_grace_minutes || 30} นาที</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {historySelected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-700">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white">
                  <History size={18} className="text-cyan-600" /> ประวัติการตรวจ {historySelected.container_number}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {historySelected.booking_number ? `Booking ${historySelected.booking_number} · ` : ''}
                  ตำแหน่งปัจจุบัน: {formatYardPosition(historySelected)} · รอบทุก {historySelected.policy?.interval_hours || 4} ชั่วโมง · {formatRange(historySelected.policy)}
                </p>
              </div>
              <button type="button" onClick={() => setHistorySelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <HistoryMetric label="จำนวนครั้งที่ตรวจ" value={historyStats.total.toLocaleString()} />
                <HistoryMetric label="ผิดปกติ" value={historyStats.abnormal.toLocaleString()} tone={historyStats.abnormal > 0 ? 'rose' : 'slate'} />
                <HistoryMetric label="มีรูปหลักฐาน" value={historyStats.withPhoto.toLocaleString()} />
                <HistoryMetric label="ตรวจล่าสุด" value={historyStats.latest?.checked_at ? formatDateTime(historyStats.latest.checked_at) : '-'} />
              </div>

              {historySelected.active_exception_id && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  <p className="font-semibold">มี Exception เปิดอยู่: {historySelected.active_exception_reason || historySelected.active_exception_severity || 'ต้องตรวจสอบ'}</p>
                  <p className="mt-1">{historySelected.active_exception_action || 'ตรวจสอบอุณหภูมิ/ไฟเลี้ยง และปิดงานหลังแก้ไข'}</p>
                </div>
              )}

              {historyError && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{historyError}</p>}

              {historyLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                </div>
              ) : history.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
                  ยังไม่มีประวัติการตรวจสำหรับตู้นี้
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="hidden gap-3 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:bg-slate-900/50 dark:text-slate-400 md:grid md:grid-cols-[1.1fr_1.4fr_1fr_1.4fr]">
                    <span>เวลา / ผู้ตรวจ</span>
                    <span>อุณหภูมิ</span>
                    <span>สถานะ</span>
                    <span>หมายเหตุ / หลักฐาน</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {history.map(check => (
                      <div key={check.check_id} className="grid gap-3 px-3 py-3 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-[1.1fr_1.4fr_1fr_1.4fr]">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white">{formatDateTime(check.checked_at)}</p>
                          <p className="mt-1 text-slate-400">{check.checked_by_name || `User #${check.checked_by_user_id || '-'}`}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          <span>Measured {formatTemp(check.measured_temp_c)}</span>
                          <span>Set {formatTemp(check.set_point_c)}</span>
                          <span>Supply {formatTemp(check.supply_temp_c)}</span>
                          <span>Return {formatTemp(check.return_temp_c)}</span>
                        </div>
                        <div className="space-y-2">
                          <CheckStatusBadge status={check.status} />
                          {check.exception_id && (
                            <p className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-300">
                              Exception {check.exception_severity || ''} {check.exception_status || ''}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="whitespace-pre-wrap text-slate-500 dark:text-slate-300">{check.notes || '-'}</p>
                          {check.exception_action && <p className="mt-1 text-[11px] text-red-600">{check.exception_action}</p>}
                          {check.photo_url && (
                            <a
                              href={check.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300"
                            >
                              <ExternalLink size={12} /> ดูรูปหลักฐาน
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={submitCheck} className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-700">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-white">
                  <Thermometer size={18} className="text-cyan-600" /> บันทึกอุณหภูมิ {selected.container_number}
                </h2>
                <p className="mt-1 text-xs text-slate-400">รอบตรวจทุก {selected.policy?.interval_hours || 4} ชั่วโมง · {formatRange(selected.policy)}</p>
                <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">ตำแหน่งปัจจุบัน: {formatYardPosition(selected)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {checkError && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{checkError}</p>}
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Measured °C">
                  <input type="number" step="0.1" value={checkForm.measured_temp_c} onChange={e => setCheckForm({ ...checkForm, measured_temp_c: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Set point °C">
                  <input type="number" step="0.1" value={checkForm.set_point_c} onChange={e => setCheckForm({ ...checkForm, set_point_c: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Supply °C">
                  <input type="number" step="0.1" value={checkForm.supply_temp_c} onChange={e => setCheckForm({ ...checkForm, supply_temp_c: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Return °C">
                  <input type="number" step="0.1" value={checkForm.return_temp_c} onChange={e => setCheckForm({ ...checkForm, return_temp_c: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <Field label="สถานะ">
                <select value={checkForm.status} onChange={e => setCheckForm({ ...checkForm, status: e.target.value })} className={inputClass}>
                  <option value="normal">ปกติ</option>
                  <option value="unreadable">อ่านค่าไม่ได้</option>
                  <option value="power_issue">ไฟ/ปลั๊กมีปัญหา</option>
                </select>
              </Field>
              <PhotoCapture
                label="รูปหน้าจออุณหภูมิ"
                value={checkForm.photo_url}
                folder="reefer"
                onCapture={url => setCheckForm(current => ({ ...current, photo_url: url }))}
              />
              <Field label="หมายเหตุ">
                <textarea value={checkForm.notes} onChange={e => setCheckForm({ ...checkForm, notes: e.target.value })} className={`${inputClass} min-h-20 resize-y`} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-700">
              <button type="button" onClick={() => setSelected(null)} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200">ยกเลิก</button>
              <button disabled={savingCheck} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                {savingCheck ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} บันทึกอุณหภูมิ
              </button>
            </div>
          </form>
        </div>
      )}
      <ActionInputDialog
        open={Boolean(exceptionActionDialog)}
        title={exceptionActionDialog?.action === 'resolve' ? 'ปิด Reefer Exception' : 'Ignore Reefer Exception'}
        description={exceptionActionDialog?.item.container_number}
        fields={[{
          name: 'note',
          label: exceptionActionDialog?.action === 'resolve' ? 'บันทึกการแก้ไข exception' : 'เหตุผลที่ ignore exception',
          type: 'textarea',
          defaultValue: exceptionActionDialog?.action === 'resolve' ? exceptionActionDialog.item.active_exception_action || '' : '',
          required: true,
        }]}
        confirmLabel={exceptionActionDialog?.action === 'resolve' ? 'ปิดงาน' : 'Ignore'}
        onCancel={() => setExceptionActionDialog(null)}
        onSubmit={({ note }) => {
          if (!exceptionActionDialog) return;
          const trimmed = note.trim();
          if (!trimmed) return;
          void patchException(exceptionActionDialog.item, exceptionActionDialog.action, trimmed);
        }}
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'cyan' | 'amber' | 'rose' | 'red' }) {
  const tones = {
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}><Thermometer size={17} /></div>
      <p className="text-2xl font-bold text-slate-800 dark:text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function PlugMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/30">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

function HistoryMetric({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'rose' }) {
  return (
    <div className={`rounded-lg border p-3 ${
      tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300'
        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200'
    }`}>
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function tabClass(active: boolean) {
  return `inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
    active
      ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300'
      : 'border-slate-200 bg-white text-slate-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
  }`;
}

function filterClass(active: boolean) {
  return `h-8 rounded-md px-3 transition ${
    active
      ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-800 dark:text-cyan-300'
      : 'text-slate-500 hover:text-cyan-700 dark:text-slate-400'
  }`;
}

function DueBadge({ status }: { status: ReeferItem['due_status'] }) {
  const config = {
    not_checked: { label: 'ยังไม่เคยตรวจ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <AlertTriangle size={12} /> },
    ok: { label: 'ปกติ', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <CheckCircle2 size={12} /> },
    due: { label: 'ถึงรอบตรวจ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <Clock size={12} /> },
    overdue: { label: 'เกินกำหนด', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: <AlertTriangle size={12} /> },
  }[status];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.cls}`}>{config.icon}{config.label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status !== 'out_of_range') return null;
  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"><AlertTriangle size={12} /> นอกช่วง</span>;
}

function CheckStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    normal: { label: 'ปกติ', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    out_of_range: { label: 'นอกช่วง', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    unreadable: { label: 'อ่านค่าไม่ได้', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    power_issue: { label: 'ไฟ/ปลั๊กมีปัญหา', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  };
  const statusConfig = config[status] || { label: status || '-', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusConfig.cls}`}>{statusConfig.label}</span>;
}

function formatTemp(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return `${Number(value).toFixed(1)}°C`;
}

function formatRange(policy?: ReeferPolicy | null) {
  if (!policy || (policy.min_temp_c == null && policy.max_temp_c == null)) return 'ไม่กำหนดช่วง';
  return `${policy.min_temp_c ?? '-∞'} ถึง ${policy.max_temp_c ?? '+∞'}°C`;
}

function formatYardPosition(item: Pick<ReeferItem, 'zone_name' | 'bay' | 'row' | 'tier'>) {
  const zone = item.zone_name ? `Zone ${item.zone_name}` : 'ยังไม่ระบุ Zone';
  if (item.bay == null || item.row == null || item.tier == null) {
    return `${zone} · ยังไม่ระบุ slot`;
  }
  return `${zone} · Bay ${padSlot(item.bay)} · Row ${padSlot(item.row)} · Tier ${padSlot(item.tier)}`;
}

function padSlot(value: number) {
  return String(value).padStart(2, '0');
}

function policyLabel(policy: ReeferPolicy) {
  if (policy.scope_type === 'customer') return `Customer #${policy.customer_id}`;
  if (policy.scope_type === 'booking') return `Booking #${policy.booking_id}`;
  if (policy.scope_type === 'container') return `Container #${policy.container_id}`;
  if (policy.scope_type === 'yard') return `Yard #${policy.yard_id || '-'}`;
  return 'Default';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}
