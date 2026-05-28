import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');
const schema = fs.readFileSync(path.join(repoRoot, 'src/lib/schema.sql'), 'utf8');
const migration = fs.readFileSync(path.join(repoRoot, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

describe('runtime schema migration ledger', () => {
  it('declares SchemaMigrations in the canonical schema', () => {
    expect(schema).toMatch(/CREATE\s+TABLE\s+SchemaMigrations/i);
  });

  it('records the runtime core migration by migration key', () => {
    expect(migration).toContain('SchemaMigrations');
    expect(migration).toContain('migration_key');
  });
});
