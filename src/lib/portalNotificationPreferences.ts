import sql from 'mssql';

export const PORTAL_NOTIFICATION_TYPES = [
  'reefer_exception',
  'booking_status',
  'invoice',
  'gate_activity',
] as const;

export type PortalNotificationType = typeof PORTAL_NOTIFICATION_TYPES[number];
export type PortalNotificationPreferences = Record<PortalNotificationType, boolean>;

export const DEFAULT_PORTAL_NOTIFICATION_PREFERENCES: PortalNotificationPreferences = {
  reefer_exception: true,
  booking_status: true,
  invoice: true,
  gate_activity: true,
};

interface DbRequest {
  input(name: string, type: unknown, value: unknown): DbRequest;
  query(statement: string): Promise<{ recordset: Array<Record<string, unknown>> }>;
}

interface Db {
  request(): DbRequest;
}

export function isPortalNotificationType(value: string): value is PortalNotificationType {
  return (PORTAL_NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function normalizePortalNotificationPreferences(
  rows: Array<Record<string, unknown>> = [],
): PortalNotificationPreferences {
  const preferences = { ...DEFAULT_PORTAL_NOTIFICATION_PREFERENCES };
  for (const row of rows) {
    const type = String(row.notification_type || '');
    if (!isPortalNotificationType(type)) continue;
    preferences[type] = row.enabled === false || row.enabled === 0 ? false : Boolean(row.enabled);
  }
  return preferences;
}

export function filterNotificationsByPreferences<T extends { type: string }>(
  notifications: T[],
  preferences: PortalNotificationPreferences,
) {
  return notifications.filter((notification) => {
    if (!isPortalNotificationType(notification.type)) return true;
    return preferences[notification.type];
  });
}

export async function getPortalNotificationPreferences(db: Db, customerId: number) {
  try {
    const result = await db.request()
      .input('customerId', sql.Int, customerId)
      .query(`
        SELECT notification_type, enabled
        FROM PortalNotificationPreferences
        WHERE customer_id = @customerId
      `);
    return normalizePortalNotificationPreferences(result.recordset);
  } catch (error) {
    console.warn('⚠️ Portal notification preferences unavailable, using defaults:', error);
    return { ...DEFAULT_PORTAL_NOTIFICATION_PREFERENCES };
  }
}

export function mergePreferencePatch(value: unknown): PortalNotificationPreferences {
  const source = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const nested = typeof source.preferences === 'object' && source.preferences !== null
    ? source.preferences as Record<string, unknown>
    : source;
  const preferences = { ...DEFAULT_PORTAL_NOTIFICATION_PREFERENCES };

  for (const type of PORTAL_NOTIFICATION_TYPES) {
    if (typeof nested[type] === 'boolean') preferences[type] = nested[type] as boolean;
  }

  return preferences;
}
