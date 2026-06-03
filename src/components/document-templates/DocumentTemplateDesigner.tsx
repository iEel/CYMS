'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Boxes, Layers3, SlidersHorizontal } from 'lucide-react';
import {
  addFieldFromBinding,
  applyElementPatch,
  applyFieldPatch,
  createDesignerHistory,
  deleteField,
  nudgeElement,
  nudgeField,
  nudgeLineItems,
  pushDesignerHistory,
  redoDesignerHistory,
  undoDesignerHistory,
  type FieldPatch,
  type ElementPatch,
} from '@/lib/documentTemplateDesigner';
import type { ContinuousPrintPayload } from '@/lib/billingContinuousPrintTypes';
import type { DocumentTemplateConfig, DocumentTemplateFieldLayer } from '@/lib/documentTemplateTypes';
import { BindingPalette } from './BindingPalette';
import { DesignerStatusBar } from './DesignerStatusBar';
import { DesignerToolbar } from './DesignerToolbar';
import { ElementInspector } from './ElementInspector';
import { FieldInspector } from './FieldInspector';
import { LayerList, type LayerState } from './LayerList';
import { LineItemsInspector } from './LineItemsInspector';
import { TemplateCanvas } from './TemplateCanvas';

type DocumentTemplateDesignerProps = {
  config: DocumentTemplateConfig;
  canEdit: boolean;
  canPreview?: boolean;
  samplePayload?: ContinuousPrintPayload;
  saving?: boolean;
  onChange: (config: DocumentTemplateConfig) => void;
  onCreateDraft: () => void;
  onSaveDraft: () => void;
  onPreview: () => void;
  onTestPrint: () => void;
  onPublish: () => void;
};

type DesignerPanel = 'inspector' | 'bindings' | 'layers';
type DesignerWorkMode = 'layout' | 'data' | 'table';

type DesignerSelection =
  | { type: 'field'; fieldId: string }
  | { type: 'element'; elementId: string }
  | { type: 'line_items' }
  | null;

const DEFAULT_LAYER_STATE: LayerState = {
  form: { visible: true, locked: false },
  data: { visible: true, locked: false },
  calibration: { visible: true, locked: false },
};

const firstSelection = (config: DocumentTemplateConfig): DesignerSelection => {
  void config;
  return { type: 'line_items' };
};

const preserveSelection = (
  config: DocumentTemplateConfig,
  current: DesignerSelection,
): DesignerSelection => {
  if (current?.type === 'field' && config.fields.some(field => field.field_id === current.fieldId)) {
    return current;
  }
  if (current?.type === 'element' && config.elements?.some(element => element.element_id === current.elementId)) {
    return current;
  }
  if (current?.type === 'line_items') return current;
  return firstSelection(config);
};

export function DocumentTemplateDesigner({
  config,
  canEdit,
  canPreview = true,
  samplePayload,
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
  const [workMode, setWorkMode] = useState<DesignerWorkMode>('table');
  const currentSerializedRef = useRef(JSON.stringify(config));

  useEffect(() => {
    const incoming = JSON.stringify(config);
    if (incoming === currentSerializedRef.current) return;
    currentSerializedRef.current = incoming;
    setHistory(createDesignerHistory(config));
    setSelection(current => preserveSelection(config, current));
  }, [config]);

  const selectedFieldId = selection?.type === 'field' ? selection.fieldId : null;
  const selectedElementId = selection?.type === 'element' ? selection.elementId : null;
  const selectedKind = selection?.type || null;
  const selectedField = history.current.fields.find(field => field.field_id === selectedFieldId) || null;
  const selectedElement = history.current.elements?.find(element => element.element_id === selectedElementId) || null;
  const selectedLabel = selectedKind === 'line_items'
    ? 'Line items · lines[]'
    : selectedElement
      ? `${selectedElement.label} · canvas element`
    : selectedField
      ? `${selectedField.label} · ${selectedField.binding_source}`
      : 'No field selected';
  const modePrintHint = history.current.mode === 'overlay'
    ? 'Overlay mode: data layer only prints'
    : 'Full mode: canvas elements print';

  const switchWorkMode = (mode: DesignerWorkMode) => {
    setWorkMode(mode);
    setActivePanel('inspector');
    if (mode === 'table') {
      setSelection({ type: 'line_items' });
      return;
    }
    if (mode === 'layout') {
      const firstElement = history.current.elements?.find(element => element.visible && element.type !== 'line_items');
      setSelection(firstElement ? { type: 'element', elementId: firstElement.element_id } : { type: 'line_items' });
      return;
    }
    const firstField = history.current.fields.find(field => field.visible);
    setSelection(firstField ? { type: 'field', fieldId: firstField.field_id } : null);
  };

  const commit = (nextConfig: DocumentTemplateConfig) => {
    currentSerializedRef.current = JSON.stringify(nextConfig);
    setHistory(current => pushDesignerHistory(current, nextConfig));
    onChange(nextConfig);
  };

  const patchSelected = (patch: FieldPatch) => {
    if (!selectedFieldId) return;
    commit(applyFieldPatch(history.current, selectedFieldId, patch));
  };

  const patchSelectedElement = (patch: ElementPatch) => {
    if (!selectedElementId) return;
    commit(applyElementPatch(history.current, selectedElementId, patch));
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
    if (selection.type === 'element') {
      if (!selectedElement || selectedElement.locked || layerState[selectedElement.layer].locked) return;
      commit(nudgeElement(history.current, selection.elementId, nudge));
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
          <span className="text-xs text-slate-500">
            {modePrintHint}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">
            {[
              { id: 'layout' as const, label: 'Layout' },
              { id: 'data' as const, label: 'Data' },
              { id: 'table' as const, label: 'Table' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => switchWorkMode(item.id)}
                className={`h-7 rounded-md px-3 ${workMode === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
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
            selectedElementId={selectedElementId}
            selectedLineItems={selection?.type === 'line_items'}
            workMode={workMode}
            zoom={zoom}
            snapStep={snapStep}
            samplePayload={samplePayload}
            canEdit={canEdit}
            layerState={layerState}
            onSelectField={fieldId => {
              setWorkMode('data');
              setSelection({ type: 'field', fieldId });
            }}
            onSelectElement={elementId => {
              setWorkMode('layout');
              setSelection({ type: 'element', elementId });
            }}
            onSelectLineItems={() => {
              setWorkMode('table');
              setSelection({ type: 'line_items' });
            }}
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
            {activePanel === 'inspector' && selection?.type === 'line_items' ? (
              <LineItemsInspector
                config={history.current}
                readOnly={!canEdit}
                onChange={commit}
              />
            ) : null}
            {activePanel === 'inspector' && selection?.type === 'element' ? (
              <ElementInspector
                element={selectedElement}
                readOnly={!canEdit}
                onPatch={patchSelectedElement}
              />
            ) : null}
            {activePanel === 'inspector' && selection?.type !== 'line_items' && selection?.type !== 'element' ? (
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
                selectedElementId={selectedElementId}
                selectedLineItems={selection?.type === 'line_items'}
                layerState={layerState}
                onSelectField={fieldId => {
                  setWorkMode('data');
                  setSelection({ type: 'field', fieldId });
                  setActivePanel('inspector');
                }}
                onSelectElement={elementId => {
                  setWorkMode('layout');
                  setSelection({ type: 'element', elementId });
                  setActivePanel('inspector');
                }}
                onSelectLineItems={() => {
                  setWorkMode('table');
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
        selectedElementId={selectedElementId}
        selectedKind={selectedKind}
        canEdit={canEdit}
      />
    </div>
  );
}
