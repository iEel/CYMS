import fs from 'fs';
import path from 'path';

describe('Gate Out party grants', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
  const types = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/types.ts'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/route.ts'), 'utf8');

  const sliceAfter = (source: string, marker: string, length = 1200) => {
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, start + length);
  };

  it('types expose Gate Out container ownership and booking party fields', () => {
    const containerResult = sliceAfter(types, 'export interface ContainerResult', 900);
    const gateOutBooking = sliceAfter(types, 'export interface GateOutBooking', 1400);

    expect(containerResult).toContain('is_soc?: boolean | number');
    expect(containerResult).toContain('container_owner_id?: number | null');

    [
      'booking_customer_id?: number | null',
      'shipping_line_id?: number | null',
      'forwarder_id?: number | null',
      'shipper_id?: number | null',
      'consignee_id?: number | null',
      'trucking_company_id?: number | null',
      'bill_to_customer_id?: number | null',
      'booking_customer_name?: string | null',
      'shipping_line_name?: string | null',
      'forwarder_name?: string | null',
      'shipper_name?: string | null',
      'consignee_name?: string | null',
      'trucking_company_name?: string | null',
      'bill_to_customer_name?: string | null',
    ].forEach(field => {
      expect(gateOutBooking).toContain(field);
    });
  });

  it('sends resolved Gate Out party ids in the submit body', () => {
    const submitBody = sliceAfter(gateOut, "offlineFetch('/api/gate'", 1600);

    expect(submitBody).toContain('body: JSON.stringify({');
    expect(submitBody).toContain('billing_customer_id: resolvedCustomer?.customer_id || selectedBooking?.bill_to_customer_id || selectedBooking?.booking_customer_id || selectedBooking?.customer_id || undefined');
    expect(submitBody).toContain('container_owner_id: selectedContainer.container_owner_id || billingData?.owner?.customer_id || undefined');
    expect(submitBody).toContain('booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || undefined');
    expect(submitBody).toContain('trucking_company_id: resolvedGateOutTruckingCompanyId || undefined');
    expect(submitBody).toContain('driver_user_id: selectedDriverUserId || undefined');
    expect(gateOut).toContain('/api/settings/customers/drivers');
    expect(gateOut).toContain('setSelectedDriverUserId(null)');
  });

  it('uses booking party model for Gate Out booking compatibility and billing defaults', () => {
    const compatibilityBody = sliceAfter(gateOut, 'const getBookingCompatibility', 1600);
    const applyBody = sliceAfter(gateOut, 'const applyGateOutBooking', 1200);
    const submitBody = sliceAfter(gateOut, "offlineFetch('/api/gate'", 1600);

    expect(compatibilityBody).toContain('const bookingCustomerId = booking.booking_customer_id || booking.customer_id || null');
    expect(compatibilityBody).toContain('const billToCustomerId = booking.bill_to_customer_id || bookingCustomerId');
    expect(compatibilityBody).toContain('container?.container_owner_id');
    expect(compatibilityBody).toContain('billingData?.owner?.customer_id');
    expect(compatibilityBody).toContain('acceptedCustomerIds.size > 0 && bookingCustomerId');
    expect(compatibilityBody).toContain('ลูกค้า Booking ไม่ตรง:');
    expect(compatibilityBody).toContain('Bill To ไม่ตรง:');
    expect(submitBody).toContain('selectedBooking?.bill_to_customer_id || selectedBooking?.booking_customer_id || selectedBooking?.customer_id');

    expect(applyBody).toContain('const bookingBillingCustomerId = booking?.bill_to_customer_id || booking?.booking_customer_id || booking?.customer_id || null');
    expect(applyBody).toContain('if (bookingBillingCustomerId) setManualCustomerId(bookingBillingCustomerId)');
    expect(applyBody).toContain('if (container) await loadGateOutBilling(container, bookingBillingCustomerId || manualCustomerId, bookingRef)');
  });

  it('gate API stores party ids and builds grants from resolved Gate Out ids', () => {
    const insertInputs = sliceAfter(route, "input('bookingCustomerId'", 500);
    const bookingValidation = sliceAfter(route, 'async function validateGateOutBooking', 4200);
    const grantBody = sliceAfter(route, 'buildGatePartyGrants({', 800);

    expect(route).toContain('let resolvedBookingCustomerId = booking_customer_id || null');
    expect(route).toContain('const resolvedBillingCustomerId = billing_customer_id || null');
    expect(route).toContain('const resolvedTruckingCompanyId = trucking_company_id || null');
    expect(route).toContain('const resolvedDriverUserId = driver_user_id || null');
    expect(route).toMatch(/resolvedBookingCustomerId\s*=\s*bookingValidation\.bookingCustomerId\s*\|\|\s*resolvedBookingCustomerId/);
    expect(bookingValidation).toContain('b.bill_to_customer_id');
    expect(bookingValidation).toContain('const bookingCustomerId = booking.booking_customer_id || booking.customer_id || null');
    expect(bookingValidation).toContain('const billToCustomerId = booking.bill_to_customer_id || bookingCustomerId');
    expect(bookingValidation).toContain('const bookingPartyCustomerIds = [bookingCustomerId, billToCustomerId]');
    expect(bookingValidation).toContain('bookingPartyCustomerIds.some(customerId => acceptedCustomerIds.includes(customerId))');
    expect(insertInputs).toContain("input('bookingCustomerId', sql.Int, resolvedBookingCustomerId || null)");
    expect(insertInputs).toContain("input('billingId', sql.Int, resolvedBillingCustomerId)");
    expect(insertInputs).toContain("input('truckingCompanyId', sql.Int, resolvedTruckingCompanyId)");
    expect(insertInputs).toContain("input('driverUserId', sql.Int, resolvedDriverUserId)");
    expect(grantBody).toContain('booking_customer_id: resolvedBookingCustomerId');
    expect(grantBody).toContain('billing_customer_id: resolvedBillingCustomerId');
    expect(grantBody).toContain('trucking_company_id: resolvedTruckingCompanyId');
    expect(grantBody).toContain('driver_user_id: resolvedDriverUserId');
  });
});
