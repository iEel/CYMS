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
    !containerDone ? 'Enter a valid container number' :
    !customerDone ? 'Resolve owner and billing customer' :
    input.billingRequired && !input.billingCleared ? 'Clear billing before Gate-In' :
    !evidenceDone ? 'Complete inspection evidence' :
    !input.canSubmit ? 'Ask an authorized user to submit' :
    input.submitted ? 'Print or view EIR' :
    'Submit Gate-In and issue EIR';

  return { steps, exceptions, nextAction };
}

export function buildGateOutWorkflow(input: GateOutWorkflowInput): GateWorkflowSummary {
  const hasBookingMismatch = input.bookingWarnings.length > 0;
  const billingDone = !input.billingRequired || input.billingCleared;
  const pickupDone = input.releaseRequested || input.readyToRelease;
  const readyForRelease = input.containerSelected
    && input.customerResolved
    && input.bookingSelected
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
      detail: input.bookingSelected ? 'Booking selected' : 'Select release booking',
      status: hasBookingMismatch ? 'blocked' : input.bookingSelected ? 'done' : input.containerSelected ? 'active' : 'pending',
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
    !input.containerSelected ? 'Search and select a yard container' :
    !input.bookingSelected ? 'Select release booking' :
    hasBookingMismatch ? 'Resolve booking mismatch' :
    input.billingRequired && !input.billingCleared ? 'Clear billing before Gate-Out' :
    !pickupDone ? 'Request pickup move' :
    !input.readyToRelease ? 'Wait for pickup confirmation' :
    !input.canSubmit ? 'Ask an authorized user to release' :
    input.submitted ? 'Print or view EIR' :
    'Confirm Gate-Out and issue EIR';

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
    ? signal('billing', 'Billing', 'ไม่คิดเงิน', 'No clearance needed for this move', 'ok')
    : input.billingCleared
      ? signal('billing', 'Billing', 'Clear', 'Payment, credit, no-charge, or waiver is recorded', 'ok')
      : signal('billing', 'Billing', 'ต้องเคลียร์', 'Clear charges before issuing EIR', 'blocked');

  const booking = input.mode === 'gate_in'
    ? input.bookingSelected
      ? signal('booking', 'Booking', 'Linked', 'Booking reference is attached to Gate-In', 'ok')
      : signal('booking', 'Booking', 'Optional', 'Gate-In can continue without a booking reference', 'pending')
    : bookingWarnings.length > 0
      ? signal('booking', 'Booking', 'Mismatch', bookingWarnings.join(' | '), 'blocked')
      : input.bookingSelected
        ? signal('booking', 'Booking', 'Matched', 'Release booking is selected', 'ok')
        : signal('booking', 'Booking', 'ต้องเลือก', 'Select a release booking before Gate-Out', 'active');

  const evidenceValue = photoRequired > 0 ? `${Math.min(photoCompleted, photoRequired)}/${photoRequired}` : (input.evidenceComplete ? 'ครบ' : 'รอตรวจ');
  const evidence = input.evidenceComplete
    ? signal('evidence', 'Evidence', evidenceValue, 'Inspection and photo evidence are ready', 'ok')
    : signal('evidence', 'Evidence', evidenceValue, photoRequired > 0 ? 'Capture required photos before final confirmation' : 'Complete inspection evidence', 'active');

  const supervisor = input.supervisorPending
    ? signal('supervisor', 'Supervisor', 'Pending', 'Waiting for supervisor approval', 'blocked')
    : !input.canSubmit || hasDanger
      ? signal('supervisor', 'Supervisor', 'Blocked', 'Resolve permission or critical exception first', 'blocked')
      : hasWarning
        ? signal('supervisor', 'Supervisor', 'Review', 'Operational exception needs attention', 'active')
        : signal('supervisor', 'Supervisor', 'Clear', 'No approval blocker detected', 'ok');

  const items = [billing, booking, evidence, supervisor];
  return {
    items,
    canProceed: items.every(item => item.status !== 'blocked') && input.canSubmit,
    nextAction: input.workflow.nextAction,
  };
}
