import { getDefaultPostLoginPath, isTransportPortalRole } from '../portalRouting';

describe('portal login routing', () => {
  it('keeps internal users on the dashboard', () => {
    expect(getDefaultPostLoginPath({ role: 'yard_manager' })).toBe('/dashboard');
    expect(getDefaultPostLoginPath({ role: 'gate_clerk' })).toBe('/dashboard');
  });

  it('keeps normal customer portal users on the customer portal', () => {
    expect(getDefaultPostLoginPath({ role: 'customer' })).toBe('/portal');
    expect(getDefaultPostLoginPath({ role: 'customer', customerPortalRole: 'operations_user' })).toBe('/portal');
    expect(getDefaultPostLoginPath({ role: 'customer', customerPortalRole: 'billing_user' })).toBe('/portal');
  });

  it('routes transport customer users to the transport portal', () => {
    expect(isTransportPortalRole('trucking_coordinator')).toBe(true);
    expect(isTransportPortalRole('driver_user')).toBe(true);
    expect(getDefaultPostLoginPath({ role: 'customer', customerPortalRole: 'trucking_coordinator' })).toBe('/transport');
    expect(getDefaultPostLoginPath({ role: 'customer', customerPortalRole: 'driver_user' })).toBe('/transport');
  });
});
