import {
  assertRuntimeSchemaReady,
  getRuntimeSchemaCapabilities,
  RUNTIME_SCHEMA_CAPABILITIES,
} from '../schemaCapabilities';

describe('runtime schema capabilities', () => {
  it('documents the deployed schema features that request handlers can rely on', () => {
    expect(getRuntimeSchemaCapabilities()).toEqual({
      billingClearances: true,
      bookingContainers: true,
      ediSendLog: true,
      approvalReviews: true,
      gateBillingClearanceId: true,
    });
    expect(RUNTIME_SCHEMA_CAPABILITIES.billingClearances).toBe(true);
  });

  it('fails loudly when a required runtime schema capability is disabled', () => {
    expect(() => assertRuntimeSchemaReady({ billingClearances: false })).toThrow(
      /billingClearances/
    );
  });
});
