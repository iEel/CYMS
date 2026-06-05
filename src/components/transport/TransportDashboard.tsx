'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCw, Truck } from 'lucide-react';

import { TransportActionDialog } from './TransportActionDialog';
import { TransportActivityDrawer } from './TransportActivityDrawer';
import { TransportEirModal } from './TransportEirModal';
import { TransportJobCard } from './TransportJobCard';
import type { TransportAction, TransportCapabilities, TransportJob, TransportJobsResponse } from './types';

const emptyJobs: TransportJobsResponse = {
  summary: { open: 0, atGate: 0, releasedToday: 0, attention: 0 },
  jobs: [],
};

const filterOptions = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'open', label: 'เปิดอยู่' },
  { key: 'at_gate', label: 'หน้าด่าน' },
  { key: 'completed', label: 'เสร็จแล้ว' },
  { key: 'attention', label: 'ต้องดูแล' },
];

const transportPortalEndpoints = {
  actions: '/api/transport/actions',
  activity: '/api/transport/activity',
};

function isDone(status: string) {
  return ['released', 'completed'].includes(status);
}

export function TransportDashboard() {
  const [capabilities, setCapabilities] = useState<TransportCapabilities | null>(null);
  const [data, setData] = useState<TransportJobsResponse>(emptyJobs);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedEir, setSelectedEir] = useState<Record<string, unknown> | null>(null);
  const [eirLoading, setEirLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedAction, setSelectedAction] = useState<TransportAction | null>(null);
  const [selectedJob, setSelectedJob] = useState<TransportJob | null>(null);
  const [activityJob, setActivityJob] = useState<TransportJob | null>(null);
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(false);

  const loadData = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    setLoading(true);
    try {
      const [capabilityRes, jobsRes] = await Promise.all([
        fetch('/api/transport/capabilities'),
        fetch('/api/transport/jobs'),
      ]);

      const nextCapabilities = capabilityRes.ok ? await capabilityRes.json() : null;
      const nextData = jobsRes.ok ? await jobsRes.json() : null;

      if (!mountedRef.current || requestSequence !== requestSequenceRef.current) return;
      if (nextCapabilities) setCapabilities(nextCapabilities);
      if (nextData) setData(nextData);
      setLastUpdated(new Date());
    } finally {
      if (mountedRef.current && requestSequence === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    const interval = window.setInterval(loadData, 30000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [loadData]);

  const mode = capabilities?.transport?.mode;
  const copyLabel = mode === 'driver' ? 'Driver Copy' : 'Trucking Copy';
  const title = mode === 'driver' ? 'งานของฉัน' : 'งานขนส่ง';

  const filteredJobs = useMemo(() => {
    return data.jobs.filter(job => {
      if (filter === 'all') return true;
      if (filter === 'open') return !isDone(job.status) && job.status !== 'cancelled';
      if (filter === 'completed') return isDone(job.status);
      if (filter === 'attention') return Boolean(job.attentionReason);
      return job.status === filter;
    });
  }, [data.jobs, filter]);

  const openEir = async (eirNumber: string) => {
    setModalOpen(true);
    setSelectedEir(null);
    setEirLoading(true);
    try {
      const res = await fetch(`/api/transport/eir?eir_number=${encodeURIComponent(eirNumber)}`);
      if (res.ok) {
        const body = await res.json();
        setSelectedEir(body.eir || null);
      }
    } finally {
      setEirLoading(false);
    }
  };

  const openAction = (job: TransportJob, action: TransportAction) => {
    setSelectedJob(job);
    setSelectedAction(action);
  };

  const closeAction = () => {
    setSelectedJob(null);
    setSelectedAction(null);
  };

  const handleActionDone = () => {
    closeAction();
    loadData();
  };

  const metrics = [
    { label: 'เปิดอยู่', value: data.summary.open, icon: <ClipboardList size={18} />, tone: 'bg-blue-600' },
    { label: 'หน้าด่าน', value: data.summary.atGate, icon: <Truck size={18} />, tone: 'bg-slate-800' },
    { label: 'เสร็จวันนี้', value: data.summary.releasedToday, icon: <CheckCircle2 size={18} />, tone: 'bg-emerald-600' },
    { label: 'ต้องดูแล', value: data.summary.attention, icon: <AlertTriangle size={18} />, tone: 'bg-amber-500' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">{copyLabel}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">Pickup / release jobs</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {lastUpdated ? lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(metric => (
          <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-white ${metric.tone}`}>
              {metric.icon}
            </div>
            <p className="text-2xl font-bold text-slate-950">{metric.value}</p>
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                filter === option.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {loading && data.jobs.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            กำลังโหลด...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            ไม่มีงานในสถานะนี้
          </div>
        ) : (
          filteredJobs.map(job => (
            <TransportJobCard
              key={job.jobId}
              job={job}
              onOpenEir={openEir}
              onAction={openAction}
              onOpenActivity={setActivityJob}
            />
          ))
        )}
      </section>

      {modalOpen && (
        <TransportEirModal
          copyLabel={copyLabel}
          eir={selectedEir}
          loading={eirLoading}
          onClose={() => setModalOpen(false)}
        />
      )}

      {selectedAction && selectedJob && (
        <TransportActionDialog
          key={`${selectedJob.jobId}-${selectedAction}`}
          action={selectedAction}
          job={selectedJob}
          actionEndpoint={transportPortalEndpoints.actions}
          onClose={closeAction}
          onDone={handleActionDone}
        />
      )}

      {activityJob && (
        <TransportActivityDrawer
          key={activityJob.jobId}
          job={activityJob}
          activityEndpoint={transportPortalEndpoints.activity}
          onClose={() => setActivityJob(null)}
        />
      )}
    </div>
  );
}
