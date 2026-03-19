'use client';

import { useState, useRef } from 'react';
import { AlertTriangle, CheckCircle2, X, Camera, ImageIcon } from 'lucide-react';

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

interface ContainerInspectionProps {
  onComplete: (report: { points: DamagePoint[]; condition_grade: string; inspector_notes: string; photos: string[] }) => void;
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
  const [overviewPhotos, setOverviewPhotos] = useState<string[]>([]);
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
      <div className="relative rounded-xl overflow-hidden cursor-crosshair"
        style={{ height: 280 }} onClick={handlePanelClick}>

        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-100 to-slate-200 dark:from-slate-900 dark:to-slate-800" />

        {/* SVG Container Drawing per side */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 600 280" preserveAspectRatio="xMidYMid meet">
          {/* Side label */}
          <text x="300" y="20" textAnchor="middle" fill="#94A3B8" fontSize="11" fontWeight="600" fontFamily="sans-serif">
            {SIDES.find(s => s.key === activeSide)?.label}
          </text>

          {activeSide === 'front' && (
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
            </g>
          )}

          {activeSide === 'back' && (
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
            </g>
          )}

          {(activeSide === 'left' || activeSide === 'right') && (
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
            </g>
          )}

          {activeSide === 'top' && (
            <g>
              <rect x="40" y="50" width="520" height="180" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
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
            </g>
          )}

          {activeSide === 'floor' && (
            <g>
              <rect x="40" y="50" width="520" height="180" rx="3" fill="#DDD6C8" stroke="#A89F91" strokeWidth="2" />
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

      {/* Overview Photos */}
      <div className="space-y-2">
        <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
          <ImageIcon size={12} /> รูปถ่ายภาพรวมสภาพตู้ ({overviewPhotos.length} รูป)
        </p>
        <div className="flex gap-2 flex-wrap">
          {overviewPhotos.map((photo, i) => (
            <div key={i} className="relative">
              <img src={photo} alt={`overview ${i + 1}`} className="w-20 h-16 rounded-lg object-cover border border-slate-200" />
              <button onClick={() => setOverviewPhotos(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px]">✕</button>
            </div>
          ))}
          <button onClick={() => fileInputRef.current?.click()}
            className="w-20 h-16 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Camera size={16} /> <span className="text-[8px] mt-0.5">เพิ่มรูป</span>
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setOverviewPhotos(prev => [...prev, reader.result as string]);
          reader.readAsDataURL(file);
          e.target.value = '';
        }} />
      <input ref={damageFileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file || !activePhotoPointId) return;
          const reader = new FileReader();
          reader.onload = () => {
            setPoints(pts => pts.map(pt => pt.id === activePhotoPointId ? { ...pt, photo: reader.result as string } : pt));
            setActivePhotoPointId(null);
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }} />

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
        <button onClick={() => onComplete({ points, condition_grade: getConditionGrade(), inspector_notes: inspectorNotes, photos: overviewPhotos })}
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
