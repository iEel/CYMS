'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FilePlus2,
  FileUp,
  RefreshCw,
  Star,
  XCircle,
} from 'lucide-react';
import { CalibrationProfilesPanel } from '@/components/document-templates/CalibrationProfilesPanel';
import { DocumentTemplateDesigner } from '@/components/document-templates/DocumentTemplateDesigner';
import { PrintHistoryPanel } from '@/components/document-templates/PrintHistoryPanel';
import { PublishDiffDialog } from '@/components/document-templates/PublishDiffDialog';
import { buildSampleContinuousPrintPayload, type CompanyProfileSampleSource } from '@/lib/billingContinuousPrintSample';
import {
  buildDefaultA4TaxReceiptTemplateConfig,
  buildDefaultContinuousTemplateConfig,
} from '@/lib/documentTemplateDefaults';
import { applyPaperPatchToConfig, summarizeTemplateDiff, validateDesignerTemplateConfig } from '@/lib/documentTemplateDesigner';
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

type DocumentTemplateVersion = DocumentTemplateRow & {
  version_id: number;
  config?: DocumentTemplateConfig | null;
  status: string;
};

type TemplateDetail = {
  template: DocumentTemplateRow;
  versions: DocumentTemplateVersion[];
};

type TemplateListResponse = {
  templates?: DocumentTemplateRow[];
  error?: string;
};

type PreviewParamOptions = {
  calibrationProfileId?: string;
};

type PublishDraftContext = {
  templateId: number;
  templateName: string;
  templateCode: string;
  versionNo: number;
  config: DocumentTemplateConfig;
  changes: string[];
};

type DefaultTemplateKind = 'continuous' | 'a4';

const defaultConfig = buildDefaultContinuousTemplateConfig();

function cloneDefaultConfig(): DocumentTemplateConfig {
  return JSON.parse(JSON.stringify(defaultConfig)) as DocumentTemplateConfig;
}

function cloneTemplateConfig(config: DocumentTemplateConfig): DocumentTemplateConfig {
  return JSON.parse(JSON.stringify(config)) as DocumentTemplateConfig;
}

function defaultTemplateDefinition(kind: DefaultTemplateKind) {
  if (kind === 'a4') {
    return {
      template_code: `A4_TAX_RECEIPT_${Date.now().toString().slice(-5)}`,
      template_name: 'A4 Tax Invoice / Receipt',
      document_type: 'tax_invoice_receipt',
      description: 'Default A4 tax invoice / receipt template',
      config: buildDefaultA4TaxReceiptTemplateConfig(),
    };
  }

  return {
    template_code: `CONT_TAX_RECEIPT_${Date.now().toString().slice(-5)}`,
    template_name: 'Continuous Tax Invoice / Receipt',
    document_type: 'tax_invoice_receipt',
    description: 'Default continuous tax invoice / receipt template',
    config: cloneDefaultConfig(),
  };
}

function statusTone(status?: string | null) {
  if (status === 'active' || status === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'inactive') return 'bg-slate-100 text-slate-500 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function nextDuplicateCode(template: DocumentTemplateRow) {
  return `${template.template_code || 'TPL'}_COPY_${Date.now().toString().slice(-5)}`;
}

function openPrintPreview(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  window.open(`/billing/print/continuous?${query.toString()}`, '_blank', 'noopener,noreferrer');
}

function chooseEditableVersion(detail: TemplateDetail) {
  return detail.versions.find(version => version.status === 'draft')
    || detail.versions.find(version => version.version_no === detail.template.current_version_no)
    || detail.versions[0]
    || null;
}

function choosePublishedBaselineConfig(detail: TemplateDetail | null) {
  if (!detail?.template.current_version_no) return null;
  const currentVersions = detail.versions.filter(version => (
    version.version_no === detail.template.current_version_no && version.config
  ));
  const publishedVersion = currentVersions.find(version => (
    version.status === 'published' || version.status === 'active'
  ));
  return publishedVersion?.config || currentVersions[0]?.config || null;
}

