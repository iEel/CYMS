import {
  canQueueOfflineOperation,
  listAllowedOfflineOperations,
} from '../offlineOperationPolicy';

describe('offline operation policy', () => {
  it('allows only explicit field-operation workflows', () => {
    expect(canQueueOfflineOperation('gate_in').allowed).toBe(true);
    expect(canQueueOfflineOperation('gate_out').allowed).toBe(true);
    expect(canQueueOfflineOperation('gate_out_pickup_request').allowed).toBe(true);
    expect(canQueueOfflineOperation('reefer_check').allowed).toBe(true);
    expect(canQueueOfflineOperation('yard_audit').allowed).toBe(true);
    expect(canQueueOfflineOperation('yard_position_update').allowed).toBe(true);
  });

  it('blocks financial and policy-changing operations', () => {
    expect(canQueueOfflineOperation('invoice_create')).toMatchObject({
      allowed: false,
      reasonCode: 'invoice_create',
    });
    expect(canQueueOfflineOperation('payment_capture')).toMatchObject({
      allowed: false,
      reasonCode: 'payment_capture',
    });
    expect(canQueueOfflineOperation('portal_visibility_change')).toMatchObject({
      allowed: false,
      reasonCode: 'portal_visibility_change',
    });
    expect(canQueueOfflineOperation('document_template_publish')).toMatchObject({
      allowed: false,
      reasonCode: 'document_template_publish',
    });
  });

  it('requires every queued mutation to declare an operation type', () => {
    expect(canQueueOfflineOperation()).toMatchObject({
      allowed: false,
      reasonCode: 'missing_operation',
    });
  });

  it('fails closed for unknown mutations and online-only routes', () => {
    expect(canQueueOfflineOperation('mnr_approve')).toMatchObject({
      allowed: false,
      reasonCode: 'not_allowlisted',
    });
    expect(canQueueOfflineOperation('custom_route', { url: '/api/billing/invoices' })).toMatchObject({
      allowed: false,
      reasonCode: 'online_only_route',
    });
  });

  it('documents the current offline allowlist for UI labels and tests', () => {
    expect(listAllowedOfflineOperations()).toEqual(expect.arrayContaining([
      'gate_in',
      'gate_out',
      'gate_out_pickup_request',
      'photo_upload',
      'reefer_check',
      'yard_audit',
      'yard_audit_log',
    ]));
  });
});
