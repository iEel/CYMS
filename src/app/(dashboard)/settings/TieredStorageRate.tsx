'use client';

import { useState } from 'react';
import { Plus, Trash2, Save, TrendingUp, CheckCircle2 } from 'lucide-react';

interface TierRate {
  id: number;
  tier_name: string;
  from_day: number;
  to_day: number;
  rate_20: number;
  rate_40: number;
  rate_45: number;
  applies_to: string;
}

const DEFAULT_TIERS: TierRate[] = [
  { id: 1, tier_name: 'Free Period', from_day: 1, to_day: 3, rate_20: 0, rate_40: 0, rate_45: 0, applies_to: 'all' },
  { id: 2, tier_name: 'Standard Rate', from_day: 4, to_day: 7, rate_20: 150, rate_40: 250, rate_45: 300, applies_to: 'all' },
  { id: 3, tier_name: 'Extended Rate', from_day: 8, to_day: 14, rate_20: 250, rate_40: 400, rate_45: 500, applies_to: 'all' },
  { id: 4, tier_name: 'Penalty Rate', from_day: 15, to_day: 999, rate_20: 500, rate_40: 800, rate_45: 1000, applies_to: 'all' },
];

export default function TieredStorageRate() {
  const [tiers, setTiers] = useState<TierRate[]>(DEFAULT_TIERS);
  const [saved, setSaved] = useState(false);

  const addTier = () => {
    const lastTo = Math.max(...tiers.map(t => t.to_day), 0);
    setTiers([...tiers, { id: Date.now(), tier_name: '', from_day: lastTo + 1, to_day: lastTo + 7, rate_20: 0, rate_40: 0, rate_45: 0, applies_to: 'all' }]);
  };
  const removeTier = (id: number) => setTiers(tiers.filter(t => t.id !== id));
  const update = (id: number, field: string, value: string | number) => setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center text-cyan-600"><TrendingUp size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">Tiered Storage Rate</h3>
            <p className="text-xs text-slate-400">อัตราค่าฝากตู้แบบขั้นบันได (Progressive Pricing)</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          {saved ? <><CheckCircle2 size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
        </button>
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="grid grid-cols-7 gap-2 mb-2 px-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">ขั้น</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">จากวัน</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">ถึงวัน</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">฿ / 20&apos;</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">฿ / 40&apos;</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">฿ / 45&apos;</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase"></span>
        </div>

        <div className="space-y-2">
          {tiers.map((tier, idx) => (
            <div key={tier.id} className="grid grid-cols-7 gap-2 items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30">
              <input value={tier.tier_name} onChange={e => update(tier.id, 'tier_name', e.target.value)} className={`${inputClass} text-xs`} placeholder={`ขั้น ${idx + 1}`} />
              <input type="number" value={tier.from_day} onChange={e => update(tier.id, 'from_day', parseInt(e.target.value) || 0)} className={inputClass} />
              <input type="number" value={tier.to_day} onChange={e => update(tier.id, 'to_day', parseInt(e.target.value) || 0)} className={inputClass} />
              <input type="number" value={tier.rate_20} onChange={e => update(tier.id, 'rate_20', parseInt(e.target.value) || 0)} className={`${inputClass} ${tier.rate_20 === 0 ? 'text-emerald-500' : ''}`} />
              <input type="number" value={tier.rate_40} onChange={e => update(tier.id, 'rate_40', parseInt(e.target.value) || 0)} className={`${inputClass} ${tier.rate_40 === 0 ? 'text-emerald-500' : ''}`} />
              <input type="number" value={tier.rate_45} onChange={e => update(tier.id, 'rate_45', parseInt(e.target.value) || 0)} className={`${inputClass} ${tier.rate_45 === 0 ? 'text-emerald-500' : ''}`} />
              <button onClick={() => removeTier(tier.id)} className="text-slate-400 hover:text-red-500 justify-self-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <button onClick={addTier} className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 text-sm w-full justify-center transition-all">
          <Plus size={14} /> เพิ่มขั้นอัตรา
        </button>
      </div>
    </div>
  );
}
