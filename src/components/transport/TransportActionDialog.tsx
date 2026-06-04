'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Upload, X } from 'lucide-react';

import type { TransportAction, TransportJob } from './types';

type Props = {
  action: TransportAction;
  job: TransportJob;
  onClose: () => void;
  onDone: () => void;
  actionEndpoint?: string;
};

const actionLabels: Record<TransportAction, string> = {
  confirm_job: 'รับงาน',
  mark_arrived: 'ถึงลานแล้ว',
  report_issue: 'แจ้งปัญหา',
  add_proof: 'เพิ่มหลักฐาน',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

async function parseJsonResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'ดำเนินการไม่สำเร็จ');
  }
  return body;
}

export function TransportActionDialog({
  action,
  job,
  onClose,
  onDone,
  actionEndpoint = '/api/transport/actions',
}: Props) {
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const title = actionLabels[action];
  const requiresNote = action === 'report_issue';
  const requiresFile = action === 'add_proof';

  const summary = useMemo(() => {
    const parts = [job.containerNumber, job.bookingNumber, job.truckPlate].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : job.jobId;
  }, [job]);

  const submitAction = async () => {
    if (submitting) return;

    const trimmedNote = note.trim();
    if (requiresNote && !trimmedNote) {
      setError('กรุณาระบุรายละเอียดปัญหา');
      return;
    }
    if (requiresFile && !file) {
      setError('กรุณาเลือกไฟล์หลักฐาน');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let proofUrl: string | undefined;

      if (requiresFile && file) {
        const data = await readFileAsDataUrl(file);
        const uploadResponse = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'gate', filename_prefix: 'transport_proof', data }),
        });
        const uploadBody = await parseJsonResponse(uploadResponse);
        if (!uploadBody.url) throw new Error('อัปโหลดหลักฐานไม่สำเร็จ');
        proofUrl = uploadBody.url;
      }

      const actionResponse = await fetch(actionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.jobId,
          action,
          note: trimmedNote || undefined,
          proof_url: proofUrl,
        }),
      });
      await parseJsonResponse(actionResponse);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transport-action-dialog-title"
        className="w-full rounded-lg bg-white shadow-xl sm:max-w-md"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 id="transport-action-dialog-title" className="text-lg font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{summary}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!submitting) onClose();
            }}
            disabled={submitting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {requiresNote && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">รายละเอียดปัญหา</span>
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="ระบุสิ่งที่ต้องให้ทีมลานทราบ"
              />
            </label>
          )}

          {requiresFile && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">ไฟล์หลักฐาน</span>
              <span className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 hover:border-blue-400 hover:text-blue-700">
                <Upload size={20} className="mb-2" />
                {file ? file.name : 'เลือกรูปหรือ PDF'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={event => {
                  setFile(event.target.files?.[0] || null);
                  setError('');
                }}
              />
            </label>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submitAction}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
