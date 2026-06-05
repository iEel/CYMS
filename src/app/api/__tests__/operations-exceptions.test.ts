import fs from 'fs';
import path from 'path';
import { PERMISSION_SEEDS, ROLE_GRANTS } from '@/lib/rbacSeeds';

const root = process.cwd();

describe('Operational exception center RBAC', () => {
  it('seeds dedicated operations exception permissions and role grants', () => {
    const permissionsByCode = new Map(PERMISSION_SEEDS.map(permission => [permission.code, permission]));

    expect(permissionsByCode.get('operations.exceptions.view')).toMatchObject({
      module: 'operations',
      action: 'exceptions_view',
      description: 'ดูศูนย์รวม exception งานปฏิบัติการ',
    });
    expect(permissionsByCode.get('operations.exceptions.manage')).toMatchObject({
      module: 'operations',
      action: 'exceptions_manage',
      description: 'มอบหมาย รับทราบ ปิด หรือ ignore exception งานปฏิบัติการ',
      risk: 'medium',
    });

    expect(ROLE_GRANTS.supervisor).toEqual(expect.arrayContaining([
      'operations.exceptions.view',
      'operations.exceptions.manage',
    ]));
    expect(ROLE_GRANTS.yard_manager).toEqual(expect.arrayContaining([
      'operations.exceptions.view',
      'operations.exceptions.manage',
    ]));
    for (const roleCode of ['yard_planner', 'billing_officer', 'surveyor']) {
      expect(ROLE_GRANTS[roleCode]).toContain('operations.exceptions.view');
    }
  });

  it('backfills dedicated operations exception permissions for the expected role groups', () => {
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    expect(migration).toMatch(
      /r\.role_code IN \('yard_manager', 'supervisor'\)\s+AND p\.permission_code = 'operations\.exceptions\.manage'/
    );
    expect(migration).toMatch(
      /r\.role_code IN \('yard_manager', 'supervisor', 'surveyor', 'yard_planner', 'billing_officer'\)\s+AND p\.permission_code = 'operations\.exceptions\.view'/
    );
  });

  it('lets the Operations menu appear for exception-center-only users', () => {
    const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(sidebar).toContain('operations.exceptions.view');
    expect(sidebar).toContain('billing_officer');
    expect(sidebar).toContain('yard.slot.move');
    expect(sidebar).toContain('yard.location.assign');
    expect(sidebar).toContain("href: '/operations'");
  });
});
