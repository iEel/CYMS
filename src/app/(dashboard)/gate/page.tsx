'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Loader2,
  ArrowDownToLine, ArrowUpFromLine,
  History, ArrowRightLeft,
} from 'lucide-react';
import EIRDocument from '@/components/gate/EIRDocument';
import dynamic from 'next/dynamic';

// Lazy-load tab components for better code-splitting
import GateInTab from './GateInTab';
import GateOutTab from './GateOutTab';
import HistoryTab from './HistoryTab';
import TransferTab from './TransferTab';

const ContainerTimeline = dynamic(() => import('@/components/containers/ContainerTimeline'), { ssr: false });

export default function GatePage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'gate_in' | 'gate_out' | 'history' | 'transfer'>('gate_in');

  // EIR Preview (shared across tabs)
  const [showEIR, setShowEIR] = useState<string | null>(null);
  const [eirData, setEirData] = useState<Record<string, string | number | boolean | null> | null>(null);

  const yardId = session?.activeYardId || 1;
  const [timelineId, setTimelineId] = useState<number | null>(null);

  // View EIR — shared callback for all tabs
  const viewEIR = useCallback(async (eirNumber: string) => {
    setShowEIR(eirNumber);
    try {
      const res = await fetch(`/api/gate/eir?eir_number=${eirNumber}`);
      const data = await res.json();
      setEirData(data.eir || null);
    } catch (err) { console.error(err); }
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">ประตู Gate</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">จัดการรถเข้า-ออกลาน, ออกเอกสาร EIR</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {[
          { id: 'gate_in' as const, label: 'Gate-In (รับเข้า)', icon: <ArrowDownToLine size={14} />, color: 'emerald' },
          { id: 'gate_out' as const, label: 'Gate-Out (ปล่อยออก)', icon: <ArrowUpFromLine size={14} />, color: 'blue' },
          { id: 'history' as const, label: 'ประวัติ Gate', icon: <History size={14} />, color: 'slate' },
          { id: 'transfer' as const, label: 'ย้ายข้ามลาน', icon: <ArrowRightLeft size={14} />, color: 'purple' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== TAB CONTENT =================== */}
      {activeTab === 'gate_in' && (
        <GateInTab
          yardId={yardId}
          userId={session?.userId}
          onViewEIR={viewEIR}
        />
      )}

      {activeTab === 'gate_out' && (
        <GateOutTab
          yardId={yardId}
          userId={session?.userId}
          onViewEIR={viewEIR}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          yardId={yardId}
          onViewEIR={viewEIR}
        />
      )}

      {activeTab === 'transfer' && (
        <TransferTab
          yardId={yardId}
          userId={session?.userId}
        />
      )}

      {/* =================== EIR MODAL (shared) =================== */}
      {showEIR && eirData && (
        <EIRDocument
          data={eirData as any}
          onClose={() => { setShowEIR(null); setEirData(null); }}
        />
      )}
      {showEIR && !eirData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <Loader2 size={32} className="animate-spin mx-auto text-blue-500" />
            <p className="text-sm text-slate-500 mt-3">กำลังโหลด EIR...</p>
          </div>
        </div>
      )}

      {/* Container Timeline Modal */}
      {timelineId && <ContainerTimeline containerId={timelineId} onClose={() => setTimelineId(null)} />}
    </div>
  );
}
