'use client';

import { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, X } from 'lucide-react';
import type { EIRData } from '@/components/gate/EIRDocument';
import { RawImage } from '@/components/ui/RawImage';
import {
  buildPhotoEvidenceSnapshot,
  normalizeEvidencePhotos,
  type EvidencePhoto,
  type PhotoCompleteness,
  type PhotoRequirement,
} from '@/lib/photoEvidence';

type PortalDamageReport = NonNullable<EIRData['damage_report']> & {
  exit_photos?: string[];
  inspection_template?: string;
};

interface PortalInspectionModalProps {
  data: EIRData;
  onClose: () => void;
}

const SIDES = [
  { key: 'front', label: 'ด้านหน้า' },
  { key: 'back', label: 'ด้านหลัง' },
  { key: 'left', label: 'ด้านซ้าย' },
  { key: 'right', label: 'ด้านขวา' },
  { key: 'top', label: 'ด้านบน' },
  { key: 'floor', label: 'พื้น' },
];

const SIDE_LABELS: Record<string, string> = {
  front: 'ด้านหน้า',
  back: 'ด้านหลัง',
  left: 'ด้านซ้าย',
  right: 'ด้านขวา',
  top: 'ด้านบน',
  floor: 'พื้น',
};

const DAMAGE_LABELS: Record<string, string> = {
  dent: 'บุ๋ม',
  hole: 'ทะลุ',
  rust: 'สนิม',
  scratch: 'ขีดข่วน',
  crack: 'แตกร้าว',
  missing_part: 'ชิ้นส่วนหาย',
};

