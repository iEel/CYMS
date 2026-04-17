'use client';

import { useState, useRef } from 'react';
import { AlertTriangle, CheckCircle2, X, Camera, ImageIcon } from 'lucide-react';
import {
  PHOTO_CATEGORY_LABELS,
  STANDARD_PHOTO_CATEGORIES,
  buildPhotoRequirements,
  summarizePhotoCompleteness,
  type EvidencePhoto,
  type PhotoCategory,
  type PhotoCompleteness,
  type PhotoRequirement,
} from '@/lib/photoEvidence';

interface DamagePoint {
  id: string;
  side: 'front' | 'back' | 'left' | 'right' | 'top' | 'floor';
  x: number;
  y: number;
  type: string;
  severity: 'minor' | 'major' | 'severe';
  note: string;
  photo?: string;
}

type ConditionGrade = 'A' | 'B' | 'C' | 'D';
type TemplateKind = 'dry' | 'reefer' | 'open_top' | 'flat_rack' | 'tank' | 'dangerous';

interface ContainerInspectionProps {
  containerType?: string;
  containerSize?: string;
  onComplete: (report: {
    points: DamagePoint[];
    condition_grade: ConditionGrade;
    suggested_condition_grade: ConditionGrade;
    grade_override: boolean;
    grade_reasons: string[];
    inspector_notes: string;
    photos: string[];
    photo_evidence: EvidencePhoto[];
    photo_requirements: PhotoRequirement[];
    photo_completeness: PhotoCompleteness;
    container_type?: string;
    container_size?: string;
    inspection_template?: string;
  }) => void;
  onCancel: () => void;
}

const SIDES = [
  { key: 'front' as const, label: 'ด้านหน้า (Front)', icon: '🚪' },
  { key: 'back' as const, label: 'ด้านหลัง (Back)', icon: '🔙' },
  { key: 'left' as const, label: 'ด้านซ้าย (Left)', icon: '◀️' },
  { key: 'right' as const, label: 'ด้านขวา (Right)', icon: '▶️' },
  { key: 'top' as const, label: 'ด้านบน (Top)', icon: '🔝' },
  { key: 'floor' as const, label: 'พื้น (Floor)', icon: '⬇️' },
];

const DAMAGE_TYPES = [
  { value: 'dent', label: 'บุ๋ม (Dent)', icon: '🔨' },
  { value: 'hole', label: 'ทะลุ (Hole)', icon: '🕳️' },
  { value: 'rust', label: 'สนิม (Rust)', icon: '🟤' },
  { value: 'scratch', label: 'ขีดข่วน (Scratch)', icon: '✂️' },
  { value: 'crack', label: 'แตกร้าว (Crack)', icon: '💔' },
  { value: 'missing_part', label: 'ชิ้นส่วนหาย', icon: '❓' },
];

const SEVERITY_COLORS = {
  minor: { bg: 'bg-amber-400', text: 'text-amber-700', label: 'เล็กน้อย' },
  major: { bg: 'bg-orange-500', text: 'text-orange-700', label: 'ปานกลาง' },
  severe: { bg: 'bg-red-600', text: 'text-red-700', label: 'รุนแรง' },
};

const INSPECTION_TEMPLATES: Record<string, { key: string; label: string; kind: TemplateKind }> = {
  GP: { key: 'dry', label: 'Dry Container', kind: 'dry' },
  HC: { key: 'dry_high_cube', label: 'High Cube', kind: 'dry' },
  RF: { key: 'reefer', label: 'Reefer Container', kind: 'reefer' },
  OT: { key: 'open_top', label: 'Open Top Container', kind: 'open_top' },
  FR: { key: 'flat_rack', label: 'Flat Rack', kind: 'flat_rack' },
  TK: { key: 'tank', label: 'Tank Container', kind: 'tank' },
  DG: { key: 'dangerous_goods', label: 'Dangerous Goods', kind: 'dangerous' },
};

function getInspectionTemplate(containerType?: string) {
  const normalized = (containerType || 'GP').toUpperCase();
  return INSPECTION_TEMPLATES[normalized] || INSPECTION_TEMPLATES.GP;
}

const GRADE_ORDER: Record<ConditionGrade, number> = { A: 0, B: 1, C: 2, D: 3 };
const GRADE_LABELS: Record<ConditionGrade, string> = {
  A: 'ใช้งานได้',
  B: 'เสียหายเล็กน้อย',
  C: 'ต้องซ่อม / จำกัดการใช้งาน',
  D: 'Hold / ห้ามปล่อยใช้งาน',
};

function worseGrade(a: ConditionGrade, b: ConditionGrade): ConditionGrade {
  return GRADE_ORDER[a] >= GRADE_ORDER[b] ? a : b;
}