export default function DocumentTemplateManager() {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const publishInFlightRef = useRef(false);
  const [templates, setTemplates] = useState<DocumentTemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [editingVersion, setEditingVersion] = useState<DocumentTemplateVersion | null>(null);
  const [config, setConfig] = useState<DocumentTemplateConfig>(() => cloneDefaultConfig());
  const [invoiceId, setInvoiceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishDraftContext, setPublishDraftContext] = useState<PublishDraftContext | null>(null);
  const [companyPreview, setCompanyPreview] = useState<CompanyProfileSampleSource | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find(template => template.template_id === selectedId) || templates[0] || null,
    [selectedId, templates],
  );
  const canEditDraft = editingVersion?.status === 'draft';
  const selectedTemplateVersion = editingVersion?.version_no || selectedTemplate?.current_version_no || selectedTemplate?.version_no || undefined;
  const designerSamplePayload = useMemo(() => buildSampleContinuousPrintPayload(companyPreview), [companyPreview]);

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

  const loadCompanyPreview = async () => {
    try {
      const response = await fetch('/api/settings/company');
      if (!response.ok) return;
      const data = await response.json() as CompanyProfileSampleSource | null;
      setCompanyPreview(data || null);
    } catch {
      setCompanyPreview(null);
    }
  };

  const loadDetail = async (templateId: number) => {
    setError('');
    const response = await fetch(`/api/document-templates/${templateId}`);
    const nextDetail = await response.json() as TemplateDetail & { error?: string };
    if (!response.ok) throw new Error(nextDetail.error || 'Unable to load template detail');

    const version = chooseEditableVersion(nextDetail);
    const versionConfig = version?.config ? cloneTemplateConfig(version.config) : cloneDefaultConfig();
    setDetail(nextDetail);
    setEditingVersion(version);
    setConfig(versionConfig);
  };

  useEffect(() => {
    loadTemplates();
    loadCompanyPreview();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedTemplate) {
        setDetail(null);
        setEditingVersion(null);
        setConfig(cloneDefaultConfig());
        return;
      }

      try {
        await loadDetail(selectedTemplate.template_id);
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setEditingVersion(null);
          setConfig(cloneDefaultConfig());
          setError(err instanceof Error ? err.message : 'Unable to load template detail');
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedTemplate]);

  useEffect(() => {
    setPublishDialogOpen(false);
    setPublishDraftContext(null);
  }, [selectedId, detail?.template.current_version_no]);

  const createDraft = async () => {
    if (!selectedTemplate) return;
    setActionId('draft');
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/document-templates/${selectedTemplate.template_id}/draft`, {
        method: 'POST',
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to create draft version');
      await loadDetail(selectedTemplate.template_id);
      setMessage('สร้าง draft version สำหรับแก้ไขแล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create draft version');
    } finally {
      setActionId(null);
    }
  };

  const createDefaultTemplate = async (kind: DefaultTemplateKind) => {
    setActionId(`create-default-${kind}`);
    setError('');
    setMessage('');
    const definition = defaultTemplateDefinition(kind);
    try {
      const response = await fetch('/api/document-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(definition),
      });
      const data = await response.json() as { error?: string; template?: DocumentTemplateRow };
      if (!response.ok) throw new Error(data.error || 'Unable to create default template');
      await loadTemplates();
      if (data.template?.template_id) setSelectedId(data.template.template_id);
      setMessage(kind === 'a4' ? 'สร้าง default A4 template แล้ว' : 'สร้าง default continuous template แล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create default template');
    } finally {
      setActionId(null);
    }
  };

  const saveDraft = async () => {
    if (!selectedTemplate || !canEditDraft) return false;
    const validation = validateDesignerTemplateConfig(config);
    if (!validation.valid) {
      setError(validation.errors[0] || 'Template config ไม่ถูกต้อง');
      return false;
    }

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
      await loadDetail(selectedTemplate.template_id);
      await loadTemplates();
      setMessage('บันทึก draft layout แล้ว');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDraftForContext = async (context: PublishDraftContext) => {
    const validation = validateDesignerTemplateConfig(context.config);
    if (!validation.valid) {
      setError(validation.errors[0] || 'Template config ไม่ถูกต้อง');
      return false;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/document-templates/${context.templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: context.config }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to save template');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = () => {
    if (!selectedTemplate || !editingVersion || !canEditDraft) return;
    const versionNo = editingVersion.version_no;
    if (!versionNo) {
      setError('ไม่พบ version สำหรับ publish');
      return;
    }
    const validation = validateDesignerTemplateConfig(config);
    if (!validation.valid) {
      setError(validation.errors[0] || 'Template config ไม่ถูกต้อง');
      return;
    }

    const changes = summarizeTemplateDiff(choosePublishedBaselineConfig(detail), config);
    setError('');
    setMessage('');
    setPublishDraftContext({
      templateId: selectedTemplate.template_id,
      templateName: selectedTemplate.template_name,
      templateCode: selectedTemplate.template_code,
      versionNo,
      config: cloneTemplateConfig(config),
      changes,
    });
    setPublishDialogOpen(true);
  };

  const cancelPublish = () => {
    if (actionId === 'publish' || saving) return;
    setPublishDialogOpen(false);
    setPublishDraftContext(null);
  };

  const confirmPublishDraft = async () => {
    const context = publishDraftContext;
    if (!context) return;
    if (publishInFlightRef.current) return;
    if (actionId === 'publish') return;
    publishInFlightRef.current = true;
    setPublishDialogOpen(false);
    setActionId('publish');
    setError('');
    setMessage('');
    try {
      const saved = await saveDraftForContext(context);
      if (!saved) return;
      const response = await fetch(`/api/document-templates/${context.templateId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_no: context.versionNo }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to publish template');
      await loadTemplates();
      await loadDetail(context.templateId);
      setPublishDraftContext(null);
      setMessage('Publish template version แล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish template');
    } finally {
      publishInFlightRef.current = false;
      setActionId(null);
    }
  };

  const runAction = async (action: 'duplicate' | 'set-default' | 'deactivate') => {
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
        : {};
      const response = await fetch(`/api/document-templates/${selectedTemplate.template_id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { error?: string; template?: DocumentTemplateRow };
      if (!response.ok) throw new Error(data.error || `Unable to ${action} template`);
      await loadTemplates();
      if (action === 'duplicate' && data.template?.template_id) setSelectedId(data.template.template_id);
      setMessage(action === 'set-default' ? 'ตั้งเป็น default แล้ว' : `ดำเนินการ ${action} แล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} template`);
    } finally {
      setActionId(null);
    }
  };

  const exportSelected = () => {
    if (!selectedTemplate) return;
    const blob = new Blob([JSON.stringify({ template: selectedTemplate, version: editingVersion, config }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedTemplate.template_code || 'document-template'}-designer.json`;
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
      const importedConfig = imported.config || cloneDefaultConfig();
      const validation = validateDesignerTemplateConfig(importedConfig);
      if (!validation.valid) throw new Error(validation.errors[0] || 'Imported template JSON ไม่ถูกต้อง');

      const templateCode = `${imported.template?.template_code || 'TPL'}_${Date.now().toString().slice(-5)}`.toUpperCase();
      const response = await fetch('/api/document-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_code: templateCode,
          template_name: imported.template?.template_name ? `${imported.template.template_name} Import` : 'Imported Document Template',
          document_type: imported.template?.document_type || 'tax_invoice_receipt',
          description: imported.template?.description || 'Imported from designer JSON',
          config: importedConfig,
        }),
      });
      const data = await response.json() as { error?: string; template?: DocumentTemplateRow };
      if (!response.ok) throw new Error(data.error || 'Unable to import template');
      await loadTemplates();
      if (data.template?.template_id) setSelectedId(data.template.template_id);
      setMessage('นำเข้า template แล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import template');
    } finally {
      setActionId(null);
      event.target.value = '';
    }
  };

  const previewParams = (preview: 'sample' | 'real', testPrint = false, options?: PreviewParamOptions) => {
    if (!selectedTemplate || !editingVersion) return {};
    const params: Record<string, string> = {
      type: selectedTemplate?.document_type || 'tax_invoice_receipt',
      preview,
      mode: config.mode,
      copyMode: config.copy_mode,
      returnTo: '/settings?tab=document-templates',
      templateId: String(selectedTemplate.template_id),
      versionNo: String(editingVersion.version_no),
    };
    if (testPrint) params.testPrint = '1';
    if (options?.calibrationProfileId) params.calibrationProfileId = options.calibrationProfileId;
    if (preview === 'real') params.id = invoiceId.trim();
    return params;
  };

  const ensurePreviewReady = async () => {
    if (!selectedTemplate || !editingVersion) {
      setError('เลือกหรือสร้าง document template ก่อน Preview');
      return false;
    }
    if (!canEditDraft) return true;
    return await saveDraft();
  };

  const samplePreview = async () => {
    if (!await ensurePreviewReady()) return;
    openPrintPreview(previewParams('sample'));
  };

  const testPrint = async (options?: PreviewParamOptions) => {
    if (!await ensurePreviewReady()) return;
    openPrintPreview(previewParams('sample', true, options));
  };

  const realPreview = async () => {
    if (!invoiceId.trim()) {
      setError('ระบุ invoice id ก่อน preview เอกสารจริง');
      return;
    }
    if (!await ensurePreviewReady()) return;
    openPrintPreview(previewParams('real'));
  };

  const updatePaper = (key: keyof DocumentTemplateConfig['paper'], value: number) => {
    if (!Number.isFinite(value)) return;
    setConfig(current => applyPaperPatchToConfig(current, { [key]: value }));
  };

  const isContinuousFamily = config.template_family === 'continuous_tax_receipt'
    || selectedTemplate?.template_code?.startsWith('CONT_')
    || selectedTemplate?.template_name?.toLowerCase().includes('continuous');
  const isA4Family = config.template_family === 'a4_tax_receipt'
    || selectedTemplate?.template_code?.startsWith('A4_')
    || selectedTemplate?.template_name?.toLowerCase().includes('a4');
  const paperSummary = isA4Family
    ? 'A4 layout'
    : isContinuousFamily
      ? 'Continuous 9.5 x 5.5 layout'
      : 'Custom layout';
  const showContinuousPaperWarning = isContinuousFamily
    && (Math.abs(config.paper.width_mm - 241.3) > 0.1 || Math.abs(config.paper.height_mm - 139.7) > 0.1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Document Templates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Canvas designer สำหรับ A4 และ Continuous Tax Invoice / Receipt, draft workflow และ test print
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadTemplates}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300">
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300">
            <FileUp size={14} /> Import JSON
          </button>
          <button type="button" onClick={exportSelected} disabled={!selectedTemplate}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
            <Download size={14} /> Export JSON
          </button>
          <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={importTemplate} />
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-500">Templates</p>
            <p className="mt-1 text-[11px] text-slate-400">เลือก template แล้วแก้ draft บน canvas</p>
          </div>
          <div className="max-h-[520px] overflow-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">Loading templates...</p>
            ) : templates.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs font-semibold text-slate-500">No document templates found</p>
                <p className="mt-1 text-[11px] text-slate-400">สร้าง template เริ่มต้นก่อนเปิด designer</p>
              </div>
            ) : templates.map(template => (
              <button
                key={template.template_id}
                type="button"
                onClick={() => setSelectedId(template.template_id)}
                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40 ${selectedTemplate?.template_id === template.template_id ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    {template.is_default && <Star size={13} className="fill-amber-400 text-amber-400" />}
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-white">{template.template_name}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">{template.template_code} · v{template.current_version_no || template.version_no || '-'}</span>
                </span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(template.status)}`}>
                  {template.status}
                </span>
              </button>
            ))}
          </div>
          <div className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-700">
            <button type="button" onClick={() => createDefaultTemplate('continuous')} disabled={actionId !== null}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
              <FilePlus2 size={14} /> Create Continuous Template
            </button>
            <button type="button" onClick={() => createDefaultTemplate('a4')} disabled={actionId !== null}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
              <FilePlus2 size={14} /> Create A4 Template
            </button>
            <button type="button" onClick={() => runAction('duplicate')} disabled={!selectedTemplate || actionId !== null}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
              <Copy size={14} /> Duplicate Template
            </button>
            <button type="button" onClick={() => runAction('set-default')} disabled={!selectedTemplate || actionId !== null}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
              <Star size={14} /> Set Default
            </button>
            <button type="button" onClick={() => runAction('deactivate')} disabled={!selectedTemplate || actionId !== null}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
              <XCircle size={14} /> Deactivate
            </button>
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {selectedTemplate && editingVersion ? (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Selected template</p>
                    <h4 className="truncate text-base font-semibold text-slate-800 dark:text-white">
                      {selectedTemplate.template_name}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Editing {editingVersion.status || 'none'} version {editingVersion.version_no || '-'} · Published version {detail?.template.current_version_no || '-'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {paperSummary} · A4 layout เป็น template แยกจาก continuous form
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={invoiceId}
                      onChange={event => setInvoiceId(event.target.value)}
                      placeholder="Invoice ID for real preview"
                      className="h-9 w-52 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button type="button" onClick={realPreview}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200">
                      Real Preview
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
                  <label className="text-xs font-medium text-slate-500">
                    Width mm
                    <input type="number" step="0.1" value={config.paper.width_mm} onChange={event => updatePaper('width_mm', Number(event.target.value))} disabled={!canEditDraft}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Height mm
                    <input type="number" step="0.1" value={config.paper.height_mm} onChange={event => updatePaper('height_mm', Number(event.target.value))} disabled={!canEditDraft}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Mode
                    <select value={config.mode} onChange={event => setConfig(current => ({ ...current, mode: event.target.value as DocumentTemplateMode }))} disabled={!canEditDraft}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                      <option value="full">full</option>
                      <option value="overlay">overlay</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Copy mode
                    <select value={config.copy_mode} onChange={event => setConfig(current => ({ ...current, copy_mode: event.target.value as DocumentTemplateCopyMode }))} disabled={!canEditDraft}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                      <option value="carbonless">carbonless</option>
                      <option value="separate">separate</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Top offset
                    <input type="number" step="0.1" value={config.paper.top_offset_mm} onChange={event => updatePaper('top_offset_mm', Number(event.target.value))} disabled={!canEditDraft}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    Left offset
                    <input type="number" step="0.1" value={config.paper.left_offset_mm} onChange={event => updatePaper('left_offset_mm', Number(event.target.value))} disabled={!canEditDraft}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                  </label>
                </div>
                {showContinuousPaperWarning ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Continuous template ถูกออกแบบสำหรับ 241.3 x 139.7 mm ถ้าต้องการปริ้น A4 ให้สร้าง A4 layout เป็น template แยก เพื่อไม่ให้ตำแหน่งกรอบและตารางเพี้ยน
                  </div>
                ) : null}
              </section>

              <CalibrationProfilesPanel
                config={config}
                readOnly={!canEditDraft}
                onChange={setConfig}
                onTestPrint={calibrationProfileId => testPrint({ calibrationProfileId })}
              />

              <PrintHistoryPanel
                templateCode={selectedTemplate?.template_code}
                templateVersion={selectedTemplateVersion}
              />

              <DocumentTemplateDesigner
                config={config}
                canEdit={canEditDraft}
                canPreview={Boolean(selectedTemplate && editingVersion)}
                samplePayload={designerSamplePayload}
                saving={saving}
                onChange={setConfig}
                onCreateDraft={createDraft}
                onSaveDraft={saveDraft}
                onPreview={samplePreview}
                onTestPrint={testPrint}
                onPublish={publishDraft}
              />
            </>
          ) : (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800">
              <FilePlus2 size={28} className="mx-auto text-blue-500" />
              <h4 className="mt-3 text-base font-semibold text-slate-800 dark:text-white">ยังไม่มี template ให้แก้ไข</h4>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                Designer จะเปิดได้เมื่อโหลด template/version จริงสำเร็จเท่านั้น เพื่อป้องกันการ Preview ด้วย sample layout คนละชุดกับ canvas
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={loadTemplates}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 dark:border-slate-700 dark:text-slate-300">
                  <RefreshCw size={14} /> Refresh
                </button>
                <button type="button" onClick={() => createDefaultTemplate('continuous')} disabled={actionId !== null}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                  <FilePlus2 size={14} /> Create Continuous Template
                </button>
                <button type="button" onClick={() => createDefaultTemplate('a4')} disabled={actionId !== null}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                  <FilePlus2 size={14} /> Create A4 Template
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      <PublishDiffDialog
        open={publishDialogOpen}
        changes={publishDraftContext?.changes || []}
        saving={saving || actionId === 'publish'}
        onCancel={cancelPublish}
        onConfirm={confirmPublishDraft}
      />
    </div>
  );
}
