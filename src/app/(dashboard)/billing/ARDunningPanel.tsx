'use client';

import { useMemo, useState } from 'react';
import { Bell, CheckCircle2, Copy, Loader2, Mail, MessageSquare, Phone, ShieldAlert, X } from 'lucide-react';
import { buildARDunningPlan, type ARDunningItem } from '@/lib/arDunning';
import type { ARCustomer } from './billingTypes';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';

const severityClass = {
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  danger: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  critical: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300',
};

const actionIcon: Record<ARDunningItem['recommended_action'], ReactNode> = {
  email_reminder: <Mail size={13} />,
  call_customer: <Phone size={13} />,
  credit_hold_review: <ShieldAlert size={13} />,
  final_notice_and_credit_hold_review: <ShieldAlert size={13} />,
};

export default function ARDunningPanel({ customers }: { customers: ARCustomer[] }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const plan = useMemo(() => buildARDunningPlan(customers), [customers]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [actionTarget, setActionTarget] = useState<ARDunningItem | null>(null);
  const [contactMethod, setContactMethod] = useState('email');
  const [outcome, setOutcome] = useState('sent');
  const [note, setNote] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const topItems = plan.items.slice(0, 5);

  const copyReminder = async (item: ARDunningItem) => {
    const text = `${item.email_subject}\n\n${item.email_body}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(item.customer_id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openActionLog = (item: ARDunningItem) => {
    setActionTarget(item);
    setContactMethod(item.recommended_action === 'call_customer' ? 'phone' : 'email');
    setOutcome(item.recommended_action === 'call_customer' ? 'reached' : 'sent');
    setNote('');
    setPromiseDate('');
    setPromiseAmount('');
  };

  const submitActionLog = async () => {
    if (!actionTarget || !session?.activeYardId) return;
    setLogLoading(true);
    try {
      const res = await fetch('/api/billing/dunning-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: session.activeYardId,
          customer_id: actionTarget.customer_id,
          customer_name: actionTarget.customer_name,
          stage: actionTarget.stage,
          contact_method: contactMethod,
          outcome,
          note,
          promise_to_pay_date: outcome === 'promise_to_pay' ? promiseDate || null : null,
          promise_to_pay_amount: outcome === 'promise_to_pay' ? Number(promiseAmount || 0) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast('error', 'บันทึก dunning action ไม่สำเร็จ', data.error || actionTarget.customer_name);
        return;
      }
      toast('success', 'บันทึก dunning action แล้ว', actionTarget.customer_name);
      setActionTarget(null);
    } catch (error) {
      console.error(error);
      toast('error', 'บันทึก dunning action ไม่สำเร็จ');
    } finally {
      setLogLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Bell size={16} /> AR Dunning Action Center
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">จัดลำดับลูกหนี้และสร้าง draft reminder จาก AR Aging</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="ต้องตาม" value={plan.summary.total_customers} />
          <Metric label="Critical" value={plan.summary.critical_customers} />
          <Metric label="Exposure" value={`฿${Math.round(plan.summary.total_exposure).toLocaleString()}`} />
        </div>
      </div>

      {topItems.length === 0 ? (
        <div className="p-5 text-center text-sm text-slate-400">ยังไม่มีลูกหนี้ที่ต้องติดตามตามอายุหนี้</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {topItems.map(item => (
            <div key={item.customer_id} className="p-4 flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${severityClass[item.severity]}`}>
                    {stageLabel(item.stage)}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-white">{item.customer_name}</span>
                  <span className="text-xs text-slate-400">เก่าสุด {item.oldest_days} วัน</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {item.invoice_count} ใบแจ้งหนี้ · ยอดค้าง ฿{Math.round(item.outstanding_amount).toLocaleString()} · {actionLabel(item.recommended_action)}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 truncate">{item.email_subject}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/billing?tab=invoices&search=${encodeURIComponent(item.customer_name)}`}
                  className="h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1.5"
                >
                  {actionIcon[item.recommended_action]} ดูบิล
                </a>
                <button
                  onClick={() => copyReminder(item)}
                  className="h-9 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5"
                >
                  {copiedId === item.customer_id ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  {copiedId === item.customer_id ? 'คัดลอกแล้ว' : 'Copy reminder'}
                </button>
                <button
                  onClick={() => openActionLog(item)}
                  className="h-9 px-3 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
                >
                  <MessageSquare size={13} /> Log contact
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm p-4">
          <div className="mx-auto mt-16 max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <MessageSquare size={15} /> Log AR contact
                </h3>
                <p className="text-xs text-slate-400 mt-1">{actionTarget.customer_name} · {stageLabel(actionTarget.stage)}</p>
              </div>
              <button onClick={() => setActionTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={15} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Method</span>
                  <select value={contactMethod} onChange={e => setContactMethod(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white">
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="portal">Portal</option>
                    <option value="note">Note</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">Outcome</span>
                  <select value={outcome} onChange={e => setOutcome(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white">
                    <option value="sent">Sent</option>
                    <option value="reached">Reached</option>
                    <option value="no_answer">No answer</option>
                    <option value="promise_to_pay">Promise to pay</option>
                    <option value="disputed">Disputed</option>
                    <option value="escalated">Escalated</option>
                  </select>
                </label>
              </div>

              {outcome === 'promise_to_pay' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Promise date</span>
                    <input type="date" value={promiseDate} onChange={e => setPromiseDate(e.target.value)}
                      className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">Amount</span>
                    <input type="number" min="0" value={promiseAmount} onChange={e => setPromiseAmount(e.target.value)}
                      className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-800 dark:text-white" />
                  </label>
                </div>
              )}

              <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
                placeholder="บันทึกผลการติดต่อ, ผู้รับสาย, หมายเหตุ AP หรือเงื่อนไข promise-to-pay..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white" />

              <button onClick={submitActionLog} disabled={logLoading || !session?.activeYardId}
                className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {logLoading ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                Save contact log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-20 rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}

function stageLabel(stage: ARDunningItem['stage']) {
  const labels: Record<ARDunningItem['stage'], string> = {
    friendly_reminder: 'Friendly reminder',
    second_notice: 'Second notice',
    credit_hold_review: 'Credit hold review',
    final_notice: 'Final notice',
  };
  return labels[stage];
}

function actionLabel(action: ARDunningItem['recommended_action']) {
  const labels: Record<ARDunningItem['recommended_action'], string> = {
    email_reminder: 'ส่งอีเมลแจ้งเตือน',
    call_customer: 'โทรติดตาม + อีเมลซ้ำ',
    credit_hold_review: 'เสนอพิจารณา credit hold',
    final_notice_and_credit_hold_review: 'final notice + credit hold review',
  };
  return labels[action];
}
