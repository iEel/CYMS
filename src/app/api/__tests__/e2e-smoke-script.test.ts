import fs from 'fs';
import path from 'path';

type SmokeHelpers = {
  assertProtectedPageRedirect: (result: { path: string; status: number; location?: string | null }) => void;
};

describe('E2E smoke test script', () => {
  const root = process.cwd();
  const scriptPath = path.join(root, 'scripts/e2e-smoke.mjs');

  function loadSmokeHelpers(): SmokeHelpers {
    const script = fs.readFileSync(scriptPath, 'utf8');
    const match = script.match(/export function assertProtectedPageRedirect\(result\) \{[\s\S]*?\n\}/);
    if (!match) {
      throw new Error('assertProtectedPageRedirect export not found');
    }

    const factory = new Function(
      'baseUrl',
      `${match[0].replace('export function', 'function')}\nreturn { assertProtectedPageRedirect };`,
    ) as (baseUrl: string) => SmokeHelpers;

    return factory('http://localhost:3005');
  }

  it('adds a dependency-free smoke script for the running app', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(pkg.scripts['test:e2e:smoke']).toBe('node scripts/e2e-smoke.mjs');
    expect(script).toContain('CYMS_E2E_BASE_URL');
    expect(script).toContain('/login');
    expect(script).toContain('/manifest.json');
    expect(script).toContain('/api/auth/me');
    expect(script).toContain('/dashboard');
    expect(script).toContain('/eir/');
    expect(script).toContain('/portal/containers');
    expect(script).toContain('/settings?tab=document-templates');
    expect(script).toContain('/billing/print/continuous');
    expect(script).toContain('export function assertProtectedPageRedirect');
    expect(script).toContain('assertStatus(portalContainers, [200, 302, 307, 308])');
    expect(script).toContain('assertStatus(documentTemplates, [200, 302, 307, 308])');
    expect(script).toContain('assertStatus(continuousPrint, [200, 302, 307, 308])');
    expect(script).toContain('assertProtectedPageRedirect(dashboard)');
    expect(script).not.toContain("String(dashboard.location || '').includes('/login')");
  });

  it('accepts protected-page redirects to same-origin login paths', () => {
    const { assertProtectedPageRedirect } = loadSmokeHelpers();

    expect(() =>
      assertProtectedPageRedirect({ path: '/settings', status: 307, location: 'http://localhost:3005/login?next=%2Fsettings' }),
    ).not.toThrow();
    expect(() =>
      assertProtectedPageRedirect({ path: '/settings', status: 307, location: '/login?next=%2Fsettings' }),
    ).not.toThrow();
  });

  it('rejects protected-page redirects to external login paths', () => {
    const { assertProtectedPageRedirect } = loadSmokeHelpers();

    expect(() =>
      assertProtectedPageRedirect({ path: '/settings', status: 307, location: 'https://evil.test/login' }),
    ).toThrow('/settings redirected to unexpected location: https://evil.test/login');
  });

  it('rejects protected-page redirects to same-origin non-auth paths', () => {
    const { assertProtectedPageRedirect } = loadSmokeHelpers();

    expect(() => assertProtectedPageRedirect({ path: '/settings', status: 307, location: '/dashboard' })).toThrow(
      '/settings redirected to unexpected location: /dashboard',
    );
    expect(() => assertProtectedPageRedirect({ path: '/settings', status: 307, location: '/not-login' })).toThrow(
      '/settings redirected to unexpected location: /not-login',
    );
  });

  it('rejects protected-page redirects without a Location header', () => {
    const { assertProtectedPageRedirect } = loadSmokeHelpers();

    expect(() => assertProtectedPageRedirect({ path: '/settings', status: 307, location: null })).toThrow(
      '/settings redirected to missing location',
    );
  });
});
