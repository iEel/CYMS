export type GateWorkflowStatus = 'done' | 'active' | 'pending' | 'blocked';

export interface GateWorkflowStep {
  id: string;
  label: string;
  detail: string;
  status: GateWorkflowStatus;
}

export interface GateWorkflowException {
  code: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  detail: string;
}

export interface GateWorkflowSummary {
  steps: GateWorkflowStep[];
  exceptions: GateWorkflowException[];
  nextAction: string;
}

export type GateDecisionStatus = 'ok' | 'active' | 'pending' | 'blocked';

export interface GateDecisionSignal {
  key: 'billing' | 'booking' | 'evidence' | 'supervisor';
  label: string;
  value: string;
  detail: string;
  status: GateDecisionStatus;
}

export interface GateDecisionSignals {
  items: GateDecisionSignal[];
  canProceed: boolean;
  nextAction: string;
}

export interface GateDecisionInput {
  mode: 'gate_in' | 'gate_out';
  workflow: GateWorkflowSummary;
  billingRequired: boolean;
  billingCleared: boolean;
  bookingSelected?: boolean;
  bookingWarnings?: string[];
  evidenceComplete: boolean;
  photoCompleted?: number;
  photoRequired?: number;
  supervisorPending?: boolean;
  canSubmit: boolean;
}

export interface GateInWorkflowInput {
  containerNumber: string;
  containerValid: boolean | null;
  ownerResolved: boolean;
  billingCustomerResolved: boolean;
  billingRequired: boolean;
  billingCleared: boolean;
  inspectionComplete: boolean;
  sealRequired: boolean;
  sealCaptured: boolean;
  submitted: boolean;
  halted: boolean;
  canSubmit: boolean;
}

export interface GateOutWorkflowInput {
  containerSelected: boolean;
  customerResolved: boolean;
  bookingSelected: boolean;
  bookingWarnings: string[];
  billingRequired: boolean;
  billingCleared: boolean;
  releaseRequested: boolean;
  readyToRelease: boolean;
  exitPhotosCount: number;
  submitted: boolean;
  canSubmit: boolean;
}

function exception(
  code: string,
  severity: GateWorkflowException['severity'],
  title: string,
  detail: string
): GateWorkflowException {
  return { code, severity, title, detail };
}

export function buildGateInWorkflow(input: GateInWorkflowInput): GateWorkflowSummary {
  const containerStarted = input.containerNumber.trim().length > 0;
  const containerDone = containerStarted && input.containerValid === true;
  const customerDone = containerDone && input.ownerResolved && input.billingCustomerResolved && !input.halted;
  const billingDone = !input.billingRequired || input.billingCleared;
  const sealDone = !input.sealRequired || input.sealCaptured;
  const evidenceDone = input.inspectionComplete && sealDone;
  const readyForEir = containerDone && customerDone && billingDone && evidenceDone && input.canSubmit;
  const exceptions: GateWorkflowException[] = [];

  if (containerStarted && input.containerValid === false) {
    exceptions.push(exception(
      'invalid_container',
      'danger',
      'Invalid container number',
      'Fix the ISO check digit before continuing the gate-in workflow.'
    ));
  }
  if (input.halted) {
    exceptions.push(exception(
      'prefix_conflict',
      'danger',
      'Customer selection required',
      'This prefix maps to multiple customers. Select the owner and billing customer before continuing.'
    ));
  } else if (containerDone && (!input.ownerResolved || !input.billingCustomerResolved)) {
    exceptions.push(exception(
      'customer_required',
      'warning',
      'Customer selection required',
      'Resolve owner and billing customer before billing or EIR issuance.'
    ));
  }
  if (customerDone && input.billingRequired && !input.billingCleared) {
    exceptions.push(exception(
      'billing_hold',
      'warning',
      'Billing clearance required',
      'Collect payment, place on credit, or approve a waiver before issuing EIR.'
    ));
  }
  if (customerDone && input.sealRequired && !input.sealCaptured) {
    exceptions.push(exception(
      'seal_photo_missing',
      'warning',
      'Seal photo required',
      'Capture seal evidence for laden containers before final submission.'
    ));
  }
  if (customerDone && !input.inspectionComplete) {
    exceptions.push(exception(
      'inspection_missing',
      'info',
      'Inspection not recorded',
      'Complete the inspection checklist so the EIR has condition evidence.'
    ));
  }
  if (!input.canSubmit) {
    exceptions.push(exception(
      'permission_missing',
      'danger',
      'Gate-In permission missing',
      'Your account cannot submit Gate-In transactions.'
    ));
  }

  const steps: GateWorkflowStep[] = [
    {
      id: 'container',
      label: 'Container check',
      detail: containerDone ? 'Check digit passed' : 'Scan or enter a valid container number',
      status: containerDone ? 'done' : containerStarted && input.containerValid === false ? 'blocked' : 'active',
    },
    {
      id: 'customer',
      label: 'Resolve customer',
      detail: customerDone ? 'Owner and billing customer resolved' : 'Confirm owner and payer',
      status: customerDone ? 'done' : containerDone ? (input.halted ? 'blocked' : 'active') : 'pending',
    },
    {
      id: 'billing',
      label: 'Billing clearance',
      detail: billingDone ? 'Billing is clear' : 'Collect, credit, no-charge, or waive',
      status: billingDone ? 'done' : customerDone ? 'active' : 'pending',
    },
    {
      id: 'evidence',
      label: 'Inspection evidence',
      detail: evidenceDone ? 'Inspection and required photos complete' : 'Complete inspection and required photos',
      status: evidenceDone && billingDone && customerDone ? 'done' : billingDone && customerDone ? 'active' : 'pending',
    },
    {
      id: 'eir',
      label: 'Issue EIR',
      detail: input.submitted ? 'EIR issued' : 'Submit gate-in and print EIR',
      status: input.submitted ? 'done' : readyForEir ? 'active' : 'blocked',
    },
  ];

  const nextAction =
    !containerDone ? 'กรอกเลขตู้ให้ถูกต้อง' :
    !customerDone ? 'ระบุเจ้าของตู้และลูกค้าวางบิล' :
    input.billingRequired && !input.billingCleared ? 'เคลียร์ค่าใช้จ่ายก่อน Gate-In' :
    !evidenceDone ? 'ตรวจสภาพและแนบหลักฐานให้ครบ' :
    !input.canSubmit ? 'ใช้บัญชีที่มีสิทธิ์บันทึก Gate-In' :
    input.submitted ? 'เปิดดูหรือพิมพ์ EIR' :
    'บันทึก Gate-In และออก EIR';

  return { steps, exceptions, nextAction };
}

