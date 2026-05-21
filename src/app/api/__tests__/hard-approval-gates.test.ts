import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

const hardApprovalRoutes = [
  'src/app/api/billing/clearance/route.ts',
  'src/app/api/billing/invoices/route.ts',
  'src/app/api/containers/route.ts',
  'src/app/api/gate/route.ts',
];

describe('risky API actions use hard approval gates', () => {
  it.each(hardApprovalRoutes)('%s calls requireApprovalForAction', (relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    expect(source).toMatch(/\brequireApprovalForAction\s*\(/);
  });
});
