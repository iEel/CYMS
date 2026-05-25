export type EIRViewType =
  | 'internal'
  | 'customer'
  | 'shipping_line'
  | 'booking_customer'
  | 'billing'
  | 'trucking'
  | 'driver'
  | 'public'
  | 'auditor';

export interface PortalScope {
  eir?: {
    fields?: {
      container_grade?: boolean;
      [fieldName: string]: boolean | undefined;
    };
    [scopeName: string]: unknown;
  };
  [scopeName: string]: unknown;
}

export interface EIRVisibilityGrant {
  access_role?: string | null;
  permissions?: string[] | null;
  permission_scope?: PortalScope | null;
  [grantField: string]: unknown;
}

export interface EIRVisibilityContext {
  viewType: EIRViewType;
  permissions?: string[] | null;
  permission_scope?: PortalScope | null;
  accessGrant?: EIRVisibilityGrant | null;
}

type EIRRecord = Record<string, unknown>;

const PUBLIC_FIELDS = [
  'eir_number',
  'transaction_type',
  'created_at',
  'gate_datetime',
  'date',
  'verification_status',
  'document_status',
  'version_no',
  'container_number',
  'yard_name',
  'yard_code',
  'container_condition',
] as const;

const OPERATIONAL_FIELDS = [
  'eir_number',
  'transaction_type',
  'created_at',
  'verification_status',
  'container_number',
  'booking_number',
  'shipping_line',
  'seal_number',
  'yard_code',
  'gate_name',
  'gate_time',
] as const;

const PORTAL_LIFECYCLE_FIELDS = [
  'lifecycle_id',
  'document_type',
  'document_number',
  'status',
  'action',
  'event_type',
  'user_name',
  'yard_name',
  'created_at',
] as const;

const GRADE_FIELDS = ['container_grade', 'container_grade_label'] as const;
const DAMAGE_REPORT_GRADE_FIELDS = [
  'condition_grade',
  'condition_grade_label',
  'container_grade',
  'container_grade_label',
  'grade',
  'grade_label',
] as const;

function isRecord(value: unknown): value is EIRRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickFields(source: EIRRecord, fields: readonly string[]): EIRRecord {
  return fields.reduce<EIRRecord>((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      payload[field] = source[field];
    }
    return payload;
  }, {});
}

function hasPermission(context: EIRVisibilityContext, permission: string): boolean {
  const permissions = [
    ...(context.permissions ?? []),
    ...(context.accessGrant?.permissions ?? []),
  ];

  return permissions.includes(permission);
}

function fieldScopeAllowsGrade(context: EIRVisibilityContext): boolean {
  const contextScope = context.permission_scope?.eir?.fields?.container_grade;
  const grantScope = context.accessGrant?.permission_scope?.eir?.fields?.container_grade;

  return contextScope === true || grantScope === true;
}

function addGradeIfAllowed(payload: EIRRecord, master: EIRRecord, context: EIRVisibilityContext): void {
  if (!canViewContainerGrade(context)) return;

  for (const field of GRADE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(master, field)) {
      payload[field] = master[field];
    }
  }
}

function sanitizeDamagePoints(value: unknown): EIRRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((point) => {
      const sanitized: EIRRecord = {};

      for (const field of ['side', 'type', 'severity', 'note']) {
        if (Object.prototype.hasOwnProperty.call(point, field)) {
          sanitized[field] = point[field];
        }
      }

      return sanitized;
    });
}

function sanitizeDamageReport(value: unknown, includeGradeFields: boolean): EIRRecord | undefined {
  if (!isRecord(value)) return undefined;

  const sanitized: EIRRecord = {};

  if (includeGradeFields) {
    for (const field of DAMAGE_REPORT_GRADE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        sanitized[field] = value[field];
      }
    }
  }

  const points = sanitizeDamagePoints(value.points);
  if (points.length > 0) {
    sanitized.points = points;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function buildSafeDamageSummary(master: EIRRecord): EIRRecord | undefined {
  const damageReport = isRecord(master.damage_report) ? master.damage_report : undefined;
  const points = sanitizeDamagePoints(damageReport?.points);
  const condition = master.container_condition === 'damage' || master.container_condition === 'sound'
    ? master.container_condition
    : points.length > 0
      ? 'damage'
      : 'sound';

  return {
    condition,
    damage_points: points.length,
  };
}

function addPublicCopyMetadata(payload: EIRRecord, master: EIRRecord): EIRRecord {
  const damageSummary = buildSafeDamageSummary(master);
  if (damageSummary) {
    payload.damage_summary = damageSummary;
  }

  payload.copy_type_label = copyTypeLabel('public');

  return payload;
}

export function sanitizeEirLifecycle(events: unknown): EIRRecord[] {
  if (!Array.isArray(events)) return [];

  return events
    .filter(isRecord)
    .map((event) => pickFields(event, PORTAL_LIFECYCLE_FIELDS));
}

export function maskPhone(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.length <= 6) return raw;

  return `${raw.slice(0, 3)}****${raw.slice(-3)}`;
}

