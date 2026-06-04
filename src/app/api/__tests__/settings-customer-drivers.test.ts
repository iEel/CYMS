import fs from 'fs';
import path from 'path';

describe('settings customer driver lookup API', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/settings/customers/drivers/route.ts');
  const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf8') : '';

  it('lists active driver portal users for a selected trucking company only', () => {
    expect(route).toContain('export async function GET');
    expect(route).toContain('requireAnyPermission');
    expect(route).toContain('trucking_company_id');
    expect(route).toContain(".input('truckingCompanyId', sql.Int, truckingCompanyId)");
    expect(route).toContain("u.customer_portal_role = 'driver_user'");
    expect(route).toContain("r.role_code = 'customer'");
    expect(route).toContain("u.status = 'active'");
    expect(route).toContain('u.customer_id = @truckingCompanyId');
    expect(route).toContain('ORDER BY u.full_name, u.username');
  });
});
