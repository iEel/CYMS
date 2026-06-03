'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

export type ActionInputField = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea';
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
};

interface ActionInputDialogProps {
  open: boolean;
  title: string;
  description?: string;
  fields: ActionInputField[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export default function ActionInputDialog({
  open,
  title,
  description,
  fields,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  loading = false,
  onSubmit,
  onCancel,
}: ActionInputDialogProps) {
  const initialValues = useMemo(
    () => Object.fromEntries(fields.map(field => [field.name, field.defaultValue || ''])),
    [fields]
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    if (open) setValues(initialValues);
  }, [initialValues, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, open]);

  if (!open) return null;

  const canSubmit = fields.every(field => !field.required || values[field.name]?.trim());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || loading) return;
    onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={loading ? undefined : onCancel} />
      <form
        onSubmit={handleSubmit}
        className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-slate-700 dark:bg-slate-800"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700"
        >
          <X size={16} />
        </button>

        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-800 dark:text-white">{title}</h3>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>

        <div className="space-y-3 px-6 py-5">
          {fields.map(field => (
            <label key={field.name} className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {field.label}
              {field.type === 'textarea' ? (
                <textarea
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder={field.placeholder}
                  required={field.required}
                  value={values[field.name] || ''}
                  onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                />
              ) : (
                <input
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  required={field.required}
                  value={values[field.name] || ''}
                  onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-10 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
