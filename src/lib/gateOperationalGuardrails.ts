import type { PhotoCompleteness } from './photoEvidence';

export type GateMode = 'gate_in' | 'gate_out';
export type GateGuardrailSeverity = 'info' | 'warning' | 'blocked';

export interface GateRecentTransaction {
  transaction_id?: number;
  transaction_type?: string;
  container_number?: string | null;
  seal_number?: string | null;
  truck_plate?: string | null;
  driver_name?: string | null;
  created_at?: string | null;
  eir_number?: string | null;
}

export interface GateGuardrailForm {
  container_number?: string | null;
  booking_ref?: string | null;
  driver_name?: string | null;
  driver_license?: string | null;
  truck_plate?: string | null;
  truck_company?: string | null;
  seal_number?: string | null;
  is_laden?: boolean | null;
}

export interface GateGuardrailAlert {
  key: string;
  severity: GateGuardrailSeverity;
  title: string;
  message: string;
  action?: string;
  matched_transaction?: {
    transaction_id?: number;
    container_number?: string | null;
    eir_number?: string | null;
    created_at?: string | null;
  };
}

export interface GatePhotoStatus {
  required: number;
  completed: number;
  ok: boolean;
  missing_categories: string[];
}

export interface GateDriverProfileStatus {
  status: 'missing' | 'partial' | 'complete';
  completed: number;
  total: number;
  missing_fields: string[];
}

export interface GateQrPass {
  pass_id: string;
  expires_at: string;
  qr_text: string;
  payload: {
    v: 1;
    mode: GateMode;
    container_number?: string;
    booking_ref?: string;
    truck_plate?: string;
    driver_name?: string;
    expires_at: string;
  };
}

export interface GateOperationalGuardrailsInput {
  mode: GateMode;
  form: GateGuardrailForm;
  recentTransactions?: GateRecentTransaction[];
  inspectionCompleteness?: PhotoCompleteness | null;
  sealPhotoCaptured?: boolean;
  exitPhotosCount?: number;
  releasePhase?: 'search' | 'pending_pickup' | 'confirm_release';
  now?: Date;
}

function normalizeIdentifier(value?: string | null) {
  return (value || '').replace(/[^0-9A-Za-zก-๙]/g, '').toUpperCase();
}

function normalizeText(value?: string | null) {
  return (value || '').trim();
}

function normalizeReference(value?: string | null) {
  return normalizeText(value).replace(/\s+/g, '').replace(/[^0-9A-Za-zก-๙-]/g, '').toUpperCase();
}

function sameContainer(a?: string | null, b?: string | null) {
  return Boolean(a && b && normalizeIdentifier(a) === normalizeIdentifier(b));
}

function recentMatch(
  recentTransactions: GateRecentTransaction[],
  field: 'seal_number' | 'truck_plate',
  value?: string | null,
  currentContainer?: string | null,
) {
  const normalized = normalizeIdentifier(value);
  if (!normalized) return null;

  return recentTransactions.find(tx => {
    const txValue = normalizeIdentifier(tx[field]);
    return txValue === normalized && !sameContainer(tx.container_number, currentContainer);
  }) || null;
}

function summarizeDriverProfile(form: GateGuardrailForm): GateDriverProfileStatus {
  const fields = [
    { key: 'driver_name', label: 'ชื่อคนขับ', value: form.driver_name },
    { key: 'truck_plate', label: 'ทะเบียนรถ', value: form.truck_plate },
    { key: 'driver_license', label: 'เลขใบขับขี่', value: form.driver_license },
    { key: 'truck_company', label: 'บริษัทรถ', value: form.truck_company },
  ];
  const missing = fields.filter(field => !normalizeText(field.value)).map(field => field.label);
  const completed = fields.length - missing.length;
  return {
    status: completed === 0 ? 'missing' : missing.length === 0 ? 'complete' : 'partial',
    completed,
    total: fields.length,
    missing_fields: missing,
  };
}

function summarizeGatePhotos(input: GateOperationalGuardrailsInput): GatePhotoStatus {
  if (input.mode === 'gate_out') {
    const required = input.releasePhase === 'confirm_release' ? 2 : 0;
    const completed = Math.min(input.exitPhotosCount || 0, required || input.exitPhotosCount || 0);
    return {
      required,
      completed,
      ok: required === 0 || completed >= required,
      missing_categories: required > completed ? ['รูปตู้ขาออกอย่างน้อย 2 รูป'] : [],
    };
  }

  const inspection = input.inspectionCompleteness;
  const sealRequired = Boolean(input.form.is_laden);
  const required = (inspection?.required || 0) + (sealRequired ? 1 : 0);
  const completed = (inspection?.completed || 0) + (sealRequired && input.sealPhotoCaptured ? 1 : 0);
  const missing = [...(inspection?.missing_categories || [])];
  if (sealRequired && !input.sealPhotoCaptured) missing.push('รูปซีล');

  return {
    required,
    completed,
    ok: required === 0 || completed >= required,
    missing_categories: missing,
  };
}

