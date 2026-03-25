'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2, Filter } from 'lucide-react';

interface Invoice {
  invoice_id: number; invoice_number: string; charge_type: string;
  total_before_vat: number; vat_amount: number; grand_total: number;
  status: string; created_at: string; paid_at: string; container_number: string;
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  issued: { label: 'แจ้งหนี้', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  paid: { label: 'ชำระแล้ว', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: 'ยกเลิก', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  draft: { label: 'ร่าง', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400' },
};

const chargeLabels: Record<string, string> = {
  storage: 'ค่าฝากตู้', lolo: 'ค่ายก LOLO', mnr: 'ค่าซ่อม M&R',
  washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น',
  gate: 'ค่า Gate', other: 'อื่นๆ',
};

export default function PortalInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState({ outstanding: 0, paid_total: 0, issued_count: 0, paid_count: 0 });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = (p = 1, status = statusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (status) params.set('status', status);
    fetch(`/api/portal/invoices?${params}`).then(r => r.json()).then(d => {
      setInvoices(d.invoices || []);
      setSummary(d.summary || {});
      setTotal(d.total || 0);
      setPage(d.page || 1);
      setTotalPages(d.totalPages || 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <FileText size={22} className="text-blue-600" /> ใบแจ้งหนี้ / Invoice
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">{total} รายการทั้งหมด</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4">
          <p className="text-[10px] text-amber-600 font-medium uppercase">ค้างชำระ ({summary.issued_count})</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">฿{summary.outstanding.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30 rounded-xl p-4">
          <p className="text-[10px] text-emerald-600 font-medium uppercase">ชำระแล้ว ({summary.paid_count})</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">฿{summary.paid_total.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex justify-end">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); loadData(1, e.target.value); }}
          className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white">
          <option value="">ทุกสถานะ</option>
          <option value="issued">แจ้งหนี้</option>
          <option value="paid">ชำระแล้ว</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2"><Filter size={14} /> ไม่พบข้อมูล</p>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
              {invoices.map(inv => (
                <div key={inv.invoice_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800 dark:text-white text-sm">{inv.invoice_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(statusLabels[inv.status] || statusLabels.draft).cls}`}>
                      {(statusLabels[inv.status] || statusLabels.draft).label}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{chargeLabels[inv.charge_type] || inv.charge_type}</span>
                    <span className="font-semibold text-slate-800 dark:text-white">฿{inv.grand_total.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {inv.container_number && `ตู้: ${inv.container_number} | `}
                    {new Date(inv.created_at).toLocaleDateString('th-TH')}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/30">
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="p-3">เลขบิล</th>
                  <th className="p-3">ประเภท</th>
                  <th className="p-3">ตู้</th>
                  <th className="p-3 text-right">ยอดรวม</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">วันที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {invoices.map(inv => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="p-3 font-medium text-slate-800 dark:text-white">{inv.invoice_number}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{chargeLabels[inv.charge_type] || inv.charge_type}</td>
                    <td className="p-3 font-mono text-slate-500 text-xs">{inv.container_number || '-'}</td>
                    <td className="p-3 text-right font-semibold text-slate-800 dark:text-white">฿{inv.grand_total.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(statusLabels[inv.status] || statusLabels.draft).cls}`}>
                        {(statusLabels[inv.status] || statusLabels.draft).label}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-xs">{new Date(inv.created_at).toLocaleDateString('th-TH')}</td>
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
