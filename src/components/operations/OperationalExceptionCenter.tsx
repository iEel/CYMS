'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import ActionInputDialog, { type ActionInputField } from '@/components/ui/ActionInputDialog';
import type {
  OperationalExceptionAction,
  OperationalExceptionItem,
  OperationalExceptionSeverity,
  OperationalExceptionSource,
  OperationalExceptionSummary,
} from '@/lib/operationalExceptions';

type PatchAction = Exclude<OperationalExceptionAction, 'open_detail'>;
type SourceFilter = '' | OperationalExceptionSource;
type SeverityFilter = '' | OperationalExceptionSeverity;
type StatusFilter = '' | 'open' | 'in_progress' | 'pending_review' | 'acknowledged' | 'resolved' | 'ignored';

interface OperationalExceptionCenterProps {
  yardId: number;
  canManageExceptions: boolean;
  initialSource?: OperationalExceptionSource;
}

interface OperationalExceptionResponse {
  yard_id: number;
  generated_at: string;
  summary: OperationalExceptionSummary;
  exceptions: OperationalExceptionItem[];
  error?: string;
}

interface ActionDialogState {
  item: OperationalExceptionItem;
  action: PatchAction;
}

const defaultSummary: OperationalExceptionSummary = {
  total_open: 0,
  critical: 0,
  warning: 0,
  info: 0,
  sla_breached: 0,
  by_source: {
    reconciliation: 0,
    reefer: 0,
    approval: 0,
    transport: 0,
  },
};

const sourceLabels: Record<OperationalExceptionSource, string> = {
  reconciliation: 'Reconciliation',
  reefer: 'Reefer',
  approval: 'Approval',
  transport: 'Transport',
};

const severityLabels: Record<OperationalExceptionSeverity, { label: string; className: string }> = {
  critical: {
    label: 'Critical',
    className: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800',
  },
  warning: {
    label: 'Warning',
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800',
  },
  info: {
    label: 'Info',
    className: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:ring-sky-800',
  },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  open: {
    label: 'Open',
    className: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800',
  },
  in_progress: {
    label: 'In progress',
    className: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:ring-indigo-800',
  },
  pending_review: {
    label: 'Pending review',
    className: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:ring-violet-800',
  },
  acknowledged: {
    label: 'Acknowledged',
    className: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:ring-cyan-800',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800',
  },
  ignored: {
    label: 'Ignored',
    className: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600',
  },
};

const actionLabels: Record<OperationalExceptionAction, string> = {
  assign: 'Assign',
  acknowledge: 'Acknowledge',
  resolve: 'Resolve',
  ignore: 'Ignore',
  reopen: 'Reopen',
  open_detail: 'Open detail',
};

const noteRequiredActions = new Set<PatchAction>(['resolve', 'ignore', 'reopen']);
const REEFER_ASSIGN_HELP = 'Reefer assign requires a user ID; open the Reefer page to assign this exception.';

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSlaAge(item: OperationalExceptionItem) {
  if (typeof item.sla_age_minutes === 'number') {
    if (item.sla_age_minutes < 60) return `${Math.round(item.sla_age_minutes)}m`;
    if (item.sla_age_minutes < 1440) return `${Math.round(item.sla_age_minutes / 60)}h`;
    return `${Math.round(item.sla_age_minutes / 1440)}d`;
  }
  if (typeof item.sla_age_days === 'number') return `${Math.round(item.sla_age_days)}d`;
  return '-';
}

function positiveEntityId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function entityLabel(item: OperationalExceptionItem) {
  return item.entity_ref || String(item.entity_id || '-');
}

function badge(className: string) {
  return `inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${className}`;
}

