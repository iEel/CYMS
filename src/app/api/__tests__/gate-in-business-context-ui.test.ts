import fs from 'fs';
import path from 'path';

describe('Gate In business context UI', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const bookings = fs.readFileSync(path.join(process.cwd(), 'src/app/api/edi/bookings/route.ts'), 'utf8');

  it('shows a real booking selector and party summary', () => {
    expect(gateIn).toContain('selectedBooking');
    expect(gateIn).toContain('เลือก Booking');
    expect(gateIn).toContain('Booking Customer');
    expect(gateIn).toContain('Forwarder');
    expect(gateIn).toContain('Consignee');
    expect(gateIn).toContain('Bill To Customer');
  });

  it('booking lookup returns party ids and names', () => {
    expect(bookings).toContain('booking_customer_id');
    expect(bookings).toContain('shipping_line_name');
    expect(bookings).toContain('forwarder_name');
    expect(bookings).toContain('bill_to_customer_name');
  });
});
