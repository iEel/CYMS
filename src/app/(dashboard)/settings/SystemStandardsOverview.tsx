'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, ClipboardList, Loader2, RefreshCw, Route } from 'lucide-react';

interface StatusItem {
  status: string;
  label: string;
  description: string;
  severity: string;
  next: string[];
}

interface RuleItem {
  code: string;
  title: string;
  area: string;
  severity: string;
  ownerRole: string;
  recommendedAction: string;
}

interface SopHint {
  code: string;
  module: string;
  title: string;
  when: string;
  steps: string[];
}

interface IntegrationMap {
  event: string;
  sourceModule: string;
  targetSystem: string;
  logKey: string;
  trigger: string;
  retryPolicy: string;
}

function normalizeStatuses(value: unknown): StatusItem[] {
  if (Array.isArray(value)) return value as StatusItem[];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, Omit<StatusItem, 'status'>>).map(([status, config]) => ({
    status,
    ...config,
  }));
}

export default function SystemStandardsOverview() {
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [sops, setSops] = useState<SopHint[]>([]);
  const [mappings, setMappings] = useState<IntegrationMap[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, rulesRes, sopRes, mappingRes] = await Promise.all([
        fetch('/api/settings/status-model'),
        fetch('/api/settings/data-quality'),
        fetch('/api/settings/sop'),
        fetch('/api/integrations/mapping'),
      ]);
      const [statusData, rulesData, sopData, mappingData] = await Promise.all([
        statusRes.json(),
        rulesRes.json(),
        sopRes.json(),
        mappingRes.json(),
      ]);
      setStatuses(normalizeStatuses(statusData.container_statuses));
      setRules(Array.isArray(rulesData.rules) ? rulesData.rules : []);
      setSops(Array.isArray(sopData.hints) ? sopData.hints : []);
      setMappings(Array.isArray(mappingData.mappings) ? mappingData.mappings : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> กำลังโหลด...</div>
      </div>
    );
  }

  const severityClass: Record<string, string> = {
    critical: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    normal: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    watch: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">System Standards</h3>
              <p className="text-xs text-slate-400">สถานะกลาง, data quality, SOP และ integration mapping ที่ระบบใช้เป็น metadata</p>
            </div>
          </div>
          <button onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
            <RefreshCw size={14} /> รีเฟรช
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{statuses.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Container Status</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="text-2xl font-bold text-amber-600">{rules.length}</p>
            <p className="text-xs text-amber-600">Data Quality Rules</p>
          </div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="text-2xl font-bold text-blue-600">{mappings.length}</p>
            <p className="text-xs text-blue-600">Integration Events</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4">
            <p className="text-2xl font-bold text-emerald-600">{sops.length}</p>
            <p className="text-xs text-emerald-600">SOP Hints</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-emerald-600" />
            <h4 className="font-semibold text-sm text-slate-800 dark:text-white">Container Status Model</h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {statuses.map(item => (
              <div key={item.status} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-white">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${severityClass[item.severity] || severityClass.info}`}>{item.severity}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Next: {item.next.length ? item.next.join(', ') : '-'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h4 className="font-semibold text-sm text-slate-800 dark:text-white">Data Quality Rules</h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {rules.map(rule => (
              <div key={rule.code} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-white">{rule.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{rule.ownerRole} · {rule.recommendedAction}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${severityClass[rule.severity] || severityClass.info}`}>{rule.area}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Route size={16} className="text-blue-600" />
            <h4 className="font-semibold text-sm text-slate-800 dark:text-white">Integration Mapping</h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {mappings.map(item => (
              <div key={item.event} className="p-4">
                <p className="font-semibold text-sm text-slate-800 dark:text-white">{item.sourceModule} {'->'} {item.targetSystem}</p>
                <p className="text-xs text-slate-400 mt-1">{item.event} · {item.logKey}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{item.trigger}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <h4 className="font-semibold text-sm text-slate-800 dark:text-white">Operational SOP Hints</h4>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {sops.map(item => (
              <div key={item.code} className="p-4">
                <p className="font-semibold text-sm text-slate-800 dark:text-white">{item.title}</p>
                <p className="text-xs text-slate-400 mt-1">{item.module} · {item.when}</p>
                <ul className="mt-2 space-y-1">
                  {item.steps.map(step => (
                    <li key={step} className="text-xs text-slate-500 dark:text-slate-400">- {step}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
