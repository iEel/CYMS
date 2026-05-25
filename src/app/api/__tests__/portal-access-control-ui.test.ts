import fs from 'fs';
import path from 'path';

describe('portal access control UI', () => {
  const settingsPage = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/page.tsx'), 'utf8');

  it('adds a settings tab for portal access control', () => {
    expect(settingsPage).toContain('Portal Access');
    expect(settingsPage).toContain('PortalAccessControl');
  });

  it('has admin grants list API', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/portal/grants/route.ts'), 'utf8');
    expect(route).toContain('PortalEntityAccess');
    expect(route).toContain('requireRole');
    expect(route).toContain('yard_manager');
  });

  it('has field scope toggle and reconcile controls in UI', () => {
    const ui = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/PortalAccessControl.tsx'), 'utf8');
    expect(ui).toContain('/api/portal/grants/reconcile');
    expect(ui).toContain('/api/portal/grants/field-scope');
    expect(ui).toContain('แสดงเกรดตู้ใน EIR ให้ลูกค้า');
  });
});
