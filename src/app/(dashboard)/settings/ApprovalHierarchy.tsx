'use client';

import { useState } from 'react';
import {
  Plus, Trash2, Save, ShieldCheck, Users, ArrowUp, ArrowDown,
  Settings2, CheckCircle2,
} from 'lucide-react';

interface ApprovalLevel {
  id: number;
  level: number;
  role_name: string;
  description: string;
  approval_limit: number;
  auto_approve: boolean;
}

const DEFAULT_LEVELS: ApprovalLevel[] = [
  { id: 1, level: 1, role_name: 'Surveyor', description: 'ตรวจสอบสภาพตู้ — อนุมัติ EOR ≤ ฿5,000', approval_limit: 5000, auto_approve: false },
  { id: 2, level: 2, role_name: 'Shift Supervisor', description: 'หัวหน้ากะ — อนุมัติ EOR ≤ ฿20,000', approval_limit: 20000, auto_approve: false },
  { id: 3, level: 3, role_name: 'Yard Manager', description: 'ผู้จัดการลาน — อนุมัติ EOR ≤ ฿100,000', approval_limit: 100000, auto_approve: false },
  { id: 4, level: 4, role_name: 'Operations Director', description: 'ผู้อำนวยการ — อนุมัติทุกมูลค่า', approval_limit: 999999999, auto_approve: false },
];

export default function ApprovalHierarchy() {
  const [levels, setLevels] = useState<ApprovalLevel[]>(DEFAULT_LEVELS);
  const [saved, setSaved] = useState(false);

  const addLevel = () => {
    const maxLevel = Math.max(...levels.map(l => l.level), 0);
    setLevels([...levels, {
      id: Date.now(), level: maxLevel + 1, role_name: '', description: '', approval_limit: 0, auto_approve: false,
    }]);
  };

  const removeLevel = (id: number) => setLevels(levels.filter(l => l.id !== id));

  const updateLevel = (id: number, field: string, value: string | number | boolean) => {
    setLevels(levels.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const moveLevel = (id: number, dir: number) => {
    const idx = levels.findIndex(l => l.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= levels.length) return;
    const arr = [...levels];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    arr.forEach((l, i) => { l.level = i + 1; });
    setLevels(arr);
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600"><ShieldCheck size={20} /></div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">Approval Hierarchy</h3>
              <p className="text-xs text-slate-400">ลำดับชั้นอนุมัติ — EOR, Gate, Billing</p>
            </div>
          </div>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all">
            {saved ? <><CheckCircle2 size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {levels.map((level) => (
          <div key={level.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveLevel(level.id, -1)} className="text-slate-400 hover:text-slate-600"><ArrowUp size={12} /></button>
              <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs font-bold flex items-center justify-center">{level.level}</span>
              <button onClick={() => moveLevel(level.id, 1)} className="text-slate-400 hover:text-slate-600"><ArrowDown size={12} /></button>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
              <input value={level.role_name} onChange={e => updateLevel(level.id, 'role_name', e.target.value)} className={inputClass} placeholder="ชื่อตำแหน่ง" />
              <input value={level.description} onChange={e => updateLevel(level.id, 'description', e.target.value)} className={inputClass} placeholder="คำอธิบาย" />
              <input type="number" value={level.approval_limit} onChange={e => updateLevel(level.id, 'approval_limit', parseInt(e.target.value) || 0)} className={inputClass} placeholder="วงเงินอนุมัติ (฿)" />
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={level.auto_approve} onChange={e => updateLevel(level.id, 'auto_approve', e.target.checked)} className="w-4 h-4 rounded" />
                อนุมัติอัตโนมัติ
              </label>
            </div>
            <button onClick={() => removeLevel(level.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}

        <button onClick={addLevel} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 text-sm w-full justify-center transition-all">
          <Plus size={14} /> เพิ่มระดับอนุมัติ
        </button>
      </div>
    </div>
  );
}
