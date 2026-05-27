'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, DragEvent, PointerEvent } from 'react';
import {
  addFieldFromBinding,
  applyFieldPatch,
  resizeField,
  snapMm,
} from '@/lib/documentTemplateDesigner';
import type { DocumentTemplateConfig, DocumentTemplateField, DocumentTemplateFieldLayer } from '@/lib/documentTemplateTypes';
import type { LayerState } from './LayerList';

type TemplateCanvasProps = {
  config: DocumentTemplateConfig;
  selectedFieldId: string | null;
  zoom: number;
  snapStep: number;
  canEdit: boolean;
  layerState: LayerState;
  onSelectField: (fieldId: string | null) => void;
  onChange: (config: DocumentTemplateConfig) => void;
};

type DragMode = 'move' | 'resize';

type DragState = {
  mode: DragMode;
  field: DocumentTemplateField;
  startX: number;
  startY: number;
};

const PX_PER_MM = 3.2;

function mmToPx(value: number, zoom: number) {
  return value * PX_PER_MM * zoom;
}

function pxToMm(value: number, zoom: number) {
  return value / (PX_PER_MM * zoom);
}

function fieldValue(field: DocumentTemplateField) {
  return field.sample_value || field.default_value || field.label || field.binding_source;
}

function fieldStyle(field: DocumentTemplateField, zoom: number): CSSProperties {
  return {
    left: mmToPx(field.x_mm, zoom),
    top: mmToPx(field.y_mm, zoom),
    width: mmToPx(field.width_mm, zoom),
    height: mmToPx(field.height_mm, zoom),
    fontSize: `${Math.max(8, field.font_size * zoom)}px`,
    fontWeight: field.font_weight === 'bold' ? 700 : field.font_weight === 'semibold' ? 600 : field.font_weight === 'medium' ? 500 : 400,
    textAlign: field.text_align,
  };
}

function layerVisible(layerState: LayerState, layer: DocumentTemplateFieldLayer) {
  return layerState[layer]?.visible !== false;
}

function layerLocked(layerState: LayerState, layer: DocumentTemplateFieldLayer) {
  return layerState[layer]?.locked === true;
}

export function TemplateCanvas({
  config,
  selectedFieldId,
  zoom,
  snapStep,
  canEdit,
  layerState,
  onSelectField,
  onChange,
}: TemplateCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const beginDrag = (event: PointerEvent<HTMLElement>, field: DocumentTemplateField, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectField(field.field_id);
    if (!canEdit || field.locked || layerLocked(layerState, field.layer)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ mode, field, startX: event.clientX, startY: event.clientY });
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dxMm = pxToMm(event.clientX - drag.startX, zoom);
    const dyMm = pxToMm(event.clientY - drag.startY, zoom);

    if (drag.mode === 'resize') {
      onChange(resizeField(config, drag.field.field_id, {
        widthMm: snapMm(drag.field.width_mm + dxMm, snapStep),
        heightMm: snapMm(drag.field.height_mm + dyMm, snapStep),
        snapMm: snapStep,
      }));
      return;
    }

    onChange(applyFieldPatch(config, drag.field.field_id, {
      x_mm: snapMm(drag.field.x_mm + dxMm, snapStep),
      y_mm: snapMm(drag.field.y_mm + dyMm, snapStep),
    }));
  };

  const endDrag = () => setDrag(null);

  const dropBinding = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!canEdit || !canvasRef.current) return;
    const binding = event.dataTransfer.getData('application/x-document-binding');
    const rect = canvasRef.current.getBoundingClientRect();
    const xMm = pxToMm(event.clientX - rect.left, zoom);
    const yMm = pxToMm(event.clientY - rect.top, zoom);
    const next = addFieldFromBinding(config, binding, { xMm, yMm });
    if (next !== config) {
      const added = next.fields[next.fields.length - 1];
      onChange(next);
      onSelectField(added.field_id);
    }
  };

  const pageStyle: CSSProperties = {
    width: mmToPx(config.paper.width_mm, zoom),
    height: mmToPx(config.paper.height_mm, zoom),
    backgroundSize: `${mmToPx(snapStep, zoom)}px ${mmToPx(snapStep, zoom)}px`,
  };

  const lineRegion = config.sections.line_items;

  return (
    <div className="min-h-[700px] overflow-auto bg-slate-100 p-8 dark:bg-slate-950">
      <div
        ref={canvasRef}
        className="relative mx-auto bg-white shadow-sm outline outline-1 outline-slate-300 dark:outline-slate-700"
        style={pageStyle}
        onClick={() => onSelectField(null)}
        onDragOver={event => event.preventDefault()}
        onDrop={dropBinding}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{
          backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)',
          backgroundSize: pageStyle.backgroundSize,
        }} />
        <div aria-hidden className="pointer-events-none absolute -left-6 top-0 h-full w-5 border-r border-slate-300 bg-slate-50 text-[9px] text-slate-400">
          {Array.from({ length: Math.ceil(config.paper.height_mm / 20) }).map((_, index) => (
            <span key={index} className="absolute right-1" style={{ top: mmToPx(index * 20, zoom) }}>{index * 20}</span>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute -top-6 left-0 h-5 w-full border-b border-slate-300 bg-slate-50 text-[9px] text-slate-400">
          {Array.from({ length: Math.ceil(config.paper.width_mm / 20) }).map((_, index) => (
            <span key={index} className="absolute top-1" style={{ left: mmToPx(index * 20, zoom) }}>{index * 20}</span>
          ))}
        </div>

        <div
          className="pointer-events-none absolute border border-dashed border-slate-400 bg-slate-200/20 text-[10px] text-slate-400"
          style={{
            left: mmToPx(lineRegion.x_mm, zoom),
            top: mmToPx(lineRegion.y_mm, zoom),
            width: mmToPx(lineRegion.width_mm, zoom),
            height: mmToPx(lineRegion.row_height_mm * lineRegion.max_rows, zoom),
          }}
        >
          LineItemsRegion
        </div>

        {config.fields.filter(field => field.visible && layerVisible(layerState, field.layer)).map(field => {
          const selected = selectedFieldId === field.field_id;
          const locked = field.locked || layerLocked(layerState, field.layer);
          return (
            <div
              key={field.field_id}
              className={`absolute flex items-center overflow-hidden rounded-sm border px-1 leading-tight ${selected ? 'border-blue-500 bg-blue-50/80 text-blue-900' : 'border-slate-300 bg-white/80 text-slate-700'} ${locked ? 'cursor-not-allowed opacity-75' : 'cursor-move'}`}
              style={fieldStyle(field, zoom)}
              onPointerDown={event => beginDrag(event, field, 'move')}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              title={`${field.label} · ${field.binding_source}`}
            >
              <span className="truncate">{fieldValue(field)}</span>
              {selected && !locked && canEdit ? (
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-b-2 border-r-2 border-blue-600"
                  onPointerDown={event => beginDrag(event, field, 'resize')}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
