import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

describe('E2E smoke test script', () => {
  const root = process.cwd();
  const scriptPath = path.join(root, 'scripts/e2e-smoke.mjs');

  function runImportedHelperCase(result: { path: string; status: number; location?: string | null }) {
    const code = `
      globalThis.fetch = () => {
        throw new Error('import performed network call');
      };
      const imported = await import(${JSON.stringify(pathToFileURL(scriptPath).href)});
      if (typeof imported.assertProtectedPageRedirect !== 'function') {
        throw new Error('assertProtectedPageRedirect export is not a function');
      }
      imported.assertProtectedPageRedirect(${JSON.stringify(result)});
    `;

    execFileSync(process.execPath, ['--input-type=module', '--eval', code], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  function expectImportedHelperRejection(result: { path: string; status: number; location?: string | null }, message: string) {
    try {
      runImportedHelperCase(result);
      throw new Error('Expected imported smoke helper to reject');
    } catch (error) {
      const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
      expect(stderr).toContain(message);
    }
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
    expect(() =>
      runImportedHelperCase({ path: '/settings', status: 307, location: 'http://localhost:3005/login?next=%2Fsettings' }),
    ).not.toThrow();
    expect(() => runImportedHelperCase({ path: '/settings', status: 307, location: '/login?next=%2Fsettings' })).not.toThrow();
  });

  it('rejects protected-page redirects to external login paths', () => {
    expectImportedHelperRejection(
      { path: '/settings', status: 307, location: 'https://evil.test/login' },
      '/settings redirected to unexpected location: https://evil.test/login',
    );
  });

  it('rejects protected-page redirects to same-origin non-auth paths', () => {
    expectImportedHelperRejection(
      { path: '/settings', status: 307, location: '/dashboard' },
      '/settings redirected to unexpected location: /dashboard',
    );
    expectImportedHelperRejection(
      { path: '/settings', status: 307, location: '/not-login' },
      '/settings redirected to unexpected location: /not-login',
    );
  });

  it('rejects protected-page redirects without a Location header', () => {
    expectImportedHelperRejection(
      { path: '/settings', status: 307, location: null },
      '/settings redirected to missing location',
    );
  });
});
