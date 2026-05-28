import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('settings API hardening', () => {
  it.each([
    'src/app/api/settings/allocation-rules/route.ts',
    'src/app/api/settings/company/route.ts',
    'src/app/api/settings/email/route.ts',
    'src/app/api/settings/photo-retention/route.ts',
    'src/app/api/settings/prefix-mapping/route.ts',
    'src/app/api/settings/rate-limit/route.ts',
    'src/app/api/settings/security/route.ts',
    'src/app/api/settings/yards/route.ts',
    'src/app/api/settings/zones/route.ts',
  ])('%s uses settings.manage permission for protected settings operations', (relativePath) => {
    const source = read(relativePath);

    expect(source).toContain('requirePermission');
    expect(source).toContain('settings.manage');
  });

  it('customer portal account creation uses server-side yard_manager role check', () => {
    const source = read('src/app/api/settings/customers/portal/route.ts');

    expect(source).toContain('requireRole');
    expect(source).toContain("'yard_manager'");
    expect(source).not.toContain("request.headers.get('x-user-role')");
  });

  it('security settings audit uses the server-derived actor, not admin_user_id from body', () => {
    const source = read('src/app/api/settings/security/route.ts');

    expect(source).toContain('const actor');
    expect(source).toContain('userId: actor.userId');
    expect(source).not.toMatch(/\badmin_user_id\b/);
  });

  it('photo retention updates parameterize setting values', () => {
    const source = read('src/app/api/settings/photo-retention/route.ts');

    expect(source).toContain(".input('dbKey'");
    expect(source).toContain(".input('value'");
    expect(source).not.toMatch(/USING \(SELECT '\$\{dbKey\}' AS setting_key\)/);
    expect(source).not.toMatch(/SET setting_value = '\$\{value\}'/);
  });
});
