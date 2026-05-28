import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');
const schema = fs.readFileSync(path.join(repoRoot, 'src/lib/schema.sql'), 'utf8');
const migration = fs.readFileSync(path.join(repoRoot, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

function getSchemaMigrationsBlock(source: string) {
  const match = source.match(/CREATE\s+TABLE\s+SchemaMigrations\s*\([\s\S]*?\);/i);
  expect(match).not.toBeNull();
  return match?.[0] ?? '';
}

function expectLedgerShape(source: string) {
  const block = getSchemaMigrationsBlock(source);

  expect(block).toMatch(/migration_key\s+NVARCHAR\(150\)\s+NOT\s+NULL\s+PRIMARY\s+KEY/i);
  expect(block).toMatch(/migration_name\s+NVARCHAR\(255\)\s+NOT\s+NULL/i);
  expect(block).toMatch(/checksum\s+NVARCHAR\(128\)\s+NULL/i);
  expect(block).toMatch(/applied_at\s+DATETIME2\s+NOT\s+NULL(?:\s+CONSTRAINT\s+\w+)?\s+DEFAULT\s+SYSUTCDATETIME\(\)/i);
  expect(block).toMatch(/applied_by\s+NVARCHAR\(100\)\s+NULL/i);
  expect(block).toMatch(/status\s+NVARCHAR\(30\)\s+NOT\s+NULL(?:\s+CONSTRAINT\s+\w+)?\s+DEFAULT\s+'applied'/i);
}

describe('runtime schema migration ledger', () => {
  it('declares SchemaMigrations with the canonical ledger shape', () => {
    expect(schema).toMatch(/CREATE\s+TABLE\s+SchemaMigrations/i);
    expectLedgerShape(schema);
  });

  it('creates SchemaMigrations with the same ledger shape in the runtime migration script', () => {
    expect(migration).toMatch(/CREATE\s+TABLE\s+SchemaMigrations/i);
    expectLedgerShape(migration);
  });

  it('records the runtime core migration by migration key', () => {
    expect(migration).toContain('SchemaMigrations');
    expect(migration).toContain('migration_key');
  });
});
