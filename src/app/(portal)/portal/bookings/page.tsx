'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Filter, Ship, Package } from 'lucide-react';

interface Booking {
  booking_id: number; booking_number: string; booking_type: string; status: string;
  vessel_name: string; voyage_number: string; container_count: number;
  received_count: number; released_count: number; eta: string;
  valid_from: string; valid_to: string; created_at: string;
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
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = (p = 1, status = statusFilter) => {
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
  };

  useEffect(() => { loadData(); }, []);

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
                <div key={bk.booking_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
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
                  </div>
                </div>
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
    </div>
  );
}
