import fs from 'fs';
import path from 'path';

describe('Booking business relationship UI', () => {
  const bookingPage = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/booking/page.tsx'), 'utf8');
  const bookingRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/edi/bookings/route.ts'), 'utf8');

  it('renders business relationship labels on the create booking page', () => {
    expect(bookingPage).toContain('Business Relationship');
    expect(bookingPage).toContain('Booking Customer');
    expect(bookingPage).toContain('Shipping Line / Container Owner');
    expect(bookingPage).toContain('Forwarder');
    expect(bookingPage).toContain('Shipper');
    expect(bookingPage).toContain('Consignee');
    expect(bookingPage).toContain('Trucking Company');
    expect(bookingPage).toContain('Bill To Customer');
  });

  it('submits explicit party ids for booking access context', () => {
    expect(bookingPage).toContain('booking_customer_id: createForm.booking_customer_id || undefined');
    expect(bookingPage).toContain('shipping_line_id: createForm.shipping_line_id || undefined');
    expect(bookingPage).toContain('forwarder_id: createForm.forwarder_id || undefined');
    expect(bookingPage).toContain('shipper_id: createForm.shipper_id || undefined');
    expect(bookingPage).toContain('consignee_id: createForm.consignee_id || undefined');
    expect(bookingPage).toContain('trucking_company_id: createForm.trucking_company_id || undefined');
    expect(bookingPage).toContain('bill_to_customer_id: createForm.bill_to_customer_id || createForm.booking_customer_id || undefined');
  });

  it('keeps bill-to customer synced while it is still booking-customer derived', () => {
    expect(bookingPage).toContain('bill_to_customer_id: !prev.bill_to_customer_id || prev.bill_to_customer_id === prev.booking_customer_id ? value : prev.bill_to_customer_id');
  });

  it('booking API route exposes party names for existing lookups', () => {
    expect(bookingRoute).toContain('booking_customer_name');
    expect(bookingRoute).toContain('shipping_line_name');
    expect(bookingRoute).toContain('forwarder_name');
    expect(bookingRoute).toContain('shipper_name');
    expect(bookingRoute).toContain('consignee_name');
    expect(bookingRoute).toContain('trucking_company_name');
    expect(bookingRoute).toContain('bill_to_customer_name');
  });

  it('paginated booking list uses bookingSummarySelect so party names are returned', () => {
    const paginatedListQuery = bookingRoute.match(/const result = await reqData\.query\(`([\s\S]*?)`\);/);

    expect(paginatedListQuery?.[1]).toContain('SELECT ${bookingSummarySelect()}');
    expect(paginatedListQuery?.[1]).toContain('${bookingPartyJoins()}');
    expect(paginatedListQuery?.[1]).toMatch(/ORDER\s+BY\s+b\.created_at\s+DESC/);
    expect(paginatedListQuery?.[1]).toMatch(/OFFSET\s+@offset\s+ROWS\s+FETCH\s+NEXT\s+@limit\s+ROWS\s+ONLY/);
  });

  it('bookingSummarySelect preserves legacy booking fields used by list and detail UI', () => {
    const summarySelect = bookingRoute.match(/function bookingSummarySelect\(\) \{\s*return `([\s\S]*?)`;\s*\}/);

    [
      'b.yard_id',
      'b.eta',
      'b.valid_from',
      'b.valid_to',
      'b.seal_number',
      'b.notes',
      'b.created_by_customer_user_id',
      'b.created_at',
      'b.updated_at',
    ].forEach(field => {
      expect(summarySelect?.[1]).toContain(field);
    });
  });
});
