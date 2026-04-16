'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Loader2,
  ArrowDownToLine, ArrowUpFromLine,
  History, ArrowRightLeft, BarChart3,
} from 'lucide-react';
import EIRDocument from '@/components/gate/EIRDocument';
import type { EIRData } from '@/components/gate/EIRDocument';
import dynamic from 'next/dynamic';

// Lazy-load tab components for better code-splitting
import GateInTab from './GateInTab';
import GateOutTab from './GateOutTab';
import HistoryTab from './HistoryTab';
import TransferTab from './TransferTab';
import GateReportTab from './GateReportTab';

const ContainerTimeline = dynamic(() => import('@/components/containers/ContainerTimeline'), { ssr: false });

export default function GatePage() {
  const { session, hasPermission, hasAnyPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'gate_in' | 'gate_out' | 'history' | 'transfer' | 'report'>('gate_in');

  // EIR Preview (shared across tabs)
  const [showEIR, setShowEIR] = useState<string | null>(null);
  const [eirData, setEirData] = useState<EIRData | null>(null);

  const yardId = session?.activeYardId || 1;
  const [timelineId, setTimelineId] = useState<number | null>(null);
  const canGateIn = hasPermission('gate.in');
  const canGateOut = hasPermission('gate.out');
  const canViewEir = hasPermission('gate.eir.print');
  const canMoveYard = hasAnyPermission(['yard.slot.move', 'yard.location.assign']);

  const gateTabs = [
    { id: 'gate_in' as const, label: 'Gate-In (รับเข้า)', icon: <ArrowDownToLine size={14} />, allowed: canGateIn },
    { id: 'gate_out' as const, label: 'Gate-Out (ปล่อยออก)', icon: <ArrowUpFromLine size={14} />, allowed: canGateOut },
    { id: 'history' as const, label: 'ประวัติ Gate', icon: <History size={14} />, allowed: canViewEir || canGateIn || canGateOut },
    { id: 'transfer' as const, label: 'ย้ายข้ามลาน', icon: <ArrowRightLeft size={14} />, allowed: canMoveYard },
    { id: 'report' as const, label: 'รายงาน', icon: <BarChart3 size={14} />, allowed: canViewEir || canGateIn || canGateOut },
  ].filter(tab => tab.allowed);
  const effectiveTab = gateTabs.some(tab => tab.id === activeTab) ? activeTab : gateTabs[0]?.id;

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
        {gateTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              effectiveTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== TAB CONTENT =================== */}
      {effectiveTab === 'gate_in' && canGateIn && (
        <GateInTab
          yardId={yardId}
          userId={session?.userId}
          onViewEIR={viewEIR}
        />
      )}

      {effectiveTab === 'gate_out' && canGateOut && (
        <GateOutTab
          yardId={yardId}
          userId={session?.userId}
          onViewEIR={viewEIR}
        />
      )}

      {effectiveTab === 'history' && (canViewEir || canGateIn || canGateOut) && (
        <HistoryTab
          yardId={yardId}
          onViewEIR={viewEIR}
        />
      )}

      {effectiveTab === 'transfer' && canMoveYard && (
        <TransferTab
          yardId={yardId}
          userId={session?.userId}
        />
      )}

      {effectiveTab === 'report' && (canViewEir || canGateIn || canGateOut) && (
        <GateReportTab
          yardId={yardId}
          onViewEIR={viewEIR}
        />
      )}

      {!canGateIn && !canGateOut && !canViewEir && !canMoveYard && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          คุณไม่มีสิทธิ์ใช้งานเมนู Gate ในตอนนี้ กรุณาตรวจสอบสิทธิ์ใน Granular RBAC
        </div>
      )}

      {/* =================== EIR MODAL (shared) =================== */}
      {showEIR && eirData && (
        <EIRDocument
          data={eirData}
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
