'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  addFieldFromBinding,
  applyFieldPatch,
  createDesignerHistory,
  deleteField,
  nudgeField,
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
  saving?: boolean;
  onChange: (config: DocumentTemplateConfig) => void;
  onCreateDraft: () => void;
  onSaveDraft: () => void;
  onPreview: () => void;
  onTestPrint: () => void;
  onPublish: () => void;
};

const DEFAULT_LAYER_STATE: LayerState = {
  form: { visible: true, locked: false },
  data: { visible: true, locked: false },
  calibration: { visible: true, locked: false },
};

export function DocumentTemplateDesigner({
  config,
  canEdit,
  saving = false,
  onChange,
  onCreateDraft,
  onSaveDraft,
  onPreview,
  onTestPrint,
  onPublish,
}: DocumentTemplateDesignerProps) {
  const [history, setHistory] = useState(() => createDesignerHistory(config));
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(config.fields[0]?.field_id || null);
  const [zoom, setZoom] = useState(0.92);
  const [snapStep, setSnapStep] = useState(1);
  const [layerState, setLayerState] = useState<LayerState>(DEFAULT_LAYER_STATE);
  const currentSerializedRef = useRef(JSON.stringify(config));

  useEffect(() => {
    const incoming = JSON.stringify(config);
    if (incoming === currentSerializedRef.current) return;
    currentSerializedRef.current = incoming;
    setHistory(createDesignerHistory(config));
    setSelectedFieldId(current => current && config.fields.some(field => field.field_id === current)
      ? current
      : config.fields[0]?.field_id || null);
  }, [config]);

  const selectedField = history.current.fields.find(field => field.field_id === selectedFieldId) || null;

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
      setSelectedFieldId(nextConfig.fields[0]?.field_id || null);
    }
  };

  const handleAddBinding = (bindingSource: string) => {
    const nextConfig = addFieldFromBinding(history.current, bindingSource, { xMm: 12, yMm: 12 });
    if (nextConfig === history.current) return;
    commit(nextConfig);
    setSelectedFieldId(nextConfig.fields[nextConfig.fields.length - 1]?.field_id || null);
  };

  const handleUndo = () => {
    const next = undoDesignerHistory(history);
    currentSerializedRef.current = JSON.stringify(next.current);
    setHistory(next);
    onChange(next.current);
  };

  const handleRedo = () => {
    const next = redoDesignerHistory(history);
    currentSerializedRef.current = JSON.stringify(next.current);
    setHistory(next);
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
    if (!canEdit || !selectedFieldId || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const step = event.altKey ? 0.1 : event.shiftKey ? Math.max(5, snapStep * 5) : snapStep;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    commit(nudgeField(history.current, selectedFieldId, { dxMm: dx, dyMm: dy, snapMm: event.altKey ? 0.1 : snapStep }));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <DesignerToolbar
        canEdit={canEdit}
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

      <div className="grid min-h-[720px] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="space-y-5 border-r border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-slate-500">
              Zoom
              <input type="range" min="0.45" max="1.35" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))}
                className="mt-2 w-full" />
            </label>
            <label className="text-xs font-medium text-slate-500">
              Snap
              <select value={snapStep} onChange={event => setSnapStep(Number(event.target.value))}
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value={0.5}>0.5 mm</option>
                <option value={1}>1 mm</option>
                <option value={2}>2 mm</option>
                <option value={5}>5 mm</option>
              </select>
            </label>
          </div>
          <BindingPalette onAddBinding={handleAddBinding} disabled={!canEdit} />
          <LayerList
            config={history.current}
            selectedFieldId={selectedFieldId}
            layerState={layerState}
            onSelectField={setSelectedFieldId}
            onToggleLayerVisible={toggleLayerVisible}
            onToggleLayerLocked={toggleLayerLocked}
          />
        </aside>

        <main tabIndex={0} onKeyDown={handleKeyDown} className="min-w-0 outline-none">
          <TemplateCanvas
            config={history.current}
            selectedFieldId={selectedFieldId}
            zoom={zoom}
            snapStep={snapStep}
            canEdit={canEdit}
            layerState={layerState}
            onSelectField={setSelectedFieldId}
            onChange={commit}
          />
        </main>

        <aside className="border-l border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <FieldInspector
            field={selectedField}
            readOnly={!canEdit}
            onPatch={patchSelected}
            onDelete={handleDelete}
          />
        </aside>
      </div>

      <DesignerStatusBar
        config={history.current}
        zoom={zoom}
        snapStep={snapStep}
        selectedFieldId={selectedFieldId}
        canEdit={canEdit}
      />
    </div>
  );
}
