'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, CreditCard, Loader2, Lock, Receipt, RotateCcw, Search, Users } from 'lucide-react';
import type { CreditCustomer } from './billingTypes';

export default function CreditControlTab({
  customers,
  loading,
  onRefresh,
}: {
  customers: CreditCustomer[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'over_limit' | 'overdue' | 'hold'>('all');

  const filtered = customers.filter(customer => {
    const q = search.toLowerCase();
    const matchesSearch = !q || customer.customer_name?.toLowerCase().includes(q);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'over_limit' && customer.over_limit) ||
      (filter === 'overdue' && customer.has_overdue) ||
      (filter === 'hold' && customer.credit_hold);
    return matchesSearch && matchesFilter;
  });

  const summary = customers.reduce((acc, customer) => {
    acc.totalOutstanding += Number(customer.outstanding_amount || 0);
    acc.totalLimit += Number(customer.credit_limit || 0);
    if (customer.over_limit) acc.overLimit += 1;
    if (customer.has_overdue) acc.overdue += 1;
    if (customer.credit_hold) acc.hold += 1;
    return acc;
  }, { totalOutstanding: 0, totalLimit: 0, overLimit: 0, overdue: 0, hold: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <CreditMetric label="ลูกค้าเครดิต" value={customers.length.toLocaleString()} icon={<Users size={16} />} />
        <CreditMetric label="ยอดค้างรวม" value={`฿${summary.totalOutstanding.toLocaleString()}`} icon={<Receipt size={16} />} color="text-blue-600" />
        <CreditMetric label="วงเงินรวม" value={`฿${summary.totalLimit.toLocaleString()}`} icon={<CreditCard size={16} />} color="text-emerald-600" />
        <CreditMetric label="เกินวงเงิน" value={summary.overLimit.toLocaleString()} icon={<AlertTriangle size={16} />} color="text-rose-600" />
        <CreditMetric label="Credit Hold" value={summary.hold.toLocaleString()} icon={<Lock size={16} />} color="text-amber-600" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <CreditCard size={16} /> Customer Credit Control
            </h3>
            <p className="text-xs text-slate-400 mt-1">ติดตามวงเงินเครดิต ยอดค้าง Overdue และสถานะ Credit Hold</p>
          </div>
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            รีเฟรช
          </button>
        </div>

        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-slate-700">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้าเครดิต..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500" />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
            className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500">
            <option value="all">ทั้งหมด</option>
            <option value="over_limit">เกินวงเงิน</option>
            <option value="overdue">มี overdue</option>
            <option value="hold">ติด Credit Hold</option>
          </select>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
            กำลังโหลดข้อมูลเครดิต...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
            ไม่พบลูกค้าเครดิตตามเงื่อนไข
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">ลูกค้า</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">Term</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">วงเงิน</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">ยอดค้าง</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">ใช้วงเงิน</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">Overdue</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map(customer => {
                  const creditLimit = Number(customer.credit_limit || 0);
                  const outstanding = Number(customer.outstanding_amount || 0);
                  const usage = creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0;
                  return (
                    <tr key={customer.customer_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 dark:text-white">{customer.customer_name}</p>
                        <p className="text-[10px] text-slate-400">{customer.default_payment_type} · customer #{customer.customer_id}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{customer.credit_term || 0} วัน</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200">฿{creditLimit.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${customer.over_limit ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                        ฿{outstanding.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[120px]">
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full ${usage > 100 ? 'bg-rose-500' : usage > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, usage)}%` }} />
                          </div>
                          <p className="text-[10px] text-center text-slate-400 mt-1">{creditLimit > 0 ? `${usage}%` : 'ไม่กำหนดวงเงิน'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {customer.oldest_overdue_days > 0 ? (
                          <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300 text-xs font-semibold">
                            {customer.oldest_overdue_days} วัน
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {customer.over_limit && <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/20 text-xs font-semibold">เกินวงเงิน</span>}
                          {customer.has_overdue && <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 text-xs font-semibold">Overdue</span>}
                          {customer.credit_hold && <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs font-semibold">Hold</span>}
                          {!customer.over_limit && !customer.has_overdue && !customer.credit_hold && <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 text-xs font-semibold">ปกติ</span>}
                        </div>
                        {customer.credit_hold_reason && <p className="text-[10px] text-slate-400 mt-1 truncate">{customer.credit_hold_reason}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CreditMetric({ label, value, icon, color = 'text-slate-700 dark:text-slate-200' }: { label: string; value: string; icon: ReactNode; color?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-2">{icon}<span className="text-xs">{label}</span></div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
