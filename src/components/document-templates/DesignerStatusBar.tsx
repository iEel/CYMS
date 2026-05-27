'use client';

import type { DocumentTemplateConfig } from '@/lib/documentTemplateTypes';

type DesignerStatusBarProps = {
  config: DocumentTemplateConfig;
  zoom: number;
  snapStep: number;
  selectedFieldId: string | null;
  canEdit: boolean;
};

export function DesignerStatusBar({ config, zoom, snapStep, selectedFieldId, canEdit }: DesignerStatusBarProps) {
  const fields = config.fields.filter(field => field.visible).length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
      <span>
        Paper {config.paper.width_mm} x {config.paper.height_mm} mm · {fields} visible fields
      </span>
      <span>
        Zoom {Math.round(zoom * 100)}% · Snap {snapStep} mm · {selectedFieldId || 'No field selected'} · {canEdit ? 'Draft editable' : 'Active read-only'}
      </span>
    </div>
  );
}
