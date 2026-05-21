import { buildGateInWorkflow, buildGateOutWorkflow } from '@/lib/gateWorkflow';

describe('gate workflow helpers', () => {
  it('blocks gate-in completion when billing clearance is still required', () => {
    const workflow = buildGateInWorkflow({
      containerNumber: 'EVRU1234567',
      containerValid: true,
      ownerResolved: true,
      billingCustomerResolved: true,
      billingRequired: true,
      billingCleared: false,
      inspectionComplete: true,
      sealRequired: false,
      sealCaptured: false,
      submitted: false,
      halted: false,
      canSubmit: true,
    });

    expect(workflow.steps.map((step) => [step.id, step.status])).toEqual([
      ['container', 'done'],
      ['customer', 'done'],
      ['billing', 'active'],
      ['evidence', 'pending'],
      ['eir', 'blocked'],
    ]);
    expect(workflow.exceptions).toContainEqual({
      code: 'billing_hold',
      severity: 'warning',
      title: 'Billing clearance required',
      detail: 'Collect payment, place on credit, or approve a waiver before issuing EIR.',
    });
    expect(workflow.nextAction).toBe('Clear billing before Gate-In');
  });

  it('marks gate-in ready when customer, billing, inspection, and seal evidence are complete', () => {
    const workflow = buildGateInWorkflow({
      containerNumber: 'EVRU1234567',
      containerValid: true,
      ownerResolved: true,
      billingCustomerResolved: true,
      billingRequired: true,
      billingCleared: true,
      inspectionComplete: true,
      sealRequired: true,
      sealCaptured: true,
      submitted: false,
      halted: false,
      canSubmit: true,
    });

    expect(workflow.steps.at(-1)).toMatchObject({ id: 'eir', status: 'active' });
    expect(workflow.exceptions).toEqual([]);
    expect(workflow.nextAction).toBe('Submit Gate-In and issue EIR');
  });

  it('surfaces gate-out booking mismatch and billing blockers before release', () => {
    const workflow = buildGateOutWorkflow({
      containerSelected: true,
      customerResolved: true,
      bookingSelected: true,
      bookingWarnings: ['Customer mismatch'],
      billingRequired: true,
      billingCleared: false,
      releaseRequested: false,
      readyToRelease: false,
      exitPhotosCount: 0,
      submitted: false,
      canSubmit: true,
    });

    expect(workflow.steps.map((step) => [step.id, step.status])).toEqual([
      ['container', 'done'],
      ['booking', 'blocked'],
      ['billing', 'blocked'],
      ['pickup', 'pending'],
      ['release', 'blocked'],
    ]);
    expect(workflow.exceptions.map((item) => item.code)).toEqual(['booking_mismatch', 'billing_hold']);
    expect(workflow.nextAction).toBe('Resolve booking mismatch');
  });
});