export default function OperationalExceptionCenter({
  yardId,
  canManageExceptions,
  initialSource,
}: OperationalExceptionCenterProps) {
  const { toast } = useToast();
  const [source, setSource] = useState<SourceFilter>(initialSource || '');
  const [severity, setSeverity] = useState<SeverityFilter>('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [summary, setSummary] = useState<OperationalExceptionSummary>(defaultSummary);
  const [exceptions, setExceptions] = useState<OperationalExceptionItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialogState | null>(null);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        yard_id: String(yardId),
        limit: '150',
      });
      if (source) params.set('source', source);
      if (severity) params.set('severity', severity);
      if (status) params.set('status', status);
      if (includeClosed) params.set('include_closed', '1');
      if (appliedSearch.trim()) params.set('search', appliedSearch.trim());

      const response = await fetch(`/api/operations/exceptions?${params.toString()}`);
      const data = await response.json() as OperationalExceptionResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to load operational exceptions');

      setSummary(data.summary || defaultSummary);
      setExceptions(Array.isArray(data.exceptions) ? data.exceptions : []);
      setGeneratedAt(data.generated_at || null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load operational exceptions';
      setError(message);
      setSummary(defaultSummary);
      setExceptions([]);
      toast('error', 'Exception Center load failed', message);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, includeClosed, severity, source, status, toast, yardId]);

  useEffect(() => {
    void fetchExceptions();
  }, [fetchExceptions]);

  useEffect(() => {
    setSource(initialSource || '');
  }, [initialSource]);

  const metricCards = useMemo(() => [
    { label: 'Total open', value: summary.total_open, icon: <ShieldAlert size={16} />, tone: 'text-blue-600' },
    { label: 'Critical', value: summary.critical, icon: <AlertTriangle size={16} />, tone: 'text-rose-600' },
    { label: 'Warning', value: summary.warning, icon: <Clock size={16} />, tone: 'text-amber-600' },
    { label: 'SLA breached', value: summary.sla_breached, icon: <XCircle size={16} />, tone: 'text-red-600' },
  ], [summary]);

  const dialogFields: ActionInputField[] = useMemo(() => {
    if (!actionDialog) return [];
    if (actionDialog.action === 'assign') {
      return [
        {
          name: 'assigned_to',
          label: 'Assignee',
          placeholder: 'Dispatcher, billing officer, supervisor...',
          defaultValue: actionDialog.item.assigned_to || '',
          required: true,
        },
        {
          name: 'note',
          label: 'Assignment note',
          type: 'textarea',
          placeholder: 'Optional context for the assignee',
        },
      ];
    }

    return [{
      name: 'note',
      label: `${actionLabels[actionDialog.action]} note`,
      type: 'textarea',
      placeholder: 'Record the operational reason or next step',
      required: noteRequiredActions.has(actionDialog.action),
    }];
  }, [actionDialog]);

  const openActionDialog = (item: OperationalExceptionItem, action: PatchAction) => {
    if (!canManageExceptions) return;
    if (item.source === 'reefer' && action === 'assign') {
      toast('warning', 'Reefer assign is disabled here', REEFER_ASSIGN_HELP);
      return;
    }
    setActionDialog({ item, action });
  };

  const submitAction = async (values: Record<string, string>) => {
    if (!actionDialog || !canManageExceptions) return;

    const { item, action } = actionDialog;
    if (item.source === 'reefer' && action === 'assign') {
      toast('warning', 'Reefer assign is disabled here', REEFER_ASSIGN_HELP);
      return;
    }

    const entityId = positiveEntityId(item.entity_id);
    const exceptionId = item.source === 'reefer' ? entityId : null;
    const entityRef = item.entity_ref || (entityId ? undefined : String(item.entity_id || ''));

    if (item.source === 'reefer' && !exceptionId) {
      toast('error', 'Missing reefer exception id');
      return;
    }
    if (item.source !== 'reefer' && !entityId && !entityRef) {
      toast('error', 'Missing exception identity');
      return;
    }

    const actionKey = `${item.exception_id}:${action}`;
    setBusyActionKey(actionKey);

    try {
      const body: Record<string, unknown> = {
        yard_id: yardId,
        source: item.source,
        issue_code: item.issue_code,
        action,
        entity_id: entityId || undefined,
        entity_ref: entityRef || undefined,
        exception_id: exceptionId || undefined,
        note: values.note?.trim() || undefined,
      };

      if (action === 'assign') {
        body.assigned_to = values.assigned_to?.trim();
      }

      const response = await fetch('/api/operations/exceptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Unable to update exception');
      }

      toast('success', `${actionLabels[action]} saved`, entityLabel(item));
      setActionDialog(null);
      await fetchExceptions();
    } catch (patchError) {
      const message = patchError instanceof Error ? patchError.message : 'Unable to update exception';
      toast('error', `${actionLabels[action]} failed`, message);
    } finally {
      setBusyActionKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 p-4 dark:border-slate-700">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white">
                <ShieldAlert size={18} /> Exception Center
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Cross-source operational exceptions for reconciliation, reefer, approvals, and transport.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {generatedAt && <span>Updated {formatDateTime(generatedAt)}</span>}
              <button
                type="button"
                onClick={() => void fetchExceptions()}
                disabled={loading}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(metric => (
            <div key={metric.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className={`flex items-center gap-2 text-xs font-semibold uppercase ${metric.tone}`}>
                {metric.icon} {metric.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-white">{metric.value}</div>
            </div>
          ))}
        </div>

        <form
          className="grid gap-3 border-t border-slate-100 p-4 dark:border-slate-700 lg:grid-cols-[1fr_150px_150px_170px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedSearch(search);
          }}
        >
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Search title, entity, owner, assignee..."
            />
          </div>
          <select
            value={source}
            onChange={event => setSource(event.target.value as SourceFilter)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All sources</option>
            {Object.entries(sourceLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={severity}
            onChange={event => setSeverity(event.target.value as SeverityFilter)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={status}
            onChange={event => setStatus(event.target.value as StatusFilter)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Open statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="pending_review">Pending review</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Apply
            </button>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={event => setIncludeClosed(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Include closed
            </label>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 dark:border-slate-700 md:flex-row md:items-center md:justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-white">Exception list ({exceptions.length})</h3>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {Object.entries(summary.by_source).map(([sourceKey, count]) => (
              <span key={sourceKey} className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-700">
                {sourceLabels[sourceKey as OperationalExceptionSource]} {count}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 size={24} className="mx-auto animate-spin" />
          </div>
        ) : exceptions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">No exceptions found</p>
            <p className="mt-1 text-xs text-slate-400">Adjust filters or include closed items to widen the result.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {exceptions.map(item => {
              const severity = severityLabels[item.severity] || severityLabels.warning;
              const status = statusLabels[item.status] || {
                label: item.status,
                className: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600',
              };
              const actions = (item.allowed_actions || []).filter((action): action is PatchAction => action !== 'open_detail');
              const openDetailAllowed = (item.allowed_actions || []).includes('open_detail');

              return (
                <div key={item.exception_id} className="p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={badge('bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600')}>
                          {sourceLabels[item.source]}
                        </span>
                        <span className={badge(severity.className)}>{severity.label}</span>
                        <span className={badge(status.className)}>{status.label}</span>
                        {item.sla_breached && (
                          <span className={badge('bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800')}>
                            SLA breached
                          </span>
                        )}
                      </div>

                      <h4 className="mt-2 text-sm font-bold text-slate-800 dark:text-white">{item.title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</p>
                      {item.recommended_action && (
                        <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">
                          Recommended: {item.recommended_action}
                        </p>
                      )}

                      <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2 xl:grid-cols-5">
                        <span><span className="font-semibold text-slate-600 dark:text-slate-300">Entity:</span> {entityLabel(item)}</span>
                        <span><span className="font-semibold text-slate-600 dark:text-slate-300">Owner:</span> {item.owner_role || '-'}</span>
                        <span><span className="font-semibold text-slate-600 dark:text-slate-300">Assigned:</span> {item.assigned_to || 'Unassigned'}</span>
                        <span><span className="font-semibold text-slate-600 dark:text-slate-300">SLA:</span> {formatSlaAge(item)}</span>
                        <span><span className="font-semibold text-slate-600 dark:text-slate-300">Created:</span> {formatDateTime(item.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:max-w-xs xl:justify-end">
                      {openDetailAllowed && (
                        <a
                          href={item.href || '#'}
                          target={item.href?.startsWith('http') ? '_blank' : undefined}
                          rel={item.href?.startsWith('http') ? 'noreferrer' : undefined}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <ExternalLink size={13} /> Open detail
                        </a>
                      )}
                      {canManageExceptions && actions.map(action => {
                        const disabled = item.source === 'reefer' && action === 'assign';
                        const isBusy = busyActionKey === `${item.exception_id}:${action}`;

                        return (
                          <button
                            key={action}
                            type="button"
                            onClick={() => openActionDialog(item, action)}
                            disabled={disabled || isBusy}
                            title={disabled ? REEFER_ASSIGN_HELP : actionLabels[action]}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                          >
                            {isBusy ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                            {actionLabels[action]}
                          </button>
                        );
                      })}
                      {canManageExceptions && item.source === 'reefer' && (item.allowed_actions || []).includes('assign') && (
                        <span className="w-full text-[11px] text-slate-400 xl:text-right">{REEFER_ASSIGN_HELP}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ActionInputDialog
        open={Boolean(actionDialog)}
        title={actionDialog ? `${actionLabels[actionDialog.action]} exception` : 'Update exception'}
        description={actionDialog ? entityLabel(actionDialog.item) : undefined}
        fields={dialogFields}
        confirmLabel={actionDialog ? actionLabels[actionDialog.action] : 'Save'}
        loading={Boolean(actionDialog && busyActionKey === `${actionDialog.item.exception_id}:${actionDialog.action}`)}
        onCancel={() => setActionDialog(null)}
        onSubmit={values => void submitAction(values)}
      />
    </div>
  );
}
