import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('permissions seed sync routing', () => {
  it('keeps GET /api/settings/permissions read-only from RBAC seed sync', () => {
    const source = readSource('src/app/api/settings/permissions/route.ts');
    const getBlock = source.match(/export\s+async\s+function\s+GET[\s\S]*?(?=\/\/ PUT|export\s+async\s+function\s+PUT)/)?.[0] ?? '';

    expect(getBlock).toContain('export async function GET');
    expect(getBlock).not.toContain('syncGranularRbac');
    expect(getBlock).not.toContain('ensureGranularRbac');
  });

  it('exposes an audited yard-manager-only POST sync endpoint', () => {
    const source = readSource('src/app/api/settings/permissions/sync/route.ts');

    expect(source).toContain("requireRole(request, ['yard_manager']");
    expect(source).toContain('syncGranularRbac');
    expect(source).toContain('logAudit');
    expect(source).toContain("action: 'permissions_seed_sync'");
    expect(source).toContain('export async function POST');
  });
});
