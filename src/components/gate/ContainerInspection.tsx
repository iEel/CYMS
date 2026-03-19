'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface DamagePoint {
  id: string;
  side: 'front' | 'back' | 'left' | 'right' | 'top' | 'floor';
  x: number;
  y: number;
  type: string;
  severity: 'minor' | 'major' | 'severe';
  note: string;
}

interface ContainerInspectionProps {
  onComplete: (report: { points: DamagePoint[]; condition_grade: string; inspector_notes: string }) => void;
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

export default function ContainerInspection({ onComplete, onCancel }: ContainerInspectionProps) {
  const [activeSide, setActiveSide] = useState<typeof SIDES[0]['key']>('front');
  const [points, setPoints] = useState<DamagePoint[]>([]);
  const [selectedType, setSelectedType] = useState('dent');
  const [selectedSeverity, setSelectedSeverity] = useState<'minor' | 'major' | 'severe'>('minor');
  const [inspectorNotes, setInspectorNotes] = useState('');

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

  // Calculate condition grade based on damage
  const getConditionGrade = () => {
    if (totalPoints === 0) return 'A';
    const severeCount = points.filter(p => p.severity === 'severe').length;
    const majorCount = points.filter(p => p.severity === 'major').length;
    if (severeCount > 0) return 'D';
    if (majorCount >= 3 || totalPoints >= 5) return 'C';
    if (majorCount > 0 || totalPoints >= 2) return 'B';
    return 'A';
  };

  const gradeColors: Record<string, string> = {
    A: 'bg-emerald-500', B: 'bg-amber-500', C: 'bg-orange-500', D: 'bg-red-600',
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

      {/* Inspection Panel */}
      <div className="relative bg-slate-100 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 overflow-hidden cursor-crosshair"
        style={{ height: 240 }} onClick={handlePanelClick}>

        {/* Container drawing */}
        <div className="absolute inset-4 border-2 border-slate-400/40 dark:border-slate-500/40 rounded-lg">
          <div className="absolute top-1 left-1 text-[10px] text-slate-400 font-medium uppercase">
            {SIDES.find(s => s.key === activeSide)?.label}
          </div>
          {/* Container structural lines */}
          {activeSide !== 'top' && activeSide !== 'floor' && (
            <>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="absolute border-b border-slate-300/30 dark:border-slate-600/30 w-full" style={{ top: `${(i + 1) * 14.28}%` }} />
              ))}
            </>
          )}
          {/* Grid lines */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="absolute border-r border-slate-300/20 dark:border-slate-600/20 h-full" style={{ left: `${(i + 1) * 20}%` }} />
          ))}
        </div>

        {/* Damage points */}
        {currentSidePoints.map(point => (
          <div key={point.id} className={`absolute w-5 h-5 rounded-full ${SEVERITY_COLORS[point.severity].bg} shadow-lg border-2 border-white dark:border-slate-800 cursor-pointer z-10 flex items-center justify-center animate-pulse`}
            style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-50%, -50%)' }}
            onClick={(e) => { e.stopPropagation(); removePoint(point.id); }}
            title={`${DAMAGE_TYPES.find(d => d.value === point.type)?.label} — กดเพื่อลบ`}>
            <span className="text-[8px] text-white font-bold">✕</span>
          </div>
        ))}

        {/* Click hint */}
        {currentSidePoints.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs pointer-events-none">
            <div className="text-center">
              <AlertTriangle size={20} className="mx-auto mb-1 opacity-40" />
              <p>กดตำแหน่งที่พบความเสียหาย</p>
            </div>
          </div>
        )}
      </div>

      {/* Damage List */}
      {totalPoints > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400 font-semibold">จุดเสียหาย ({totalPoints} จุด)</p>
          {points.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${SEVERITY_COLORS[p.severity].bg}`} />
                <span className="text-slate-600 dark:text-slate-300">
                  {SIDES.find(s => s.key === p.side)?.icon} {DAMAGE_TYPES.find(d => d.value === p.type)?.label}
                </span>
                <span className="text-slate-400">@ ({p.x.toFixed(0)}%, {p.y.toFixed(0)}%)</span>
              </div>
              <button onClick={() => removePoint(p.id)} className="text-slate-400 hover:text-red-500"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Condition Grade */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold ${gradeColors[getConditionGrade()]}`}>
          {getConditionGrade()}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">
            สภาพตู้: เกรด {getConditionGrade()}
          </p>
          <p className="text-xs text-slate-400">
            {getConditionGrade() === 'A' ? 'สภาพดี — ไม่พบความเสียหาย' :
              getConditionGrade() === 'B' ? 'สภาพพอใช้ — พบความเสียหายเล็กน้อย' :
              getConditionGrade() === 'C' ? 'ชำรุด — ต้องซ่อมก่อนใช้งาน' :
              'ชำรุดหนัก — ห้ามใช้งาน'}
          </p>
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
        <button onClick={() => onComplete({ points, condition_grade: getConditionGrade(), inspector_notes: inspectorNotes })}
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
