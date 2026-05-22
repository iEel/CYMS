'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Filter,
  Loader2,
  Package,
  Plus,
  Send,
  Ship,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

interface Booking {
  booking_id: number; booking_number: string; booking_type: string; status: string;
  vessel_name: string; voyage_number: string; container_count: number;
  received_count: number; released_count: number; eta: string;
  valid_from: string; valid_to: string; created_at: string;
  visibility_role?: string;
  eta_status?: { code: string; label: string; tone: string; days: number | null };
  empty_return_instruction?: {
    title: string;
    cut_off_date: string | null;
    cut_off_status: string;
    steps: string[];
  } | null;
}

interface BookingContainer {
  id: number; container_number: string; status: string;
  gate_in_at?: string; gate_out_at?: string; created_at: string;
  size?: string; type?: string; shipping_line?: string; container_status?: string;
  gate_in_eir_number?: string; gate_out_eir_number?: string;
}

interface BookingDetail {
  booking: Booking;
  containers: BookingContainer[];
}

interface TimelineEvent {
  event_type: string;
  title: string;
  event_time: string;
  container_number?: string | null;
  reference_number?: string | null;
  status?: string | null;
  detail?: string | null;
}

interface CreateBookingForm {
  booking_number: string;
  booking_type: string;
  container_count: string;
  container_size: string;
  container_type: string;
  eta: string;
  valid_from: string;
  valid_to: string;
  vessel_name: string;
  voyage_number: string;
  seal_number: string;
  container_numbers: string;
  notes: string;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  pending: { label: '⏳ รอดำเนินการ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  confirmed: { label: '✅ ยืนยันแล้ว', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: '🏁 เสร็จสิ้น', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: '❌ ยกเลิก', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

const typeLabels: Record<string, string> = {
  import: '📥 นำเข้า', export: '📤 ส่งออก',
  empty_pickup: '📦 รับตู้เปล่า', empty_return: '🔄 คืนตู้เปล่า',
};

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

const initialCreateForm: CreateBookingForm = {
  booking_number: '',
  booking_type: 'export',
  container_count: '1',
  container_size: '20',
  container_type: 'GP',
  eta: '',
  valid_from: '',
  valid_to: '',
  vessel_name: '',
  voyage_number: '',
  seal_number: '',
  container_numbers: '',
  notes: '',
};

export default function PortalBookings() {
  const { session } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateBookingForm>(initialCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const detailStats = detail ? bookingStats(detail.booking) : null;

  const loadData = useCallback((p = 1, status = statusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (status) params.set('status', status);
    fetch(`/api/portal/bookings?${params}`).then(r => r.json()).then(d => {
      setBookings(d.bookings || []);
      setTotal(d.total || 0);
      setPage(d.page || 1);
      setTotalPages(d.totalPages || 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const openDetail = (bookingId: number) => {
    setDetailLoading(true);
    setTimeline([]);
    Promise.all([
      fetch(`/api/portal/bookings/detail?booking_id=${bookingId}`).then(r => r.json()),
      fetch(`/api/portal/timeline?booking_id=${bookingId}`).then(r => r.json()),
    ]).then(([d, t]) => {
      if (!d.error) setDetail({ booking: d.booking, containers: d.containers || [] });
      setTimeline(Array.isArray(t.timeline) ? t.timeline : []);
      setDetailLoading(false);
    }).catch(() => setDetailLoading(false));
  };

  const submitBooking = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');

    const containerNumbers = createForm.container_numbers
      .split(/[\s,]+/)
      .map(item => item.trim().toUpperCase())
      .filter(Boolean);

    try {
      const res = await fetch('/api/portal/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          yard_id: session?.activeYardId || session?.yardIds?.[0],
          container_count: Number(createForm.container_count || 1),
          container_numbers: containerNumbers,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(data.error || 'ไม่สามารถสร้าง Booking ได้');
        return;
      }
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      loadData(1);
      if (data.booking?.booking_id) openDetail(data.booking.booking_id);
    } catch {
      setCreateError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList size={22} className="text-blue-600" /> Booking
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{total} รายการทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadData(1, e.target.value); }}
            className="h-10 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
            <option value="">ทุกสถานะ</option>
            <option value="pending">รอดำเนินการ</option>
            <option value="confirmed">ยืนยันแล้ว</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
          <button
            onClick={() => { setCreateError(''); setCreateOpen(true); }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} /> สร้าง Booking
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <p className="flex items-center justify-center gap-2"><Filter size={14} /> ไม่พบข้อมูล</p>
            <button
              onClick={() => { setCreateError(''); setCreateOpen(true); }}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={14} /> สร้าง Booking
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {bookings.map(bk => {
              const progress = bk.container_count > 0
                ? Math.round((bk.received_count / bk.container_count) * 100) : 0;
              return (
                <button key={bk.booking_id} onClick={() => openDetail(bk.booking_id)}
                  className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white text-sm">{bk.booking_number}</p>
                      <p className="text-xs text-slate-400">{typeLabels[bk.booking_type] || bk.booking_type}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${(statusLabels[bk.status] || statusLabels.pending).cls}`}>
                      {(statusLabels[bk.status] || statusLabels.pending).label}
                    </span>
                  </div>

                  {/* Vessel info */}
                  {bk.vessel_name && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Ship size={12} /> {bk.vessel_name} {bk.voyage_number && `/ ${bk.voyage_number}`}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{progress}%</span>
                  </div>

                  {/* Counts */}
                  <div className="flex items-center gap-4 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><Package size={10} /> {bk.container_count} ตู้</span>
                    <span>รับแล้ว {bk.received_count}</span>
                    <span>ออกแล้ว {bk.released_count}</span>
                    {bk.eta_status && <EtaBadge status={bk.eta_status} />}
                    {bk.status === 'pending' && <span className="text-amber-600">รอพนักงานยืนยัน</span>}
                    <VisibilityPill role={bk.visibility_role} />
                    {bk.empty_return_instruction && <span className="text-amber-600">Empty return instruction</span>}
                    <span className="text-blue-500">ดูรายละเอียด</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
            Math.max(0, page - 3), Math.min(totalPages, page + 2)
          ).map(p => (
            <button key={p} onClick={() => loadData(p)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                p === page ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-100'
              }`}>{p}</button>
          ))}
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <ClipboardList size={18} className="text-blue-600" />
                  {detail?.booking.booking_number || 'Booking Detail'}
                </h2>
                {detail?.booking && (
                  <p className="text-xs text-slate-400 mt-1">
                    {typeLabels[detail.booking.booking_type] || detail.booking.booking_type}
                    {detail.booking.vessel_name ? ` · ${detail.booking.vessel_name} ${detail.booking.voyage_number || ''}` : ''}
                  </p>
                )}
              </div>
              <button onClick={() => { setDetail(null); setTimeline([]); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : detail && detailStats && (
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      <Activity size={15} className="text-blue-600" /> ภาพรวม Booking
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${(statusLabels[detail.booking.status] || statusLabels.pending).cls}`}>
                      {(statusLabels[detail.booking.status] || statusLabels.pending).label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Metric label="จำนวนที่ขอ" value={detailStats.expected} />
                    <Metric label="เข้าลานแล้ว" value={detailStats.received} color="text-blue-600" />
                    <Metric label="ออกลานแล้ว" value={detailStats.released} color="text-emerald-600" />
                    <Metric label="คงเหลือ" value={detailStats.remaining} color="text-amber-600" />
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <p className="text-[10px] text-slate-400">ETA</p>
                      {detail.booking.eta_status ? (
                        <EtaBadge status={detail.booking.eta_status} />
                      ) : (
                        <p className="text-sm font-bold text-slate-400">-</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ProgressLine label="Gate In" value={detailStats.received} total={detailStats.expected} tone="blue" />
                    <ProgressLine label="Gate Out" value={detailStats.released} total={detailStats.expected} tone="emerald" />
                  </div>
                  {detail.booking.status === 'pending' && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span>รอพนักงานยืนยัน ก่อนนำไปใช้กับงานหน้าด่าน</span>
                    </div>
                  )}
                  {detailStats.released >= detailStats.expected && detailStats.expected > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                      <span>Booking นี้ปล่อยตู้ครบตามจำนวนแล้ว</span>
                    </div>
                  )}
                </div>

                {detail.booking.empty_return_instruction && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                          {detail.booking.empty_return_instruction.title}
                        </h3>
                        {detail.booking.empty_return_instruction.cut_off_date && (
                          <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                            Cut-off: {new Date(detail.booking.empty_return_instruction.cut_off_date).toLocaleDateString('th-TH')}
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-slate-800 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        {detail.booking.empty_return_instruction.cut_off_status}
                      </span>
                    </div>
                    <ol className="mt-3 space-y-1 text-xs text-amber-900 dark:text-amber-100">
                      {detail.booking.empty_return_instruction.steps.map((step, index) => (
                        <li key={index}>{index + 1}. {step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/30 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    กิจกรรมตู้ใน Booking
                  </div>
                  {detail.containers.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-400">ยังไม่มีรายการตู้ใน Booking นี้</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {detail.containers.map(c => (
                        <ContainerActivity key={c.id} container={c} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/30 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                    <span>Audit Trail</span>
                    <span className="text-[10px] text-slate-400">read-only</span>
                  </div>
                  {timeline.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-400">ยังไม่มี audit trail</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {timeline.map((event, index) => (
                        <div key={`${event.event_type}-${event.event_time}-${index}`} className="grid gap-2 p-3 md:grid-cols-[140px_1fr]">
                          <p className="text-[11px] font-semibold text-slate-400">{formatDateTime(event.event_time)}</p>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">{event.title}</p>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{event.event_type}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {[event.container_number, event.reference_number, event.status, event.detail].filter(Boolean).join(' · ') || '-'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={submitBooking}
            className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-700">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-white">
                  <ClipboardList size={18} className="text-blue-600" /> สร้าง Booking
                </h2>
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">สถานะเริ่มต้น: รอพนักงานยืนยัน</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {createError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <Field label="เลข Booking">
                  <input
                    required
                    value={createForm.booking_number}
                    onChange={e => setCreateForm({ ...createForm, booking_number: e.target.value.toUpperCase() })}
                    className={inputClass}
                    placeholder="BK-2026-0001"
                  />
                </Field>
                <Field label="ประเภท">
                  <select
                    value={createForm.booking_type}
                    onChange={e => setCreateForm({ ...createForm, booking_type: e.target.value })}
                    className={inputClass}
                  >
                    <option value="export">ส่งออก</option>
                    <option value="import">นำเข้า</option>
                    <option value="empty_pickup">รับตู้เปล่า</option>
                    <option value="empty_return">คืนตู้เปล่า</option>
                  </select>
                </Field>
                <Field label="จำนวนตู้">
                  <input
                    type="number"
                    min="1"
                    max="999"
                    required
                    value={createForm.container_count}
                    onChange={e => setCreateForm({ ...createForm, container_count: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Field label="ขนาด">
                  <select
                    value={createForm.container_size}
                    onChange={e => setCreateForm({ ...createForm, container_size: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">ไม่ระบุ</option>
                    <option value="20">20 ft</option>
                    <option value="40">40 ft</option>
                    <option value="45">45 ft</option>
                  </select>
                </Field>
                <Field label="ประเภทตู้">
                  <select
                    value={createForm.container_type}
                    onChange={e => setCreateForm({ ...createForm, container_type: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">ไม่ระบุ</option>
                    <option value="GP">GP</option>
                    <option value="HC">HC</option>
                    <option value="RF">RF</option>
                    <option value="OT">OT</option>
                    <option value="FR">FR</option>
                  </select>
                </Field>
                <Field label="ETA">
                  <input
                    type="date"
                    value={createForm.eta}
                    onChange={e => setCreateForm({ ...createForm, eta: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Seal">
                  <input
                    value={createForm.seal_number}
                    onChange={e => setCreateForm({ ...createForm, seal_number: e.target.value.toUpperCase() })}
                    className={inputClass}
                    placeholder="SEAL..."
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="เรือ">
                  <input
                    value={createForm.vessel_name}
                    onChange={e => setCreateForm({ ...createForm, vessel_name: e.target.value })}
                    className={inputClass}
                    placeholder="Vessel"
                  />
                </Field>
                <Field label="Voyage">
                  <input
                    value={createForm.voyage_number}
                    onChange={e => setCreateForm({ ...createForm, voyage_number: e.target.value.toUpperCase() })}
                    className={inputClass}
                    placeholder="Voyage"
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Valid From">
                  <input
                    type="date"
                    value={createForm.valid_from}
                    onChange={e => setCreateForm({ ...createForm, valid_from: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Valid To">
                  <input
                    type="date"
                    value={createForm.valid_to}
                    onChange={e => setCreateForm({ ...createForm, valid_to: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="เลขตู้ล่วงหน้า">
                <textarea
                  value={createForm.container_numbers}
                  onChange={e => setCreateForm({ ...createForm, container_numbers: e.target.value.toUpperCase() })}
                  className={`${inputClass} min-h-20 resize-y`}
                  placeholder="MSKU1234567, TLLU7654321"
                />
              </Field>

              <Field label="หมายเหตุ">
                <textarea
                  value={createForm.notes}
                  onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                  className={`${inputClass} min-h-20 resize-y`}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                ส่ง Booking
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color = 'text-slate-800 dark:text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value || 0}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function bookingStats(booking: Booking) {
  const expected = Number(booking.container_count || 0);
  const received = Number(booking.received_count || 0);
  const released = Number(booking.released_count || 0);
  return {
    expected,
    received,
    released,
    remaining: Math.max(0, expected - released),
  };
}

function ProgressLine({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'blue' | 'emerald' }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const barClass = tone === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span>{value}/{total} ตู้</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: 'รอรับ', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
    received: { label: 'รับแล้ว', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    released: { label: 'ออกแล้ว', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  };
  const item = config[status] || config.pending;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.cls}`}>{item.label}</span>;
}

function ContainerActivity({ container }: { container: BookingContainer }) {
  const events = [
    { label: 'รับเข้า Booking', at: container.created_at, done: true, tone: 'slate' },
    container.gate_in_at
      ? { label: 'เข้าลานแล้ว', at: container.gate_in_at, done: true, tone: 'blue' }
      : { label: 'รอเข้าลาน', at: null, done: false, tone: 'slate' },
    container.gate_out_at
      ? { label: 'ออกลานแล้ว', at: container.gate_out_at, done: true, tone: 'emerald' }
      : { label: 'รอออกลาน', at: null, done: false, tone: 'slate' },
  ];

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{container.container_number}</p>
            <StatusPill status={container.status} />
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {[container.size ? `${container.size}'` : '', container.type, container.shipping_line].filter(Boolean).join(' ') || 'ไม่ระบุขนาด/ประเภท'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          {container.gate_in_eir_number && (
            <a href={`/api/portal/eir-pdf?eir_number=${container.gate_in_eir_number}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-500 hover:underline">
              <Download size={10} /> EIR In
            </a>
          )}
          {container.gate_out_eir_number && (
            <a href={`/api/portal/eir-pdf?eir_number=${container.gate_out_eir_number}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
              <Download size={10} /> EIR Out
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {events.map(event => (
          <span
            key={event.label}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
              event.done
                ? event.tone === 'emerald'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : event.tone === 'blue'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                : 'bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500'
            }`}
          >
            <Clock size={10} />
            {event.label}
            {event.at ? ` ${formatDate(event.at)}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('th-TH');
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function EtaBadge({ status }: { status: { code: string; label: string; tone: string; days: number | null } }) {
  const cls: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls[status.tone] || cls.slate}`}>
      {status.label}
    </span>
  );
}

function VisibilityPill({ role }: { role?: string }) {
  const labels: Record<string, string> = {
    booking_customer: 'Visible by booking',
    owner: 'Visible by owner',
    billing: 'Visible by billing',
    invoice_customer: 'Visible by invoice',
  };
  return <span className="text-blue-500">{labels[role || ''] || 'Visible by grant'}</span>;
}
