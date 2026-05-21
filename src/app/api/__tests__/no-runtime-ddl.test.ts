import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');
const productionRoots = ['src/app/api', 'src/lib'];

const coreApiRoutes = [
  'src/app/api/gate/route.ts',
  'src/app/api/billing/invoices/route.ts',
  'src/app/api/mnr/route.ts',
  'src/app/api/customers/360/route.ts',
  'src/app/api/settings/customers/route.ts',
];

function collectSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return collectSourceFiles(relativePath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    if (relativePath === 'src/lib/schema.sql') return [];
    return [relativePath];
  });
}

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

describe('production runtime source does not own database DDL', () => {
  const runtimeSourceFiles = productionRoots.flatMap(collectSourceFiles);

  it.each(runtimeSourceFiles)('%s has no CREATE/ALTER table statements', (relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

    expect(source).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(source).not.toMatch(/\bALTER\s+TABLE\b/i);
  });
});
