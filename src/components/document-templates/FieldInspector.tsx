'use client';

import { Trash2 } from 'lucide-react';
import type {
  DocumentTemplateField,
  DocumentTemplateFieldLayer,
  DocumentTemplateFontWeight,
  DocumentTemplateTextAlign,
} from '@/lib/documentTemplateTypes';
import type { FieldPatch } from '@/lib/documentTemplateDesigner';
import { DESIGNER_BINDINGS } from '@/lib/documentTemplateDesigner';

type FieldInspectorProps = {
  field: DocumentTemplateField | null;
  readOnly: boolean;
  onPatch: (patch: FieldPatch) => void;
  onDelete: () => void;
};

function numberInput(value: number, onChange: (value: number) => void, disabled: boolean) {
  return (
    <input
      type="number"
      step="0.1"
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      disabled={disabled}
      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    />
  );
}

export function FieldInspector({ field, readOnly, onPatch, onDelete }: FieldInspectorProps) {
  if (!field) {
    return (
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inspector</h4>
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
          เลือก field บน canvas เพื่อแก้คุณสมบัติ
        </p>
      </div>
    );
  }

  const disabled = readOnly || field.locked;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inspector</h4>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-white">{field.label}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
          title="Delete field"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <label className="block text-xs font-medium text-slate-500">
        label
        <input value={field.label} onChange={event => onPatch({ label: event.target.value })} disabled={disabled}
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </label>

      <label className="block text-xs font-medium text-slate-500">
        binding_source
        <select value={field.binding_source} onChange={event => onPatch({ binding_source: event.target.value, field_key: event.target.value } as FieldPatch)} disabled={disabled}
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          {DESIGNER_BINDINGS.map(binding => <option key={binding} value={binding}>{binding}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500">x_mm{numberInput(field.x_mm, value => onPatch({ x_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">y_mm{numberInput(field.y_mm, value => onPatch({ y_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">width_mm{numberInput(field.width_mm, value => onPatch({ width_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">height_mm{numberInput(field.height_mm, value => onPatch({ height_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">font_size{numberInput(field.font_size, value => onPatch({ font_size: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">
          font_weight
          <select value={field.font_weight} onChange={event => onPatch({ font_weight: event.target.value as DocumentTemplateFontWeight })} disabled={disabled}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="normal">normal</option>
            <option value="medium">medium</option>
            <option value="semibold">semibold</option>
            <option value="bold">bold</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500">
          text_align
          <select value={field.text_align} onChange={event => onPatch({ text_align: event.target.value as DocumentTemplateTextAlign })} disabled={disabled}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          layer
          <select value={field.layer} onChange={event => onPatch({ layer: event.target.value as DocumentTemplateFieldLayer })} disabled={disabled}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="form">form</option>
            <option value="data">data</option>
            <option value="calibration">calibration</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-500">
        format
        <input value={field.format} onChange={event => onPatch({ format: event.target.value })} disabled={disabled}
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </label>

      <label className="block text-xs font-medium text-slate-500">
        sample_value
        <input value={field.sample_value || ''} onChange={event => onPatch({ sample_value: event.target.value })} disabled={disabled}
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={field.visible} onChange={event => onPatch({ visible: event.target.checked })} disabled={readOnly} />
          visible
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={field.locked} onChange={event => onPatch({ locked: event.target.checked })} disabled={readOnly} />
          locked
        </label>
      </div>
    </div>
  );
}
