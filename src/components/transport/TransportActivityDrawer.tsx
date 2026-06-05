'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, X } from 'lucide-react';

import type { TransportJob, TransportJobActivity, TransportJobProof } from './types';

type ActivityResponse = {
  jobId: string;
  activities: TransportJobActivity[];
  proofs: TransportJobProof[];
};

type Props = {
  job: TransportJob;
  onClose: () => void;
  activityEndpoint?: string;
};

const actionLabels: Record<string, string> = {
  confirm_job: 'รับงาน',
  mark_arrived: 'ถึงลานแล้ว',
  report_issue: 'แจ้งปัญหา',
  add_proof: 'เพิ่มหลักฐาน',
};

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function activityTime(activity: TransportJobActivity) {
  if (!activity.createdAt) return 0;
  const time = new Date(activity.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function TransportActivityDrawer({
  job,
  onClose,
  activityEndpoint = '/api/transport/activity',
}: Props) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${activityEndpoint}?job_id=${encodeURIComponent(job.jobId)}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof body.error === 'string' ? body.error : 'โหลดประวัติไม่สำเร็จ');
        }
        if (!cancelled) setData(body as ActivityResponse);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'โหลดประวัติไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadActivity();
    return () => {
      cancelled = true;
    };
  }, [activityEndpoint, job.jobId]);

  const activities = useMemo(() => {
    return [...(data?.activities || [])].sort((a, b) => {
      const timeDifference = activityTime(b) - activityTime(a);
      if (timeDifference !== 0) return timeDifference;
      return b.activityId - a.activityId;
    });
  }, [data?.activities]);
  const proofs = data?.proofs || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="transport-activity-drawer-title"
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 id="transport-activity-drawer-title" className="text-lg font-bold text-slate-950">ประวัติ</h2>
            <p className="mt-1 text-sm text-slate-500">{job.containerNumber || job.jobId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              กำลังโหลด...
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : activities.length === 0 && proofs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              ยังไม่มีประวัติการดำเนินการ
            </div>
          ) : (
            <div className="space-y-5">
              {activities.length > 0 && (
                <div className="space-y-3">
                  {activities.map(activity => (
                    <div key={activity.activityId} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900">{actionLabels[activity.action] || activity.action}</p>
                        <time className="text-xs font-medium text-slate-400">{formatDateTime(activity.createdAt)}</time>
                      </div>
                      {activity.note && <p className="mt-2 text-sm text-slate-600">{activity.note}</p>}
                      {activity.proofUrl && (
                        <a
                          href={activity.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
                        >
                          เปิดหลักฐาน <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {proofs.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase text-slate-400">หลักฐาน</h3>
                  <div className="space-y-2">
                    {proofs.map(proof => (
                      <a
                        key={proof.proofId}
                        href={proof.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <span>{formatDateTime(proof.createdAt)}</span>
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