function isStructuralEdge(point: DamagePoint) {
  return point.x <= 12 || point.x >= 88 || point.y <= 18 || point.y >= 88;
}

function isDoorLockArea(point: DamagePoint) {
  return point.side === 'front' && point.x >= 43 && point.x <= 57 && point.y >= 34 && point.y <= 72;
}

function isReeferUnitArea(point: DamagePoint) {
  return (point.side === 'front' && point.x >= 17 && point.x <= 40 && point.y >= 20 && point.y <= 86)
    || ((point.side === 'left' || point.side === 'top') && point.x <= 24);
}

function isTankCriticalArea(point: DamagePoint) {
  return ['front', 'back', 'left', 'right', 'top'].includes(point.side);
}

function isFlatRackFrameArea(point: DamagePoint) {
  return point.side === 'front' || point.side === 'back' || point.x <= 18 || point.x >= 82 || point.y >= 72;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

async function uploadInspectionPhoto(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  try {
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataUrl, folder: 'damage', filename_prefix: 'inspection' }),
    });
    const json = await res.json();
    return json.success && json.url ? json.url : dataUrl;
  } catch {
    return dataUrl;
  }
}

function evaluateCondition(points: DamagePoint[], templateKind: TemplateKind): { grade: ConditionGrade; reasons: string[] } {
  let grade: ConditionGrade = 'A';
  const reasons: string[] = [];

  if (points.length === 0) {
    return { grade: 'A', reasons: ['ไม่พบจุดเสียหาย'] };
  }

  const severeCount = points.filter(p => p.severity === 'severe').length;
  const majorCount = points.filter(p => p.severity === 'major').length;
  const structuralTypes = ['hole', 'crack', 'missing_part'];

  if (severeCount > 0) {
    grade = worseGrade(grade, 'D');
    reasons.push('มีความเสียหายระดับรุนแรง');
  }

  for (const point of points) {
    const isStructuralType = structuralTypes.includes(point.type);

    if (templateKind === 'tank' && isTankCriticalArea(point) && isStructuralType) {
      grade = worseGrade(grade, 'D');
      reasons.push('ตู้ Tank มีความเสียหายที่ shell/frame/valve area');
      continue;
    }

    if (templateKind === 'reefer' && isReeferUnitArea(point) && (point.severity !== 'minor' || isStructuralType)) {
      grade = worseGrade(grade, point.severity === 'severe' ? 'D' : 'C');
      reasons.push('ความเสียหายบริเวณ reefer unit หรือ insulation area');
    }

    if (templateKind === 'flat_rack' && isFlatRackFrameArea(point) && point.severity !== 'minor') {
      grade = worseGrade(grade, point.severity === 'severe' ? 'D' : 'C');
      reasons.push('ความเสียหายบริเวณ frame/deck ของ Flat Rack');
    }

    if (templateKind === 'dangerous' && isStructuralType) {
      grade = worseGrade(grade, point.severity === 'minor' ? 'C' : 'D');
      reasons.push('ตู้ DG มีความเสียหายที่กระทบความพร้อมด้าน safety/security');
    }

    if (isStructuralEdge(point) && point.severity !== 'minor') {
      grade = worseGrade(grade, point.severity === 'severe' ? 'D' : 'C');
      reasons.push('ความเสียหายใกล้โครงสร้างหลัก เช่น rail/post/corner area');
    }

    if (isDoorLockArea(point) && (isStructuralType || point.severity !== 'minor')) {
      grade = worseGrade(grade, 'C');
      reasons.push('ความเสียหายบริเวณประตู/locking gear/seal area');
    }

    if (isStructuralType) {
      grade = worseGrade(grade, point.severity === 'minor' ? 'C' : 'D');
      reasons.push('พบรูทะลุ รอยร้าว หรือชิ้นส่วนหาย');
    }

    if (point.side === 'floor' && point.severity !== 'minor') {
      grade = worseGrade(grade, point.severity === 'severe' ? 'D' : 'C');
      reasons.push('พื้นตู้เสียหาย อาจกระทบการรับน้ำหนัก/ความสะอาดสินค้า');
    }
  }

  if (majorCount >= 3 || points.length >= 5) {
    grade = worseGrade(grade, 'C');
    reasons.push('จำนวนจุดเสียหายหรือระดับปานกลางเกินเกณฑ์ใช้งานปกติ');
  } else if (majorCount > 0 || points.length >= 2) {
    grade = worseGrade(grade, 'B');
    reasons.push('พบความเสียหายมากกว่าหนึ่งจุดหรือมีระดับปานกลาง');
  } else {
    grade = worseGrade(grade, 'B');
    reasons.push('พบความเสียหายเล็กน้อยหนึ่งจุด');
  }

  return { grade, reasons: Array.from(new Set(reasons)) };
}

