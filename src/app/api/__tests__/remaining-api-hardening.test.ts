import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('remaining API permission hardening', () => {
  it('CEDEX catalog requires M&R permissions and audits server actor', () => {
    const source = read('src/app/api/mnr/cedex/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('mnr.cedex.manage');
    expect(source).toContain('mnr.eor.create');
    expect(source).toContain('userId: actor.userId');
  });

  it('shifting plan requires yard movement permission and yard access', () => {
    const source = read('src/app/api/operations/shift/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('yard.slot.move');
    expect(source).toContain('requireYardAccess');
    expect(source).toContain('c.yard_id = @yardId');
  });

  it('photo cleanup requires settings permission and no longer exposes scheduler through public fetch', () => {
    const apiSource = read('src/app/api/settings/photo-retention/cleanup/route.ts');
    const schedulerSource = read('src/lib/photoCleanupScheduler.ts');

    expect(apiSource).toContain('requirePermission');
    expect(apiSource).toContain('settings.manage');
    expect(apiSource).toContain('runPhotoRetentionCleanup');
    expect(schedulerSource).toContain('runPhotoRetentionCleanup');
    expect(schedulerSource).not.toContain('/api/settings/photo-retention/cleanup');
  });

  it('yard audit requires yard operation permissions, yard access, and server actor audit', () => {
    const source = read('src/app/api/yard/audit/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('yard.location.assign');
    expect(source).toContain('requireYardAccess');
    expect(source).toContain('userId: actor.userId');
    expect(source).not.toContain("parseInt(yardId || '1')");
  });

  it('demurrage settings require billing read permissions and settings permission for mutation', () => {
    const source = read('src/app/api/billing/demurrage/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('billing.invoice.create');
    expect(source).toContain('requirePermission');
    expect(source).toContain('settings.manage');
    expect(source).toContain('userId: actor.userId');
  });

  it('document numbering is protected by settings permission', () => {
    const source = read('src/app/api/documents/numbering/route.ts');

    expect(source).toContain('requirePermission');
    expect(source).toContain('settings.manage');
    expect(source).toContain('requireYardAccess');
  });

  it('EDI schedule requires integration/settings permissions and no naked reload endpoint', () => {
    const source = read('src/app/api/edi/schedule/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('integration.logs.view');
    expect(source).toContain('requirePermission');
    expect(source).toContain('settings.manage');
    expect(source).toContain('requireYardAccess');
  });

  it('storage rates require billing/settings permissions and audit with server actor', () => {
    const source = read('src/app/api/settings/storage-rates/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('billing.invoice.create');
    expect(source).toContain('requirePermission');
    expect(source).toContain('settings.manage');
    expect(source).toContain('userId: actor.userId');
  });
});
