'use client';

import { useState } from 'react';
import { Plus, Trash2, Save, Lock, CheckCircle2, Tag } from 'lucide-react';

interface SealType {
  id: number;
  seal_type: string;
  prefix: string;
  description: string;
  color: string;
  requires_photo: boolean;
  is_active: boolean;
}

const DEFAULT_SEALS: SealType[] = [
  { id: 1, seal_type: 'bolt', prefix: 'BLT', description: 'ซีลสลักเหล็ก (High Security Bolt Seal)', color: '#EF4444', requires_photo: true, is_active: true },
  { id: 2, seal_type: 'cable', prefix: 'CBL', description: 'ซีลสายเคเบิล (Cable Seal)', color: '#3B82F6', requires_photo: true, is_active: true },
  { id: 3, seal_type: 'padlock', prefix: 'PLK', description: 'แม่กุญแจ (Padlock)', color: '#F59E0B', requires_photo: true, is_active: true },
  { id: 4, seal_type: 'indicative', prefix: 'IND', description: 'ซีลพลาสติก (Indicative Seal)', color: '#10B981', requires_photo: false, is_active: true },
  { id: 5, seal_type: 'electronic', prefix: 'ELK', description: 'ซีลอิเล็กทรอนิกส์ (E-Seal / GPS)', color: '#8B5CF6', requires_photo: true, is_active: false },
];

export default function SealMaster() {
  const [seals, setSeals] = useState<SealType[]>(DEFAULT_SEALS);
  const [saved, setSaved] = useState(false);

  const addSeal = () => setSeals([...seals, { id: Date.now(), seal_type: '', prefix: '', description: '', color: '#94A3B8', requires_photo: true, is_active: true }]);
  const removeSeal = (id: number) => setSeals(seals.filter(s => s.id !== id));
  const update = (id: number, field: string, value: string | boolean) => setSeals(seals.map(s => s.id === id ? { ...s, [field]: value } : s));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600"><Lock size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">Seal Master</h3>
            <p className="text-xs text-slate-400">ประเภทซีลและรหัสนำหน้า</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          {saved ? <><CheckCircle2 size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
        </button>
      </div>

      <div className="p-5 space-y-3">
        {seals.map(seal => (
          <div key={seal.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600">
            <div className="w-4 h-8 rounded" style={{ backgroundColor: seal.color }} />
            <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2">
              <div><label className={labelClass}>ประเภท</label><input value={seal.seal_type} onChange={e => update(seal.id, 'seal_type', e.target.value)} className={inputClass} placeholder="bolt" /></div>
              <div><label className={labelClass}>Prefix</label><input value={seal.prefix} onChange={e => update(seal.id, 'prefix', e.target.value)} className={`${inputClass} font-mono`} placeholder="BLT" /></div>
              <div className="col-span-2"><label className={labelClass}>คำอธิบาย</label><input value={seal.description} onChange={e => update(seal.id, 'description', e.target.value)} className={inputClass} /></div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={seal.requires_photo} onChange={e => update(seal.id, 'requires_photo', e.target.checked)} className="w-3.5 h-3.5 rounded" /> บังคับถ่ายรูป
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={seal.is_active} onChange={e => update(seal.id, 'is_active', e.target.checked)} className="w-3.5 h-3.5 rounded" /> เปิดใช้
                </label>
              </div>
            </div>
            <button onClick={() => removeSeal(seal.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={addSeal} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 text-sm w-full justify-center transition-all">
          <Plus size={14} /> เพิ่มประเภทซีล
        </button>
      </div>
    </div>
  );
}
