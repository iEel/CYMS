'use client';

import { use, useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/utils';

interface PublicEIR {
  eir_number?: string;
  container_number?: string;
  transaction_type?: string;
  created_at?: string;
  date?: string;
  gate_datetime?: string;
  yard_name?: string;
  document_status?: string;
  verification_status?: string;
  copy_type_label?: string;
  damage_summary?: {
    condition?: string;
    damage_points?: number;
  };
}

interface EIRPublicViewProps {
  paramsPromise: Promise<{ id: string }>;
}

function displayDate(value?: string) {
  if (!value) return '-';
  return formatDateTime(value);
}

function transactionLabel(value?: string) {
  return value === 'gate_out' ? 'GATE-OUT' : 'GATE-IN';
}

function conditionLabel(summary?: PublicEIR['damage_summary']) {
  if (!summary) return 'Sound';
  const pointCount = typeof summary.damage_points === 'number' ? summary.damage_points : 0;
  if (pointCount > 0) return `Damage noted (${pointCount} point${pointCount === 1 ? '' : 's'})`;
  return summary.condition ? `Condition ${summary.condition}` : 'Sound';
}

export default function EIRPublicView({ paramsPromise }: EIRPublicViewProps) {
  const params = use(paramsPromise);
  const eirNumber = params.id;
  const [data, setData] = useState<PublicEIR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchEIR() {
      try {
        const res = await fetch(`/api/public/eir?eir_number=${encodeURIComponent(eirNumber)}`);
        const json = await res.json();
        if (res.ok && json.eir) {
          setData(json.eir);
        } else {
          setError(json.error || 'ไม่พบข้อมูล EIR');
        }
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    }
    fetchEIR();
  }, [eirNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-4">กำลังโหลดข้อมูล EIR...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-sm">
          <div className="text-4xl mb-3">!</div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">ไม่พบข้อมูล</h1>
          <p className="text-sm text-slate-500">{error || 'ไม่พบข้อมูล EIR'}</p>
          <p className="text-xs text-slate-400 mt-3 font-mono">{eirNumber}</p>
        </div>
      </div>
    );
  }

  const eventDate = data.gate_datetime || data.date || data.created_at;
  const status = data.document_status || data.verification_status || '-';

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg font-black">C</div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Equipment Interchange Receipt</h1>
            <p className="text-[10px] text-slate-400 font-mono">{data.eir_number || eirNumber}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl font-bold font-mono text-slate-800 break-all">
                {data.container_number || '-'}
              </span>
              <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white bg-blue-600">
                {transactionLabel(data.transaction_type)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{data.copy_type_label || 'Public Verification Copy'}</p>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            <MobileField label="EIR" value={data.eir_number || eirNumber} />
            <MobileField label="วันที่" value={displayDate(eventDate)} />
            <MobileField label="ลาน" value={data.yard_name || '-'} />
            <MobileField label="สถานะเอกสาร" value={status} />
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">สรุปสภาพตู้</p>
          <p className="text-sm font-semibold text-slate-800">{conditionLabel(data.damage_summary)}</p>
        </section>

        <div className="text-center py-3">
          <p className="text-[10px] text-slate-300">CYMS - Container Yard Management System</p>
        </div>
      </div>
    </div>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-sm font-medium text-slate-700 break-words">{value}</p>
    </div>
  );
}
