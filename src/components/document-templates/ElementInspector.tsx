'use client';

import type {
  DocumentTemplateElement,
  DocumentTemplateFieldLayer,
  DocumentTemplateFontWeight,
  DocumentTemplateTextAlign,
} from '@/lib/documentTemplateTypes';
import { DESIGNER_BINDINGS, type ElementPatch } from '@/lib/documentTemplateDesigner';

type ElementInspectorProps = {
  element: DocumentTemplateElement | null;
  readOnly: boolean;
  onPatch: (patch: ElementPatch) => void;
};

function numberInput(value: number | undefined, onChange: (value: number) => void, disabled: boolean) {
  return (
    <input
      type="number"
      step="0.1"
      value={value ?? ''}
      onChange={event => onChange(Number(event.target.value))}
      disabled={disabled}
      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    />
  );
}

export function ElementInspector({ element, readOnly, onPatch }: ElementInspectorProps) {
  if (!element) {
    return (
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inspector</h4>
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
          เลือก element บน canvas เพื่อแก้ตำแหน่งหรือขนาด
        </p>
      </div>
    );
  }

  const disabled = readOnly || element.locked;

  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inspector</h4>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-white">{element.label}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">Canvas element · {element.type}</p>
      </div>

      <label className="block text-xs font-medium text-slate-500">
        label
        <input value={element.label} onChange={event => onPatch({ label: event.target.value })} disabled={disabled}
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
      </label>

      {element.type === 'text' || element.type === 'bound_text' ? (
        <label className="block text-xs font-medium text-slate-500">
          text
          <textarea value={element.text || ''} onChange={event => onPatch({ text: event.target.value })} disabled={disabled}
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
      ) : null}

      {element.type === 'bound_text' ? (
        <label className="block text-xs font-medium text-slate-500">
          binding_source
          <select value={element.binding_source || ''} onChange={event => onPatch({ binding_source: event.target.value })} disabled={disabled}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="">ไม่มี binding</option>
            {DESIGNER_BINDINGS.map(binding => <option key={binding} value={binding}>{binding}</option>)}
          </select>
        </label>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500">x_mm{numberInput(element.x_mm, value => onPatch({ x_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">y_mm{numberInput(element.y_mm, value => onPatch({ y_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">width_mm{numberInput(element.width_mm, value => onPatch({ width_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">height_mm{numberInput(element.height_mm, value => onPatch({ height_mm: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">font_size{numberInput(element.font_size, value => onPatch({ font_size: value }), disabled)}</label>
        <label className="text-xs font-medium text-slate-500">border_mm{numberInput(element.border_width_mm, value => onPatch({ border_width_mm: value }), disabled)}</label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500">
          font_weight
          <select value={element.font_weight || 'normal'} onChange={event => onPatch({ font_weight: event.target.value as DocumentTemplateFontWeight })} disabled={disabled}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="normal">normal</option>
            <option value="medium">medium</option>
            <option value="semibold">semibold</option>
            <option value="bold">bold</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          text_align
          <select value={element.text_align || 'left'} onChange={event => onPatch({ text_align: event.target.value as DocumentTemplateTextAlign })} disabled={disabled}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-slate-500">
        layer
        <select value={element.layer} onChange={event => onPatch({ layer: event.target.value as DocumentTemplateFieldLayer })} disabled={disabled}
          className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          <option value="form">form</option>
          <option value="data">data</option>
          <option value="calibration">calibration</option>
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={element.visible} onChange={event => onPatch({ visible: event.target.checked })} disabled={readOnly} />
          visible
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={element.locked} onChange={event => onPatch({ locked: event.target.checked })} disabled={readOnly} />
          locked
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={element.border === true} onChange={event => onPatch({ border: event.target.checked })} disabled={disabled} />
          border
        </label>
      </div>
    </div>
  );
}
