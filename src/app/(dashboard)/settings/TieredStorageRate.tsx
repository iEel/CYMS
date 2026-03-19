'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

interface TierRate {
  tier_id?: number;
  id: number;
  tier_name: string;
  from_day: number;
  to_day: number;
  rate_20: number;
  rate_40: number;
  rate_45: number;
  applies_to: string;
}

export default function TieredStorageRate() {
  const { session } = useAuth();
  const yardId = session?.activeYardId || 1;

  const [tiers, setTiers] = useState<TierRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from DB
  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/storage-rates?yard_id=${yardId}`);
      const data = await res.json();
      if (data.tiers?.length > 0) {
        setTiers(data.tiers.map((t: TierRate & { tier_id: number }) => ({
          ...t,
          id: t.tier_id,
        })));
      } else {
        // Default if nothing in DB
        setTiers([
          { id: 1, tier_name: 'Free Period', from_day: 1, to_day: 3, rate_20: 0, rate_40: 0, rate_45: 0, applies_to: 'all' },
          { id: 2, tier_name: 'Standard Rate', from_day: 4, to_day: 7, rate_20: 150, rate_40: 250, rate_45: 300, applies_to: 'all' },
          { id: 3, tier_name: 'Extended Rate', from_day: 8, to_day: 14, rate_20: 250, rate_40: 400, rate_45: 500, applies_to: 'all' },
          { id: 4, tier_name: 'Penalty Rate', from_day: 15, to_day: 999, rate_20: 500, rate_40: 800, rate_45: 1000, applies_to: 'all' },
        ]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [yardId]);

  useEffect(() => { fetchTiers(); }, [fetchTiers]);

  const addTier = () => {
    const lastTo = Math.max(...tiers.map(t => t.to_day), 0);
    setTiers([...tiers, { id: Date.now(), tier_name: '', from_day: lastTo + 1, to_day: lastTo + 7, rate_20: 0, rate_40: 0, rate_45: 0, applies_to: 'all' }]);
  };
  const removeTier = (id: number) => setTiers(tiers.filter(t => t.id !== id));
  const update = (id: number, field: string, value: string | number) => setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));

  // Save to DB
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/storage-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, tiers }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        fetchTiers(); // Reload from DB
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500";

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        <Loader2 size={24} className="animate-spin mx-auto text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center text-cyan-600"><TrendingUp size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">Tiered Storage Rate</h3>
            <p className="text-xs text-slate-400">อัตราค่าฝากตู้แบบขั้นบันได — ใช้คำนวณค่าบริการจริงที่ Gate-Out</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><CheckCircle2 size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
        </button>
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="grid grid-cols-7 gap-2 mb-2 px-3">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">ชื่อขั้น</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">จากวันที่</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">ถึงวันที่</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">฿/วัน 20&apos;</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">฿/วัน 40&apos;</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">฿/วัน 45&apos;</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase"></span>
        </div>

        <div className="space-y-2">
          {tiers.map((tier, idx) => (
            <div key={tier.id} className="grid grid-cols-7 gap-2 items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-700/30">
              <input value={tier.tier_name} onChange={e => update(tier.id, 'tier_name', e.target.value)} className={`${inputClass} text-xs`} placeholder={`ขั้น ${idx + 1}`} />
              <input type="number" value={tier.from_day || ''} onFocus={e => e.target.select()} onChange={e => update(tier.id, 'from_day', parseInt(e.target.value) || 0)} className={inputClass} />
              <input type="number" value={tier.to_day || ''} onFocus={e => e.target.select()} onChange={e => update(tier.id, 'to_day', parseInt(e.target.value) || 0)} className={inputClass} />
              <input type="number" value={tier.rate_20 || ''} onFocus={e => e.target.select()} onChange={e => update(tier.id, 'rate_20', parseFloat(e.target.value) || 0)} className={`${inputClass} ${tier.rate_20 === 0 ? 'text-emerald-500' : ''}`} placeholder="ฟรี" />
              <input type="number" value={tier.rate_40 || ''} onFocus={e => e.target.select()} onChange={e => update(tier.id, 'rate_40', parseFloat(e.target.value) || 0)} className={`${inputClass} ${tier.rate_40 === 0 ? 'text-emerald-500' : ''}`} placeholder="ฟรี" />
              <input type="number" value={tier.rate_45 || ''} onFocus={e => e.target.select()} onChange={e => update(tier.id, 'rate_45', parseFloat(e.target.value) || 0)} className={`${inputClass} ${tier.rate_45 === 0 ? 'text-emerald-500' : ''}`} placeholder="ฟรี" />
              <button onClick={() => removeTier(tier.id)} className="text-slate-400 hover:text-red-500 justify-self-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <button onClick={addTier} className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 text-sm w-full justify-center transition-all">
          <Plus size={14} /> เพิ่มขั้นอัตรา
        </button>

        {/* Preview */}
        {tiers.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
            <p className="text-[10px] font-semibold text-blue-500 uppercase mb-2">ตัวอย่างการคำนวณ (ตู้ 20ft, อยู่ 10 วัน)</p>
            {(() => {
              let total = 0;
              const lines: { label: string; days: number; rate: number; sub: number }[] = [];
              let remaining = 10;
              for (const t of tiers) {
                if (remaining <= 0) break;
                const daysInTier = Math.min(remaining, t.to_day - t.from_day + 1);
                if (daysInTier > 0) {
                  const sub = daysInTier * t.rate_20;
                  total += sub;
                  lines.push({ label: t.tier_name || `วัน ${t.from_day}-${t.to_day}`, days: daysInTier, rate: t.rate_20, sub });
                  remaining -= daysInTier;
                }
              }
              return (
                <div className="space-y-1 text-xs">
                  {lines.map((l, i) => (
                    <div key={i} className="flex justify-between text-blue-600">
                      <span>{l.label}: {l.days} วัน × ฿{l.rate}</span>
                      <span className="font-mono">฿{l.sub.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-blue-800 dark:text-blue-300 border-t border-blue-200 pt-1">
                    <span>รวม</span>
                    <span>฿{total.toLocaleString()}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
