import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');
const migration = fs.readFileSync(
  path.join(repoRoot, 'scripts/migrate-runtime-core-schema.js'),
  'utf8',
);

describe('portal access durable schema migration', () => {
  it('adds scoped portal access columns when missing', () => {
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'permission_scope')");
    expect(migration).toMatch(/ALTER\s+TABLE\s+PortalEntityAccess\s+ADD\s+permission_scope\s+NVARCHAR\(MAX\)\s+NULL/i);
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'valid_from')");
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'valid_until')");
  });

  it('creates durable EIR access logging with public verification action support', () => {
    expect(migration).toContain("OBJECT_ID('EIRAccessLog', 'U')");
    expect(migration).toMatch(/CREATE\s+TABLE\s+EIRAccessLog/i);
    expect(migration).toContain('public_verify');
  });

  it('adds and backfills customer portal roles for customer users', () => {
    expect(migration).toContain("COL_LENGTH('Users', 'customer_portal_role')");
    expect(migration).toContain('customer_admin');
  });
});
