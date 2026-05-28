'use client';

import { CheckCircle2, FileText, Loader2, Printer } from 'lucide-react';

export interface BillingDocumentInvoice {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  customer_id?: number;
  status: string;
  description: string;
  grand_total: number;
  balance_amount?: number | null;
  created_at: string;
  due_date: string;
}

export interface BillingStatementGroup {
  key: string;
  customer_id?: number;
  customer: string;
  invoices: BillingDocumentInvoice[];
  total: number;
}

interface BillingDocumentActionsProps {
  invoices: BillingDocumentInvoice[];
  canCreateInvoice: boolean;
  statementBusyKey: string | null;
  onIssueStatement: (group: BillingStatementGroup) => void;
  onPrintSummary: () => void;
  onPrintReceipt: (invoice: BillingDocumentInvoice) => void;
  onPrintContinuousReceipt: (invoice: BillingDocumentInvoice) => void;
}

export default function BillingDocumentActions({
  invoices,
  canCreateInvoice,
  statementBusyKey,
  onIssueStatement,
  onPrintSummary,
  onPrintReceipt,
  onPrintContinuousReceipt,
}: BillingDocumentActionsProps) {
  const grouped: Record<string, BillingStatementGroup> = {};
  invoices.filter(i => ['issued', 'overdue'].includes(i.status)).forEach(inv => {
    const key = inv.customer_id ? String(inv.customer_id) : inv.customer_name || 'ไม่ระบุลูกค้า';
    if (!grouped[key]) grouped[key] = { key, customer_id: inv.customer_id, customer: inv.customer_name || 'ไม่ระบุลูกค้า', invoices: [], total: 0 };
    grouped[key].invoices.push(inv);
    grouped[key].total += Number(inv.balance_amount ?? inv.grand_total ?? 0);
  });
  const statementGroups = Object.values(grouped);
  const paidInvoices = invoices.filter(i => i.status === 'paid').slice(0, 20);

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><FileText size={16} /> ใบวางบิล (Billing Statement)</h3>
          <p className="text-xs text-slate-400 mt-0.5">รวมยอดค้างชำระตามลูกค้า</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {statementGroups.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ไม่มีบิลค้างชำระ</div>
          ) : statementGroups.map(group => (
            <div key={group.customer} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div>
                  <span className="font-semibold text-sm text-slate-800 dark:text-white">{group.customer}</span>
                  <p className="text-[10px] text-slate-400">{group.invoices.length} ใบแจ้งหนี้ค้างชำระ</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-blue-600">฿{group.total.toLocaleString()}</span>
                  <button
                    onClick={() => onIssueStatement(group)}
                    disabled={!canCreateInvoice || !group.customer_id || statementBusyKey === group.key}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {statementBusyKey === group.key ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    ออกเอกสารวางบิลรวม
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {group.invoices.map(inv => (
                  <div key={inv.invoice_id} className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono">{inv.invoice_number} — {inv.description}</span>
                    <span>฿{Number(inv.balance_amount ?? inv.grand_total ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <button onClick={onPrintSummary} className="mt-2 text-xs text-slate-500 hover:text-blue-700 flex items-center gap-1"><Printer size={10} /> พิมพ์สรุปบนหน้าจอนี้</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> ใบเสร็จรับเงิน (Receipt)</h3>
          <p className="text-xs text-slate-400 mt-0.5">บิลที่ชำระแล้ว สามารถออกใบเสร็จ</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {paidInvoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ยังไม่มีบิลที่ชำระแล้ว</div>
          ) : paidInvoices.map(inv => (
            <div key={inv.invoice_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{inv.invoice_number}</span>
                    <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">ชำระแล้ว</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{inv.customer_name} • {inv.description} • ฿{inv.grand_total.toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  <button onClick={() => onPrintReceipt(inv)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 flex items-center gap-1">
                    <Printer size={12} /> พิมพ์ใบเสร็จ
                  </button>
                  <button onClick={() => onPrintContinuousReceipt(inv)}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-1">
                    <Printer size={12} /> ฟอร์มต่อเนื่อง
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
