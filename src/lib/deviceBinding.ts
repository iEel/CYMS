import { getDb } from '@/lib/db';
import sql from 'mssql';

export interface DeviceBindingPolicy {
  enabled: boolean;
  auto_bind: boolean;
  enforce_roles: string[];
}

export const DEVICE_BINDING_SETTING_KEY = 'device_binding_policy';

export const DEFAULT_DEVICE_BINDING_POLICY: DeviceBindingPolicy = {
  enabled: false,
  auto_bind: true,
  enforce_roles: ['rs_driver'],
};

const VALID_DEVICE_ID = /^[A-Za-z0-9._:-]{16,128}$/;

export function normalizeDeviceId(value: unknown) {
  const normalized = String(value || '').trim();
  if (!VALID_DEVICE_ID.test(normalized)) return null;
  return normalized;
}

export function isDeviceBindingRequired(policy: DeviceBindingPolicy, roleCode: string) {
  return policy.enabled && policy.enforce_roles.includes(roleCode);
}

export function sanitizeDeviceBindingPolicy(value: Partial<DeviceBindingPolicy> | null | undefined): DeviceBindingPolicy {
  const enforceRoles = Array.isArray(value?.enforce_roles)
    ? value.enforce_roles
        .map(role => String(role || '').trim())
        .filter(Boolean)
        .slice(0, 20)
    : DEFAULT_DEVICE_BINDING_POLICY.enforce_roles;

  return {
    enabled: !!value?.enabled,
    auto_bind: value?.auto_bind !== false,
    enforce_roles: Array.from(new Set(enforceRoles)),
  };
}

export async function getDeviceBindingPolicy(): Promise<DeviceBindingPolicy> {
  try {
    const db = await getDb();
    const result = await db.request()
      .input('key', sql.NVarChar, DEVICE_BINDING_SETTING_KEY)
      .query('SELECT setting_value FROM SystemSettings WHERE setting_key = @key');

    const rawValue = result.recordset[0]?.setting_value;
    if (!rawValue) return DEFAULT_DEVICE_BINDING_POLICY;
    return sanitizeDeviceBindingPolicy({
      ...DEFAULT_DEVICE_BINDING_POLICY,
      ...JSON.parse(rawValue),
    });
  } catch {
    return DEFAULT_DEVICE_BINDING_POLICY;
  }
}
