/**
 * Client-safe password strength utility
 * ใช้ได้ทั้ง client component และ server — ไม่ import db/mssql
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PasswordPolicyConfig {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  max_login_attempts: number;
  lockout_duration_min: number;
}

/**
 * Validate a password against the policy (client-safe)
 */
export function validatePasswordClient(password: string, policy: PasswordPolicyConfig): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < policy.min_length) {
    errors.push(`ความยาวขั้นต่ำ ${policy.min_length} ตัวอักษร`);
  }
  if (policy.require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('ต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว (A-Z)');
  }
  if (policy.require_lowercase && !/[a-z]/.test(password)) {
    errors.push('ต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว (a-z)');
  }
  if (policy.require_number && !/[0-9]/.test(password)) {
    errors.push('ต้องมีตัวเลขอย่างน้อย 1 ตัว (0-9)');
  }
  if (policy.require_special && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%...)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calculate password strength score (0-4) — client-safe
 */
export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  score = Math.min(4, score);

  const levels = [
    { label: 'อ่อนมาก', color: '#EF4444' },
    { label: 'อ่อน', color: '#F97316' },
    { label: 'ปานกลาง', color: '#EAB308' },
    { label: 'แข็งแรง', color: '#22C55E' },
    { label: 'แข็งแรงมาก', color: '#10B981' },
  ];

  return { score, ...levels[score] };
}