export function buildGateQrPass(params: {
  mode: GateMode;
  container_number?: string | null;
  booking_ref?: string | null;
  truck_plate?: string | null;
  driver_name?: string | null;
  now?: Date;
  validForMinutes?: number;
}): GateQrPass {
  const now = params.now || new Date();
  const expires = new Date(now.getTime() + (params.validForMinutes || 30) * 60_000);
  const container = normalizeIdentifier(params.container_number);
  const booking = normalizeReference(params.booking_ref);
  const plate = normalizeIdentifier(params.truck_plate);
  const driver = normalizeText(params.driver_name);
  const prefix = params.mode === 'gate_in' ? 'GI' : 'GO';
  const passId = [prefix, container || 'NO-CNTR', booking || 'NO-BK', plate || 'NO-PLATE'].join('-');
  const payload: GateQrPass['payload'] = {
    v: 1,
    mode: params.mode,
    expires_at: expires.toISOString(),
  };
  if (container) payload.container_number = container;
  if (booking) payload.booking_ref = booking;
  if (plate) payload.truck_plate = plate;
  if (driver) payload.driver_name = driver;

  return {
    pass_id: passId,
    expires_at: expires.toISOString(),
    payload,
    qr_text: JSON.stringify(payload),
  };
}

export function buildGateOperationalGuardrails(input: GateOperationalGuardrailsInput) {
  const form = input.form;
  const recentTransactions = input.recentTransactions || [];
  const alerts: GateGuardrailAlert[] = [];
  const driver_profile = summarizeDriverProfile(form);
  const photo_status = summarizeGatePhotos(input);

  const duplicateSeal = recentMatch(recentTransactions, 'seal_number', form.seal_number, form.container_number);
  if (duplicateSeal) {
    alerts.push({
      key: 'duplicate_seal_number',
      severity: 'warning',
      title: 'เลขซีลซ้ำในรายการวันนี้',
      message: `พบเลขซีลนี้กับตู้ ${duplicateSeal.container_number || '-'} แล้ว`,
      action: 'ตรวจรูปซีลและยืนยันเลขซีลก่อนบันทึก',
      matched_transaction: {
        transaction_id: duplicateSeal.transaction_id,
        container_number: duplicateSeal.container_number,
        eir_number: duplicateSeal.eir_number,
        created_at: duplicateSeal.created_at,
      },
    });
  }

  const duplicatePlate = recentMatch(recentTransactions, 'truck_plate', form.truck_plate, form.container_number);
  if (duplicatePlate) {
    alerts.push({
      key: 'duplicate_truck_plate',
      severity: 'info',
      title: 'ทะเบียนรถเคยเข้าออกวันนี้',
      message: `ทะเบียนนี้เคยใช้กับตู้ ${duplicatePlate.container_number || '-'} ในรายการล่าสุด`,
      action: 'ยืนยันว่าเป็นรถคันเดียวกันหรือแก้ทะเบียนก่อนดำเนินการ',
      matched_transaction: {
        transaction_id: duplicatePlate.transaction_id,
        container_number: duplicatePlate.container_number,
        eir_number: duplicatePlate.eir_number,
        created_at: duplicatePlate.created_at,
      },
    });
  }

  if (input.mode === 'gate_in' && form.is_laden && !input.sealPhotoCaptured) {
    alerts.push({
      key: 'missing_seal_photo',
      severity: 'blocked',
      title: 'ยังไม่มีรูปซีล',
      message: 'ตู้ Laden ควรมีรูปซีลก่อนรับเข้าเพื่อลด dispute ตอนออก EIR',
      action: 'ถ่ายรูปซีลหรือแนบหลักฐานก่อนบันทึก',
    });
  }

  if (input.mode === 'gate_in' && input.inspectionCompleteness && !photo_status.ok) {
    alerts.push({
      key: 'missing_inspection_photos',
      severity: 'warning',
      title: 'หลักฐานตรวจสภาพยังไม่ครบ',
      message: `ขาด ${photo_status.missing_categories.join(', ')}`,
      action: 'กลับไปเพิ่มรูปในหมวดที่ยังขาด',
    });
  }

  if (input.mode === 'gate_out' && input.releasePhase === 'confirm_release' && !photo_status.ok) {
    alerts.push({
      key: 'exit_photo_recommended',
      severity: 'warning',
      title: 'รูปตู้ขาออกยังน้อย',
      message: 'แนะนำรูปตู้ขาออกอย่างน้อย 2 รูปก่อนออก EIR',
      action: 'ถ่ายรูปหน้า/หลังหรือมุมสำคัญเพิ่ม',
    });
  }

  const qr_pass = buildGateQrPass({
    mode: input.mode,
    container_number: form.container_number,
    booking_ref: form.booking_ref,
    truck_plate: form.truck_plate,
    driver_name: form.driver_name,
    now: input.now,
  });

  return {
    qr_pass,
    alerts,
    driver_profile,
    photo_status,
    has_blocker: alerts.some(alert => alert.severity === 'blocked'),
  };
}

export type GateOperationalGuardrailsSnapshot = ReturnType<typeof buildGateOperationalGuardrails>;
