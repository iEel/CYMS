'use client';

import { useCallback } from 'react';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function useGatePrintReturnDraft<T>({
  storageKey,
  isValidDraft,
  label = 'Gate print draft',
}: {
  storageKey: string;
  isValidDraft?: (draft: T) => boolean;
  label?: string;
}) {
  const clearDraft = useCallback(() => {
    if (!canUseLocalStorage()) return;
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const restoreDraft = useCallback((): T | null => {
    if (!canUseLocalStorage()) return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      const draft = JSON.parse(raw) as T;
      if (isValidDraft && !isValidDraft(draft)) {
        window.localStorage.removeItem(storageKey);
        return null;
      }
      window.localStorage.removeItem(storageKey);
      return draft;
    } catch (error) {
      console.warn(`${label} restore failed:`, error);
      window.localStorage.removeItem(storageKey);
      return null;
    }
  }, [isValidDraft, label, storageKey]);

  const saveDraft = useCallback((draft: T) => {
    if (!canUseLocalStorage()) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (error) {
      console.warn(`${label} persist failed:`, error);
    }
  }, [label, storageKey]);

  return { clearDraft, restoreDraft, saveDraft };
}
