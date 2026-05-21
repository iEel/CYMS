import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

const yardScopedRoutes = [
  'src/app/api/approval-reviews/route.ts',
  'src/app/api/billing/ar-aging/route.ts',
  'src/app/api/billing/clearance/route.ts',
  'src/app/api/billing/credit-control/route.ts',
  'src/app/api/billing/demurrage/route.ts',
  'src/app/api/billing/erp-export/route.ts',
  'src/app/api/billing/invoices/route.ts',
  'src/app/api/billing/reports/route.ts',
  'src/app/api/containers/route.ts',
  'src/app/api/dashboard/route.ts',
  'src/app/api/documents/numbering/route.ts',
  'src/app/api/edi/codeco/route.ts',
  'src/app/api/edi/schedule/route.ts',
  'src/app/api/gate/route.ts',
  'src/app/api/gate/transfer/route.ts',
  'src/app/api/gate/transfer/receive/route.ts',
  'src/app/api/mnr/route.ts',
  'src/app/api/notifications/route.ts',
  'src/app/api/operations/route.ts',
  'src/app/api/operations/stream/route.ts',
  'src/app/api/reefer/checks/route.ts',
  'src/app/api/reefer/exceptions/route.ts',
  'src/app/api/reefer/policies/route.ts',
  'src/app/api/reports/dwell/route.ts',
  'src/app/api/reports/gate/route.ts',
  'src/app/api/reports/mnr/route.ts',
  'src/app/api/reports/reefer/route.ts',
  'src/app/api/reports/reconciliation/route.ts',
  'src/app/api/search/route.ts',
  'src/app/api/settings/storage-rates/route.ts',
  'src/app/api/yard/audit-log/route.ts',
];

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('yard-scoped API routes enforce server-side yard access', () => {
  it.each(yardScopedRoutes)('%s calls requireYardAccess', (relativePath) => {
    expect(read(relativePath)).toMatch(/\brequireYardAccess\s*\(/);
  });

  it('does not silently default request yard_id to yard 1 in API/lib runtime code', () => {
    const roots = ['src/app/api', 'src/lib'];
    const offenders: string[] = [];

    const visit = (relativeDir: string) => {
      const absoluteDir = path.join(repoRoot, relativeDir);
      for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
        const relativePath = path.join(relativeDir, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') visit(relativePath);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
        const source = read(relativePath);
        if (
          /searchParams\.get\(['"]yard_id['"]\)\s*\|\|\s*['"]1['"]/.test(source) ||
          /searchParams\.get\(['"]yard_id['"]\)\s*\|\|\s*1/.test(source) ||
          /\bbody\.yard_id\s*\|\|\s*1\b/.test(source) ||
          /\bschedule_yard_id\s*\|\|\s*1\b/.test(source)
        ) {
          offenders.push(relativePath);
        }
      }
    };

    roots.forEach(visit);
    expect(offenders).toEqual([]);
  });
});
