import {
  normalizeBusinessPartyContext,
  resolveBillingCustomerId,
  validateBusinessPartyInput,
} from '../businessPartyResolver';

describe('business party resolver', () => {
  it('maps legacy customer_id to booking customer and bill-to defaults', () => {
    const context = normalizeBusinessPartyContext({ customer_id: 41 });

    expect(context).toMatchObject({
      legacyCustomerId: 41,
      bookingCustomerId: 41,
      billToCustomerId: 41,
    });
  });

  it('prefers explicit billing party over legacy customer fallback', () => {
    const context = normalizeBusinessPartyContext({
      customer_id: 41,
      billing_customer_id: 88,
      booking_customer_id: 42,
    });

    expect(context.bookingCustomerId).toBe(42);
    expect(context.billToCustomerId).toBe(88);
    expect(resolveBillingCustomerId(context)).toBe(88);
  });

  it('keeps multi-party customer roles separate', () => {
    const context = normalizeBusinessPartyContext({
      shipping_line_id: 1,
      forwarder_id: 2,
      shipper_id: 3,
      consignee_id: 4,
      trucking_company_id: 5,
      container_owner_id: 6,
      bill_to_customer_id: 7,
    });

    expect(context).toMatchObject({
      shippingLineId: 1,
      forwarderId: 2,
      shipperId: 3,
      consigneeId: 4,
      truckingCompanyId: 5,
      containerOwnerId: 6,
      billToCustomerId: 7,
    });
  });

  it('reports invalid party ids before SQL parameter binding', () => {
    const validation = validateBusinessPartyInput({
      customer_id: 'abc',
      billing_customer_id: 1.5,
      trucking_company_id: -2,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      'customer_id ต้องเป็น positive integer',
      'billing_customer_id ต้องเป็น positive integer',
      'trucking_company_id ต้องเป็น positive integer',
    ]));
  });
});
