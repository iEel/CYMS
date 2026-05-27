'use client';

import { CheckCircle2, Eye, FilePlus2, Printer, Redo2, Save, Undo2 } from 'lucide-react';

type DesignerToolbarProps = {
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  saving?: boolean;
  onCreateDraft: () => void;
  onSaveDraft: () => void;
  onPreview: () => void;
  onTestPrint: () => void;
  onPublish: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function DesignerToolbar({
  canEdit,
  canUndo,
  canRedo,
  saving = false,
  onCreateDraft,
  onSaveDraft,
  onPreview,
  onTestPrint,
  onPublish,
  onUndo,
  onRedo,
}: DesignerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300"
          title="Redo"
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!canEdit && (
          <button
            type="button"
            onClick={onCreateDraft}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <FilePlus2 size={15} /> Create Draft
          </button>
        )}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!canEdit || saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={15} /> {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"
        >
          <Eye size={15} /> Preview
        </button>
        <button
          type="button"
          onClick={onTestPrint}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"
        >
          <Printer size={15} /> Test Print
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={!canEdit}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          <CheckCircle2 size={15} /> Publish
        </button>
      </div>
    </div>
  );
}
