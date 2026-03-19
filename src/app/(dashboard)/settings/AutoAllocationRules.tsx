'use client';

import { useState } from 'react';
import { Save, CheckCircle2, Layers, ToggleLeft, ToggleRight } from 'lucide-react';

interface AllocationRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  priority: number;
  value: string;
}

const DEFAULT_RULES: AllocationRule[] = [
  { id: 'segregate_line', label: 'แยกตามสายเรือ', description: 'จัดกลุ่มตู้ของแต่ละสายเรือไว้โซนเดียวกัน', enabled: true, priority: 1, value: 'strict' },
  { id: 'segregate_size', label: 'แยกตามขนาดตู้', description: '20\' และ 40\' ไม่ stack ร่วมกัน', enabled: true, priority: 2, value: 'strict' },
  { id: 'segregate_type', label: 'แยกตามประเภทตู้', description: 'GP/RF/OT/FR แยกโซน', enabled: true, priority: 3, value: 'preferred' },
  { id: 'reefer_zone', label: 'ตู้เย็นในโซนปลั๊ก', description: 'RF ต้องอยู่ในโซนที่มี power plug', enabled: true, priority: 4, value: 'strict' },
  { id: 'dg_zone', label: 'ตู้อันตรายในโซน DG', description: 'Dangerous Goods ต้องอยู่โซน DG เท่านั้น', enabled: true, priority: 5, value: 'strict' },
  { id: 'fifo_lifo', label: 'ลำดับการจัดเรียง', description: 'LIFO = เอาตู้ล่าสุดออกก่อน / FIFO = เอาตู้เก่าออกก่อน', enabled: true, priority: 6, value: 'LIFO' },
  { id: 'max_tier', label: 'จำกัดชั้นซ้อน', description: 'จำนวนชั้นสูงสุดที่ซ้อนได้ (Empty vs Laden)', enabled: true, priority: 7, value: '5,3' },
  { id: 'spread_even', label: 'กระจายตู้สม่ำเสมอ', description: 'กระจายตู้ทุก Bay ไม่ให้กระจุกตัว', enabled: false, priority: 8, value: 'auto' },
  { id: 'nearest_gate', label: 'ใกล้ประตูที่สุด', description: 'จัดตู้ที่จะออกเร็วไว้ใกล้ gate', enabled: false, priority: 9, value: 'auto' },
];

export default function AutoAllocationRules() {
  const [rules, setRules] = useState<AllocationRule[]>(DEFAULT_RULES);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const updateValue = (id: string, value: string) => setRules(rules.map(r => r.id === id ? { ...r, value } : r));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const inputClass = "h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><Layers size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">Auto-Allocation Rules</h3>
            <p className="text-xs text-slate-400">กฎการจัดตู้ลงตำแหน่งอัตโนมัติ</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          {saved ? <><CheckCircle2 size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {rules.map(rule => (
          <div key={rule.id} className={`p-4 flex items-center gap-4 transition-colors ${rule.enabled ? '' : 'opacity-50'}`}>
            <button onClick={() => toggle(rule.id)} className="shrink-0">
              {rule.enabled
                ? <ToggleRight size={28} className="text-emerald-500" />
                : <ToggleLeft size={28} className="text-slate-300" />
              }
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{rule.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{rule.description}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {rule.id === 'fifo_lifo' ? (
                <select value={rule.value} onChange={e => updateValue(rule.id, e.target.value)} className={inputClass}>
                  <option value="LIFO">LIFO</option>
                  <option value="FIFO">FIFO</option>
                </select>
              ) : rule.id === 'max_tier' ? (
                <input value={rule.value} onChange={e => updateValue(rule.id, e.target.value)} className={`${inputClass} w-20 font-mono`} placeholder="E,L" />
              ) : (
                <select value={rule.value} onChange={e => updateValue(rule.id, e.target.value)} className={inputClass}>
                  <option value="strict">บังคับ</option>
                  <option value="preferred">แนะนำ</option>
                  <option value="auto">อัตโนมัติ</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
