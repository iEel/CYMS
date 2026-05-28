'use client';

import { FileText, Loader2, Printer, RotateCcw } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export interface BillingStatementHistoryRow {
  statement_id: number;
  statement_number: string;
  customer_name?: string;
  grand_total: number;
  status: string;
  line_count: number;
  issued_at?: string | null;
  created_at?: string | null;
}

interface BillingStatementHistoryProps {
  statements: BillingStatementHistoryRow[];
  loading: boolean;
  error?: string | null;
  yardId: number;
  onRefresh: () => void;
  onOpenStatement: (statement: BillingStatementHistoryRow) => void;
}

export default function BillingStatementHistory({
  statements,
  loading,
  error,
  onRefresh,
  onOpenStatement,
}: BillingStatementHistoryProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><FileText size={16} /> ประวัติใบวางบิลรวม</h3>
          <p className="text-xs text-slate-400 mt-0.5">เอกสารที่ออกแล้วสามารถเปิดดูหรือพิมพ์ซ้ำได้</p>
        </div>
        <button onClick={onRefresh} className="h-8 justify-center text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1">
          <RotateCcw size={12} /> รีเฟรช
        </button>
      </div>
      {loading ? (
        <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-rose-500">{error}</div>
      ) : statements.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีประวัติใบวางบิลรวม</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {statements.map(statement => (
            <div key={statement.statement_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{statement.statement_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      statement.status === 'issued' ? 'bg-blue-50 text-blue-600' :
                      statement.status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                      statement.status === 'cancelled' ? 'bg-slate-100 text-slate-400' :
                      'bg-amber-50 text-amber-600'
                    }`}>{statement.status}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {statement.customer_name || 'ไม่ระบุลูกค้า'} • {statement.line_count || 0} ใบแจ้งหนี้ • ออกเมื่อ {formatDateTime(statement.issued_at || statement.created_at || new Date().toISOString())}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-blue-600">฿{Number(statement.grand_total || 0).toLocaleString()}</span>
                  <button
                    onClick={() => onOpenStatement(statement)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                  >
                    <Printer size={12} /> เปิด/พิมพ์ซ้ำ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
