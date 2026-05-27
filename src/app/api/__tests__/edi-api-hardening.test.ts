import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('EDI and booking API hardening', () => {
  it('booking container links require booking permission and yard access', () => {
    const source = read('src/app/api/bookings/containers/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('booking.manage');
    expect(source).toContain('requireYardAccess');
    expect(source).toContain('loadBookingForAccess');
  });

  it('staff booking API requires booking permission and yard access', () => {
    const source = read('src/app/api/edi/bookings/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('booking.manage');
    expect(source).toContain('requireYardAccess');
    expect(source).toContain('userId: actor.userId');
  });

  it.each([
    'src/app/api/edi/endpoints/route.ts',
    'src/app/api/edi/templates/route.ts',
  ])('%s requires settings permission and uses server-derived audit actor', (relativePath) => {
    const source = read(relativePath);

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('settings.manage');
    expect(source).toContain('userId: actor.userId');
    expect(source).not.toContain('userId: null');
    expect(source).not.toContain('yardId: 1');
  });

  it('EDI validation requires gate or booking permission plus yard access', () => {
    const source = read('src/app/api/edi/validate/route.ts');

    expect(source).toContain('requireAnyPermission');
    expect(source).toContain('gate.in');
    expect(source).toContain('booking.manage');
    expect(source).toContain('requireYardAccess');
  });

  it('CODECO send requires integration send permission, yard access, and actor audit', () => {
    const source = read('src/app/api/edi/codeco/send/route.ts');

    expect(source).toContain('requirePermission');
    expect(source).toContain('integration.send');
    expect(source).toContain('requireYardAccess');
    expect(source).toContain('userId: actor.userId');
    expect(source).not.toContain('yard_id || 1');
    expect(source).not.toContain('userId: null');
  });

  it('CODECO send log read requires integration log permission', () => {
    const source = read('src/app/api/edi/codeco/send/route.ts');

    expect(source).toContain('integration.logs.view');
  });
});
