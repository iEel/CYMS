import fs from 'fs';
import path from 'path';

describe('Gate In party grants', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/route.ts'), 'utf8');

  it('sends selected party ids from Gate In submit body to gate API', () => {
    expect(gateIn).toContain('booking_customer_id: selectedBooking?.booking_customer_id || selectedBooking?.customer_id || manualCustomerId || undefined');
    expect(gateIn).toContain('trucking_company_id: resolvedTruckingCompanyId || undefined');
    expect(gateIn).toContain('driver_user_id: undefined');
  });

  it('uses the same resolved trucking company id for preview and submit', () => {
    expect(gateIn).toContain('const resolvedTruckingCompanyId = useMemo');
    expect(gateIn).toContain("customerList.find(c => c.customer_name === gateInForm.truck_company)?.customer_id || null");
    expect(gateIn).toContain('trucking_company_id: resolvedTruckingCompanyId || null');
    expect(gateIn).toContain('trucking_company_id: resolvedTruckingCompanyId || undefined');
  });

  it('gate API stores party ids and builds grants from resolved ids', () => {
    expect(route).toContain('const resolvedTruckingCompanyId = trucking_company_id || null');
    expect(route).toContain('const resolvedDriverUserId = driver_user_id || null');
    expect(route).toContain(".input('truckingCompanyId', sql.Int, resolvedTruckingCompanyId)");
    expect(route).toContain(".input('driverUserId', sql.Int, resolvedDriverUserId)");
    expect(route).toContain('trucking_company_id: resolvedTruckingCompanyId');
    expect(route).toContain('driver_user_id: resolvedDriverUserId');
    expect(route).toContain('buildGatePartyGrants');
  });
});
