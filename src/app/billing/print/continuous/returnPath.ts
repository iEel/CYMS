export const CONTINUOUS_PRINT_RETURN_TO_FALLBACK = '/settings?tab=document-templates';

export function sanitizeContinuousPrintReturnTo(value: string | null) {
  if (!value) return CONTINUOUS_PRINT_RETURN_TO_FALLBACK;
  if (value.trim() !== value) return CONTINUOUS_PRINT_RETURN_TO_FALLBACK;
  if (!value.startsWith('/') || value.startsWith('//')) return CONTINUOUS_PRINT_RETURN_TO_FALLBACK;
  if (/[\u0000-\u001F\u007F]/.test(value)) return CONTINUOUS_PRINT_RETURN_TO_FALLBACK;
  return value;
}
