'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  addLineItemColumn,
  applyLineItemColumnPatch,
  applyLineItemsPatch,
  moveLineItemColumn,
  removeLineItemColumn,
} from '@/lib/documentTemplateDesigner';
import type {
  DocumentTemplateConfig,
  DocumentTemplateLineItemFormat,
  DocumentTemplateTextAlign,
} from '@/lib/documentTemplateTypes';

type LineItemsInspectorProps = {
  config: DocumentTemplateConfig;
  readOnly: boolean;
  onChange: (config: DocumentTemplateConfig) => void;
};

const LINE_ITEM_FIELDS = ['description', 'qty', 'unit_price', 'amount'] as const;
const TEXT_ALIGN_OPTIONS: DocumentTemplateTextAlign[] = ['left', 'center', 'right'];
const FORMAT_OPTIONS: DocumentTemplateLineItemFormat[] = ['text', 'number', 'currency:THB'];

function numberInput(value: number, onChange: (value: number) => void, disabled: boolean, step = '0.1') {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={event => {
        const nextValue = Number(event.target.value);
        if (!Number.isFinite(nextValue)) return;
        onChange(nextValue);
      }}
      disabled={disabled}
      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
    />
  );
}

export function LineItemsInspector({ config, readOnly, onChange }: LineItemsInspectorProps) {
  const lineItems = config.sections.line_items;
  const columns = lineItems.columns;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</h4>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-white">
          {lineItems.binding_source}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500">
          x_mm
          {numberInput(lineItems.x_mm, value => onChange(applyLineItemsPatch(config, { x_mm: value })), readOnly)}
        </label>
        <label className="text-xs font-medium text-slate-500">
          y_mm
          {numberInput(lineItems.y_mm, value => onChange(applyLineItemsPatch(config, { y_mm: value })), readOnly)}
        </label>
        <label className="text-xs font-medium text-slate-500">
          width_mm
          {numberInput(lineItems.width_mm, value => onChange(applyLineItemsPatch(config, { width_mm: value })), readOnly)}
        </label>
        <label className="text-xs font-medium text-slate-500">
          row_height_mm
          {numberInput(lineItems.row_height_mm, value => onChange(applyLineItemsPatch(config, { row_height_mm: value })), readOnly)}
        </label>
        <label className="text-xs font-medium text-slate-500">
          max_rows
          {numberInput(lineItems.max_rows, value => onChange(applyLineItemsPatch(config, { max_rows: value })), readOnly, '1')}
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Columns</h5>
          <span className="text-[11px] text-slate-400">{columns.length} total</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {LINE_ITEM_FIELDS.map(fieldKey => (
            <button
              key={fieldKey}
              type="button"
              onClick={() => onChange(addLineItemColumn(config, fieldKey))}
              disabled={readOnly}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title={`Add ${fieldKey} column`}
            >
              <Plus size={13} /> {fieldKey}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {columns.map((column, index) => {
            const canMoveUp = !readOnly && index > 0;
            const canMoveDown = !readOnly && index < columns.length - 1;
            const canRemove = !readOnly && columns.length > 1;

            return (
              <div key={column.column_id} className="space-y-2 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {column.field_key}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onChange(moveLineItemColumn(config, column.column_id, -1))}
                      disabled={!canMoveUp}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700"
                      title="Move column up"
                      aria-label={`Move ${column.label} column up`}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(moveLineItemColumn(config, column.column_id, 1))}
                      disabled={!canMoveDown}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-700"
                      title="Move column down"
                      aria-label={`Move ${column.label} column down`}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(removeLineItemColumn(config, column.column_id))}
                      disabled={!canRemove}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
                      title="Remove column"
                      aria-label={`Remove ${column.label} column`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <label className="block text-xs font-medium text-slate-500">
                  label
                  <input
                    value={column.label}
                    onChange={event => onChange(applyLineItemColumnPatch(config, column.column_id, { label: event.target.value }))}
                    disabled={readOnly}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium text-slate-500">
                    width_mm
                    {numberInput(
                      column.width_mm,
                      value => onChange(applyLineItemColumnPatch(config, column.column_id, { width_mm: value })),
                      readOnly,
                    )}
                  </label>
                  <label className="text-xs font-medium text-slate-500">
                    text_align
                    <select
                      value={column.text_align}
                      onChange={event => onChange(applyLineItemColumnPatch(config, column.column_id, { text_align: event.target.value as DocumentTemplateTextAlign }))}
                      disabled={readOnly}
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      {TEXT_ALIGN_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>

                <label className="block text-xs font-medium text-slate-500">
                  format
                  <select
                    value={column.format}
                    onChange={event => onChange(applyLineItemColumnPatch(config, column.column_id, { format: event.target.value as DocumentTemplateLineItemFormat }))}
                    disabled={readOnly}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {FORMAT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
