'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Printer,
  RefreshCw,
  Save,
  Star,
  XCircle,
} from 'lucide-react';
import { buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplateDefaults';
import type {
  DocumentTemplateConfig,
  DocumentTemplateCopyMode,
  DocumentTemplateMode,
} from '@/lib/documentTemplateTypes';

type DocumentTemplateRow = {
  template_id: number;
  template_code: string;
  template_name: string;
  document_type: string;
  description?: string | null;
  status: 'draft' | 'active' | 'inactive' | string;
  is_default: boolean;
  current_version_no?: number | null;
  version_no?: number | null;
  version_status?: string | null;
  paper_width_mm?: number | null;
  paper_height_mm?: number | null;
  paper_size_code?: string | null;
  mode?: DocumentTemplateMode | null;
  copy_mode?: DocumentTemplateCopyMode | null;
  published_at?: string | null;
  updated_at?: string | null;
};

type TemplateDetail = {
  template: DocumentTemplateRow;
  versions: Array<DocumentTemplateRow & {
    version_id: number;
    config?: DocumentTemplateConfig | null;
  }>;
};

type TemplateListResponse = {
  templates?: DocumentTemplateRow[];
  error?: string;
};

const defaultConfig = buildDefaultContinuousTemplateConfig();

function cloneDefaultConfig(): DocumentTemplateConfig {
  return JSON.parse(JSON.stringify(defaultConfig)) as DocumentTemplateConfig;
}

function statusTone(status?: string | null) {
  if (status === 'active' || status === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'inactive') return 'bg-slate-100 text-slate-500 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH');
}

function nextDuplicateCode(template: DocumentTemplateRow) {
  return `${template.template_code || 'TPL'}_COPY_${Date.now().toString().slice(-5)}`;
}

function openPrintPreview(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  window.open(`/billing/print/continuous?${query.toString()}`, '_blank', 'noopener,noreferrer');
}

