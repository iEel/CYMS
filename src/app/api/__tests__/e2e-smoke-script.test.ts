import fs from 'fs';
import path from 'path';

describe('E2E smoke test script', () => {
  const root = process.cwd();

  it('adds a dependency-free smoke script for the running app', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const script = fs.readFileSync(path.join(root, 'scripts/e2e-smoke.mjs'), 'utf8');

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
    expect(script).toContain('assertProtectedPageRedirect');
    expect(script).toContain('assertStatus(portalContainers, [200, 302, 307, 308, 401, 403])');
    expect(script).toContain('assertStatus(documentTemplates, [200, 302, 307, 308, 401, 403])');
    expect(script).toContain('assertStatus(continuousPrint, [200, 302, 307, 308, 401, 403])');
  });
});
