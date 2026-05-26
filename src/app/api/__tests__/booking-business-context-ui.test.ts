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

  it('maps booking import party id columns and includes them in the template before vessel fields', () => {
    const mapRowBody = bookingPage.match(/const mapRow = \(row: Record<string, string>\) => \{([\s\S]*?)\n  \};/)?.[1];
    const templateHeaders = bookingPage.match(/const headers = \[([\s\S]*?)\];/)?.[1];

    [
      "booking_customer_id: Number(get('booking_customer_id', 'booking_customer')) || undefined",
      "shipping_line_id: Number(get('shipping_line_id', 'shipping_line')) || undefined",
      "forwarder_id: Number(get('forwarder_id', 'forwarder')) || undefined",
      "shipper_id: Number(get('shipper_id', 'shipper')) || undefined",
      "consignee_id: Number(get('consignee_id', 'consignee')) || undefined",
      "trucking_company_id: Number(get('trucking_company_id', 'trucking_company')) || undefined",
      "bill_to_customer_id: Number(get('bill_to_customer_id', 'bill_to_customer')) || undefined",
    ].forEach(columnMapper => {
      expect(mapRowBody).toContain(columnMapper);
    });

    expect(templateHeaders).toMatch(
      /'booking_number', 'booking_type', 'booking_customer_id', 'shipping_line_id', 'forwarder_id', 'shipper_id', 'consignee_id', 'trucking_company_id', 'bill_to_customer_id', 'vessel_name', 'voyage_number'/
    );
  });

  it('template sample rows include complete customer party ids and column guidance', () => {
    const templateBlock = bookingPage.match(/const downloadTemplate = \(\) => \{([\s\S]*?)\n  \};/)?.[1];

    expect(templateBlock).toContain("[101, 201, 301, 401, 501, 601, 101");
    expect(templateBlock).toContain("[102, 202, 302, 402, 502, 602, 102");
    expect(templateBlock).toContain("const guideRows = [");
    expect(templateBlock).toContain("ใช้ customer_id จากหน้า ตั้งค่าระบบ > ลูกค้า");
    expect(templateBlock).toContain("XLSX.utils.book_append_sheet(wb, guideWs, 'Column Guide')");
  });

  it('upload helper copy lists the business relationship columns, not only the legacy booking fields', () => {
    expect(bookingPage).toContain('booking_customer_id, shipping_line_id, forwarder_id, shipper_id, consignee_id, trucking_company_id, bill_to_customer_id');
    expect(bookingPage).toContain('ใช้ customer_id จากหน้า ตั้งค่าระบบ > ลูกค้า');
  });

  it('keeps bill-to customer synced while it is still booking-customer derived', () => {
    expect(bookingPage).toContain('bill_to_customer_id: !prev.bill_to_customer_id || prev.bill_to_customer_id === prev.booking_customer_id ? value : prev.bill_to_customer_id');
  });

  it('uses searchable customer comboboxes for business relationship party selection', () => {
    expect(bookingPage).toContain('function CustomerCombobox');
    expect(bookingPage).toContain('role="combobox"');
    expect(bookingPage).toContain('aria-expanded={open}');
    expect(bookingPage).toContain('const filteredOptions = options.filter');
    expect(bookingPage).toContain('customerRoleSummary(customer)');
    expect(bookingPage).toContain('กดพิมพ์เพื่อค้นหาบริษัท');
    expect(bookingPage).not.toContain('const PartySelect =');
    expect(bookingPage).not.toContain('<PartySelect');
  });

  it('customer search uses id, code, name, tax id, and role metadata', () => {
    expect(bookingPage).toContain('customer.customer_id.toString()');
    expect(bookingPage).toContain('customer.customer_code');
    expect(bookingPage).toContain('customer.tax_id');
    expect(bookingPage).toContain('customerRoleSummary(customer)');
    expect(bookingPage).toContain('onKeyDown={handleKeyDown}');
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
