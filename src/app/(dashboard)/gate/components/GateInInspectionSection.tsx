'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import ContainerInspection from '@/components/gate/ContainerInspection';
import PhotoCapture from '@/components/gate/PhotoCapture';
import SignaturePad from '@/components/gate/SignaturePad';
import type { EvidencePhoto, PhotoCompleteness, PhotoRequirement } from '@/lib/photoEvidence';
import type { GateInFormState } from './GateInContainerSection';

export interface GateInInspectionReport {
  points: unknown[];
  condition_grade: string;
  suggested_condition_grade?: string;
  grade_override?: boolean;
  grade_reasons?: string[];
  inspector_notes: string;
  photos: string[];
  photo_evidence?: EvidencePhoto[];
  photo_requirements?: PhotoRequirement[];
  photo_completeness?: PhotoCompleteness;
  container_type?: string;
  container_size?: string;
  inspection_template?: string;
}

interface GateInInspectionSectionProps {
  gateInForm: GateInFormState;
  sealPhoto: string;
  setSealPhoto: Dispatch<SetStateAction<string>>;
  driverSignature: string;
  setDriverSignature: Dispatch<SetStateAction<string>>;
  showInspection: boolean;
  setShowInspection: Dispatch<SetStateAction<boolean>>;
  inspectionReport: GateInInspectionReport | null;
  setInspectionReport: Dispatch<SetStateAction<GateInInspectionReport | null>>;
}

export default function GateInInspectionSection({
  gateInForm,
  sealPhoto,
  setSealPhoto,
  driverSignature,
  setDriverSignature,
  showInspection,
  setShowInspection,
  inspectionReport,
  setInspectionReport,
}: GateInInspectionSectionProps) {
  return (
    <>
      {gateInForm.is_laden && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <PhotoCapture label="ถ่ายรูปซีล (บังคับสำหรับตู้ Laden)" required onCapture={setSealPhoto} value={sealPhoto} folder="seal" />
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2"><ClipboardCheck size={12} /> ตรวจสภาพตู้</h4>
        {!showInspection && !inspectionReport && (
          <button onClick={() => setShowInspection(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all text-sm flex items-center justify-center gap-2">
            <ClipboardCheck size={16} /> เปิดแบบฟอร์มตรวจสภาพตู้
          </button>
        )}
        {showInspection && (
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
            <ContainerInspection
              containerType={gateInForm.type}
              containerSize={gateInForm.size}
              onComplete={(report) => {
                setInspectionReport(report);
                setShowInspection(false);
              }}
              onCancel={() => setShowInspection(false)}
            />
          </div>
        )}
        {inspectionReport && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                  inspectionReport.condition_grade === 'A' ? 'bg-emerald-500' :
                  inspectionReport.condition_grade === 'B' ? 'bg-amber-500' :
                  inspectionReport.condition_grade === 'C' ? 'bg-orange-500' : 'bg-red-600'
                }`}>{inspectionReport.condition_grade}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">✅ ตรวจแล้ว — เกรด {inspectionReport.condition_grade}</p>
                  <p className="text-[10px] text-slate-400">
                    พบ {inspectionReport.points.length} จุดเสียหาย · {inspectionReport.photo_evidence?.length || inspectionReport.photos.length} รูปถ่าย
                    {inspectionReport.photo_completeness
                      ? ` · หลักฐานครบ ${inspectionReport.photo_completeness.completed}/${inspectionReport.photo_completeness.required}`
                      : ''}
                    {inspectionReport.grade_override && inspectionReport.suggested_condition_grade
                      ? ` · ปรับจากเกรดแนะนำ ${inspectionReport.suggested_condition_grade}`
                      : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => { setInspectionReport(null); setShowInspection(true); }}
                className="text-xs text-blue-500 hover:text-blue-700">ตรวจใหม่</button>
            </div>
          </div>
        )}
      </div>

      <SignaturePad label="ลายเซ็นคนขับรับมอบ" onComplete={setDriverSignature} />
      {driverSignature && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs">
          <CheckCircle2 size={14} /> ลงลายเซ็นแล้ว
        </div>
      )}
    </>
  );
}
