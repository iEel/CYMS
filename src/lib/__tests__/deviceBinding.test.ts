import { DEFAULT_DEVICE_BINDING_POLICY, isDeviceBindingRequired, normalizeDeviceId } from '@/lib/deviceBinding';

describe('deviceBinding', () => {
  it('normalizes trusted device ids and rejects malformed values', () => {
    expect(normalizeDeviceId('  550e8400-e29b-41d4-a716-446655440000  ')).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(normalizeDeviceId('browser_device_ABC-123')).toBe('browser_device_ABC-123');

    expect(normalizeDeviceId('short')).toBeNull();
    expect(normalizeDeviceId('has spaces inside')).toBeNull();
    expect(normalizeDeviceId('x'.repeat(129))).toBeNull();
  });

  it('only requires binding when the policy is enabled for the user role', () => {
    expect(isDeviceBindingRequired(DEFAULT_DEVICE_BINDING_POLICY, 'rs_driver')).toBe(false);

    const policy = {
      ...DEFAULT_DEVICE_BINDING_POLICY,
      enabled: true,
      enforce_roles: ['rs_driver', 'gate_clerk'],
    };

    expect(isDeviceBindingRequired(policy, 'rs_driver')).toBe(true);
    expect(isDeviceBindingRequired(policy, 'gate_clerk')).toBe(true);
    expect(isDeviceBindingRequired(policy, 'yard_manager')).toBe(false);
  });
});
