'use client';

import type { Dispatch, SetStateAction } from 'react';
import { AlertTriangle, ArrowDownToLine, FileText, Loader2, X } from 'lucide-react';
import { inputClass, labelClass } from '../types';
import type { GateInFormState } from './GateInContainerSection';

export interface GateInResultState {
  success: boolean;
  message: string;
  eir_number?: string;
  assigned_location?: {
    zone_name: string;
    bay: number;
    row: number;
    tier: number;
    reason: string;
  };
}

interface GateInSubmitSectionProps {
  gateInForm: GateInFormState;
  setGateInForm: Dispatch<SetStateAction<GateInFormState>>;
  gateInLoading: boolean;
  canGateIn: boolean;
  containerValid: boolean | null;
  gateInRequiresBillingClearance: boolean;
  gateInBillingCleared: boolean;
  gateInResult: GateInResultState | null;
  setGateInResult: Dispatch<SetStateAction<GateInResultState | null>>;
  handleGateIn: () => void;
  onViewEIR: (eirNumber: string) => void;
}

export default function GateInSubmitSection({
  gateInForm,
  setGateInForm,
  gateInLoading,
  canGateIn,
  containerValid,
  gateInRequiresBillingClearance,
  gateInBillingCleared,
  gateInResult,
  setGateInResult,
  handleGateIn,
  onViewEIR,
}: GateInSubmitSectionProps) {
  return (
    <>
      <div>
        <label className={labelClass}>หมายเหตุ</label>
        <input
          type="text"
          placeholder="หมายเหตุเพิ่มเติม..."
          value={gateInForm.notes}
          onChange={e => setGateInForm({ ...gateInForm, notes: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleGateIn}
          disabled={gateInLoading || !canGateIn || !gateInForm.container_number || containerValid === false || (gateInRequiresBillingClearance && !gateInBillingCleared)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all"
        >
          {gateInLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
          รับตู้เข้าลาน + ออก EIR
        </button>
        {gateInRequiresBillingClearance && !gateInBillingCleared && (
          <span className="text-[11px] text-amber-500 flex items-center gap-1">
            <AlertTriangle size={12} /> กรุณาชำระเงินก่อนรับตู้
          </span>
        )}
      </div>

      {gateInResult && (
        <div className={`p-3 rounded-xl text-sm flex items-center justify-between gap-3 ${gateInResult.success ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'}`}>
          <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
            <span className="font-medium text-xs">{gateInResult.message}</span>
            {gateInResult.assigned_location && (
              <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                📍 {gateInResult.assigned_location.zone_name} B{gateInResult.assigned_location.bay}-R{gateInResult.assigned_location.row}-T{gateInResult.assigned_location.tier}
              </span>
            )}
            {gateInResult.eir_number && (
              <>
                <span className="text-xs font-mono">EIR: {gateInResult.eir_number}</span>
                <button
                  onClick={() => onViewEIR(gateInResult.eir_number!)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700 transition-colors"
                >
                  <FileText size={12} /> พิมพ์ EIR
                </button>
              </>
            )}
          </div>
          <button onClick={() => setGateInResult(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