export function buildGateOutWorkflow(input: GateOutWorkflowInput): GateWorkflowSummary {
  const hasBookingMismatch = input.bookingWarnings.length > 0;
  const billingDone = !input.billingRequired || input.billingCleared;
  const pickupDone = input.releaseRequested || input.readyToRelease;
  const readyForRelease = input.containerSelected
    && input.customerResolved
    && !hasBookingMismatch
    && billingDone
    && input.readyToRelease
    && input.canSubmit;
  const exceptions: GateWorkflowException[] = [];

  if (input.containerSelected && !input.customerResolved) {
    exceptions.push(exception(
      'customer_required',
      'warning',
      'Billing customer required',
      'Choose the billing customer before calculating release clearance.'
    ));
  }
  if (hasBookingMismatch) {
    exceptions.push(exception(
      'booking_mismatch',
      'danger',
      'Booking mismatch',
      input.bookingWarnings.join(' | ')
    ));
  }
  if (input.customerResolved && input.billingRequired && !input.billingCleared) {
    exceptions.push(exception(
      'billing_hold',
      'warning',
      'Billing clearance required',
      'Collect payment, place on credit, or approve a waiver before requesting pickup.'
    ));
  }
  if (input.readyToRelease && input.exitPhotosCount === 0) {
    exceptions.push(exception(
      'exit_photo_missing',
      'info',
      'Exit photos not captured',
      'Capture at least one exit photo when damage or release evidence is required.'
    ));
  }
  if (!input.canSubmit) {
    exceptions.push(exception(
      'permission_missing',
      'danger',
      'Gate-Out permission missing',
      'Your account cannot submit Gate-Out transactions.'
    ));
  }

  const steps: GateWorkflowStep[] = [
    {
      id: 'container',
      label: 'Select container',
      detail: input.containerSelected ? 'Container selected from yard' : 'Search by container number or shipping line',
      status: input.containerSelected ? 'done' : 'active',
    },
    {
      id: 'booking',
      label: 'Match booking',
      detail: input.bookingSelected ? 'Booking selected' : 'Booking optional',
      status: hasBookingMismatch ? 'blocked' : input.containerSelected ? 'done' : 'pending',
    },
    {
      id: 'billing',
      label: 'Billing clearance',
      detail: billingDone ? 'Billing is clear' : 'Collect, credit, no-charge, or waive',
      status: billingDone ? 'done' : hasBookingMismatch ? 'blocked' : input.customerResolved ? 'active' : 'pending',
    },
    {
      id: 'pickup',
      label: 'Pickup request',
      detail: pickupDone ? 'Move request is in progress or ready' : 'Create pickup move request',
      status: pickupDone ? 'done' : billingDone && input.containerSelected && !hasBookingMismatch ? 'active' : 'pending',
    },
    {
      id: 'release',
      label: 'Release and EIR',
      detail: input.submitted ? 'Release EIR issued' : 'Confirm truck, photos, and release',
      status: input.submitted ? 'done' : readyForRelease ? 'active' : 'blocked',
    },
  ];

  const nextAction =
    !input.containerSelected ? 'ค้นหาและเลือกตู้ในลาน' :
    hasBookingMismatch ? 'แก้ไข Booking mismatch' :
    input.billingRequired && !input.billingCleared ? 'เคลียร์ค่าใช้จ่ายก่อน Gate-Out' :
    !pickupDone ? 'สร้างคำขอรับตู้' :
    !input.readyToRelease ? 'รอยืนยันงานรับตู้' :
    !input.canSubmit ? 'ใช้บัญชีที่มีสิทธิ์ปล่อยตู้' :
    input.submitted ? 'เปิดดูหรือพิมพ์ EIR' :
    'ยืนยัน Gate-Out และออก EIR';

  return { steps, exceptions, nextAction };
}

