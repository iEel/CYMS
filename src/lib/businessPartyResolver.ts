type PartyField =
  | 'customer_id'
  | 'booking_customer_id'
  | 'billing_customer_id'
  | 'bill_to_customer_id'
  | 'container_owner_id'
  | 'shipping_line_id'
  | 'forwarder_id'
  | 'shipper_id'
  | 'consignee_id'
  | 'trucking_company_id';

const PARTY_FIELDS: PartyField[] = [
  'customer_id',
  'booking_customer_id',
  'billing_customer_id',
  'bill_to_customer_id',
  'container_owner_id',
  'shipping_line_id',
  'forwarder_id',
  'shipper_id',
  'consignee_id',
  'trucking_company_id',
];

export type BusinessPartyInput = Record<string, unknown>;

export type BusinessPartyContext = {
  legacyCustomerId: number | null;
  bookingCustomerId: number | null;
  billToCustomerId: number | null;
  containerOwnerId: number | null;
  shippingLineId: number | null;
  forwarderId: number | null;
  shipperId: number | null;
  consigneeId: number | null;
  truckingCompanyId: number | null;
};

export type BusinessPartyValidation = {
  valid: boolean;
  errors: string[];
};

function read(input: BusinessPartyInput, snakeKey: string, camelKey: string) {
  return input[camelKey] ?? input[snakeKey] ?? null;
}

function toPositiveInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return parsed > 0 ? parsed : null;
  }
  if (typeof value !== 'number') return null;
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function validateBusinessPartyInput(input: BusinessPartyInput): BusinessPartyValidation {
  const errors = PARTY_FIELDS.flatMap((field) => {
    const value = input[field];
    if (value == null || value === '') return [];
    return toPositiveInt(value) ? [] : [`${field} ต้องเป็น positive integer`];
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeBusinessPartyContext(input: BusinessPartyInput): BusinessPartyContext {
  const legacyCustomerId = toPositiveInt(read(input, 'customer_id', 'legacyCustomerId'));
  const bookingCustomerId =
    toPositiveInt(read(input, 'booking_customer_id', 'bookingCustomerId')) ||
    legacyCustomerId;
  const billToCustomerId =
    toPositiveInt(read(input, 'bill_to_customer_id', 'billToCustomerId')) ||
    toPositiveInt(read(input, 'billing_customer_id', 'billingCustomerId')) ||
    legacyCustomerId;

  return {
    legacyCustomerId,
    bookingCustomerId,
    billToCustomerId,
    containerOwnerId: toPositiveInt(read(input, 'container_owner_id', 'containerOwnerId')),
    shippingLineId: toPositiveInt(read(input, 'shipping_line_id', 'shippingLineId')),
    forwarderId: toPositiveInt(read(input, 'forwarder_id', 'forwarderId')),
    shipperId: toPositiveInt(read(input, 'shipper_id', 'shipperId')),
    consigneeId: toPositiveInt(read(input, 'consignee_id', 'consigneeId')),
    truckingCompanyId: toPositiveInt(read(input, 'trucking_company_id', 'truckingCompanyId')),
  };
}

export function resolveBillingCustomerId(context: BusinessPartyContext): number | null {
  return context.billToCustomerId || context.bookingCustomerId || context.legacyCustomerId;
}
