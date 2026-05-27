'use client';

export type PublishDiffDialogProps = {
  open: boolean;
  changes: string[];
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PublishDiffDialog({
  open,
  changes,
  saving = false,
  onCancel,
  onConfirm,
}: PublishDiffDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-diff-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h3 id="publish-diff-title" className="text-base font-semibold text-slate-900 dark:text-white">
            Publish this draft
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Review the layout changes before this version becomes active.
          </p>
        </div>

        <div className="px-5 py-4">
          <ul className="space-y-2">
            {changes.map((change, index) => (
              <li key={`${change}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {change}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </section>
    </div>
  );
}
