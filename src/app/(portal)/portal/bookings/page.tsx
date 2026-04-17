'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Loader2, Filter, Ship, Package, X, Download, Clock } from 'lucide-react';

interface Booking {
  booking_id: number; booking_number: string; booking_type: string; status: string;
  vessel_name: string; voyage_number: string; container_count: number;
  received_count: number; released_count: number; eta: string;
  valid_from: string; valid_to: string; created_at: string;
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

export default function PortalBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

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
    fetch(`/api/portal/bookings/detail?booking_id=${bookingId}`).then(r => r.json()).then(d => {
      if (!d.error) setDetail({ booking: d.booking, containers: d.containers || [] });
      setDetailLoading(false);
    }).catch(() => setDetailLoading(false));
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
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadData(1, e.target.value); }}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
          <option value="">ทุกสถานะ</option>
          <option value="pending">รอดำเนินการ</option>
          <option value="confirmed">ยืนยันแล้ว</option>
          <option value="completed">เสร็จสิ้น</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2"><Filter size={14} /> ไม่พบข้อมูล</p>
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
                    {bk.eta && <span>ETA: {new Date(bk.eta).toLocaleDateString('th-TH')}</span>}
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
              <button onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : detail && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="จำนวน" value={detail.booking.container_count} />
                  <Metric label="รับแล้ว" value={detail.booking.received_count} color="text-blue-600" />
                  <Metric label="ออกแล้ว" value={detail.booking.released_count} color="text-emerald-600" />
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/30 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    ตู้ใน Booking แบบอ่านอย่างเดียว
                  </div>
                  {detail.containers.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-400">ยังไม่มีรายการตู้ใน Booking นี้</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {detail.containers.map(c => (
                        <div key={c.id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-semibold text-sm text-slate-800 dark:text-white">{c.container_number}</p>
                              <StatusPill status={c.status} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {[c.size ? `${c.size}'` : '', c.type, c.shipping_line].filter(Boolean).join(' ') || 'ไม่ระบุขนาด/ประเภท'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            {c.gate_in_at && <span className="inline-flex items-center gap-1"><Clock size={10} /> รับเข้า {new Date(c.gate_in_at).toLocaleDateString('th-TH')}</span>}
                            {c.gate_out_at && <span className="inline-flex items-center gap-1"><Clock size={10} /> ออก {new Date(c.gate_out_at).toLocaleDateString('th-TH')}</span>}
                            {c.gate_in_eir_number && (
                              <a href={`/api/portal/eir-pdf?eir_number=${c.gate_in_eir_number}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                                <Download size={10} /> EIR In
                              </a>
                            )}
                            {c.gate_out_eir_number && (
                              <a href={`/api/portal/eir-pdf?eir_number=${c.gate_out_eir_number}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                                <Download size={10} /> EIR Out
                              </a>
                            )}
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

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: 'รอรับ', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
    received: { label: 'รับแล้ว', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    released: { label: 'ออกแล้ว', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  };
  const item = config[status] || config.pending;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.cls}`}>{item.label}</span>;
}
