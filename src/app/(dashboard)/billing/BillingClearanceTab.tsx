'use client';

import { useState } from 'react';
import { Ban, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { ClearanceRow, ClearanceStats } from './billingTypes';
import { clearanceLabel } from './billingUi';

export default function BillingClearanceTab({
  clearances,
  stats,
  loading,
  onRefresh,
}: {
  clearances: ClearanceRow[];
  stats: ClearanceStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState('');
  const [txFilter, setTxFilter] = useState('');
  const [search, setSearch] = useState('');

  const rows = clearances.filter(row => {
    const q = search.toLowerCase();
    return (!typeFilter || row.clearance_type === typeFilter)
      && (!txFilter || row.transaction_type === txFilter)
      && (!q ||
        row.container_number?.toLowerCase().includes(q) ||
        row.customer_name?.toLowerCase().includes(q) ||
        row.invoice_number?.toLowerCase().includes(q) ||
        row.eir_number?.toLowerCase().includes(q));
  });

  const reportRows = rows.filter(r => ['credit', 'no_charge', 'waived'].includes(r.clearance_type));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Paid', value: stats?.paid_amount || 0, count: stats?.paid_count || 0, color: 'text-emerald-600' },
          { label: 'Credit', value: stats?.credit_amount || 0, count: stats?.credit_count || 0, color: 'text-blue-600' },
          { label: 'Waived', value: stats?.waived_amount || 0, count: stats?.waived_count || 0, color: 'text-amber-600' },
          { label: 'Gate In', value: stats?.gate_in_amount || 0, count: 0, color: 'text-cyan-600' },
          { label: 'Gate Out', value: stats?.gate_out_amount || 0, count: 0, color: 'text-violet-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-400">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.color}`}>฿{kpi.value.toLocaleString()}</p>
            {kpi.count > 0 && <p className="text-[10px] text-slate-400">{kpi.count} รายการ</p>}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><CheckCircle2 size={16} /> Billing Clearance ({rows.length})</h3>
            <p className="text-xs text-slate-400 mt-1">หลักฐานเคลียร์เงินก่อน Gate/EIR พร้อม link ย้อนกลับเอกสาร</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ตู้/EIR/ลูกค้า/บิล" className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
              <option value="">ทุก clearance</option>
              <option value="paid">Paid</option>
              <option value="credit">Credit</option>
              <option value="no_charge">No Charge</option>
              <option value="waived">Waived</option>
            </select>
            <select value={txFilter} onChange={e => setTxFilter(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs">
              <option value="">Gate In/Out</option>
              <option value="gate_in">Gate-In</option>
              <option value="gate_out">Gate-Out</option>
            </select>
            <button onClick={onRefresh} className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"><RotateCcw size={12} /> รีเฟรช</button>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีรายการ Billing Clearance</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">เวลา</th>
                  <th className="text-left px-4 py-2.5">Gate/EIR</th>
                  <th className="text-left px-4 py-2.5">ตู้/ลูกค้า</th>
                  <th className="text-center px-4 py-2.5">Clearance</th>
                  <th className="text-right px-4 py-2.5">ยอดเดิม</th>
                  <th className="text-right px-4 py-2.5">ยอดสุทธิ</th>
                  <th className="text-left px-4 py-2.5">เหตุผล/ผู้อนุมัติ</th>
                  <th className="text-center px-4 py-2.5">เอกสาร</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map(row => {
                  const badge = clearanceLabel(row.clearance_type);
                  return (
                    <tr key={row.clearance_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-2 text-slate-500">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-2">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">{row.transaction_type === 'gate_in' ? 'Gate-In' : 'Gate-Out'}</p>
                        {row.eir_number ? <button onClick={() => window.open(`/eir/${row.eir_number}`, '_blank')} className="font-mono text-blue-500 hover:text-blue-700">{row.eir_number}</button> : <span className="text-slate-400">-</span>}
                        {row.booking_ref && <p className="font-mono text-[10px] text-slate-400">BK: {row.booking_ref}</p>}
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-mono font-semibold text-slate-800 dark:text-white">{row.container_number || '-'}</p>
                        <p className="text-slate-400">{row.customer_name || '-'}</p>
                      </td>
                      <td className="px-4 py-2 text-center"><span className={`px-2 py-1 rounded-lg font-semibold ${badge.color}`}>{badge.label}</span></td>
                      <td className="px-4 py-2 text-right font-mono">฿{(row.original_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">฿{(row.final_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 max-w-[240px]">
                        <p className="truncate text-slate-600 dark:text-slate-300">{row.reason || '-'}</p>
                        {(row.approved_by_name || row.created_by_name) && <p className="text-[10px] text-slate-400">โดย {row.approved_by_name || row.created_by_name}</p>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {row.invoice_id ? (
                          <button onClick={() => window.open(`/billing/print?id=${row.invoice_id}&type=${row.clearance_type === 'paid' ? 'receipt' : 'invoice'}`, '_blank')}
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200">
                            {row.invoice_number || 'Print'}
                          </button>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Ban size={16} /> รายงานควบคุม No Charge / Waived / Credit</h3>
          <p className="text-xs text-slate-400 mt-1">ใช้ตรวจสอบรายการที่ไม่มีรับเงินสดทันทีหรือมีการยกเว้นค่าใช้จ่าย</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {reportRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-400 text-center">ไม่มีรายการควบคุมพิเศษใน filter นี้</div>
          ) : reportRows.slice(0, 30).map(row => {
            const badge = clearanceLabel(row.clearance_type);
            return (
              <div key={`report-${row.clearance_id}`} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${badge.color}`}>{badge.label}</span>
                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{row.container_number || '-'}</span>
                    {row.eir_number && <span className="font-mono text-xs text-slate-400">{row.eir_number}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{row.customer_name || '-'} • {row.reason || 'ไม่มีเหตุผลระบุ'} • {formatDateTime(row.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">ผลกระทบ</p>
                  <p className="font-bold text-amber-600">฿{((row.original_amount || 0) - (row.final_amount || 0)).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
