import fs from 'fs';
import path from 'path';

describe('Gate visibility preview', () => {
  it('has an internal preview endpoint using portal grant rules without writing grants', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/visibility-preview/route.ts'), 'utf8');
    expect(route).toContain('buildGatePartyGrants');
    expect(route).toContain('buildBookingPartyGrants');
    expect(route).toContain('requireAnyPermission');
    expect(route).toContain('requireYardAccess');
    expect(route).toContain("'gate.in'");
    expect(route).toContain("'gate.out'");
    expect(route).toContain('defaultPortalPermissionScope');
    expect(route).toContain('try');
    expect(route).toContain('invalid_request');
    expect(route).toContain('container_number_required');
    expect(route).toContain('positiveIntOrNull(body.yard_id)');
    expect(route).toContain('@yardId');
    expect(route).toContain('positiveIntOrNull(body.booking_id)');
    expect(route).toContain('@bookingId');
    expect(route).toContain('FROM Bookings');
    expect(route).toContain('AND yard_id = @yardId');
    expect(route).toContain('Customers');
    expect(route).toContain('customerName');
    expect(route).toContain('positiveIntOrNull');
    expect(route).toContain("typeof value === 'number'");
    expect(route).toContain('Number.isSafeInteger(value)');
    expect(route).toContain("typeof value === 'string'");
    expect(route).toContain('/^[1-9]\\d*$/');
    expect(route).not.toContain('applyPortalGrants');
  });

  it('renders Portal Visibility Preview in Gate In', () => {
    const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
    expect(gateIn).toContain('Portal Visibility Preview');
    expect(gateIn).toContain('/api/gate/visibility-preview');
    expect(gateIn).toContain('yard_id: yardId');
    expect(gateIn).toContain('booking_id: selectedBooking?.booking_id || null');
    expect(gateIn).toContain('accessRole');
    expect(gateIn).toContain('customerName?: string | null');
    expect(gateIn).toContain('row.customerName || `Customer #${row.customerId}`');
    expect(gateIn).toContain('visibilityPreviewError');
    expect(gateIn).toContain('containerValid !== true');
    expect(gateIn).toContain('normalizedContainerNumber.length !== 11');
    expect(gateIn).toContain('Visibility preview unavailable');
  });
});
