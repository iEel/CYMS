import fs from 'fs';
import path from 'path';

describe('Gate In business context UI', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const bookings = fs.readFileSync(path.join(process.cwd(), 'src/app/api/edi/bookings/route.ts'), 'utf8');

  it('shows a real booking selector and party summary', () => {
    expect(gateIn).toContain('selectedBooking');
    expect(gateIn).toContain('bookingSearchLoading');
    expect(gateIn).toContain('เลือก Booking');
    expect(gateIn).toContain('Booking Customer');
    expect(gateIn).toContain('Container Owner');
    expect(gateIn).toContain('Shipping Line / Container Owner');
    expect(gateIn).toContain('Forwarder');
    expect(gateIn).toContain('Consignee');
    expect(gateIn).toContain('Bill To Customer');
  });

  it('keeps manual booking refs and clears stale booking context', () => {
    expect(gateIn).toContain('clearBookingDerivedContext');
    expect(gateIn).toContain('bookingDerivedContextRef');
    expect(gateIn).toContain('setGateInForm(prev => ({ ...prev, booking_ref');
    expect(gateIn).toContain('ownerSearch');
    expect(gateIn).toContain('setContainerOwnerId(booking.shipping_line_id)');
    expect(gateIn).toContain('onKeyDown');
    expect(gateIn).toContain('bookingSearchError');
    expect(gateIn).toContain('!res.ok');
  });

  it('booking lookup returns party ids and names', () => {
    expect(bookings).toContain('booking_customer_id');
    expect(bookings).toContain('shipping_line_name');
    expect(bookings).toContain('forwarder_name');
    expect(bookings).toContain('bill_to_customer_name');
  });
});
