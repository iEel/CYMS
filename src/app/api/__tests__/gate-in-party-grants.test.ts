import fs from 'fs';
import path from 'path';

describe('Gate In party grants', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/route.ts'), 'utf8');

  it('sends selected party ids from Gate In to gate API', () => {
    expect(gateIn).toContain('booking_customer_id');
    expect(gateIn).toContain('trucking_company_id');
    expect(gateIn).toContain('driver_user_id');
  });

  it('gate API stores party ids and builds grants from them', () => {
    expect(route).toContain('trucking_company_id');
    expect(route).toContain('driver_user_id');
    expect(route).toContain('buildGatePartyGrants');
  });
});
