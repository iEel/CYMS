'use client';

import { useRef, useState } from 'react';
import type { CSSProperties, DragEvent, KeyboardEvent, PointerEvent } from 'react';
import {
  addFieldFromBinding,
  applyFieldPatch,
  applyLineItemsPatch,
  resizeField,
  resizeLineItems,
  snapMm,
} from '@/lib/documentTemplateDesigner';
import { normalizeTemplateCanvasConfig } from '@/lib/documentTemplateCanvas';
import type { DocumentTemplateConfig, DocumentTemplateElement, DocumentTemplateField, DocumentTemplateFieldLayer, DocumentTemplateLineItemsSection } from '@/lib/documentTemplateTypes';
import type { LayerState } from './LayerList';

type TemplateCanvasProps = {
  config: DocumentTemplateConfig;
  selectedFieldId: string | null;
  selectedLineItems: boolean;
  zoom: number;
  snapStep: number;
  canEdit: boolean;
  layerState: LayerState;
  onSelectField: (fieldId: string) => void;
  onSelectLineItems: () => void;
  onClearSelection: () => void;
  onChange: (config: DocumentTemplateConfig) => void;
};

type DragMode = 'move' | 'resize';

type DragState =
  | {
      kind: 'field';
      mode: DragMode;
      field: DocumentTemplateField;
      startX: number;
      startY: number;
    }
  | {
      kind: 'line_items';
      mode: DragMode;
      lineRegion: DocumentTemplateLineItemsSection;
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

function elementStyle(element: DocumentTemplateElement, zoom: number): CSSProperties {
  return {
    left: mmToPx(element.x_mm, zoom),
    top: mmToPx(element.y_mm, zoom),
    width: mmToPx(element.width_mm, zoom),
    height: mmToPx(element.height_mm, zoom),
    fontSize: element.font_size ? `${Math.max(7, element.font_size * zoom)}px` : undefined,
    fontWeight: element.font_weight === 'bold' ? 700 : element.font_weight === 'semibold' ? 600 : element.font_weight === 'medium' ? 500 : 400,
    textAlign: element.text_align,
    borderWidth: element.border ? Math.max(1, mmToPx(element.border_width_mm ?? 0.2, zoom)) : undefined,
  };
}

function elementText(element: DocumentTemplateElement) {
  if (element.type === 'text') return element.text || element.label;
  if (element.type === 'bound_text') return element.text || element.label || element.binding_source;
  return element.label;
}

function renderElementContent(element: DocumentTemplateElement) {
  if (element.type === 'image') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[9px] font-semibold text-slate-500">
        {element.label}
      </div>
    );
  }

  if (element.type === 'checkbox') {
    return <span className="block h-3 w-3 border border-slate-500" />;
  }

  if (element.type === 'box' || element.type === 'line') return null;

  return <span className="whitespace-pre-line">{elementText(element)}</span>;
}

