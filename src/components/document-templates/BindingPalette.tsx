'use client';

import { Plus } from 'lucide-react';
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
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Binding Palette</h4>
        <p className="mt-1 text-[11px] text-slate-400">ลาก field ไปวางบนกระดาษ หรือกดเพิ่มที่ตำแหน่งเริ่มต้น</p>
      </div>

      {GROUPS.map(group => {
        const bindings = DESIGNER_BINDINGS.filter(binding => binding.startsWith(group.prefix));
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
    </div>
  );
}
