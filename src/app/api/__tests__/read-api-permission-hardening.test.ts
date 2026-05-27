import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

const sensitiveReadRoutes = [
  'src/app/api/audit-trail/readable/route.ts',
  'src/app/api/boxtech/route.ts',
  'src/app/api/containers/detail/route.ts',
  'src/app/api/containers/timeline/route.ts',
  'src/app/api/customers/360/route.ts',
  'src/app/api/dashboard/route.ts',
  'src/app/api/documents/activity/route.ts',
  'src/app/api/documents/consistency/route.ts',
  'src/app/api/documents/lifecycle/route.ts',
  'src/app/api/entity-timeline/route.ts',
  'src/app/api/integrations/logs/route.ts',
  'src/app/api/integrations/mapping/route.ts',
  'src/app/api/mnr/eor-pdf/route.ts',
  'src/app/api/operations/stream/route.ts',
  'src/app/api/reports/dwell/route.ts',
  'src/app/api/reports/gate/route.ts',
  'src/app/api/reports/mnr/route.ts',
  'src/app/api/search/route.ts',
  'src/app/api/settings/data-quality/route.ts',
  'src/app/api/settings/sop/route.ts',
  'src/app/api/settings/status-model/route.ts',
  'src/app/api/yard/stats/route.ts',
];

describe('sensitive read APIs require route-level authorization', () => {
  it.each(sensitiveReadRoutes)('%s uses a server-side permission or role guard', (relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    expect(source).toMatch(/\b(requirePermission|requireAnyPermission|requireRole)\s*\(/);
  });
});