export default function ContainerInspection({ containerType = 'GP', containerSize, onComplete, onCancel }: ContainerInspectionProps) {
  const template = getInspectionTemplate(containerType);
  const [activeSide, setActiveSide] = useState<typeof SIDES[0]['key']>('front');
  const [points, setPoints] = useState<DamagePoint[]>([]);
  const [selectedType, setSelectedType] = useState('dent');
  const [selectedSeverity, setSelectedSeverity] = useState<'minor' | 'major' | 'severe'>('minor');
  const [manualGrade, setManualGrade] = useState<ConditionGrade | null>(null);
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePhoto[]>([]);
  const [selectedPhotoCategory, setSelectedPhotoCategory] = useState<PhotoCategory>('front');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const damageFileRef = useRef<HTMLInputElement>(null);
  const [activePhotoPointId, setActivePhotoPointId] = useState<string | null>(null);

  // Click on panel to add damage point
  const handlePanelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPoint: DamagePoint = {
      id: `${Date.now()}-${Math.random()}`,
      side: activeSide,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      type: selectedType,
      severity: selectedSeverity,
      note: '',
    };
    setPoints([...points, newPoint]);
  };

  const removePoint = (id: string) => {
    setPoints(points.filter(p => p.id !== id));
  };

  const currentSidePoints = points.filter(p => p.side === activeSide);
  const totalPoints = points.length;
  const conditionEvaluation = evaluateCondition(points, template.kind);
  const finalGrade = manualGrade || conditionEvaluation.grade;
  const overviewPhotos = evidencePhotos.map(photo => photo.url);
  const damageEvidencePhotos: EvidencePhoto[] = points
    .filter(point => point.photo)
    .map((point, index) => ({
      id: `damage-${point.id}`,
      url: point.photo as string,
      category: 'damage_closeup',
      label: `${PHOTO_CATEGORY_LABELS.damage_closeup} ${index + 1}`,
      taken_at: new Date().toISOString(),
      damage_point_id: point.id,
      required: point.severity !== 'minor',
    }));
  const allEvidencePhotos = [...evidencePhotos, ...damageEvidencePhotos];
  const photoRequirements = buildPhotoRequirements(template.key, evidencePhotos, points);
  const photoCompleteness = summarizePhotoCompleteness(photoRequirements, allEvidencePhotos.length);

  const gradeColors: Record<string, string> = {
    A: 'bg-emerald-500', B: 'bg-amber-500', C: 'bg-orange-500', D: 'bg-red-600',
  };

  const handleEvidencePhotoUpload = async (file: File) => {
    const url = await uploadInspectionPhoto(file);
    setEvidencePhotos(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        url,
        category: selectedPhotoCategory,
        label: PHOTO_CATEGORY_LABELS[selectedPhotoCategory],
        taken_at: new Date().toISOString(),
        required: photoRequirements.some(item => item.category === selectedPhotoCategory && item.required),
      },
    ]);
  };

  const completeInspection = () => {
    onComplete({
      points,
      condition_grade: finalGrade,
      suggested_condition_grade: conditionEvaluation.grade,
      grade_override: manualGrade !== null,
      grade_reasons: conditionEvaluation.reasons,
      inspector_notes: inspectorNotes,
      photos: overviewPhotos,
      photo_evidence: allEvidencePhotos,
      photo_requirements: photoRequirements,
      photo_completeness: photoCompleteness,
      container_type: containerType.toUpperCase(),
      container_size: containerSize,
      inspection_template: template.key,
    });
  };

  return (
    <div className="space-y-4">
      {/* Side Selector */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
        {SIDES.map(side => {
          const count = points.filter(p => p.side === side.key).length;
          return (
            <button key={side.key} onClick={() => setActiveSide(side.key)}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border relative ${
                activeSide === side.key
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-blue-200'
              }`}>
              <span className="text-base">{side.icon}</span>
              <p className="mt-0.5">{side.label.split(' ')[0]}</p>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tools */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] text-slate-400 uppercase font-semibold">ประเภท:</span>
        {DAMAGE_TYPES.map(dt => (
          <button key={dt.value} onClick={() => setSelectedType(dt.value)}
            className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border transition-all ${
              selectedType === dt.value
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 font-medium'
                : 'border-slate-200 dark:border-slate-600 text-slate-500'
            }`}>
            {dt.icon} {dt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-[10px] text-slate-400 uppercase font-semibold">ความรุนแรง:</span>
        {(['minor', 'major', 'severe'] as const).map(s => (
          <button key={s} onClick={() => setSelectedSeverity(s)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
              selectedSeverity === s
                ? `${SEVERITY_COLORS[s].bg} text-white border-transparent`
                : 'border-slate-200 dark:border-slate-600 text-slate-500'
            }`}>
            {SEVERITY_COLORS[s].label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold">
          Template: {containerSize ? `${containerSize}' ` : ''}{containerType.toUpperCase()} - {template.label}
        </span>
        <span>ตำแหน่งจุดเสียหายบันทึกเป็นเปอร์เซ็นต์ตามด้านที่เลือก</span>
      </div>

      {/* Inspection Panel */}
      <div className="relative rounded-xl overflow-hidden cursor-crosshair"
        style={{ height: 280 }} onClick={handlePanelClick}>

        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-100 to-slate-200 dark:from-slate-900 dark:to-slate-800" />

        {/* SVG Container Drawing per side */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 280" preserveAspectRatio="xMidYMid meet">
          {/* Side label */}
          <text x="300" y="20" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="600" fontFamily="sans-serif">
            {SIDES.find(s => s.key === activeSide)?.label} - {template.label}
          </text>

          {activeSide === 'front' && template.kind === 'tank' && (
            <g>
              <rect x="110" y="45" width="380" height="200" rx="8" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
              <circle cx="300" cy="145" r="78" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="3" />
              <circle cx="300" cy="145" r="50" fill="none" stroke="#CBD5E1" strokeWidth="2" />
              <rect x="120" y="60" width="55" height="170" rx="2" fill="none" stroke="#64748B" strokeWidth="5" />
              <rect x="425" y="60" width="55" height="170" rx="2" fill="none" stroke="#64748B" strokeWidth="5" />
              <rect x="285" y="60" width="30" height="18" rx="3" fill="#94A3B8" />
              <text x="300" y="235" textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="sans-serif">Tank end frame / manway</text>
            </g>
          )}

          {activeSide === 'front' && template.kind !== 'tank' && (
            <g>
              {/* Container body */}
              <rect x="80" y="30" width="440" height="230" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
              {/* Left door */}
              <rect x="85" y="35" width="213" height="220" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
              {/* Right door */}
              <rect x="302" y="35" width="213" height="220" rx="2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
              {/* Door hinges */}
              {[70, 130, 190].map(y => (
                <g key={`lh${y}`}>
                  <rect x="85" y={y} width="8" height="16" rx="2" fill="#94A3B8" />
                  <rect x="507" y={y} width="8" height="16" rx="2" fill="#94A3B8" />
                </g>
              ))}
              {/* Door handles */}
              <rect x="280" y="110" width="6" height="60" rx="3" fill="#64748B" />
              <rect x="314" y="110" width="6" height="60" rx="3" fill="#64748B" />
              {/* Lock rods */}
              <line x1="270" y1="45" x2="270" y2="245" stroke="#CBD5E1" strokeWidth="1" />
              <line x1="330" y1="45" x2="330" y2="245" stroke="#CBD5E1" strokeWidth="1" />
              {/* Seal position */}
              <circle cx="300" cy="170" r="8" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="3,2" />
              <text x="300" y="195" textAnchor="middle" fill="#3B82F6" fontSize="8" fontFamily="sans-serif">ซีล</text>
              {/* Corner castings */}
              <rect x="80" y="30" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="500" y="30" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="80" y="240" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="500" y="240" width="20" height="20" fill="#94A3B8" rx="2" />
              {template.kind === 'reefer' && (
                <g>
                  <rect x="108" y="58" width="132" height="174" rx="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
                  <circle cx="174" cy="122" r="34" fill="none" stroke="#2563EB" strokeWidth="3" />
                  {Array.from({ length: 8 }, (_, i) => (
                    <line key={i} x1="174" y1="122" x2={174 + Math.cos(i * Math.PI / 4) * 30} y2={122 + Math.sin(i * Math.PI / 4) * 30} stroke="#2563EB" strokeWidth="2" />
                  ))}
                  <rect x="132" y="176" width="84" height="28" rx="3" fill="#BFDBFE" stroke="#60A5FA" />
                  <text x="174" y="248" textAnchor="middle" fill="#2563EB" fontSize="9" fontFamily="sans-serif">Reefer unit</text>
                </g>
              )}
              {template.kind === 'flat_rack' && (
                <g>
                  <rect x="112" y="50" width="70" height="190" rx="3" fill="none" stroke="#64748B" strokeWidth="6" />
                  <rect x="418" y="50" width="70" height="190" rx="3" fill="none" stroke="#64748B" strokeWidth="6" />
                  <line x1="182" y1="228" x2="418" y2="228" stroke="#64748B" strokeWidth="8" />
                  <text x="300" y="75" textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="sans-serif">End frames / open sides</text>
                </g>
              )}
              {template.kind === 'dangerous' && (
                <g>
                  <polygon points="300,70 330,120 270,120" fill="#FDE68A" stroke="#F59E0B" strokeWidth="2" />
                  <text x="300" y="112" textAnchor="middle" fill="#92400E" fontSize="28" fontWeight="700" fontFamily="sans-serif">!</text>
                  <text x="300" y="135" textAnchor="middle" fill="#92400E" fontSize="9" fontWeight="700" fontFamily="sans-serif">DG placard area</text>
                </g>
              )}
            </g>
          )}

          {activeSide === 'back' && template.kind === 'tank' && (
            <g>
              <rect x="110" y="45" width="380" height="200" rx="8" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
              <circle cx="300" cy="145" r="76" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="3" />
              <path d="M255 145h90M300 100v90" stroke="#CBD5E1" strokeWidth="2" />
              <rect x="120" y="60" width="55" height="170" rx="2" fill="none" stroke="#64748B" strokeWidth="5" />
              <rect x="425" y="60" width="55" height="170" rx="2" fill="none" stroke="#64748B" strokeWidth="5" />
              <text x="300" y="235" textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="sans-serif">Tank rear frame</text>
            </g>
          )}

          {activeSide === 'back' && template.kind !== 'tank' && (
            <g>
              <rect x="80" y="30" width="440" height="230" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
              {/* Corrugated wall - horizontal ribs */}
              {Array.from({ length: 18 }, (_, i) => (
                <line key={i} x1="85" y1={40 + i * 12.5} x2="515" y2={40 + i * 12.5} stroke="#CBD5E1" strokeWidth="1" />
              ))}
              {/* Corner castings */}
              <rect x="80" y="30" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="500" y="30" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="80" y="240" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="500" y="240" width="20" height="20" fill="#94A3B8" rx="2" />
              <text x="300" y="145" textAnchor="middle" fill="#94A3B8" fontSize="14" fontFamily="sans-serif" fontWeight="600">ผนังด้านหลัง</text>
              {template.kind === 'reefer' && (
                <text x="300" y="170" textAnchor="middle" fill="#3B82F6" fontSize="10" fontFamily="sans-serif">Reefer rear panel</text>
              )}
              {template.kind === 'flat_rack' && (
                <g>
                  <rect x="105" y="55" width="90" height="180" rx="3" fill="none" stroke="#64748B" strokeWidth="6" />
                  <rect x="405" y="55" width="90" height="180" rx="3" fill="none" stroke="#64748B" strokeWidth="6" />
                  <line x1="195" y1="225" x2="405" y2="225" stroke="#64748B" strokeWidth="8" />
                </g>
              )}
            </g>
          )}

          {(activeSide === 'left' || activeSide === 'right') && template.kind === 'tank' && (
            <g>
              <rect x="40" y="42" width="520" height="210" rx="8" fill="none" stroke="#64748B" strokeWidth="5" />
              <ellipse cx="300" cy="145" rx="205" ry="70" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="3" />
              <line x1="100" y1="145" x2="500" y2="145" stroke="#CBD5E1" strokeWidth="1.5" />
              <rect x="260" y="58" width="80" height="24" rx="4" fill="#CBD5E1" stroke="#94A3B8" />
              <line x1="125" y1="68" x2="125" y2="222" stroke="#64748B" strokeWidth="5" />
              <line x1="475" y1="68" x2="475" y2="222" stroke="#64748B" strokeWidth="5" />
              <text x="300" y="235" textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="sans-serif">Cylindrical tank shell / top valve</text>
            </g>
          )}

          {(activeSide === 'left' || activeSide === 'right') && template.kind === 'flat_rack' && (
            <g>
              <rect x="40" y="205" width="520" height="34" rx="3" fill="#CBD5E1" stroke="#64748B" strokeWidth="3" />
              <rect x="52" y="58" width="52" height="150" rx="3" fill="none" stroke="#64748B" strokeWidth="6" />
              <rect x="496" y="58" width="52" height="150" rx="3" fill="none" stroke="#64748B" strokeWidth="6" />
              {[155, 255, 355, 455].map(x => (
                <line key={x} x1={x} y1="92" x2={x} y2="205" stroke="#94A3B8" strokeWidth="3" strokeDasharray="8,6" />
              ))}
              <text x="300" y="145" textAnchor="middle" fill="#64748B" fontSize="14" fontFamily="sans-serif" fontWeight="600">โครง Flat Rack เปิดด้านข้าง</text>
              <text x="300" y="275" textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="sans-serif">
                {activeSide === 'left' ? '← หน้า                                                    หลัง →' : '← หลัง                                                    หน้า →'}
              </text>
            </g>
          )}

          {(activeSide === 'left' || activeSide === 'right') && template.kind !== 'tank' && template.kind !== 'flat_rack' && (
            <g>
              <rect x="40" y="30" width="520" height="230" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
              {/* Corrugated wall - horizontal ribs */}
              {Array.from({ length: 18 }, (_, i) => (
                <line key={i} x1="45" y1={40 + i * 12.5} x2="555" y2={40 + i * 12.5} stroke="#CBD5E1" strokeWidth="1" />
              ))}
              {/* Vertical posts */}
              {[160, 300, 440].map(x => (
                <line key={x} x1={x} y1="30" x2={x} y2="260" stroke="#B0BEC5" strokeWidth="2" />
              ))}
              {/* Corner castings */}
              <rect x="40" y="30" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="540" y="30" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="40" y="240" width="20" height="20" fill="#94A3B8" rx="2" />
              <rect x="540" y="240" width="20" height="20" fill="#94A3B8" rx="2" />
              {/* Arrow for direction */}
              <text x="300" y="275" textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="sans-serif">
                {activeSide === 'left' ? '← หน้า                                                    หลัง →' : '← หลัง                                                    หน้า →'}
              </text>
              {template.kind === 'reefer' && activeSide === 'left' && (
                <g>
                  <rect x="54" y="58" width="92" height="170" rx="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
                  <circle cx="100" cy="126" r="24" fill="none" stroke="#2563EB" strokeWidth="2" />
                  <text x="100" y="218" textAnchor="middle" fill="#2563EB" fontSize="8" fontFamily="sans-serif">Unit end</text>
                </g>
              )}
              {template.kind === 'open_top' && (
                <g>
                  <rect x="70" y="48" width="460" height="34" rx="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" strokeDasharray="7,4" opacity="0.75" />
                  <text x="300" y="72" textAnchor="middle" fill="#2563EB" fontSize="9" fontFamily="sans-serif">ผ้าใบ / Open top rail</text>
                </g>
              )}
            </g>
          )}

          {activeSide === 'top' && template.kind === 'tank' && (
            <g>
              <rect x="40" y="48" width="520" height="184" rx="8" fill="none" stroke="#64748B" strokeWidth="5" />
              <ellipse cx="300" cy="140" rx="220" ry="58" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="3" />
              <rect x="260" y="122" width="80" height="36" rx="6" fill="#CBD5E1" stroke="#94A3B8" />
              <circle cx="300" cy="140" r="14" fill="#E2E8F0" stroke="#64748B" strokeWidth="2" />
              <text x="300" y="42" textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="sans-serif">← หน้า                                                    หลัง →</text>
            </g>
          )}

          {activeSide === 'top' && template.kind === 'flat_rack' && (
            <g>
              <rect x="40" y="78" width="520" height="124" rx="3" fill="#E2E8F0" stroke="#64748B" strokeWidth="3" />
              {[90, 150, 210, 270, 330, 390, 450, 510].map(x => (
                <line key={x} x1={x} y1="78" x2={x} y2="202" stroke="#94A3B8" strokeWidth="2" />
              ))}
              <line x1="40" y1="78" x2="560" y2="202" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="10,6" />
              <line x1="560" y1="78" x2="40" y2="202" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="10,6" />
              <text x="300" y="62" textAnchor="middle" fill="#64748B" fontSize="10" fontFamily="sans-serif">Flat rack deck - no roof</text>
            </g>
          )}

          {activeSide === 'top' && template.kind !== 'tank' && template.kind !== 'flat_rack' && (
            <g>
              <rect x="40" y="50" width="520" height="180" rx="3" fill={template.kind === 'open_top' ? '#EFF6FF' : '#E2E8F0'} stroke={template.kind === 'open_top' ? '#3B82F6' : '#94A3B8'} strokeWidth="2" strokeDasharray={template.kind === 'open_top' ? '10,6' : undefined} />
              {/* Roof lines */}
              {Array.from({ length: 10 }, (_, i) => (
                <line key={i} x1={90 + i * 48} y1="50" x2={90 + i * 48} y2="230" stroke="#CBD5E1" strokeWidth="1" />
              ))}
              {/* Center ridge */}
              <line x1="40" y1="140" x2="560" y2="140" stroke="#B0BEC5" strokeWidth="2" strokeDasharray="8,4" />
              {/* Corner castings */}
              <rect x="40" y="50" width="20" height="16" fill="#94A3B8" rx="2" />
              <rect x="540" y="50" width="20" height="16" fill="#94A3B8" rx="2" />
              <rect x="40" y="214" width="20" height="16" fill="#94A3B8" rx="2" />
              <rect x="540" y="214" width="20" height="16" fill="#94A3B8" rx="2" />
              <text x="300" y="42" textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="sans-serif">← หน้า                                                    หลัง →</text>
              {template.kind === 'open_top' && (
                <text x="300" y="145" textAnchor="middle" fill="#2563EB" fontSize="14" fontFamily="sans-serif" fontWeight="700">Open top / removable tarpaulin</text>
              )}
              {template.kind === 'reefer' && (
                <rect x="55" y="70" width="65" height="140" rx="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
              )}
            </g>
          )}

          {activeSide === 'floor' && (
            <g>
              <rect x="40" y="50" width="520" height="180" rx="3" fill={template.kind === 'tank' ? '#E2E8F0' : '#DDD6C8'} stroke={template.kind === 'tank' ? '#64748B' : '#A89F91'} strokeWidth="2" />
              {/* Wooden floorboards */}
              {Array.from({ length: 8 }, (_, i) => (
                <line key={i} x1="40" y1={73 + i * 22} x2="560" y2={73 + i * 22} stroke="#C4B99A" strokeWidth="1" />
              ))}
              {/* Cross beams */}
              {[160, 300, 440].map(x => (
                <rect key={x} x={x - 4} y="50" width="8" height="180" fill="#B7AD9A" rx="1" opacity="0.5" />
              ))}
              {/* Fork pockets */}
              <rect x="120" y="232" width="80" height="16" rx="3" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
              <rect x="400" y="232" width="80" height="16" rx="3" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
              <text x="160" y="244" textAnchor="middle" fill="#FFF" fontSize="7" fontFamily="sans-serif">Fork Pocket</text>
              <text x="440" y="244" textAnchor="middle" fill="#FFF" fontSize="7" fontFamily="sans-serif">Fork Pocket</text>
              <text x="300" y="42" textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="sans-serif">← หน้า                                                    หลัง →</text>
              {template.kind === 'flat_rack' && (
                <text x="300" y="145" textAnchor="middle" fill="#64748B" fontSize="13" fontFamily="sans-serif" fontWeight="700">Heavy deck / lashing points</text>
              )}
              {template.kind === 'tank' && (
                <ellipse cx="300" cy="140" rx="210" ry="56" fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="8,5" />
              )}
            </g>
          )}
        </svg>

        {/* Damage points */}
        {currentSidePoints.map(point => (
          <div key={point.id} className={`absolute w-6 h-6 rounded-full ${SEVERITY_COLORS[point.severity].bg} shadow-lg border-2 border-white dark:border-slate-800 cursor-pointer z-10 flex items-center justify-center`}
            style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)', animation: 'pulse 2s infinite' }}
            onClick={(e) => { e.stopPropagation(); removePoint(point.id); }}
            title={`${DAMAGE_TYPES.find(d => d.value === point.type)?.label} — กดเพื่อลบ`}>
            <span className="text-[9px] text-white font-bold">✕</span>
          </div>
        ))}

        {/* Click hint */}
        {currentSidePoints.length === 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white text-[10px]">
              <AlertTriangle size={12} /> กดตำแหน่งบนตู้ตรงจุดที่พบความเสียหาย
            </div>
          </div>
        )}
      </div>

      {/* Damage List */}
      {totalPoints > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400 font-semibold">จุดเสียหาย ({totalPoints} จุด)</p>
          {points.map(p => (
            <div key={p.id} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${SEVERITY_COLORS[p.severity].bg}`} />
                  <span className="text-slate-600 dark:text-slate-300">
                    {SIDES.find(s => s.key === p.side)?.icon} {DAMAGE_TYPES.find(d => d.value === p.type)?.label}
                  </span>
                  <span className="text-slate-400">@ ({p.x.toFixed(0)}%, {p.y.toFixed(0)}%)</span>
                </div>
                <button onClick={() => removePoint(p.id)} className="text-slate-400 hover:text-red-500"><X size={12} /></button>
              </div>
              {/* Damage photo */}
              <div className="flex items-center gap-2">
                {p.photo ? (
                  <div className="relative">
                    <img src={p.photo} alt="damage" className="w-16 h-12 rounded object-cover border border-slate-200" />
                    <button onClick={() => setPoints(pts => pts.map(pt => pt.id === p.id ? { ...pt, photo: undefined } : pt))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px]">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setActivePhotoPointId(p.id); damageFileRef.current?.click(); }}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-500">
                    <Camera size={10} /> ถ่ายรูปความเสียหาย
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Evidence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
            <ImageIcon size={12} /> Photo Evidence ({allEvidencePhotos.length} รูป)
          </p>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            photoCompleteness.missing_categories.length === 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
          }`}>
            ครบ {photoCompleteness.completed}/{photoCompleteness.required}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {photoRequirements.map(item => (
            <div key={item.category} className={`px-2 py-1.5 rounded-lg border text-[10px] flex items-center justify-between gap-2 ${
              item.met
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/10 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-300'
            }`}>
              <span className="truncate">{item.label}</span>
              <span className="font-bold">{item.met ? 'ครบ' : 'รอรูป'}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">หมวดรูปถัดไป:</span>
          {STANDARD_PHOTO_CATEGORIES.map(category => (
            <button key={category} type="button" onClick={() => setSelectedPhotoCategory(category)}
              className={`px-2 py-1 rounded-lg text-[10px] border transition-all ${
                selectedPhotoCategory === category
                  ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-600 text-slate-500'
              }`}>
              {PHOTO_CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {evidencePhotos.map(photo => (
            <div key={photo.id} className="relative group">
              <img src={photo.url} alt={photo.label} className="w-24 h-16 rounded-lg object-cover border border-slate-200" />
              <span className="absolute left-1 bottom-1 max-w-[5.5rem] px-1 py-0.5 rounded bg-black/60 text-white text-[8px] truncate">
                {photo.label}
              </span>
              <button onClick={() => setEvidencePhotos(prev => prev.filter(item => item.id !== photo.id))}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px]">✕</button>
            </div>
          ))}
          <button onClick={() => fileInputRef.current?.click()}
            className="w-24 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Camera size={16} /> <span className="text-[8px] mt-0.5">เพิ่มรูป</span>
          </button>
        </div>
        {photoCompleteness.missing_categories.length > 0 && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            ยังขาด: {photoCompleteness.missing_categories.join(', ')}
          </p>
        )}
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleEvidencePhotoUpload(file);
          e.target.value = '';
        }} />
      <input ref={damageFileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file || !activePhotoPointId) return;
          const url = await uploadInspectionPhoto(file);
          setPoints(pts => pts.map(pt => pt.id === activePhotoPointId ? { ...pt, photo: url } : pt));
          setActivePhotoPointId(null);
          e.target.value = '';
        }} />

      {/* Condition Grade */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold ${gradeColors[finalGrade]}`}>
            {finalGrade}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              สภาพตู้: เกรด {finalGrade} {manualGrade ? '(พนักงานปรับเอง)' : '(ระบบแนะนำ)'}
            </p>
            <p className="text-xs text-slate-400">
              {finalGrade === 'A' ? 'สภาพดี — ไม่พบความเสียหายสำคัญ' :
                finalGrade === 'B' ? 'สภาพพอใช้ — พบความเสียหายเล็กน้อย' :
                finalGrade === 'C' ? 'ชำรุด — ต้องซ่อมหรือจำกัดการใช้งาน' :
                'ชำรุดหนัก — ห้ามใช้งาน'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ระบบแนะนำเกรด {conditionEvaluation.grade}: {GRADE_LABELS[conditionEvaluation.grade]}
            </p>
          </div>
        </div>

        {conditionEvaluation.reasons.length > 0 && (
          <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">เหตุผลจากระบบ</p>
            <div className="flex flex-wrap gap-1.5">
              {conditionEvaluation.reasons.map(reason => (
                <span key={reason} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">ปรับเกรดโดยพนักงาน</p>
            {manualGrade && (
              <button type="button" onClick={() => setManualGrade(null)}
                className="text-[10px] text-blue-500 hover:text-blue-700">
                ใช้เกรดที่ระบบแนะนำ
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(['A', 'B', 'C', 'D'] as ConditionGrade[]).map(grade => (
              <button key={grade} type="button" onClick={() => setManualGrade(grade)}
                className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-all ${
                  finalGrade === grade
                    ? `${gradeColors[grade]} text-white border-transparent shadow-sm`
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-blue-300'
                }`}>
                <span className="block text-sm">{grade}</span>
                <span className="font-normal">{GRADE_LABELS[grade]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">บันทึกผู้ตรวจ</label>
        <textarea value={inspectorNotes} onChange={e => setInspectorNotes(e.target.value)}
          className="w-full h-16 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none resize-none"
          placeholder="บันทึกเพิ่มเติม..." />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={completeInspection}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all">
          <CheckCircle2 size={16} /> บันทึกผลตรวจ
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 text-sm font-medium hover:bg-slate-200 transition-all">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
