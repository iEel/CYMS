'use client';

import { useState, useEffect } from 'react';
import { Package, Loader2, Search, Filter } from 'lucide-react';

interface Container {
  container_id: number; container_number: string; size: string; type: string;
  shipping_line: string; status: string; is_laden: boolean;
  bay: number; row: number; tier: number;
  gate_in_date: string; gate_out_date: string;
  zone_name: string; yard_name: string;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  in_yard: { label: '📦 ในลาน', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  released: { label: '✅ ปล่อยออกแล้ว', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  pending: { label: '⏳ รอเข้าลาน', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

export default function PortalContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadData = (p = 1, status = statusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (status) params.set('status', status);
    fetch(`/api/portal/containers?${params}`).then(r => r.json()).then(d => {
      setContainers(d.containers || []);
      setTotal(d.total || 0);
      setPage(d.page || 1);
      setTotalPages(d.totalPages || 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const filtered = search
    ? containers.filter(c => c.container_number?.toLowerCase().includes(search.toLowerCase()))
    : containers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Package size={22} className="text-blue-600" /> ตู้คอนเทนเนอร์
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{total} ตู้ทั้งหมด</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input type="text" placeholder="ค้นเลขตู้..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white w-40" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadData(1, e.target.value); }}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
            <option value="">ทุกสถานะ</option>
            <option value="in_yard">ในลาน</option>
            <option value="released">ปล่อยออก</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2"><Filter size={14} /> ไม่พบข้อมูล</p>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.map(c => (
                <div key={c.container_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800 dark:text-white">{c.container_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(statusLabels[c.status] || statusLabels.pending).cls}`}>
                      {(statusLabels[c.status] || statusLabels.pending).label}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>{c.size}&apos; {c.type}</span>
                    <span>{c.shipping_line}</span>
                    {c.zone_name && <span>{c.zone_name}</span>}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    เข้า: {c.gate_in_date ? new Date(c.gate_in_date).toLocaleDateString('th-TH') : '-'}
                    {c.gate_out_date && ` → ออก: ${new Date(c.gate_out_date).toLocaleDateString('th-TH')}`}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/30">
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="p-3">เลขตู้</th>
                  <th className="p-3">ขนาด</th>
                  <th className="p-3">สายเรือ</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">โซน</th>
                  <th className="p-3">Gate-In</th>
                  <th className="p-3">Gate-Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map(c => (
                  <tr key={c.container_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-white">{c.container_number}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{c.size}&apos; {c.type}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{c.shipping_line || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(statusLabels[c.status] || statusLabels.pending).cls}`}>
                        {(statusLabels[c.status] || statusLabels.pending).label}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{c.zone_name || '-'}</td>
                    <td className="p-3 text-slate-500 text-xs">{c.gate_in_date ? new Date(c.gate_in_date).toLocaleDateString('th-TH') : '-'}</td>
                    <td className="p-3 text-slate-500 text-xs">{c.gate_out_date ? new Date(c.gate_out_date).toLocaleDateString('th-TH') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
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