const SEVERITY_INFO: Record<string, { label: string; marker: string; pill: string }> = {
  minor: { label: 'เล็กน้อย', marker: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  major: { label: 'ปานกลาง', marker: 'bg-orange-500', pill: 'bg-orange-50 text-orange-700 border-orange-200' },
  severe: { label: 'รุนแรง', marker: 'bg-red-600', pill: 'bg-red-50 text-red-700 border-red-200' },
};

const GRADE_INFO: Record<string, { desc: string; color: string }> = {
  A: { desc: 'สภาพดี', color: '#10B981' },
  B: { desc: 'สภาพพอใช้', color: '#F59E0B' },
  C: { desc: 'ต้องซ่อม', color: '#F97316' },
  D: { desc: 'Hold / ห้ามใช้งาน', color: '#EF4444' },
};

export default function PortalInspectionModal({ data, onClose }: PortalInspectionModalProps) {
  const [activeSide, setActiveSide] = useState('front');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [fullPhoto, setFullPhoto] = useState<string | null>(null);

  const damageReport = (data.damage_report || null) as PortalDamageReport | null;
  const damagePoints = damageReport?.points || [];
  const currentSidePoints = damagePoints.filter(point => point.side === activeSide);
  const selectedPoint = damagePoints.find(point => point.id === selectedPointId) || null;
  const hasDamage = damagePoints.length > 0 || data.container_condition === 'damage';
  const grade = data.container_grade || damageReport?.condition_grade || 'A';
  const gradeInfo = GRADE_INFO[grade] || GRADE_INFO.A;

  const evidenceSnapshot: {
    photo_evidence: EvidencePhoto[];
    photo_requirements?: PhotoRequirement[];
    photo_completeness?: PhotoCompleteness;
  } = damageReport?.photo_evidence?.length
    ? {
        photo_evidence: normalizeEvidencePhotos(damageReport.photo_evidence as EvidencePhoto[], 'other'),
        photo_requirements: damageReport.photo_requirements as PhotoRequirement[] | undefined,
        photo_completeness: damageReport.photo_completeness,
      }
    : buildPhotoEvidenceSnapshot({
        templateKey: damageReport?.inspection_template,
        legacyPhotos: damageReport?.photos || [],
        damagePoints,
      });

  const exitPhotos = normalizeEvidencePhotos(damageReport?.exit_photos || [], 'other').map((photo, index) => ({
    ...photo,
    id: `exit-${photo.id || index}`,
    label: `ภาพขาออก ${index + 1}`,
  }));
  const galleryPhotos = [...evidenceSnapshot.photo_evidence, ...exitPhotos];
  const photoCompleteness = evidenceSnapshot.photo_completeness;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 shadow-2xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Portal Inspection</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <h2 className="font-mono text-lg font-bold text-slate-800 dark:text-white">{data.container_number}</h2>
                <span className="rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-300">
                  {data.eir_number}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  hasDamage ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                }`}>
                  {hasDamage ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                  {hasDamage ? 'Damage' : 'Sound'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: gradeInfo.color }}>
                  Grade {grade}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-red-500 flex items-center justify-center">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label="ผลตรวจ" value={hasDamage ? `${damagePoints.length} จุดเสียหาย` : 'ไม่พบความเสียหาย'} />
              <Metric label="เกรด" value={`Grade ${grade} · ${gradeInfo.desc}`} />
              <Metric label="รูปถ่าย" value={`${galleryPhotos.length} รูป`} />
              <Metric label="หลักฐานครบ" value={photoCompleteness ? `${photoCompleteness.completed}/${photoCompleteness.required}` : '-'} />
              <Metric label="ประเภท" value={data.transaction_type === 'gate_in' ? 'Gate-In' : 'Gate-Out'} />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">แผนผังตรวจสภาพ 6 ด้าน</h3>
                <span className="text-[10px] text-slate-400">เลือกด้านเพื่อดูตำแหน่ง damage point</span>
              </div>
              <div className="px-4 pt-3 flex flex-wrap gap-1">
                {SIDES.map(side => {
                  const count = damagePoints.filter(point => point.side === side.key).length;
                  return (
                    <button
                      key={side.key}
                      onClick={() => { setActiveSide(side.key); setSelectedPointId(null); }}
                      className={`relative h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                        activeSide === side.key
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-blue-300'
                      }`}
                    >
                      {side.label}
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-4">
                <div className="relative h-56 rounded-xl overflow-hidden bg-gradient-to-b from-sky-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
                  <ContainerSideSvg side={activeSide} />
                  {currentSidePoints.map(point => {
                    const severity = SEVERITY_INFO[point.severity || 'minor'] || SEVERITY_INFO.minor;
                    return (
                      <button
                        key={point.id}
                        className={`absolute z-10 w-6 h-6 rounded-full ${severity.marker} border-2 border-white dark:border-slate-800 shadow-lg text-[9px] text-white font-bold transition-transform ${
                          selectedPoint?.id === point.id ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                        }`}
                        style={{ left: `${point.x || 50}%`, top: `${point.y || 50}%`, transform: 'translate(-50%, -50%)' }}
                        onClick={() => setSelectedPointId(selectedPoint?.id === point.id ? null : point.id || null)}
                      >
                        {damagePoints.findIndex(item => item.id === point.id) + 1}
                      </button>
                    );
                  })}
                  {currentSidePoints.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-slate-400/70">ไม่พบจุดเสียหายด้านนี้</span>
                    </div>
                  )}
                </div>

                {selectedPoint && (
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-3 flex gap-3">
                    {selectedPoint.photo && (
                      <button onClick={() => setFullPhoto(selectedPoint.photo || null)} className="flex-shrink-0">
                        <RawImage src={selectedPoint.photo} alt="damage" className="w-24 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${(SEVERITY_INFO[selectedPoint.severity || 'minor'] || SEVERITY_INFO.minor).pill}`}>
                          {(SEVERITY_INFO[selectedPoint.severity || 'minor'] || SEVERITY_INFO.minor).label}
                        </span>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                          {DAMAGE_LABELS[selectedPoint.type || ''] || selectedPoint.type || 'Damage'}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {SIDE_LABELS[selectedPoint.side || ''] || selectedPoint.side || '-'} · ตำแหน่ง {Math.round(selectedPoint.x || 0)}%, {Math.round(selectedPoint.y || 0)}%
                      </p>
                      {selectedPoint.note && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{selectedPoint.note}</p>}
                      {!selectedPoint.photo && <p className="mt-1 text-[10px] text-slate-400">ไม่มีรูปถ่ายประกอบจุดนี้</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {damageReport?.inspector_notes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                <span className="font-semibold">บันทึกผู้ตรวจ:</span> {damageReport.inspector_notes}
              </div>
            )}

            {galleryPhotos.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Camera size={13} /> Photo Evidence ({galleryPhotos.length} รูป)
                  </h3>
                  {photoCompleteness && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      photoCompleteness.missing_categories.length === 0
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    }`}>
                      ครบ {photoCompleteness.completed}/{photoCompleteness.required}
                    </span>
                  )}
                </div>
                {photoCompleteness?.missing_categories.length ? (
                  <p className="px-4 pt-3 text-[10px] text-amber-600 dark:text-amber-400">
                    ยังขาด: {photoCompleteness.missing_categories.join(', ')}
                  </p>
                ) : null}
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {galleryPhotos.map(photo => (
                    <button key={photo.id} onClick={() => setFullPhoto(photo.url)} className="text-left group">
                      <RawImage src={photo.url} alt={photo.label} className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700 group-hover:border-blue-400 transition-colors" />
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">{photo.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {fullPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setFullPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-white/15 text-white flex items-center justify-center hover:bg-white/25">
            <X size={18} />
          </button>
          <RawImage src={fullPhoto} alt="Full-size inspection photo" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}

function ContainerSideSvg({ side }: { side: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid meet">
      {side === 'front' && (
        <g>
          <rect x="80" y="10" width="440" height="200" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          <rect x="85" y="15" width="213" height="190" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
          <rect x="302" y="15" width="213" height="190" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
          {[50, 100, 150].map(y => (
            <g key={`lock-${y}`}>
              <rect x="85" y={y} width="8" height="14" rx="2" fill="#94A3B8" />
              <rect x="507" y={y} width="8" height="14" rx="2" fill="#94A3B8" />
            </g>
          ))}
          <rect x="280" y="80" width="6" height="50" rx="3" fill="#64748B" />
          <rect x="314" y="80" width="6" height="50" rx="3" fill="#64748B" />
        </g>
      )}
      {side === 'back' && (
        <g>
          <rect x="80" y="10" width="440" height="200" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          {Array.from({ length: 15 }, (_, i) => (
            <line key={i} x1="85" y1={18 + i * 13} x2="515" y2={18 + i * 13} stroke="#CBD5E1" strokeWidth="1" />
          ))}
          <text x="300" y="118" textAnchor="middle" fill="#94A3B8" fontSize="12" fontFamily="sans-serif" fontWeight="600">ผนังด้านหลัง</text>
        </g>
      )}
      {(side === 'left' || side === 'right') && (
        <g>
          <rect x="40" y="10" width="520" height="200" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          {Array.from({ length: 15 }, (_, i) => (
            <line key={i} x1="45" y1={18 + i * 13} x2="555" y2={18 + i * 13} stroke="#CBD5E1" strokeWidth="1" />
          ))}
          {[160, 300, 440].map(x => (
            <line key={x} x1={x} y1="10" x2={x} y2="210" stroke="#B0BEC5" strokeWidth="2" />
          ))}
        </g>
      )}
      {side === 'top' && (
        <g>
          <rect x="40" y="20" width="520" height="170" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1={90 + i * 48} y1="20" x2={90 + i * 48} y2="190" stroke="#CBD5E1" strokeWidth="1" />
          ))}
          <line x1="40" y1="105" x2="560" y2="105" stroke="#B0BEC5" strokeWidth="2" strokeDasharray="8,4" />
        </g>
      )}
      {side === 'floor' && (
        <g>
          <rect x="40" y="20" width="520" height="170" rx="3" fill="#DDD6C8" stroke="#A89F91" strokeWidth="2" />
          {Array.from({ length: 7 }, (_, i) => (
            <line key={i} x1="40" y1={44 + i * 22} x2="560" y2={44 + i * 22} stroke="#C4B99A" strokeWidth="1" />
          ))}
          <rect x="120" y="192" width="70" height="14" rx="3" fill="#94A3B8" />
          <rect x="400" y="192" width="70" height="14" rx="3" fill="#94A3B8" />
        </g>
      )}
    </svg>
  );
}
