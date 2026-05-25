import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');
const migration = fs.readFileSync(
  path.join(repoRoot, 'scripts/migrate-runtime-core-schema.js'),
  'utf8',
);
const setupDb = fs.readFileSync(path.join(repoRoot, 'scripts/setup-db.js'), 'utf8');
const schemaSql = fs.readFileSync(path.join(repoRoot, 'src/lib/schema.sql'), 'utf8');

const schemaMirrors = [
  ['scripts/setup-db.js', setupDb],
  ['src/lib/schema.sql', schemaSql],
] as const;

function expectPortalEntityAccessColumns(source: string) {
  expect(source).toMatch(/CREATE\s+TABLE\s+PortalEntityAccess[\s\S]*permission_scope\s+NVARCHAR\(MAX\)\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+PortalEntityAccess[\s\S]*valid_from\s+DATETIME2\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+PortalEntityAccess[\s\S]*valid_until\s+DATETIME2\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+PortalEntityAccess[\s\S]*updated_at\s+DATETIME2\s+NULL/i);
}

function expectEirAccessLogSchema(source: string) {
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*eir_number\s+NVARCHAR\(80\)\s+NOT\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*gate_transaction_id\s+INT\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*user_id\s+INT\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*customer_id\s+INT\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*view_type\s+NVARCHAR\(40\)\s+NOT\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*action\s+NVARCHAR\(30\)\s+NOT\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*ip_address\s+NVARCHAR\(100\)\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*user_agent\s+NVARCHAR\(500\)\s+NULL/i);
  expect(source).toMatch(/CREATE\s+TABLE\s+EIRAccessLog[\s\S]*accessed_at\s+DATETIME2\s+NOT\s+NULL\s+DEFAULT\s+GETDATE\(\)/i);
  expect(source).toContain('CK_EIRAccessLog_Action');
  expect(source).toContain('IX_EIRAccessLog_EIR');
  expect(source).toContain("'view'");
  expect(source).toContain("'download'");
  expect(source).toContain("'print'");
  expect(source).toContain("'public_verify'");
}

describe('portal access durable schema migration', () => {
  it('adds scoped portal access columns when missing', () => {
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'permission_scope')");
    expect(migration).toMatch(/ALTER\s+TABLE\s+PortalEntityAccess\s+ADD\s+permission_scope\s+NVARCHAR\(MAX\)\s+NULL/i);
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'valid_from')");
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'valid_until')");
    expect(migration).toContain("COL_LENGTH('PortalEntityAccess', 'updated_at')");
    expect(migration).toMatch(/ALTER\s+TABLE\s+PortalEntityAccess\s+ADD\s+updated_at\s+DATETIME2\s+NULL/i);
  });

  it('creates durable EIR access logging with required columns, constraint, and index', () => {
    expect(migration).toContain("OBJECT_ID('EIRAccessLog', 'U')");
    expectEirAccessLogSchema(migration);
  });

  it('adds and backfills customer portal roles for customer users', () => {
    expect(migration).toContain("COL_LENGTH('Users', 'customer_portal_role')");
    expect(migration).toContain('customer_admin');
  });
});

describe.each(schemaMirrors)('%s portal access schema mirror', (_label, source) => {
  it('includes customer portal roles on Users', () => {
    expect(source).toMatch(/CREATE\s+TABLE\s+Users[\s\S]*customer_portal_role\s+NVARCHAR\(40\)\s+NULL/i);
  });

  it('includes scoped PortalEntityAccess columns', () => {
    expectPortalEntityAccessColumns(source);
  });

  it('includes durable EIR access logging', () => {
    expectEirAccessLogSchema(source);
  });
});
