import type { CustomerPortalRole } from '@/lib/customerPortalPermissions';
import { hasPortalAction } from '@/lib/customerPortalPermissions';

export interface PortalScope {
  modules?: {
    containers?: boolean;
    bookings?: boolean;
    invoices?: boolean;
    documents?: boolean;
    reefer?: boolean;
  };
  reefer?: {
    show_temperature_history?: boolean;
    show_photo_evidence?: boolean;
    show_exceptions?: boolean;
    download_temperature_log?: boolean;
    allow_exception_dispute?: boolean;
  };
}

export interface ReeferAccessCounts {
  rfCount: number;
  reeferGrantCount: number;
}

export function parsePortalScope(value: unknown): PortalScope {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as PortalScope;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as PortalScope : {};
  } catch {
    return {};
  }
}

export function isPortalModuleEnabled(
  scope: PortalScope,
  moduleName: keyof NonNullable<PortalScope['modules']>
): boolean {
  const modules = scope.modules || {};
  if (moduleName === 'reefer') return modules.reefer === true;
  return modules[moduleName] !== false;
}

export function resolveReeferCapability(args: {
  portalEnabled: boolean;
  scope: PortalScope;
  role: CustomerPortalRole;
  counts: ReeferAccessCounts;
}) {
  if (!args.portalEnabled) return { visible: false, reason: 'portal_disabled' };
  if (!isPortalModuleEnabled(args.scope, 'reefer')) return { visible: false, reason: 'module_disabled' };
  if (!hasPortalAction(args.role, 'portal.reefer.view')) return { visible: false, reason: 'user_permission_missing' };
  if (args.counts.rfCount <= 0 && args.counts.reeferGrantCount <= 0) return { visible: false, reason: 'no_reefer_access' };
  return { visible: true, reason: 'available' };
}
