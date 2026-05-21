import sql from 'mssql';

interface DbRequest {
  input(name: string, type: unknown, value: unknown): DbRequest;
  query<T = Record<string, unknown>>(statement: string): Promise<{ recordset: T[] }>;
}

interface DbLike {
  request(): DbRequest;
}

export interface ReeferBookingPolicyBooking {
  booking_id?: number | null;
  yard_id?: number | null;
  customer_id?: number | null;
  container_type?: string | null;
}

export interface ReeferBookingPolicyOptions {
  intervalHours?: number | string | null;
  warningGraceMinutes?: number | string | null;
  cargoProfile?: string | null;
  minTempC?: number | string | null;
  maxTempC?: number | string | null;
}

export interface ReeferBookingPolicyResult {
  policy_id?: number;
  scope_type?: string;
  booking_id?: number;
  [key: string]: unknown;
}

function positiveInt(value: number | string | null | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function optionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isReeferBookingContainerType(value: unknown) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toUpperCase();
  return ['RF', 'RH', 'REEFER'].includes(normalized);
}

export async function ensureReeferBookingPolicy(
  db: DbLike,
  booking: ReeferBookingPolicyBooking,
  options: ReeferBookingPolicyOptions = {},
): Promise<ReeferBookingPolicyResult | null> {
  if (!isReeferBookingContainerType(booking.container_type)) return null;
  if (!booking.booking_id || !booking.yard_id) return null;

  const intervalHours = positiveInt(options.intervalHours, 4, 24 * 30);
  const warningGraceMinutes = positiveInt(options.warningGraceMinutes, 30, 24 * 60);
  const cargoProfile = options.cargoProfile?.trim() || 'general';
  const minTempC = optionalNumber(options.minTempC);
  const maxTempC = optionalNumber(options.maxTempC);

  const result = await db.request()
    .input('yardId', sql.Int, booking.yard_id)
    .input('customerId', sql.Int, booking.customer_id || null)
    .input('bookingId', sql.Int, booking.booking_id)
    .input('scopeType', sql.NVarChar, 'booking')
    .input('cargoProfile', sql.NVarChar, cargoProfile)
    .input('intervalHours', sql.Int, intervalHours)
    .input('warningGraceMinutes', sql.Int, warningGraceMinutes)
    .input('minTempC', sql.Decimal(6, 2), minTempC)
    .input('maxTempC', sql.Decimal(6, 2), maxTempC)
    .query<ReeferBookingPolicyResult>(`
      INSERT INTO ReeferCheckPolicies (
        yard_id, customer_id, booking_id, scope_type, cargo_profile,
        interval_hours, warning_grace_minutes, min_temp_c, max_temp_c, is_active
      )
      OUTPUT INSERTED.*
      SELECT
        @yardId, @customerId, @bookingId, @scopeType, @cargoProfile,
        @intervalHours, @warningGraceMinutes, @minTempC, @maxTempC, 1
      WHERE NOT EXISTS (
        SELECT 1
        FROM ReeferCheckPolicies
        WHERE scope_type = @scopeType
          AND booking_id = @bookingId
          AND is_active = 1
      )
    `);

  return result.recordset[0] || null;
}