export function maskTruckPlate(value: unknown): string {
  const raw = String(value ?? '');
  if (!raw) return raw;

  const [prefix] = raw.split('-');
  return `${prefix || raw.slice(0, 2)}-****`;
}

export function maskPersonName(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;

  const [firstName, ...rest] = raw.split(/\s+/);
  const lastInitial = rest.find(Boolean)?.charAt(0);

  return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
}

export function copyTypeLabel(viewType: EIRViewType): string {
  if (viewType === 'public') return 'Public Verification Copy';
  if (viewType === 'driver') return 'Driver Copy';
  if (viewType === 'internal' || viewType === 'auditor') return 'Internal Copy';

  return 'Customer Copy';
}

export function canViewContainerGrade(context: EIRVisibilityContext): boolean {
  if (context.viewType === 'internal' || context.viewType === 'auditor') return true;
  if (context.viewType === 'public' || context.viewType === 'driver' || context.viewType === 'trucking') {
    return false;
  }

  return hasPermission(context, 'portal.eir.grade.view') && fieldScopeAllowsGrade(context);
}

export function buildEirViewPayload(master: EIRRecord, context: EIRVisibilityContext): { eir: EIRRecord } {
  if (context.viewType === 'public') {
    const eir = addPublicCopyMetadata(pickFields(master, PUBLIC_FIELDS), master);
    eir.document_status = eir.document_status ?? eir.verification_status;
    eir.version_no = eir.version_no ?? 1;

    return {
      eir,
    };
  }

  if (context.viewType === 'internal' || context.viewType === 'auditor') {
    return {
      eir: {
        ...master,
        copy_type_label: copyTypeLabel(context.viewType),
        document_status: master.document_status ?? master.verification_status,
        version_no: master.version_no ?? 1,
      },
    };
  }

  const eir = pickFields(master, OPERATIONAL_FIELDS);
  eir.copy_type_label = copyTypeLabel(context.viewType);

  if (context.viewType === 'driver') {
    if (Object.prototype.hasOwnProperty.call(master, 'driver_name')) {
      eir.driver_name = master.driver_name;
    }
    if (Object.prototype.hasOwnProperty.call(master, 'driver_phone')) {
      eir.driver_phone = master.driver_phone;
    }
    if (Object.prototype.hasOwnProperty.call(master, 'truck_plate')) {
      eir.truck_plate = master.truck_plate;
    }
    if (Object.prototype.hasOwnProperty.call(master, 'truck_company')) {
      eir.truck_company = master.truck_company;
    }
    return { eir };
  }

  if (context.viewType === 'trucking') {
    if (Object.prototype.hasOwnProperty.call(master, 'driver_name')) {
      eir.driver_name = maskPersonName(master.driver_name);
    }
    if (Object.prototype.hasOwnProperty.call(master, 'driver_phone')) {
      eir.driver_phone = maskPhone(master.driver_phone);
    }
    if (Object.prototype.hasOwnProperty.call(master, 'truck_plate')) {
      eir.truck_plate = master.truck_plate;
    }
    if (Object.prototype.hasOwnProperty.call(master, 'truck_company')) {
      eir.truck_company = master.truck_company;
    }
    return { eir };
  }

  if (Object.prototype.hasOwnProperty.call(master, 'driver_name')) {
    eir.driver_name = maskPersonName(master.driver_name);
  }
  if (Object.prototype.hasOwnProperty.call(master, 'driver_phone')) {
    eir.driver_phone = maskPhone(master.driver_phone);
  }
  if (Object.prototype.hasOwnProperty.call(master, 'truck_plate')) {
    eir.truck_plate = maskTruckPlate(master.truck_plate);
  }
  const damageReport = sanitizeDamageReport(master.damage_report, canViewContainerGrade(context));
  if (damageReport) {
    eir.damage_report = damageReport;
  }

  addGradeIfAllowed(eir, master, context);

  return { eir };
}

export function resolveEirViewType(
  actor: unknown,
  eir: unknown,
  accessGrant?: EIRVisibilityGrant | null,
): EIRViewType {
  void actor;
  void eir;

  const role = String(accessGrant?.access_role ?? '').toLowerCase();

  if (role === 'shipping_line') return 'shipping_line';
  if (role === 'booking_customer') return 'booking_customer';
  if (role === 'billing' || role === 'invoice_customer') return 'billing';
  if (role === 'trucking') return 'trucking';
  if (role === 'driver') return 'driver';

  return 'customer';
}
