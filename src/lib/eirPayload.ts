import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;
type DbRow = Record<string, unknown>;

export interface EIRDamagePoint {
  id?: string;
  side?: string;
  x?: number;
  y?: number;
  type?: string;
  severity?: string;
  note?: string;
  photo?: string;
}

export interface EIRDamageReport {
  points?: EIRDamagePoint[];
  condition_grade?: string;
  inspector_notes?: string;
  photos?: string[];
  exit_photos?: string[];
  photo_evidence?: unknown[];
  photo_requirements?: unknown[];
  photo_completeness?: {
    required?: number;
    completed?: number;
    total?: number;
    missing_categories?: string[];
  };
  inspection_template?: string;
}

export interface EIRCompanyProfile {
  company_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  tax_id?: string;
}

export interface EIRPayload {
  eir_number: string;
  transaction_type: 'gate_in' | 'gate_out';
  date: string;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  seal_number: string;
  tare_weight_kg: number;
  max_gross_weight_kg: number;
  is_laden: boolean;
  driver_name: string;
  truck_plate: string;
  truck_company: string;
  booking_ref: string;
  yard_name: string;
  yard_code: string;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  processed_by: string;
  damage_report: EIRDamageReport | null;
  notes: string;
  container_condition: 'sound' | 'damage';
  container_grade: string;
  company: EIRCompanyProfile | null;
}

function asString(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBoolean(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function asDateString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return asString(value);
}

export function parseEIRDamageReport(raw: unknown): {
  damageReport: EIRDamageReport | null;
  containerCondition: 'sound' | 'damage';
  containerGrade: string;
} {
  if (!raw) {
    return { damageReport: null, containerCondition: 'sound', containerGrade: 'A' };
  }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') {
      return { damageReport: null, containerCondition: 'sound', containerGrade: 'A' };
    }

    const damageReport = parsed as EIRDamageReport;
    const hasDamage = Array.isArray(damageReport.points) && damageReport.points.length > 0;
    const grade = typeof damageReport.condition_grade === 'string' && damageReport.condition_grade.trim()
      ? damageReport.condition_grade.trim().toUpperCase()
      : 'A';

    return {
      damageReport,
      containerCondition: hasDamage ? 'damage' : 'sound',
      containerGrade: grade,
    };
  } catch {
    return { damageReport: null, containerCondition: 'sound', containerGrade: 'A' };
  }
}

export function buildEIRPayload(row: DbRow, company: EIRCompanyProfile | null): EIRPayload {
  const parsed = parseEIRDamageReport(row.damage_report);
  const fallbackGrade = asString(row.container_grade, 'A').toUpperCase();

  return {
    eir_number: asString(row.eir_number),
    transaction_type: asString(row.transaction_type) === 'gate_out' ? 'gate_out' : 'gate_in',
    date: asDateString(row.created_at),
    container_number: asString(row.container_number),
    size: asString(row.size),
    type: asString(row.type),
    shipping_line: asString(row.shipping_line),
    seal_number: asString(row.seal_number),
    tare_weight_kg: asNumber(row.tare_weight_kg),
    max_gross_weight_kg: asNumber(row.max_gross_weight_kg),
    is_laden: asBoolean(row.is_laden),
    driver_name: asString(row.driver_name),
    truck_plate: asString(row.truck_plate),
    truck_company: asString(row.truck_company),
    booking_ref: asString(row.booking_ref),
    yard_name: asString(row.yard_name),
    yard_code: asString(row.yard_code),
    zone_name: asString(row.zone_name),
    bay: asNumber(row.bay),
    row: asNumber(row.row),
    tier: asNumber(row.tier),
    processed_by: asString(row.processed_by_name, 'ระบบ'),
    damage_report: parsed.damageReport,
    notes: asString(row.notes),
    container_condition: parsed.containerCondition,
    container_grade: parsed.damageReport?.condition_grade ? parsed.containerGrade : fallbackGrade,
    company,
  };
}

export async function fetchCompanyProfile(db: DbPool): Promise<EIRCompanyProfile | null> {
  try {
    const companyResult = await db.request().query(
      'SELECT TOP 1 company_name, address, phone, email, logo_url, tax_id FROM CompanyProfile',
    );
    return (companyResult.recordset[0] as EIRCompanyProfile | undefined) || null;
  } catch {
    return null;
  }
}

export async function fetchEIRLifecycle(db: DbPool, transactionId: number, eirNumber: string) {
  const lifecycleResult = await db.request()
    .input('transactionId', sql.Int, transactionId)
    .input('eirNumber', sql.NVarChar(80), eirNumber)
    .query(`
      SELECT dl.*, u.full_name as user_name, y.yard_name
      FROM DocumentLifecycle dl
      LEFT JOIN Users u ON dl.user_id = u.user_id
      LEFT JOIN Yards y ON dl.yard_id = y.yard_id
      WHERE dl.document_type = 'eir'
        AND (dl.document_id = @transactionId OR dl.document_number = @eirNumber)
      ORDER BY dl.created_at ASC, dl.lifecycle_id ASC
    `);

  return lifecycleResult.recordset;
}
