import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Operational exception center RBAC', () => {
  it('seeds dedicated operations exception permissions', () => {
    const seeds = fs.readFileSync(path.join(root, 'src/lib/rbacSeeds.ts'), 'utf8');
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    expect(seeds).toContain('operations.exceptions.view');
    expect(seeds).toContain('operations.exceptions.manage');
    expect(migration).toContain('operations.exceptions.view');
    expect(migration).toContain('operations.exceptions.manage');
  });

  it('lets the Operations menu appear for exception-center-only users', () => {
    const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(sidebar).toContain('operations.exceptions.view');
    expect(sidebar).toContain("href: '/operations'");
  });
});
