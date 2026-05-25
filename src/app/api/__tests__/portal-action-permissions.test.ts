import fs from 'fs';
import path from 'path';

const root = process.cwd();

const expectations: Array<[string, string]> = [
  ['src/app/api/portal/invoices/route.ts', 'portal.invoice.view'],
  ['src/app/api/portal/invoice-pdf/route.ts', 'portal.invoice.download'],
  ['src/app/api/portal/document-bundle/route.ts', 'portal.document.download'],
  ['src/app/api/portal/disputes/route.ts', 'portal.dispute.create'],
  ['src/app/api/portal/bookings/route.ts', 'portal.booking.view'],
  ['src/app/api/portal/bookings/route.ts', 'portal.booking.create'],
  ['src/app/api/portal/bookings/detail/route.ts', 'portal.booking.view'],
  ['src/app/api/portal/bookings/documents/route.ts', 'portal.document.download'],
  ['src/app/api/portal/bookings/amendments/route.ts', 'portal.booking.view'],
  ['src/app/api/portal/bookings/amendments/route.ts', 'portal.booking.create'],
  ['src/app/api/portal/statement/route.ts', 'portal.invoice.view'],
  ['src/app/api/portal/reefer/route.ts', 'portal.container.view'],
];

describe('portal route action permissions', () => {
  it.each(expectations)('%s checks %s', (file, action) => {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    expect(src).toContain('requirePortalAction');
    expect(src).toContain(action);
  });
});
