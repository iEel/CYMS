import fs from 'fs';
import path from 'path';

describe('Gate visibility preview', () => {
  it('has an internal preview endpoint using portal grant rules without writing grants', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/visibility-preview/route.ts'), 'utf8');
    expect(route).toContain('buildGatePartyGrants');
    expect(route).toContain('defaultPortalPermissionScope');
    expect(route).not.toContain('applyPortalGrants');
  });

  it('renders Portal Visibility Preview in Gate In', () => {
    const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
    expect(gateIn).toContain('Portal Visibility Preview');
    expect(gateIn).toContain('/api/gate/visibility-preview');
    expect(gateIn).toContain('accessRole');
  });
});