function signal(
  key: GateDecisionSignal['key'],
  label: string,
  value: string,
  detail: string,
  status: GateDecisionStatus
): GateDecisionSignal {
  return { key, label, value, detail, status };
}

export function buildGateDecisionSignals(input: GateDecisionInput): GateDecisionSignals {
  const bookingWarnings = input.bookingWarnings || [];
  const hasDanger = input.workflow.exceptions.some(item => item.severity === 'danger');
  const hasWarning = input.workflow.exceptions.some(item => item.severity === 'warning');
  const photoRequired = Number(input.photoRequired || 0);
  const photoCompleted = Number(input.photoCompleted || 0);

  const billing = !input.billingRequired
    ? signal('billing', 'บัญชี', 'ไม่คิดเงิน', 'ไม่ต้องเคลียร์ค่าใช้จ่ายสำหรับรายการนี้', 'ok')
    : input.billingCleared
      ? signal('billing', 'บัญชี', 'ผ่าน', 'บันทึกชำระ เครดิต ไม่คิดเงิน หรือยกเว้นแล้ว', 'ok')
      : signal('billing', 'บัญชี', 'ต้องเคลียร์', 'เคลียร์ค่าใช้จ่ายก่อนออก EIR', 'blocked');

  const booking = input.mode === 'gate_in'
    ? input.bookingSelected
      ? signal('booking', 'Booking', 'ผูกแล้ว', 'เชื่อม Booking กับ Gate-In แล้ว', 'ok')
      : signal('booking', 'Booking', 'ไม่จำเป็น', 'Gate-In ทำต่อได้แม้ไม่มี Booking', 'pending')
    : bookingWarnings.length > 0
      ? signal('booking', 'Booking', 'ไม่ตรงกัน', bookingWarnings.join(' | '), 'blocked')
      : input.bookingSelected
        ? signal('booking', 'Booking', 'ตรงกัน', 'เลือก Booking สำหรับปล่อยตู้แล้ว', 'ok')
        : signal('booking', 'Booking', 'ไม่จำเป็น', 'Gate-Out ทำต่อได้แม้ไม่มี Booking', 'pending');

  const evidenceValue = photoRequired > 0 ? `${Math.min(photoCompleted, photoRequired)}/${photoRequired}` : (input.evidenceComplete ? 'ครบ' : 'รอตรวจ');
  const evidence = input.evidenceComplete
    ? signal('evidence', 'หลักฐาน', evidenceValue, 'ตรวจสภาพและรูปหลักฐานครบแล้ว', 'ok')
    : signal('evidence', 'หลักฐาน', evidenceValue, photoRequired > 0 ? 'ถ่ายรูปที่จำเป็นก่อนยืนยันรายการ' : 'ตรวจสภาพและแนบหลักฐาน', 'active');

  const supervisor = input.supervisorPending
    ? signal('supervisor', 'อนุมัติ', 'รออนุมัติ', 'รอผู้อนุมัติพิจารณา', 'blocked')
    : !input.canSubmit || hasDanger
      ? signal('supervisor', 'อนุมัติ', 'ติดเงื่อนไข', 'แก้สิทธิ์หรือ exception สำคัญก่อน', 'blocked')
      : hasWarning
        ? signal('supervisor', 'อนุมัติ', 'ตรวจทาน', 'มี exception ที่ควรตรวจสอบ', 'active')
        : signal('supervisor', 'อนุมัติ', 'ผ่าน', 'ไม่พบ blocker การอนุมัติ', 'ok');

  const items = [billing, booking, evidence, supervisor];
  const finalStep = input.workflow.steps.at(-1);
  const workflowReady = finalStep?.status === 'active' || finalStep?.status === 'done';

  return {
    items,
    canProceed: Boolean(workflowReady) && items.every(item => item.status !== 'blocked') && input.canSubmit,
    nextAction: input.workflow.nextAction,
  };
}
