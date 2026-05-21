import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

const coreApiRoutes = [
  'src/app/api/gate/route.ts',
  'src/app/api/billing/invoices/route.ts',
  'src/app/api/mnr/route.ts',
  'src/app/api/customers/360/route.ts',
  'src/app/api/settings/customers/route.ts',
];

describe('core API routes do not run schema migrations at request time', () => {
  it.each(coreApiRoutes)('%s has no DDL statements or schema-probing guards', (relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

    expect(source).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(source).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(source).not.toMatch(/\bCOL_LENGTH\s*\(/i);
    expect(source).not.toMatch(/\bsys\.columns\b/i);
    expect(source).not.toMatch(/\bINFORMATION_SCHEMA\.COLUMNS\b/i);
  });
});
