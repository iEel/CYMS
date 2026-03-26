import { getDb } from '@/lib/db';

export interface PasswordPolicyConfig {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_number: boolean;
  require_special: boolean;
  max_login_attempts: number;
  lockout_duration_min: number;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const DEFAULT_POLICY: PasswordPolicyConfig = {
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_special: true,
  max_login_attempts: 5,
  lockout_duration_min: 30,
};

/**
 * Load password policy config from SystemSettings
 */
export async function getPasswordPolicy(): Promise<PasswordPolicyConfig> {
  try {
    const db = await getDb();
    const result = await db.request().query(
      "SELECT setting_value FROM SystemSettings WHERE setting_key = 'password_policy'"
    );
    if (result.recordset.length > 0 && result.recordset[0].setting_value) {
      return { ...DEFAULT_POLICY, ...JSON.parse(result.recordset[0].setting_value) };
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_POLICY;
}

/**
 * Validate a password against the policy
 */
export function validatePassword(password: string, policy: PasswordPolicyConfig): PasswordValidationResult {
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
 * Calculate password strength score (0-4)
 */
export function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Cap at 4
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
