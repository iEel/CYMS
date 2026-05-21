'use client';

import { useMemo, useState } from 'react';
import { Calculator, PackageCheck, TrendingUp } from 'lucide-react';
import { buildTariffSimulatorScenarios, simulateTariffCharge } from '@/lib/billingTariffSimulator';

interface TariffLike {
  tariff_id?: number;
  charge_type: string;
  description?: string;
  rate: number;
  unit: string;
  free_days: number;
}

interface Props {
  draftTariff: TariffLike;
  savedTariffs: TariffLike[];
  chargeLabels: Record<string, string>;
  unitLabels: Record<string, string>;
}

export default function TariffSimulatorPanel({ draftTariff, savedTariffs, chargeLabels, unitLabels }: Props) {
  const [selectedTariffId, setSelectedTariffId] = useState('draft');
  const [dwellDays, setDwellDays] = useState(14);
  const [quantity, setQuantity] = useState(1);

  const selectedTariff = selectedTariffId === 'draft'
    ? null
    : savedTariffs.find(item => String(item.tariff_id) === selectedTariffId) || null;
  const tariff = selectedTariff || draftTariff;
  const simulation = useMemo(() => simulateTariffCharge({
    ...tariff,
    dwell_days: dwellDays,
    quantity,
  }), [dwellDays, quantity, tariff]);
  const scenarios = useMemo(() => buildTariffSimulatorScenarios(tariff, quantity), [quantity, tariff]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Calculator size={16} /> Tariff Simulator
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5">ทดลองผลลัพธ์ก่อนบันทึก rate หรือเทียบ tariff ที่มีอยู่</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTariffId}
            onChange={e => setSelectedTariffId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300"
          >
            <option value="draft">Draft จากฟอร์ม</option>
            {savedTariffs.map(item => (
              <option key={item.tariff_id} value={item.tariff_id}>
                {chargeLabels[item.charge_type] || item.charge_type} · ฿{item.rate}
              </option>
            ))}
          </select>
          <NumberInput label="Dwell" value={dwellDays} onChange={setDwellDays} suffix="วัน" />
          <NumberInput label="Qty" value={quantity} onChange={setQuantity} suffix="ตู้" min={1} />
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Metric label="Billable days" value={`${simulation.billable_days}`} />
          <Metric label="Charge qty" value={`${simulation.charge_quantity}`} />
          <Metric label="Subtotal" value={`฿${simulation.subtotal.toLocaleString()}`} />
          <Metric label="VAT + Total" value={`฿${simulation.grand_total.toLocaleString()}`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {scenarios.map(item => (
            <div key={item.label} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase">
                  <TrendingUp size={12} /> {item.label}
                </div>
                <span className="text-[10px] text-slate-400">{item.result.billable_days} billable</span>
              </div>
              <p className="mt-2 text-lg font-bold text-slate-800 dark:text-white">฿{item.result.grand_total.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {chargeLabels[item.result.charge_type] || item.result.charge_type} {unitLabels[item.result.unit] || item.result.unit}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix, min = 0 }: { label: string; value: number; onChange: (value: number) => void; suffix: string; min?: number }) {
  return (
    <label className="h-9 flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2">
      <span className="text-[10px] font-semibold text-slate-400 uppercase">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onFocus={e => e.target.select()}
        onChange={e => onChange(Math.max(min, parseInt(e.target.value) || min))}
        className="w-14 bg-transparent text-xs font-semibold text-slate-700 dark:text-white outline-none"
      />
      <span className="text-[10px] text-slate-400">{suffix}</span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase">
        <PackageCheck size={12} /> {label}
      </div>
      <p className="mt-2 text-base font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}
