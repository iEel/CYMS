'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { ContinuousTaxReceipt } from '@/components/billing/ContinuousTaxReceipt';
import { buildSampleContinuousPrintPayload } from '@/lib/billingContinuousPrintSample';
import { buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplateDefaults';
import type { ContinuousPrintPayload } from '@/lib/billingContinuousPrintTypes';
import type {
  DocumentTemplateConfig,
  DocumentTemplateCopyMode,
  DocumentTemplateMode,
} from '@/lib/documentTemplateTypes';

type PreviewResponse = {
  payload?: ContinuousPrintPayload;
  config?: DocumentTemplateConfig;
  template?: {
    template_code?: string;
    template_version?: number;
  };
  preview?: {
    payload?: ContinuousPrintPayload;
    config?: DocumentTemplateConfig;
    template?: {
      template_code?: string;
      template_version?: number;
    };
  };
};

type PrintLogResponse = {
  print_no?: number;
  is_reprint?: boolean;
  reprint_count?: number;
  reprint_label?: string;
  error?: string;
};

function modeFrom(value: string | null): DocumentTemplateMode {
  return value === 'overlay' ? 'overlay' : 'full';
}

function copyModeFrom(value: string | null): DocumentTemplateCopyMode {
  return value === 'separate' ? 'separate' : 'carbonless';
}

function booleanFrom(value: string | null) {
  return value === '1' || value === 'true' || value === 'yes';
}

function copyIndexFrom(value: string | null) {
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function positiveIntFrom(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function withPreviewParams(searchParams: URLSearchParams) {
  const previewParams = new URLSearchParams();
  for (const key of ['id', 'type', 'mode', 'copyMode', 'copyIndex', 'preview', 'testPrint', 'templateId', 'versionNo']) {
    const value = searchParams.get(key);
    if (value !== null) previewParams.set(key, value);
  }
  return `/api/document-templates/preview?${previewParams.toString()}`;
}

function fallbackPreview(mode: DocumentTemplateMode, copyMode: DocumentTemplateCopyMode) {
  const config = buildDefaultContinuousTemplateConfig();
  return {
    payload: buildSampleContinuousPrintPayload(),
    config: {
      ...config,
      mode,
      copy_mode: copyMode,
    },
  };
}

function ContinuousPrintContent() {
  const searchParams = useSearchParams();
  const mode = modeFrom(searchParams.get('mode'));
  const copyMode = copyModeFrom(searchParams.get('copyMode'));
  const copyIndex = copyIndexFrom(searchParams.get('copyIndex'));
  const testPrint = booleanFrom(searchParams.get('testPrint'));
  const previewLabel = booleanFrom(searchParams.get('preview')) ? 'PREVIEW' : null;
  const hasInvoiceId = Boolean(searchParams.get('id'));
  const fallback = useMemo(() => fallbackPreview(mode, copyMode), [mode, copyMode]);
  const [payload, setPayload] = useState<ContinuousPrintPayload>(fallback.payload);
  const [config, setConfig] = useState<DocumentTemplateConfig>(fallback.config);
  const [templateCode, setTemplateCode] = useState('');
  const [templateVersion, setTemplateVersion] = useState(1);
  const [reprintLabel, setReprintLabel] = useState<string | null>(previewLabel);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [printError, setPrintError] = useState('');
  const [printing, setPrinting] = useState(false);
  const isSamplePreview = searchParams.get('preview') === 'sample' || payload.document.document_type === 'sample';
  const realDocumentId = isSamplePreview
    ? null
    : positiveIntFrom(payload.document.invoice_id) || positiveIntFrom(searchParams.get('id'));
  const effectiveTestPrint = testPrint && !realDocumentId;

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setStatus('loading');
      setErrorMessage('');
      try {
        const response = await fetch(withPreviewParams(searchParams));
        if (!response.ok) throw new Error(`Preview route unavailable (${response.status})`);

        const data = await response.json() as PreviewResponse;
        const nextPayload = data.payload || data.preview?.payload;
        const nextConfig = data.config || data.preview?.config;
        const nextTemplate = data.template || data.preview?.template;
        if (!nextPayload || !nextConfig) throw new Error('Preview response missing payload or config');

        if (!cancelled) {
          setPayload(nextPayload);
          setConfig({ ...nextConfig, mode, copy_mode: copyMode });
          setTemplateCode(nextTemplate?.template_code || nextPayload.document.document_type.toUpperCase());
          setTemplateVersion(nextTemplate?.template_version || 1);
          setReprintLabel(previewLabel);
          setStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          if (hasInvoiceId) {
            setErrorMessage(error instanceof Error ? error.message : 'Preview route unavailable');
            setStatus('error');
          } else {
            setPayload(fallback.payload);
            setConfig(fallback.config);
            setStatus('fallback');
          }
        }
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [copyMode, fallback, hasInvoiceId, mode, previewLabel, searchParams]);

  async function postPrintLog(documentId: number, reprintReason?: string | null): Promise<PrintLogResponse> {
    const policy = config.print_policy;
    const response = await fetch('/api/document-templates/print-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: payload.document.document_type || searchParams.get('type') || 'tax_invoice_receipt',
        type: searchParams.get('type') || payload.document.document_type || 'tax_invoice_receipt',
        document_id: documentId,
        id: documentId,
        document_no: payload.document.document_number || payload.document.invoice_number,
        template_code: templateCode,
        template_version: templateVersion,
        snapshot: payload,
        mode,
        copy_mode: copyMode,
        reprint_reason: reprintReason || null,
        show_reprint_label: Boolean(policy?.reprint_label_template),
        reprint_label_template: policy?.reprint_label_template,
        require_reprint_reason: Boolean((policy as { require_reprint_reason?: boolean })?.require_reprint_reason),
      }),
    });
    const data = await response.json().catch(() => ({})) as PrintLogResponse;
    if (!response.ok) return { ...data, error: data.error || `Print log failed (${response.status})` };
    return data;
  }

  async function handlePrint() {
    setPrintError('');
    if (!realDocumentId || isSamplePreview) {
      window.print();
      return;
    }

    setPrinting(true);
    try {
      let result = await postPrintLog(realDocumentId);
      if (result.error === 'reprint reason is required') {
        const reason = window.prompt('กรุณาระบุเหตุผลในการพิมพ์ซ้ำ');
        if (!reason?.trim()) {
          setPrintError('ต้องระบุเหตุผลในการพิมพ์ซ้ำ');
          return;
        }
        result = await postPrintLog(realDocumentId, reason);
      }

      if (result.error) {
        setPrintError(result.error);
        return;
      }

      setReprintLabel(result.reprint_label || null);
      window.setTimeout(() => window.print(), 0);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        body { background: #e5e7eb; margin: 0; }
        .continuous-print-toolbar {
          align-items: center;
          background: #111827;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
          color: #fff;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          left: 16px;
          padding: 10px 12px;
          position: fixed;
          right: 16px;
          top: 16px;
          z-index: 40;
        }
        .continuous-print-toolbar button {
          align-items: center;
          background: #fff;
          border: 0;
          color: #111827;
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-weight: 700;
          gap: 8px;
          padding: 8px 12px;
        }
        .continuous-print-status { color: #d1d5db; font-size: 12px; }
        .continuous-print-error { color: #fecaca; font-size: 12px; margin-top: 2px; }
        .continuous-print-shell { padding: 76px 16px 24px; }
        @media print {
          .continuous-print-toolbar { display: none !important; }
          .continuous-print-shell { padding: 0; }
        }
      `}</style>
      <div className="continuous-print-toolbar">
        <div>
          <strong>Continuous Tax Invoice / Receipt</strong>
          <div className="continuous-print-status">
            {status === 'loading'
              ? 'Loading preview...'
              : status === 'fallback'
                ? 'Using sample preview'
                : status === 'error'
                  ? 'Preview failed'
                  : 'Preview ready'}
          </div>
          {printError ? <div className="continuous-print-error">{printError}</div> : null}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={status === 'error' || status === 'loading' || printing}
          aria-label="Print continuous receipt"
        >
          <Printer size={16} />
          {printing ? 'กำลังบันทึก' : 'พิมพ์'}
        </button>
      </div>
      <main className="continuous-print-shell">
        {status === 'error' ? (
          <div className="mx-auto max-w-xl bg-white p-6 text-slate-800 shadow">
            <h1 className="text-lg font-bold">ไม่สามารถโหลดข้อมูลเอกสารได้</h1>
            <p className="mt-2 text-sm text-slate-500">{errorMessage || 'กรุณาตรวจสอบสิทธิ์หรือข้อมูลใบแจ้งหนี้'}</p>
          </div>
        ) : (
          <ContinuousTaxReceipt
            payload={payload}
            config={config}
            mode={mode}
            copyMode={copyMode}
            copyIndex={copyIndex}
            reprintLabel={reprintLabel}
            testPrint={effectiveTestPrint}
          />
        )}
      </main>
    </>
  );
}

export default function ContinuousPrintPage() {
  return (
    <Suspense fallback={<div className="continuous-print-fallback">Loading continuous print preview...</div>}>
      <ContinuousPrintContent />
    </Suspense>
  );
}
