'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Boxes, Layers3, SlidersHorizontal } from 'lucide-react';
import {
  addFieldFromBinding,
  applyFieldPatch,
  createDesignerHistory,
  deleteField,
  nudgeField,
  nudgeLineItems,
  pushDesignerHistory,
  redoDesignerHistory,
  undoDesignerHistory,
  type FieldPatch,
} from '@/lib/documentTemplateDesigner';
import type { DocumentTemplateConfig, DocumentTemplateFieldLayer } from '@/lib/documentTemplateTypes';
import { BindingPalette } from './BindingPalette';
import { DesignerStatusBar } from './DesignerStatusBar';
import { DesignerToolbar } from './DesignerToolbar';
import { FieldInspector } from './FieldInspector';
import { LayerList, type LayerState } from './LayerList';
import { TemplateCanvas } from './TemplateCanvas';

type DocumentTemplateDesignerProps = {
  config: DocumentTemplateConfig;
  canEdit: boolean;
  canPreview?: boolean;
  saving?: boolean;
  onChange: (config: DocumentTemplateConfig) => void;
  onCreateDraft: () => void;
  onSaveDraft: () => void;
  onPreview: () => void;
  onTestPrint: () => void;
  onPublish: () => void;
};

type DesignerPanel = 'inspector' | 'bindings' | 'layers';

type DesignerSelection =
  | { type: 'field'; fieldId: string }
  | { type: 'line_items' }
  | null;

const DEFAULT_LAYER_STATE: LayerState = {
  form: { visible: true, locked: false },
  data: { visible: true, locked: false },
  calibration: { visible: true, locked: false },
};

const firstSelection = (config: DocumentTemplateConfig): DesignerSelection =>
  config.fields[0]?.field_id ? { type: 'field', fieldId: config.fields[0].field_id } : { type: 'line_items' };

const preserveSelection = (
  config: DocumentTemplateConfig,
  current: DesignerSelection,
): DesignerSelection => {
  if (current?.type === 'field' && config.fields.some(field => field.field_id === current.fieldId)) {
    return current;
  }
  if (current?.type === 'line_items') return current;
  return firstSelection(config);
};

