import fs from 'fs';
import path from 'path';

describe('settings users customer portal role wiring', () => {
  const apiSource = fs.readFileSync(path.join(process.cwd(), 'src/app/api/settings/users/route.ts'), 'utf8');
  const uiSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/UsersSettings.tsx'), 'utf8');
  const permissionsSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/customerPortalPermissions.ts'), 'utf8');

  it('selects and persists Users.customer_portal_role', () => {
    expect(apiSource).toContain('u.customer_portal_role');
    expect(apiSource).toContain('customerPortalRole');
    expect(apiSource).toContain('customer_portal_role = @customerPortalRole');
  });

  it('shows customer portal role selector only for customer users', () => {
    expect(uiSource).toContain('customer_portal_role');
    expect(uiSource).toContain('CUSTOMER_PORTAL_ROLES');
    expect(uiSource).toContain("form.role_code === 'customer'");
  });

  it('includes reefer actions in customer portal roles', () => {
    expect(permissionsSource).toContain("'portal.reefer.view'");
    expect(permissionsSource).toContain("'portal.reefer.download'");
    expect(permissionsSource).toContain("'portal.reefer.exception.view'");
    expect(permissionsSource).toContain("'portal.reefer.exception.dispute'");
    expect(uiSource).toContain('ดูตู้เย็น');
  });
});
