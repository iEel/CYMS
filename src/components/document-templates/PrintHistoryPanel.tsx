'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export type PrintHistoryPanelProps = {
  templateCode?: string;
  templateVersion?: number;
};

type PrintHistoryRow = {
  print_id: number;
  document_type: string;
  document_id: number;
  document_no?: string | null;
  template_code: string;
  template_version: number;
  print_no: number;
  is_reprint: boolean;
  reprint_count: number;
  reprint_reason?: string | null;
  manual_preprinted_form_no?: string | null;
  mode: string;
  copy_mode: string;
  printed_by?: number | null;
  printed_by_name?: string | null;
  printed_at?: string | null;
  has_snapshot: boolean;
};

type PrintHistoryResponse = {
  prints?: PrintHistoryRow[];
  error?: string;
};

function formattedDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function printCountLabel(print: PrintHistoryRow) {
  if (!print.is_reprint) return `Print ${print.print_no}`;
  return `Reprint ${print.reprint_count}`;
}

export function PrintHistoryPanel({ templateCode, templateVersion }: PrintHistoryPanelProps) {
  const [prints, setPrints] = useState<PrintHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const canLoad = Boolean(templateCode && templateVersion);

  useEffect(() => {
    if (!templateCode || !templateVersion) {
      setPrints([]);
      setError('');
      setLoading(false);
      return;
    }

    const nextTemplateCode = templateCode;
    const nextTemplateVersion = templateVersion;
    const controller = new AbortController();
    let cancelled = false;

    async function loadPrintHistory() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          templateCode: nextTemplateCode,
          templateVersion: String(nextTemplateVersion),
          limit: '20',
        });
        const response = await fetch(`/api/document-templates/print-history?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json() as PrintHistoryResponse;
        if (!response.ok) throw new Error(data.error || 'Unable to load print history');
        if (!cancelled) setPrints(data.prints || []);
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Unable to load print history');
          setPrints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPrintHistory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [templateCode, templateVersion, reloadKey]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Recent prints</h4>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {templateCode && templateVersion ? `${templateCode} · v${templateVersion}` : 'No template version selected'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey(key => key + 1)}
          disabled={!canLoad || loading}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!canLoad ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
          Select a template version to view print history.
        </p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : loading && prints.length === 0 ? (
        <p className="mt-4 px-3 py-4 text-center text-xs text-slate-400">Loading print history...</p>
      ) : prints.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
          No prints recorded for this template version.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-700">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-400">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Document</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Print</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Mode</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Reason / form</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Printed by</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {prints.map(print => (
                <tr key={print.print_id} className="text-slate-600 dark:text-slate-300">
                  <td className="whitespace-nowrap px-3 py-2">
                    <p className="font-semibold text-slate-800 dark:text-white">{print.document_no || `#${print.document_id}`}</p>
                    <p className="text-[11px] text-slate-400">{print.document_type}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <p>{printCountLabel(print)}</p>
                    <p className="text-[11px] text-slate-400">{formattedDate(print.printed_at)}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <p>{print.mode}</p>
                    <p className="text-[11px] text-slate-400">{print.copy_mode}</p>
                  </td>
                  <td className="min-w-48 px-3 py-2">
                    <p>{print.reprint_reason || '-'}</p>
                    <p className="text-[11px] text-slate-400">{print.manual_preprinted_form_no || '-'}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{print.printed_by_name || (print.printed_by ? `User #${print.printed_by}` : '-')}</td>
                  <td className="whitespace-nowrap px-3 py-2">{print.has_snapshot ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
