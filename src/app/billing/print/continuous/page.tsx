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
  preview?: {
    payload?: ContinuousPrintPayload;
    config?: DocumentTemplateConfig;
  };
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

function withPreviewParams(searchParams: URLSearchParams) {
  const previewParams = new URLSearchParams();
  for (const key of ['id', 'type', 'mode', 'copyMode', 'copyIndex', 'preview', 'testPrint']) {
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
  const reprintLabel = booleanFrom(searchParams.get('preview')) ? 'PREVIEW' : null;
  const hasInvoiceId = Boolean(searchParams.get('id'));
  const fallback = useMemo(() => fallbackPreview(mode, copyMode), [mode, copyMode]);
  const [payload, setPayload] = useState<ContinuousPrintPayload>(fallback.payload);
  const [config, setConfig] = useState<DocumentTemplateConfig>(fallback.config);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

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
        if (!nextPayload || !nextConfig) throw new Error('Preview response missing payload or config');

        if (!cancelled) {
          setPayload(nextPayload);
          setConfig({ ...nextConfig, mode, copy_mode: copyMode });
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
  }, [copyMode, fallback, hasInvoiceId, mode, searchParams]);

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
        </div>
        <button type="button" onClick={() => window.print()} disabled={status === 'error'} aria-label="Print continuous receipt">
          <Printer size={16} />
          พิมพ์
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
            testPrint={testPrint}
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
