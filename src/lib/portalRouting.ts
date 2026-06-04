export type PortalRoutingSession = {
  role?: string | null;
  customerPortalRole?: string | null;
};

const TRANSPORT_PORTAL_ROLES = new Set(['trucking_coordinator', 'driver_user']);

export function isTransportPortalRole(role?: string | null) {
  return Boolean(role && TRANSPORT_PORTAL_ROLES.has(role));
}

export function getDefaultPostLoginPath(session: PortalRoutingSession) {
  if (session.role === 'customer') {
    return isTransportPortalRole(session.customerPortalRole) ? '/transport' : '/portal';
  }
  return '/dashboard';
}