export function DocumentTemplateDesigner({
  config,
  canEdit,
  canPreview = true,
  saving = false,
  onChange,
  onCreateDraft,
  onSaveDraft,
  onPreview,
  onTestPrint,
  onPublish,
}: DocumentTemplateDesignerProps) {
  const [history, setHistory] = useState(() => createDesignerHistory(config));
  const [selection, setSelection] = useState<DesignerSelection>(() => firstSelection(config));
  const [zoom, setZoom] = useState(0.92);
  const [snapStep, setSnapStep] = useState(1);
  const [layerState, setLayerState] = useState<LayerState>(DEFAULT_LAYER_STATE);
  const [activePanel, setActivePanel] = useState<DesignerPanel>('inspector');
  const currentSerializedRef = useRef(JSON.stringify(config));

  useEffect(() => {
    const incoming = JSON.stringify(config);
    if (incoming === currentSerializedRef.current) return;
    currentSerializedRef.current = incoming;
    setHistory(createDesignerHistory(config));
    setSelection(current => preserveSelection(config, current));
  }, [config]);

  const selectedFieldId = selection?.type === 'field' ? selection.fieldId : null;
  const selectedKind = selection?.type || null;
  const selectedField = history.current.fields.find(field => field.field_id === selectedFieldId) || null;
  const selectedLabel = selectedKind === 'line_items'
    ? 'Line items · lines[]'
    : selectedField
      ? `${selectedField.label} · ${selectedField.binding_source}`
      : 'No field selected';

  const commit = (nextConfig: DocumentTemplateConfig) => {
    currentSerializedRef.current = JSON.stringify(nextConfig);
    setHistory(current => pushDesignerHistory(current, nextConfig));
    onChange(nextConfig);
  };

  const patchSelected = (patch: FieldPatch) => {
    if (!selectedFieldId) return;
    commit(applyFieldPatch(history.current, selectedFieldId, patch));
  };

  const handleDelete = () => {
    if (!selectedFieldId) return;
    const nextConfig = deleteField(history.current, selectedFieldId);
    if (nextConfig !== history.current) {
      commit(nextConfig);
      setSelection(firstSelection(nextConfig));
    }
  };

  const handleAddBinding = (bindingSource: string) => {
    const nextConfig = addFieldFromBinding(history.current, bindingSource, { xMm: 12, yMm: 12 });
    if (nextConfig === history.current) return;
    commit(nextConfig);
    const addedFieldId = nextConfig.fields[nextConfig.fields.length - 1]?.field_id;
    setSelection(addedFieldId ? { type: 'field', fieldId: addedFieldId } : firstSelection(nextConfig));
  };

  const handleUndo = () => {
    const next = undoDesignerHistory(history);
    currentSerializedRef.current = JSON.stringify(next.current);
    setHistory(next);
    setSelection(current => preserveSelection(next.current, current));
    onChange(next.current);
  };

  const handleRedo = () => {
    const next = redoDesignerHistory(history);
    currentSerializedRef.current = JSON.stringify(next.current);
    setHistory(next);
    setSelection(current => preserveSelection(next.current, current));
    onChange(next.current);
  };

  const toggleLayerVisible = (layer: DocumentTemplateFieldLayer) => {
    setLayerState(current => ({
      ...current,
      [layer]: { ...current[layer], visible: !current[layer].visible },
    }));
  };

  const toggleLayerLocked = (layer: DocumentTemplateFieldLayer) => {
    setLayerState(current => ({
      ...current,
      [layer]: { ...current[layer], locked: !current[layer].locked },
    }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canEdit || !selection || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const step = event.altKey ? 0.1 : event.shiftKey ? Math.max(5, snapStep * 5) : snapStep;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const nudge = { dxMm: dx, dyMm: dy, snapMm: event.altKey ? 0.1 : snapStep };
    if (selection.type === 'line_items') {
      if (layerState.data.locked) return;
      commit(nudgeLineItems(history.current, nudge));
      return;
    }
    if (!selectedField || selectedField.locked || layerState[selectedField.layer].locked) return;
    commit(nudgeField(history.current, selection.fieldId, nudge));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <DesignerToolbar
        canEdit={canEdit}
        canPreview={canPreview}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        saving={saving}
        onCreateDraft={onCreateDraft}
        onSaveDraft={onSaveDraft}
        onPreview={onPreview}
        onTestPrint={onTestPrint}
        onPublish={onPublish}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${canEdit ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {canEdit ? 'Draft editable' : 'Active read-only'}
          </span>
          <span className="truncate text-xs text-slate-500">
            {selectedLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Zoom
            <input type="range" min="0.45" max="1.35" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))}
              className="w-32" />
            <span className="w-10 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Snap
            <select value={snapStep} onChange={event => setSnapStep(Number(event.target.value))}
              className="h-8 w-24 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <option value={0.5}>0.5 mm</option>
              <option value={1}>1 mm</option>
              <option value={2}>2 mm</option>
              <option value={5}>5 mm</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid min-h-[760px] grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px]">

        <main tabIndex={0} onKeyDown={handleKeyDown} className="min-w-0 outline-none">
          <TemplateCanvas
            config={history.current}
            selectedFieldId={selectedFieldId}
            selectedLineItems={selection?.type === 'line_items'}
            zoom={zoom}
            snapStep={snapStep}
            canEdit={canEdit}
            layerState={layerState}
            onSelectField={fieldId => setSelection({ type: 'field', fieldId })}
            onSelectLineItems={() => setSelection({ type: 'line_items' })}
            onClearSelection={() => setSelection(null)}
            onChange={commit}
          />
        </main>

        <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-3 border-b border-slate-200 p-2 dark:border-slate-700">
            {[
              { id: 'inspector' as const, label: 'Inspector', icon: SlidersHorizontal },
              { id: 'bindings' as const, label: 'Fields', icon: Boxes },
              { id: 'layers' as const, label: 'Layers', icon: Layers3 },
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePanel(item.id)}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold ${activePanel === item.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <Icon size={14} /> {item.label}
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {activePanel === 'inspector' ? (
              <FieldInspector
                field={selectedField}
                readOnly={!canEdit}
                onPatch={patchSelected}
                onDelete={handleDelete}
              />
            ) : null}
            {activePanel === 'bindings' ? (
              <BindingPalette onAddBinding={handleAddBinding} disabled={!canEdit} />
            ) : null}
            {activePanel === 'layers' ? (
              <LayerList
                config={history.current}
                selectedFieldId={selectedFieldId}
                selectedLineItems={selection?.type === 'line_items'}
                layerState={layerState}
                onSelectField={fieldId => {
                  setSelection({ type: 'field', fieldId });
                  setActivePanel('inspector');
                }}
                onSelectLineItems={() => {
                  setSelection({ type: 'line_items' });
                  setActivePanel('inspector');
                }}
                onToggleLayerVisible={toggleLayerVisible}
                onToggleLayerLocked={toggleLayerLocked}
              />
            ) : null}
          </div>
        </aside>
      </div>

      <DesignerStatusBar
        config={history.current}
        zoom={zoom}
        snapStep={snapStep}
        selectedFieldId={selectedFieldId}
        selectedKind={selectedKind}
        canEdit={canEdit}
      />
    </div>
  );
}
