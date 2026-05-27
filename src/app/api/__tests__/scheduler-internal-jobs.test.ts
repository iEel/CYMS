import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('scheduler internal jobs', () => {
  it('booking scheduler calls the internal summary job instead of the protected local API', () => {
    const scheduler = read('src/lib/bookingScheduler.ts');
    const route = read('src/app/api/cron/booking-summary/route.ts');
    const helper = read('src/lib/bookingSummaryJob.ts');

    expect(scheduler).toContain('runBookingSummaryJob');
    expect(scheduler).not.toContain('/api/cron/booking-summary');
    expect(scheduler).not.toContain('localhost');

    expect(route).toContain('requirePermission');
    expect(route).toContain('settings.manage');
    expect(route).toContain('runBookingSummaryJob');

    expect(helper).toContain('export async function runBookingSummaryJob');
    expect(helper).not.toContain('NextResponse');
    expect(helper).not.toContain('requirePermission');
  });

  it('EDI scheduler calls the internal CODECO job instead of the protected local API', () => {
    const scheduler = read('src/lib/ediScheduler.ts');
    const route = read('src/app/api/edi/codeco/send/route.ts');
    const helper = read('src/lib/codecoSendJob.ts');

    expect(scheduler).toContain('runCodecoSendJob');
    expect(scheduler).not.toContain('/api/edi/codeco/send');
    expect(scheduler).not.toContain('localhost');

    expect(route).toContain('requirePermission');
    expect(route).toContain('integration.send');
    expect(route).toContain('requireYardAccess');
    expect(route).toContain('runCodecoSendJob');

    expect(helper).toContain('export async function runCodecoSendJob');
    expect(helper).not.toContain('NextResponse');
    expect(helper).not.toContain('requirePermission');
    expect(helper).not.toContain('requireYardAccess');
  });
});
