'use client';

import { useState } from 'react';
import { Save, CheckCircle2, Truck, ToggleLeft, ToggleRight } from 'lucide-react';

interface EquipmentRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  value: string;
  unit: string;
}

const DEFAULT_RULES: EquipmentRule[] = [
  { id: 'max_shift_moves', label: 'จำนวน Shift สูงสุด', description: 'จำกัดจำนวนตู้ที่ต้องหลบก่อนหยิบตู้เป้าหมาย', enabled: true, value: '3', unit: 'ครั้ง' },
  { id: 'max_tier_empty', label: 'ซ้อนสูงสุด (ตู้เปล่า)', description: 'จำนวนชั้น stack สูงสุดสำหรับตู้เปล่า', enabled: true, value: '5', unit: 'ชั้น' },
  { id: 'max_tier_laden', label: 'ซ้อนสูงสุด (ตู้มีสินค้า)', description: 'จำนวนชั้น stack สูงสุดสำหรับตู้ Laden', enabled: true, value: '3', unit: 'ชั้น' },
  { id: 'weight_limit', label: 'น้ำหนักสูงสุดต่อ Stack', description: 'น้ำหนักรวมสูงสุดของตู้ใน 1 stack', enabled: true, value: '90000', unit: 'kg' },
  { id: 'rs_capacity', label: 'ความจุ Reach Stacker', description: 'น้ำหนักยกสูงสุดของ Reach Stacker', enabled: true, value: '45000', unit: 'kg' },
  { id: 'auto_restack', label: 'Auto-Restack เมื่อ Shift > N', description: 'สั่งจัดเรียงใหม่อัตโนมัติถ้าต้อง shift มากเกินกำหนด', enabled: false, value: '4', unit: 'ครั้ง' },
  { id: 'cooldown_minutes', label: 'Cooldown หลังยก', description: 'เวลาพักเครื่องขั้นต่ำระหว่างงาน (ป้องกันเครื่องร้อน)', enabled: false, value: '5', unit: 'นาที' },
  { id: 'maintenance_hours', label: 'ชั่วโมงบำรุงรักษา', description: 'แจ้งเตือนเมื่อถึงชั่วโมงทำงานสะสม', enabled: true, value: '500', unit: 'ชม.' },
];

export default function EquipmentRulesConfig() {
  const [rules, setRules] = useState<EquipmentRule[]>(DEFAULT_RULES);
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) => setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const updateValue = (id: string, value: string) => setRules(rules.map(r => r.id === id ? { ...r, value } : r));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const inputClass = "h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 text-right font-mono";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600"><Truck size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">Equipment Rules Config</h3>
            <p className="text-xs text-slate-400">กฎการทำงานเครื่องจักร — Reach Stacker, Shifting, Stack</p>
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
            <div className="shrink-0 flex items-center gap-1.5">
              <input value={rule.value} onChange={e => updateValue(rule.id, e.target.value)} className={`${inputClass} w-20`} />
              <span className="text-xs text-slate-400 whitespace-nowrap">{rule.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
