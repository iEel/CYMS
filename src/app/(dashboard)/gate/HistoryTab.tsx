'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatTime } from '@/lib/utils';
import {
  Loader2, Search, History,
  ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft,
  FileDown,
} from 'lucide-react';
import { Transaction } from './types';

interface HistoryTabProps {
  yardId: number;
  onViewEIR: (eirNumber: string) => void;
}

export default function HistoryTab({ yardId, onViewEIR }: HistoryTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [historySearch, setHistorySearch] = useState<string>('');
  const [histPage, setHistPage] = useState(1);
  const histPerPage = 25;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ yard_id: String(yardId) });
      if (historyDate) params.set('date', historyDate);
      if (historySearch.trim()) params.set('search', historySearch.trim());
      const res = await fetch(`/api/gate?${params}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
      setHistPage(1);
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  }, [yardId, historyDate, historySearch]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Auto-search with 400ms debounce on search text change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchHistory(); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySearch]);

  const histTotalPages = Math.ceil(transactions.length / histPerPage);
  const histPaginated = transactions.slice((histPage - 1) * histPerPage, histPage * histPerPage);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <History size={18} /> ประวัติ Gate
          </h3>
          <button onClick={fetchHistory} className="text-xs text-blue-500 hover:text-blue-700 font-medium">รีเฟรช</button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาเลขตู้, คนขับ, ทะเบียน, EIR..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
                text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
            />
          </div>
          <input
            type="date"
            value={historyDate}
            onChange={(e) => setHistoryDate(e.target.value)}
            className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setHistoryDate(new Date().toISOString().slice(0, 10))}
            className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500 font-medium transition-all"
          >วันนี้</button>
          <button
            disabled={transactions.length === 0}
            onClick={async () => {
              try {
                const XLSX = await import('xlsx');
                const rows = transactions.map(t => ({
                  'วันที่': new Date(t.created_at).toLocaleDateString('th-TH'),
                  'เวลา': new Date(t.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                  'ประเภท': t.transaction_type === 'gate_in' ? 'รับเข้า' : t.transaction_type === 'gate_out' ? 'ปล่อยออก' : t.transaction_type === 'transfer' ? 'ย้ายออก' : 'รับย้าย',
                  'เลขตู้': t.container_number,
                  'ขนาด': t.size,
                  'ประเภทตู้': t.type,
                  'สายเรือ': t.shipping_line || '',
                  'EIR': t.eir_number || '',
                  'คนขับ': t.driver_name || '',
                  'ทะเบียนรถ': t.truck_plate || '',
                  'ผู้ดำเนินการ': t.full_name || '',
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                ws['!cols'] = Object.keys(rows[0] || {}).map(key => ({ wch: Math.max(key.length * 2, 12) }));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Gate History');
                XLSX.writeFile(wb, `gate-history-${historyDate}.xlsx`);
              } catch (err) { console.error('Excel export error:', err); }
            }}
            className="h-10 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-sm font-medium hover:bg-emerald-100 flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileDown size={14} /> Excel
          </button>
          <span className="text-xs text-slate-400">{transactions.length} รายการ</span>
        </div>
      </div>

      {historyLoading ? (
        <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
      ) : transactions.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">ไม่พบรายการ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">ประเภท</th>
                <th className="px-4 py-3">เลขตู้</th>
                <th className="px-4 py-3">ขนาด</th>
                <th className="px-4 py-3">คนขับ</th>
                <th className="px-4 py-3">ทะเบียน</th>
                <th className="px-4 py-3">EIR</th>
                <th className="px-4 py-3">ผู้ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {histPaginated.map(tx => (
                <tr key={tx.transaction_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(tx.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}{' '}
                    {formatTime(tx.created_at).slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      tx.transaction_type === 'gate_in'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : tx.transaction_type === 'transfer' || tx.transaction_type === 'transfer_in'
                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {tx.transaction_type === 'gate_in' ? <ArrowDownToLine size={10} /> : tx.transaction_type === 'transfer' || tx.transaction_type === 'transfer_in' ? <ArrowRightLeft size={10} /> : <ArrowUpFromLine size={10} />}
                      {tx.transaction_type === 'gate_in' ? 'IN' : tx.transaction_type === 'transfer' ? 'TRF-OUT' : tx.transaction_type === 'transfer_in' ? 'TRF-IN' : 'OUT'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-white">{tx.container_number}</td>
                  <td className="px-4 py-3 text-slate-500">{tx.size}&apos;{tx.type}</td>
                  <td className="px-4 py-3 text-slate-500">{tx.driver_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono">{tx.truck_plate || '-'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onViewEIR(tx.eir_number)}
                      className="text-xs text-blue-500 hover:text-blue-700 font-mono font-medium hover:underline">
                      {tx.eir_number}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{tx.full_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!historyLoading && histTotalPages > 1 && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400">แสดง {(histPage - 1) * histPerPage + 1}–{Math.min(histPage * histPerPage, transactions.length)} จาก {transactions.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setHistPage(1)} disabled={histPage === 1} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">«</button>
            <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">‹</button>
            {Array.from({ length: Math.min(5, histTotalPages) }, (_, i) => {
              let page: number;
              if (histTotalPages <= 5) page = i + 1;
              else if (histPage <= 3) page = i + 1;
              else if (histPage >= histTotalPages - 2) page = histTotalPages - 4 + i;
              else page = histPage - 2 + i;
              return <button key={page} onClick={() => setHistPage(page)} className={`w-8 h-8 rounded-lg text-xs font-medium ${page === histPage ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{page}</button>;
            })}
            <button onClick={() => setHistPage(p => Math.min(histTotalPages, p + 1))} disabled={histPage === histTotalPages} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">›</button>
            <button onClick={() => setHistPage(histTotalPages)} disabled={histPage === histTotalPages} className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">»</button>
          </div>
        </div>
      )}
    </div>
  );
}