export default function DocumentTemplateManager() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [config, setConfig] = useState<DocumentTemplateConfig>(() => cloneDefaultConfig());
  const [invoiceId, setInvoiceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find(template => template.template_id === selectedId) || templates[0] || null,
    [selectedId, templates],
  );
  const selectedIsDraft = selectedTemplate?.version_status === 'draft' || selectedTemplate?.status === 'draft';

  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/document-templates');
      const data = await response.json() as TemplateListResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to load document templates');
      const nextTemplates = data.templates || [];
      setTemplates(nextTemplates);
      setSelectedId(current => current && nextTemplates.some(item => item.template_id === current)
        ? current
        : nextTemplates[0]?.template_id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load document templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedTemplate) {
        setConfig(cloneDefaultConfig());
        return;
      }

      setError('');
      try {
        const response = await fetch(`/api/document-templates/${selectedTemplate.template_id}`);
        const detail = await response.json() as TemplateDetail & { error?: string };
        if (!response.ok) throw new Error(detail.error || 'Unable to load template detail');
        const currentVersion = detail.versions.find(version => version.version_no === detail.template.current_version_no)
          || detail.versions[0];
        if (!cancelled) setConfig(currentVersion?.config || cloneDefaultConfig());
      } catch (err) {
        if (!cancelled) {
          setConfig(cloneDefaultConfig());
          setError(err instanceof Error ? err.message : 'Unable to load template detail');
        }
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate]);

  const updatePaper = (key: keyof DocumentTemplateConfig['paper'], value: number) => {
    setConfig(current => ({
      ...current,
      paper: {
        ...current.paper,
        [key]: value,
      },
    }));
  };

  const updateMode = (mode: DocumentTemplateMode) => setConfig(current => ({ ...current, mode }));
  const updateCopyMode = (copyMode: DocumentTemplateCopyMode) => setConfig(current => ({ ...current, copy_mode: copyMode }));
  const updateCopyLabel = (index: number, value: string) => {
    setConfig(current => ({
      ...current,
      copy_labels: current.copy_labels.map((label, labelIndex) => labelIndex === index ? value : label),
    }));
  };

  const updatePrintPolicy = (key: keyof DocumentTemplateConfig['print_policy'], value: string) => {
    setConfig(current => ({
      ...current,
      print_policy: {
        ...current.print_policy,
        [key]: value,
      },
    }));
  };

  const saveDraft = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/document-templates/${selectedTemplate.template_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to save template');
      setMessage('บันทึก draft layout แล้ว');
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: 'duplicate' | 'publish' | 'set-default' | 'deactivate') => {
    if (!selectedTemplate) return;
    const actionKey = `${selectedTemplate.template_id}:${action}`;
    setActionId(actionKey);
    setError('');
    setMessage('');
    try {
      const body = action === 'duplicate'
        ? {
          template_code: nextDuplicateCode(selectedTemplate),
          template_name: `${selectedTemplate.template_name} Copy`,
          document_type: selectedTemplate.document_type,
          description: selectedTemplate.description,
          config,
        }
        : action === 'publish'
          ? { version_no: selectedTemplate.current_version_no || selectedTemplate.version_no }
          : {};
      const response = await fetch(`/api/document-templates/${selectedTemplate.template_id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: string; template?: DocumentTemplateRow };
      if (!response.ok) throw new Error(data.error || `Unable to ${action} template`);
      setMessage(action === 'set-default' ? 'ตั้งเป็น default แล้ว' : `ดำเนินการ ${action} แล้ว`);
      await loadTemplates();
      if (action === 'duplicate' && data.template?.template_id) setSelectedId(data.template.template_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} template`);
    } finally {
      setActionId(null);
    }
  };

  const exportSelected = () => {
    if (!selectedTemplate) return;
    const blob = new Blob([JSON.stringify({ template: selectedTemplate, config }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedTemplate.template_code || 'document-template'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setActionId('import');
    setError('');
    setMessage('');
    try {
      const imported = JSON.parse(await file.text()) as {
        template?: Partial<DocumentTemplateRow>;
        config?: DocumentTemplateConfig;
      };
      const templateCode = `${imported.template?.template_code || 'TPL'}_${Date.now().toString().slice(-5)}`.toUpperCase();
      const response = await fetch('/api/document-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_code: templateCode,
          template_name: imported.template?.template_name ? `${imported.template.template_name} Import` : 'Imported Document Template',
          document_type: imported.template?.document_type || 'tax_invoice_receipt',
          description: imported.template?.description || 'Imported from settings JSON',
          config: imported.config || cloneDefaultConfig(),
        }),
      });
      const data = await response.json() as { error?: string; template?: DocumentTemplateRow };
      if (!response.ok) throw new Error(data.error || 'Unable to import template');
      setMessage('นำเข้า template แล้ว');
      await loadTemplates();
      if (data.template?.template_id) setSelectedId(data.template.template_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import template');
    } finally {
      setActionId(null);
      event.target.value = '';
    }
  };

  const realPreview = (testPrint = false) => {
    if (!invoiceId.trim()) {
      setError('ระบุ invoice id ก่อน preview เอกสารจริง');
      return;
    }
    openPrintPreview({
      id: invoiceId.trim(),
      type: 'tax_invoice_receipt',
      preview: 'real',
      mode: config.mode,
      copyMode: config.copy_mode,
      ...(testPrint ? { testPrint: '1' } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Document Templates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            จัดการ continuous form, preview งานจริง และ lifecycle ของ template
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadTemplates}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300"
          >
            <FileUp size={14} /> Import
          </button>
          <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={importTemplate} />
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)] gap-4">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Template</th>
                  <th className="px-3 py-2 font-semibold">Document</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Paper</th>
                  <th className="px-3 py-2 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading templates...</td></tr>
                ) : templates.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No document templates found</td></tr>
                ) : templates.map(template => (
                  <tr
                    key={template.template_id}
                    onClick={() => setSelectedId(template.template_id)}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${selectedTemplate?.template_id === template.template_id ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {template.is_default && <Star size={13} className="fill-amber-400 text-amber-400" />}
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white">{template.template_name}</p>
                          <p className="text-[11px] text-slate-400">{template.template_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{template.document_type}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(template.status)}`}>
                        {template.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {template.paper_size_code || `${template.paper_width_mm || '-'}x${template.paper_height_mm || '-'}mm`}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(template.updated_at || template.published_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Selected template</p>
              <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                {selectedTemplate?.template_name || 'No template selected'}
              </h4>
            </div>
            <button
              type="button"
              onClick={exportSelected}
              disabled={!selectedTemplate}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
            >
              <Download size={13} /> Export
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => openPrintPreview({ preview: 'sample', mode: config.mode, copyMode: config.copy_mode })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">
              <ExternalLink size={14} /> Sample preview
            </button>
            <button type="button" onClick={() => realPreview(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900">
              <Printer size={14} /> Test print
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={invoiceId}
              onChange={event => setInvoiceId(event.target.value)}
              placeholder="Invoice ID for real preview"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <button type="button" onClick={() => realPreview(false)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200">
              Real preview
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => runAction('duplicate')} disabled={!selectedTemplate || actionId !== null}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
              <Copy size={13} /> Duplicate
            </button>
            <button type="button" onClick={() => runAction('publish')} disabled={!selectedTemplate || actionId !== null}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
              <CheckCircle2 size={13} /> Publish
            </button>
            <button type="button" onClick={() => runAction('set-default')} disabled={!selectedTemplate || actionId !== null}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
              <Star size={13} /> Set default
            </button>
            <button type="button" onClick={() => runAction('deactivate')} disabled={!selectedTemplate || actionId !== null}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
              <XCircle size={13} /> Deactivate
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Continuous Form Settings</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Paper, mode, offsets, copy labels และ red reference source</p>
          </div>
          <button
            type="button"
            onClick={saveDraft}
            disabled={!selectedTemplate || !selectedIsDraft || saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            title={selectedIsDraft ? 'Save draft layout' : 'Only current draft versions can be saved'}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save draft'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <label className="text-xs font-medium text-slate-500">
            Width mm
            <input type="number" step="0.1" value={config.paper.width_mm} onChange={event => updatePaper('width_mm', Number(event.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Height mm
            <input type="number" step="0.1" value={config.paper.height_mm} onChange={event => updatePaper('height_mm', Number(event.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Top offset
            <input type="number" step="0.1" value={config.paper.top_offset_mm} onChange={event => updatePaper('top_offset_mm', Number(event.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Left offset
            <input type="number" step="0.1" value={config.paper.left_offset_mm} onChange={event => updatePaper('left_offset_mm', Number(event.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Print scale
            <input type="number" step="0.01" value={config.paper.print_scale} onChange={event => updatePaper('print_scale', Number(event.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Mode
            <select value={config.mode} onChange={event => updateMode(event.target.value as DocumentTemplateMode)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="full">full</option>
              <option value="overlay">overlay</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Copy mode
            <select value={config.copy_mode} onChange={event => updateCopyMode(event.target.value as DocumentTemplateCopyMode)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="carbonless">carbonless</option>
              <option value="separate">separate</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Row height
            <input type="number" step="0.1" value={config.sections.line_items.row_height_mm} onChange={event => setConfig(current => ({
              ...current,
              sections: {
                ...current.sections,
                line_items: { ...current.sections.line_items, row_height_mm: Number(event.target.value) },
              },
            }))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-slate-500">
            Reprint label
            <input value={config.print_policy.reprint_label_template} onChange={event => updatePrintPolicy('reprint_label_template', event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Red ref source
            <select value={config.print_policy.red_ref_source} onChange={event => updatePrintPolicy('red_ref_source', event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="tax_invoice_number">tax_invoice_number</option>
              <option value="receipt_number">receipt_number</option>
              <option value="invoice_number">invoice_number</option>
              <option value="document_number">document_number</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
          {config.copy_labels.slice(0, 5).map((label, index) => (
            <label key={index} className="text-xs font-medium text-slate-500">
              Copy {index + 1}
              <input value={label} onChange={event => updateCopyLabel(index, event.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
