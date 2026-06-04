import fs from 'fs';
import path from 'path';

describe('Gate In party grants', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/route.ts'), 'utf8');

  const sliceAfter = (source: string, marker: string, length = 1200) => {
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, start + length);
  };

  it('sends selected party ids from Gate In submit body to gate API', () => {
    const submitBody = sliceAfter(gateIn, "offlineFetch('/api/gate'");
    expect(submitBody).toContain('body: JSON.stringify({');
    expect(submitBody).toContain('...gateInForm');
    expect(submitBody).toContain('booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || manualCustomerId || undefined');
    expect(submitBody).toContain('trucking_company_id: resolvedTruckingCompanyId || undefined');
    expect(submitBody).toContain('driver_user_id: selectedDriverUserId || undefined');
    expect(gateIn).toContain('/api/settings/customers/drivers');
    expect(gateIn).toContain('setSelectedDriverUserId(null)');
  });

  it('uses the same resolved trucking company id for preview and submit', () => {
    const resolver = sliceAfter(gateIn, 'const resolvedTruckingCompanyId = useMemo', 400);
    const previewBody = sliceAfter(gateIn, "fetch('/api/gate/visibility-preview'");
    expect(resolver).toContain("customerList.find(c => c.customer_name === gateInForm.truck_company)?.customer_id || null");
    expect(previewBody).toContain('body: JSON.stringify({');
    expect(previewBody).toContain('trucking_company_id: resolvedTruckingCompanyId || null');
  });

  it('gate API stores party ids and builds grants from resolved ids', () => {
    const insertInputs = sliceAfter(route, "input('bookingCustomerId'", 500);
    const grantBody = sliceAfter(route, 'buildGatePartyGrants({', 700);
    expect(route).toContain('const resolvedTruckingCompanyId = trucking_company_id || null');
    expect(route).toContain('const resolvedDriverUserId = driver_user_id || null');
    expect(insertInputs).toContain(".input('truckingCompanyId', sql.Int, resolvedTruckingCompanyId)");
    expect(insertInputs).toContain(".input('driverUserId', sql.Int, resolvedDriverUserId)");
    expect(grantBody).toContain('trucking_company_id: resolvedTruckingCompanyId');
    expect(grantBody).toContain('driver_user_id: resolvedDriverUserId');
  });
});
