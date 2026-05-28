export type RuntimeSchemaCapability =
  | 'billingClearances'
  | 'bookingContainers'
  | 'ediSendLog'
  | 'approvalReviews'
  | 'gateBillingClearanceId';

export type RuntimeSchemaCapabilities = Record<RuntimeSchemaCapability, boolean>;

export const RUNTIME_SCHEMA_CAPABILITIES: RuntimeSchemaCapabilities = {
  billingClearances: true,
  bookingContainers: true,
  ediSendLog: true,
  approvalReviews: true,
  gateBillingClearanceId: true,
};

export function getRuntimeSchemaCapabilities(): RuntimeSchemaCapabilities {
  return { ...RUNTIME_SCHEMA_CAPABILITIES };
}

export function assertRuntimeSchemaReady(
  overrides: Partial<RuntimeSchemaCapabilities> = {}
): RuntimeSchemaCapabilities {
  const capabilities = {
    ...RUNTIME_SCHEMA_CAPABILITIES,
    ...overrides,
  };
  const missing = Object.entries(capabilities)
    .filter(([, enabled]) => !enabled)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Runtime schema is missing required capability: ${missing.join(', ')}. Run migrations before serving requests.`
    );
  }

  return capabilities;
}
