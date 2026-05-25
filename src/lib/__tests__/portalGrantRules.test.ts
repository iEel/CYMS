import {
  applyPortalGrants,
  buildBookingContainerGrants,
  buildBookingPartyGrants,
  buildGatePartyGrants,
  buildInvoicePartyGrants,
  defaultPortalPermissionScope,
} from '../portalGrantRules';
import { upsertPortalEntityAccess } from '../portalEntityAccess';

jest.mock('../portalEntityAccess', () => ({
  upsertPortalEntityAccess: jest.fn(),
}));

const mockedUpsertPortalEntityAccess = upsertPortalEntityAccess as jest.Mock;

describe('portal grant rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds booking customer and optional party grants for a booking', () => {
    const grants = buildBookingPartyGrants({
      booking_id: 10,
      booking_number: 'BK-10',
      customer_id: 41,
      shipping_line_id: 42,
      forwarder_id: 43,
      shipper_id: 44,
      consignee_id: 45,
      trucking_company_id: 46,
      bill_to_customer_id: 47,
    });

    expect(grants).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerId: 41, accessRole: 'booking_customer', entityType: 'booking' }),
      expect.objectContaining({ customerId: 42, accessRole: 'shipping_line', entityType: 'booking' }),
      expect.objectContaining({ customerId: 43, accessRole: 'forwarder', entityType: 'booking' }),
      expect.objectContaining({ customerId: 44, accessRole: 'shipper', entityType: 'booking' }),
      expect.objectContaining({ customerId: 45, accessRole: 'consignee', entityType: 'booking' }),
      expect.objectContaining({ customerId: 46, accessRole: 'trucking', entityType: 'booking' }),
      expect.objectContaining({ customerId: 47, accessRole: 'billing', entityType: 'booking' }),
    ]));
    expect(grants).toHaveLength(7);
  });

  it('prefers booking_customer_id over customer_id and propagates booking parties to containers', () => {
    const grants = buildBookingContainerGrants(
      {
        booking_id: 10,
        booking_number: 'BK-10',
        customer_id: 41,
        booking_customer_id: 99,
        shipping_line_id: 42,
      },
      {
        id: 700,
        container_id: 30,
        container_number: 'MSKU1234567',
      },
    );

    expect(grants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        customerId: 99,
        entityType: 'container',
        entityId: 30,
        entityRef: 'MSKU1234567',
        accessRole: 'booking_customer',
        sourceTable: 'BookingContainers',
        sourceId: 700,
      }),
      expect.objectContaining({
        customerId: 42,
        entityType: 'container',
        accessRole: 'shipping_line',
      }),
    ]));
    expect(grants.map((grant) => grant.customerId)).not.toContain(41);
  });

  it('builds gate, eir, and container grants for gate parties', () => {
    const grants = buildGatePartyGrants({
      transaction_id: 77,
      eir_number: 'EIR-IN-77',
      container_id: 30,
      container_number: 'MSKU1234567',
      container_owner_id: 41,
      booking_customer_id: 42,
      billing_customer_id: 43,
      trucking_company_id: 44,
      driver_user_id: 45,
      valid_until: '2026-05-26T00:00:00.000Z',
    });

    for (const entityType of ['gate_transaction', 'eir', 'container']) {
      expect(grants).toEqual(expect.arrayContaining([
        expect.objectContaining({ customerId: 41, entityType, accessRole: 'owner' }),
        expect.objectContaining({ customerId: 42, entityType, accessRole: 'booking_customer' }),
        expect.objectContaining({ customerId: 43, entityType, accessRole: 'billing' }),
        expect.objectContaining({ customerId: 44, entityType, accessRole: 'trucking' }),
        expect.objectContaining({ customerId: 45, entityType, accessRole: 'driver' }),
      ]));
    }
    expect(grants).toHaveLength(15);
    expect(grants.filter((grant) => grant.accessRole === 'driver')).toEqual(
      expect.arrayContaining([expect.objectContaining({ validUntil: '2026-05-26T00:00:00.000Z' })]),
    );
  });

  it('scopes portal permissions by role', () => {
    const driverScope = defaultPortalPermissionScope('driver');
    const billingScope = defaultPortalPermissionScope('billing');
    const internalScope = defaultPortalPermissionScope('internal');

    expect(driverScope).toMatchObject({
      view: true,
      download: false,
      billing: { view: false, dispute: false },
      eir: {
        fields: { container_grade: false },
        damage_summary: true,
        damage_photos: false,
      },
      maskSensitiveFields: true,
    });
    expect(billingScope).toMatchObject({
      download: true,
      billing: { view: true, dispute: true },
      eir: { damage_photos: true },
      maskSensitiveFields: true,
    });
    expect(internalScope.maskSensitiveFields).toBe(false);
  });

  it('only creates invoice grants for the bill-to invoice customer', () => {
    const grants = buildInvoicePartyGrants({
      invoice_id: 300,
      invoice_number: 'INV-300',
      customer_id: 41,
      bill_to_customer_id: 42,
      container_owner_id: 43,
      trucking_company_id: 44,
      driver_user_id: 45,
      container_id: 30,
    });

    expect(grants).toEqual([
      expect.objectContaining({
        customerId: 42,
        entityType: 'invoice',
        accessRole: 'invoice_customer',
        sourceTable: 'Invoices',
        sourceId: 300,
      }),
    ]);
    expect(grants.some((grant) => grant.entityType === 'container')).toBe(false);
    expect(grants.map((grant) => grant.customerId)).not.toEqual(expect.arrayContaining([43, 44, 45]));
  });

  it('applies grants through the existing safe upsert and ignores empty lists', async () => {
    const db = { request: jest.fn() };
    await applyPortalGrants(db, []);
    expect(mockedUpsertPortalEntityAccess).not.toHaveBeenCalled();

    await applyPortalGrants(db, [{
      customerId: 42,
      entityType: 'booking',
      entityId: 10,
      accessRole: 'booking_customer',
      sourceTable: 'Bookings',
    }]);

    expect(mockedUpsertPortalEntityAccess).toHaveBeenCalledWith(expect.objectContaining({
      db,
      customerId: 42,
      entityType: 'booking',
      entityId: 10,
      accessRole: 'booking_customer',
      sourceTable: 'Bookings',
      permissionScope: expect.objectContaining({ view: true }),
    }));
  });
});
