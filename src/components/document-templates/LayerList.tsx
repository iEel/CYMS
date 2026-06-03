'use client';

import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import type { DocumentTemplateConfig, DocumentTemplateFieldLayer } from '@/lib/documentTemplateTypes';

type LayerState = Record<DocumentTemplateFieldLayer, { visible: boolean; locked: boolean }>;

type LayerListProps = {
  config: DocumentTemplateConfig;
  selectedFieldId: string | null;
  selectedElementId: string | null;
  selectedLineItems: boolean;
  layerState: LayerState;
  onSelectField: (fieldId: string) => void;
  onSelectElement: (elementId: string) => void;
  onSelectLineItems: () => void;
  onToggleLayerVisible: (layer: DocumentTemplateFieldLayer) => void;
  onToggleLayerLocked: (layer: DocumentTemplateFieldLayer) => void;
};

const LAYERS: DocumentTemplateFieldLayer[] = ['form', 'data', 'calibration'];
const LAYER_LABELS: Record<DocumentTemplateFieldLayer, string> = {
  form: 'Form elements',
  data: 'Data fields',
  calibration: 'Calibration marks',
};

export function LayerList({
  config,
  selectedFieldId,
  selectedElementId,
  selectedLineItems,
  layerState,
  onSelectField,
  onSelectElement,
  onSelectLineItems,
  onToggleLayerVisible,
  onToggleLayerLocked,
}: LayerListProps) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Layer List</h4>
        <p className="mt-1 text-[11px] text-slate-400">เลือก form element, data field, table หรือ lock layer ชั่วคราว</p>
      </div>

      {LAYERS.map(layer => {
        const fields = config.fields.filter(field => field.layer === layer);
        const elements = (config.elements || []).filter(element => element.layer === layer && element.type !== 'line_items');
        const state = layerState[layer];
        return (
          <section key={layer} className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-100 px-2 py-1.5 dark:border-slate-700">
              <span className="text-[11px] font-semibold uppercase text-slate-500">{LAYER_LABELS[layer]}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onToggleLayerVisible(layer)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Toggle layer visibility">
                  {state.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button type="button" onClick={() => onToggleLayerLocked(layer)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Toggle layer lock">
                  {state.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              </div>
            </header>
            <div className="max-h-36 overflow-auto p-1">
              {layer === 'data' ? (
                <button
                  type="button"
                  onClick={onSelectLineItems}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] ${selectedLineItems ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  <span className="truncate">Line item table</span>
                </button>
              ) : null}
              {elements.map(element => (
                <button
                  key={element.element_id}
                  type="button"
                  onClick={() => onSelectElement(element.element_id)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] ${selectedElementId === element.element_id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  <span className="truncate">{element.label}</span>
                  {element.locked ? <Lock size={11} /> : null}
                </button>
              ))}
              {fields.length === 0 && elements.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-slate-400">No fields</p>
              ) : fields.map(field => (
                <button
                  key={field.field_id}
                  type="button"
                  onClick={() => onSelectField(field.field_id)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] ${selectedFieldId === field.field_id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  <span className="truncate">{field.label}</span>
                  {field.locked ? <Lock size={11} /> : null}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export type { LayerState };
