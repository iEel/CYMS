import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('Transport smoke runner script', () => {
  it('adds package scripts for seeding and running the transport smoke', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(pkg.scripts['seed:transport-smoke']).toBe('node scripts/seed-transport-smoke.js --confirm');
    expect(pkg.scripts['test:e2e:transport']).toBe('node scripts/e2e-transport-smoke.mjs');
  });

  it('uses the smoke fixture and exercises only transport APIs', () => {
    const source = read('scripts/e2e-transport-smoke.mjs');

    expect(source).toContain('CYMS_E2E_BASE_URL');
    expect(source).toContain("require('./transport-smoke-fixture.cjs')");
    expect(source).toContain('/api/auth/login');
    expect(source).toContain('/api/auth/me');
    expect(source).toContain('/api/transport/capabilities');
    expect(source).toContain('/api/transport/jobs');
    expect(source).toContain('/api/transport/actions');
    expect(source).toContain('/api/transport/activity');
    expect(source).toContain('confirm_job');
    expect(source).toContain('add_proof');
    expect(source).toContain('report_issue');
    expect(source).toContain('mark_arrived');
    expect(source).toContain('request-');
    expect(source).not.toContain('/api/billing');
    expect(source).not.toContain('/api/gate/eir');
    expect(source).not.toContain('/api/containers');
  });

  it('preserves session cookies between transport smoke requests', () => {
    const source = read('scripts/e2e-transport-smoke.mjs');

    expect(source).toContain('set-cookie');
    expect(source).toContain('cookie');
    expect(source).toContain('sessionCookie');
    expect(source).toContain('cookie: sessionCookie');
  });
});
