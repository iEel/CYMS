'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { DESIGNER_BINDINGS } from '@/lib/documentTemplateDesigner';

type BindingPaletteProps = {
  onAddBinding: (bindingSource: string) => void;
  disabled?: boolean;
};

const GROUPS = [
  { title: 'company.*', prefix: 'company.' },
  { title: 'customer.*', prefix: 'customer.' },
  { title: 'document.*', prefix: 'document.' },
  { title: 'payment.*', prefix: 'payment.' },
  { title: 'totals.*', prefix: 'totals.' },
  { title: 'lines[]', prefix: 'lines[]' },
];

export function BindingPalette({ onAddBinding, disabled = false }: BindingPaletteProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredBindings = useMemo(() => DESIGNER_BINDINGS.filter(binding => (
    !normalizedQuery || binding.toLowerCase().includes(normalizedQuery)
  )), [normalizedQuery]);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Binding Palette</h4>
        <p className="mt-1 text-[11px] text-slate-400">ค้นหา field แล้วลากลง canvas หรือกดเพิ่ม</p>
        <label className="relative mt-3 block">
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="ค้นหา binding เช่น customer, tax, total"
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>
      </div>

      {GROUPS.map(group => {
        const bindings = filteredBindings.filter(binding => binding.startsWith(group.prefix));
        if (bindings.length === 0) return null;
        return (
          <div key={group.title} className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-500">{group.title}</p>
            <div className="space-y-1">
              {bindings.map(binding => (
                <button
                  key={binding}
                  type="button"
                  draggable={!disabled}
                  onDragStart={event => event.dataTransfer.setData('application/x-document-binding', binding)}
                  onClick={() => onAddBinding(binding)}
                  disabled={disabled}
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] text-slate-600 hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <span className="truncate">{binding}</span>
                  <Plus size={12} />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {filteredBindings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400 dark:border-slate-700">
          ไม่พบ binding ที่ค้นหา
        </p>
      ) : null}
    </div>
  );
}