function lineItemsStyle(lineRegion: DocumentTemplateLineItemsSection, zoom: number, lineItemsCanvasHeightMm: number): CSSProperties {
  return {
    left: mmToPx(lineRegion.x_mm, zoom),
    top: mmToPx(lineRegion.y_mm, zoom),
    width: mmToPx(lineRegion.width_mm, zoom),
    height: mmToPx(lineItemsCanvasHeightMm, zoom),
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
  selectedLineItems,
  zoom,
  snapStep,
  canEdit,
  layerState,
  onSelectField,
  onSelectLineItems,
  onClearSelection,
  onChange,
}: TemplateCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const normalizedConfig = normalizeTemplateCanvasConfig(config);

  const beginDrag = (event: PointerEvent<HTMLElement>, field: DocumentTemplateField, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectField(field.field_id);
    if (!canEdit || field.locked || layerLocked(layerState, field.layer)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: 'field', mode, field, startX: event.clientX, startY: event.clientY });
  };

  const beginLineItemsDrag = (event: PointerEvent<HTMLElement>, mode: DragMode) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectLineItems();
    if (!canEdit || layerLocked(layerState, 'data')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: 'line_items', mode, lineRegion: normalizedConfig.sections.line_items, startX: event.clientX, startY: event.clientY });
  };

  const handleLineItemsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectLineItems();
    }
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dxMm = pxToMm(event.clientX - drag.startX, zoom);
    const dyMm = pxToMm(event.clientY - drag.startY, zoom);

    if (drag.kind === 'line_items') {
      if (drag.mode === 'resize') {
        const lineItemsCanvasHeightMm = Math.max(0, drag.lineRegion.start_y_mm - drag.lineRegion.y_mm) + drag.lineRegion.row_height_mm * drag.lineRegion.max_rows;
        onChange(resizeLineItems(config, {
          widthMm: snapMm(drag.lineRegion.width_mm + dxMm, snapStep),
          heightMm: snapMm(lineItemsCanvasHeightMm + dyMm, snapStep),
          snapMm: snapStep,
        }));
        return;
      }

      onChange(applyLineItemsPatch(config, {
        x_mm: snapMm(drag.lineRegion.x_mm + dxMm, snapStep),
        y_mm: snapMm(drag.lineRegion.y_mm + dyMm, snapStep),
      }));
      return;
    }

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
    width: mmToPx(normalizedConfig.paper.width_mm, zoom),
    height: mmToPx(normalizedConfig.paper.height_mm, zoom),
    backgroundSize: `${mmToPx(snapStep, zoom)}px ${mmToPx(snapStep, zoom)}px`,
  };

  const lineRegion = normalizedConfig.sections.line_items;
  const lineItemsLocked = layerLocked(layerState, 'data');
  const lineItemsVisible = layerVisible(layerState, 'data');
  const lineItemsGridTemplate = lineRegion.columns
    .map(column => `${mmToPx(column.width_mm, zoom)}px`)
    .join(' ');
  const lineItemsHeaderHeightMm = Math.max(0, lineRegion.start_y_mm - lineRegion.y_mm);
  const lineItemsCanvasHeightMm = Math.max(0, lineRegion.start_y_mm - lineRegion.y_mm) + lineRegion.row_height_mm * lineRegion.max_rows;

  return (
    <div className="min-h-[700px] overflow-auto bg-slate-100 p-8 dark:bg-slate-950">
      <div
        ref={canvasRef}
        className="relative mx-auto bg-white shadow-sm outline outline-1 outline-slate-300 dark:outline-slate-700"
        style={pageStyle}
        onClick={onClearSelection}
        onDragOver={event => event.preventDefault()}
        onDrop={dropBinding}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{
          backgroundImage: 'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)',
          backgroundSize: pageStyle.backgroundSize,
        }} />
        <div aria-hidden className="pointer-events-none absolute -left-6 top-0 h-full w-5 border-r border-slate-300 bg-slate-50 text-[9px] text-slate-400">
          {Array.from({ length: Math.ceil(normalizedConfig.paper.height_mm / 20) }).map((_, index) => (
            <span key={index} className="absolute right-1" style={{ top: mmToPx(index * 20, zoom) }}>{index * 20}</span>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute -top-6 left-0 h-5 w-full border-b border-slate-300 bg-slate-50 text-[9px] text-slate-400">
          {Array.from({ length: Math.ceil(normalizedConfig.paper.width_mm / 20) }).map((_, index) => (
            <span key={index} className="absolute top-1" style={{ left: mmToPx(index * 20, zoom) }}>{index * 20}</span>
          ))}
        </div>

        {normalizedConfig.elements?.filter(element => element.visible && element.type !== 'line_items' && layerVisible(layerState, element.layer)).map(element => (
          <div
            key={element.element_id}
            className={`pointer-events-none absolute z-0 flex items-center overflow-hidden border-slate-500 px-1 leading-tight text-slate-600 ${element.border ? 'border' : ''} ${element.type === 'line' ? 'border-t' : ''}`}
            style={elementStyle(element, zoom)}
            title={`${element.label}${element.binding_source ? ` · ${element.binding_source}` : ''}`}
          >
            {renderElementContent(element)}
          </div>
        ))}

        {lineItemsVisible ? (
          <div
            className={`absolute z-10 overflow-hidden rounded-sm border bg-white/70 text-[10px] shadow-sm ${selectedLineItems ? 'border-blue-500 ring-2 ring-blue-400/60' : 'border-dashed border-slate-400'} ${lineItemsLocked ? 'cursor-not-allowed opacity-75' : 'cursor-move'}`}
            style={lineItemsStyle(lineRegion, zoom, lineItemsCanvasHeightMm)}
            onClick={event => event.stopPropagation()}
            onPointerDown={event => beginLineItemsDrag(event, 'move')}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onFocus={onSelectLineItems}
            onKeyDown={handleLineItemsKeyDown}
            role="button"
            aria-label="Line items region"
            tabIndex={0}
            title="Line items · lines[]"
          >
            <span className="pointer-events-none absolute left-1 top-1 z-10 rounded-sm bg-white/90 px-1 py-0.5 font-semibold text-slate-600 shadow-sm">
              Line items · lines[]
            </span>
            <div
              className="grid border-b border-slate-300 bg-slate-50/90 text-slate-600"
              style={{
                gridTemplateColumns: lineItemsGridTemplate,
                height: mmToPx(lineItemsHeaderHeightMm, zoom),
              }}
            >
              {lineRegion.columns.map(column => (
                <div
                  key={column.column_id}
                  className="flex items-center justify-center overflow-hidden whitespace-pre-line border-r border-slate-300 px-1 py-0.5 font-semibold leading-tight last:border-r-0"
                  style={{ textAlign: column.text_align }}
                  title={`${column.label} · ${column.field_key}`}
                >
                  {column.label}
                </div>
              ))}
            </div>
            {Array.from({ length: lineRegion.max_rows }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid border-b border-slate-200 last:border-b-0"
                style={{
                  gridTemplateColumns: lineItemsGridTemplate,
                  height: mmToPx(lineRegion.row_height_mm, zoom),
                }}
              >
                {lineRegion.columns.map(column => (
                  <div
                    key={column.column_id}
                    className="border-r border-slate-200 px-1 last:border-r-0"
                    style={{ textAlign: column.text_align }}
                  />
                ))}
              </div>
            ))}
            {selectedLineItems && !lineItemsLocked && canEdit ? (
              <span
                className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-b-2 border-r-2 border-blue-600"
                onPointerDown={event => beginLineItemsDrag(event, 'resize')}
              />
            ) : null}
          </div>
        ) : null}

        {normalizedConfig.fields.filter(field => field.visible && layerVisible(layerState, field.layer)).map(field => {
          const selected = selectedFieldId === field.field_id;
          const locked = field.locked || layerLocked(layerState, field.layer);
          return (
            <div
              key={field.field_id}
              className={`absolute z-20 flex items-center overflow-hidden rounded-sm border px-1 leading-tight ${selected ? 'border-blue-500 bg-blue-50/80 text-blue-900' : 'border-slate-300 bg-white/80 text-slate-700'} ${locked ? 'cursor-not-allowed opacity-75' : 'cursor-move'}`}
              style={fieldStyle(field, zoom)}
              onClick={event => event.stopPropagation()}
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
