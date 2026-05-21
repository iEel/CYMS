'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import type { ARCustomer } from './billingTypes';

export default function ARAgingTab({ yardId }: { yardId: number }) {
  const [data, setData] = useState<{
    summary: { current: number; d30: number; d60: number; d90: number; d90plus: number; total: number };
    customers: ARCustomer[];
    total_invoices: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/billing/ar-aging?yard_id=${yardId}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [yardId]);

  if (loading) return <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>;
  if (!data) return <div className="p-12 text-center text-sm text-slate-400">ไม่มีข้อมูล</div>;

  const s = data.summary;
  const buckets = [
    { label: 'Current', sublabel: 'ยังไม่ครบกำหนด', value: s.current, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', bar: 'bg-emerald-500' },
    { label: '1-30 วัน', sublabel: 'ค้างชำระ', value: s.d30, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', bar: 'bg-blue-500' },
    { label: '31-60 วัน', sublabel: 'ค้างชำระ', value: s.d60, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', bar: 'bg-amber-500' },
    { label: '61-90 วัน', sublabel: 'ค้างนาน', value: s.d90, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', bar: 'bg-orange-500' },
    { label: '90+ วัน', sublabel: 'เสี่ยงสูง', value: s.d90plus, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', bar: 'bg-rose-500' },
  ];

  const riskColor = (days: number) => days > 90 ? 'text-rose-600' : days > 60 ? 'text-orange-600' : days > 30 ? 'text-amber-600' : 'text-slate-600';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={16} /> ยอดค้างชำระ (AR Aging) — {data.total_invoices} รายการ
          </h3>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">฿{s.total.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">ยอดค้างรวม</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {buckets.map((b, i) => (
            <div key={i} className={`p-3 rounded-xl ${b.bg}`}>
              <p className={`text-lg font-bold ${b.color}`}>฿{b.value.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 font-medium">{b.label}</p>
              <p className="text-[9px] text-slate-400">{b.sublabel}</p>
            </div>
          ))}
        </div>
        {/* Horizontal bar */}
        {s.total > 0 && (
          <div className="mt-4 flex h-3 rounded-full overflow-hidden">
            {buckets.map((b, i) => {
              const pct = (b.value / s.total) * 100;
              if (pct === 0) return null;
              return <div key={i} className={`${b.bar} transition-all`} style={{ width: `${pct}%` }} title={`${b.label}: ฿${b.value.toLocaleString()} (${pct.toFixed(1)}%)`} />;
            })}
          </div>
        )}
      </div>

      {/* Customer Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">แยกตามลูกค้า ({data.customers.length})</h3>
        </div>
        {data.customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">ไม่มียอดค้างชำระ 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">ลูกค้า</th>
                  <th className="text-right px-3 py-2.5">Current</th>
                  <th className="text-right px-3 py-2.5">1-30 วัน</th>
                  <th className="text-right px-3 py-2.5">31-60 วัน</th>
                  <th className="text-right px-3 py-2.5">61-90 วัน</th>
                  <th className="text-right px-3 py-2.5">90+ วัน</th>
                  <th className="text-right px-4 py-2.5">รวม</th>
                  <th className="text-center px-3 py-2.5">บิล</th>
                  <th className="text-center px-3 py-2.5">เก่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.customers.map(c => (
                  <tr key={c.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-white">{c.customer_name}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-600">{c.current > 0 ? `฿${c.current.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600">{c.d30 > 0 ? `฿${c.d30.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-amber-600">{c.d60 > 0 ? `฿${c.d60.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-orange-600">{c.d90 > 0 ? `฿${c.d90.toLocaleString()}` : '-'}</td>
                    <td className="px-3 py-2.5 text-right text-rose-600 font-semibold">{c.d90plus > 0 ? `฿${c.d90plus.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-white">฿{c.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{c.invoice_count}</td>
                    <td className={`px-3 py-2.5 text-center font-medium ${riskColor(c.oldest_days)}`}>{c.oldest_days} วัน</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-900/30 font-bold text-xs">
                <tr>
                  <td className="px-4 py-2.5 text-slate-800 dark:text-white">รวมทั้งหมด</td>
                  <td className="px-3 py-2.5 text-right text-emerald-600">฿{s.current.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-blue-600">฿{s.d30.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-amber-600">฿{s.d60.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-orange-600">฿{s.d90.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600">฿{s.d90plus.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-slate-800 dark:text-white">฿{s.total.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{data.total_invoices}</td>
                  <td className="px-3 py-2.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
