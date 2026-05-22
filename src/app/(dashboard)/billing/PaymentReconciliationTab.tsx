'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Upload, XCircle } from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';

interface PaymentReconciliationRow {
  reconciliation_id: number;
  statement_ref: string;
  paid_at?: string | null;
  payer_name?: string | null;
  amount: number;
  invoice_number_hint?: string | null;
  status: string;
  invoice_id?: number | null;
  invoice_number?: string | null;
  customer_name?: string | null;
}

interface PaymentReconciliationLabels {
  importTitle: string;
  matchLabel: string;
}

const inputClass = 'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function parseStatement(text: string) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [statement_ref, paid_at, payer_name, amount, invoice_number] = line.split(',').map(item => item.trim());
      return { statement_ref, paid_at, payer_name, amount: Number(amount), invoice_number };
    })
    .filter(row => row.statement_ref && Number.isFinite(row.amount) && row.amount > 0);
}

export default function PaymentReconciliationTab({ yardId, labels, endpoint }: { yardId: number; labels: PaymentReconciliationLabels; endpoint: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PaymentReconciliationRow[]>([]);
  const [summary, setSummary] = useState({ pending_count: 0, matched_count: 0, pending_amount: 0, matched_amount: 0 });
  const [loading, setLoading] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}?yard_id=${yardId}`);
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || { pending_count: 0, matched_count: 0, pending_amount: 0, matched_amount: 0 });
    } catch {
      toast('error', 'โหลด Payment Reconciliation ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [yardId, toast, endpoint]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const importRows = async () => {
    const parsed = parseStatement(importText);
    if (parsed.length === 0) {
      toast('warning', 'ไม่พบรายการที่นำเข้าได้', 'รูปแบบ: ref,date,payer,amount,invoice_number');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, rows: parsed }),
      });
      const data = await res.json();
      if (data.success) {
        toast('success', 'นำเข้า Statement แล้ว', `${data.imported} รายการ`);
        setImportText('');
        fetchRows();
      } else {
        toast('error', data.error || 'นำเข้าไม่สำเร็จ');
      }
    } finally {
      setImporting(false);
    }
  };

  const updateRow = async (row: PaymentReconciliationRow, action: 'match' | 'ignore') => {
    const invoiceId = action === 'match'
      ? Number(window.prompt('Invoice ID ที่ต้องการ Match', row.invoice_id ? String(row.invoice_id) : ''))
      : null;
    if (action === 'match' && (!invoiceId || !Number.isInteger(invoiceId))) return;
    const note = window.prompt(action === 'match' ? 'หมายเหตุการ Match Invoice' : 'เหตุผลที่ Ignore', '');
    if (note === null) return;
    setBusyId(row.reconciliation_id);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconciliation_id: row.reconciliation_id, action, invoice_id: invoiceId, note }),
      });
      const data = await res.json();
      if (data.success) {
        toast('success', action === 'match' ? 'Match Invoice แล้ว' : 'Ignore รายการแล้ว');
        fetchRows();
      } else {
        toast('error', data.error || 'อัปเดตไม่สำเร็จ');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Pending" value={summary.pending_count} />
        <Metric label="Matched" value={summary.matched_count} />
        <Metric label="Pending Amount" value={summary.pending_amount} money />
        <Metric label="Matched Amount" value={summary.matched_amount} money />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">{labels.importTitle}</h3>
            <p className="text-xs text-slate-400">วาง CSV: statement_ref, paid_at, payer_name, amount, invoice_number</p>
          </div>
          <button onClick={importRows} disabled={importing} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} นำเข้า
          </button>
        </div>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          className="min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="BANK-001,2026-05-22,ACME,1070,INV-202605-000001"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white">Payment Reconciliation</h3>
          <button onClick={fetchRows} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
            <RotateCcw size={13} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">ยังไม่มีรายการรับเงินจาก statement</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-400 dark:bg-slate-700/30">
                <tr>
                  <th className="p-3 text-left">Ref</th>
                  <th className="p-3 text-left">Payer</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-left">Hint</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map(row => (
                  <tr key={row.reconciliation_id}>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-200">{row.statement_ref}</td>
                    <td className="p-3 text-slate-500">{row.payer_name || '-'}</td>
                    <td className="p-3 text-right font-semibold text-slate-800 dark:text-white">฿{Number(row.amount || 0).toLocaleString()}</td>
                    <td className="p-3 font-mono text-slate-500">{row.invoice_number_hint || row.invoice_number || '-'}</td>
                    <td className="p-3"><StatusPill status={row.status} /></td>
                    <td className="p-3 text-right">
                      {row.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => updateRow(row, 'match')} disabled={busyId === row.reconciliation_id} className={`${inputClass} inline-flex items-center gap-1 bg-emerald-50 text-emerald-700`}>
                            <CheckCircle2 size={13} /> {labels.matchLabel}
                          </button>
                          <button onClick={() => updateRow(row, 'ignore')} disabled={busyId === row.reconciliation_id} className={`${inputClass} inline-flex items-center gap-1 bg-slate-50 text-slate-500`}>
                            <XCircle size={13} /> Ignore
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">{money ? `฿${Number(value || 0).toLocaleString()}` : Number(value || 0).toLocaleString()}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'matched'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'ignored'
      ? 'bg-slate-100 text-slate-500'
      : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{status}</span>;
}
