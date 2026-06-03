/**
 * CYMS — Clear Business Data, Preserve Users
 *
 * Clears operational/business data while preserving login accounts, password
 * hashes, roles, permissions, yard access, and core master/config tables.
 *
 * Preview:
 *   node scripts/clear-business-data-preserve-users.js
 *
 * Execute:
 *   node scripts/clear-business-data-preserve-users.js --confirm
 *
 * Optional upload cleanup:
 *   node scripts/clear-business-data-preserve-users.js --confirm --delete-uploads
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const args = new Set(process.argv.slice(2));
const isHelp = args.has('--help') || args.has('-h');
const isConfirmed = args.has('--confirm');
const shouldDeleteUploads = args.has('--delete-uploads');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'CYMS_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
  },
};

const PRESERVED_TABLES = [
  'Users',
  'Roles',
  'Permissions',
  'RolePermissions',
  'UserYardAccess',
  'Yards',
  'YardZones',
  'CompanyProfile',
  'SystemSettings',
  'Customers',
  'CustomerBranches',
  'PrefixMapping',
  'Tariffs',
  'StorageRateTiers',
  'DemurrageRates',
  'DocumentFormats',
  'DocumentTemplates',
  'DocumentTemplateVersions',
  'ISOContainerCodes',
  'CEDEXCodes',
  'EDIEndpoints',
  'EDITemplates',
  'ReeferCheckPolicies',
  'ApprovalHierarchy',
  'SchemaMigrations',
];

// Child/dependent tables first. Missing legacy tables are skipped safely.
const CLEAR_TABLES = [
  { name: 'DocumentPrintSnapshots', label: 'print payload snapshots' },
  { name: 'DocumentPrintLogs', label: 'print/reprint logs' },
  { name: 'BillingPaymentAllocations', label: 'payment allocations' },
  { name: 'BillingStatementLines', label: 'statement lines' },
  { name: 'PaymentReconciliationRows', label: 'payment reconciliation imports' },
  { name: 'PortalDisputes', label: 'customer portal disputes' },
  { name: 'PortalBookingAmendments', label: 'portal booking amendment requests' },
  { name: 'PortalNotificationPreferences', label: 'portal notification preferences' },
  { name: 'PortalEntityAccess', label: 'portal entity grants' },
  { name: 'EIRAccessLog', label: 'EIR view/download logs' },
  { name: 'EntityAttachments', label: 'uploaded attachment records' },
  { name: 'ApprovalReviews', label: 'approval inbox records' },
  { name: 'ReconciliationActions', label: 'reports action-center decisions' },
  { name: 'IntegrationLogs', label: 'integration logs' },
  { name: 'DocumentLifecycle', label: 'document lifecycle events' },
  { name: 'DocumentSequences', label: 'runtime document running numbers' },
  { name: 'EDISendLog', label: 'EDI send logs' },
  { name: 'GateOutRequests', label: 'durable gate-out requests' },
  { name: 'BillingClearances', label: 'gate billing clearance evidence' },
  { name: 'ReeferExceptions', label: 'reefer exception workflow' },
  { name: 'ReeferTemperatureChecks', label: 'reefer temperature checks' },
  { name: 'WorkOrders', label: 'yard work orders' },
  { name: 'MaintenanceRepair', label: 'legacy M&R records' },
  { name: 'RepairOrders', label: 'M&R repair orders' },
  { name: 'ContainerHolds', label: 'container hold/release records' },
  { name: 'BookingContainers', label: 'booking/container links' },
  { name: 'GateTransactions', label: 'gate transactions/EIR source records' },
  { name: 'InvoiceItems', label: 'legacy invoice line items' },
  { name: 'Invoices', label: 'invoices/receipts/credit notes' },
  { name: 'BillingPayments', label: 'billing payment headers' },
  { name: 'BillingStatements', label: 'billing statement headers' },
  { name: 'Bookings', label: 'bookings/manifests' },
  { name: 'Containers', label: 'container inventory' },
  { name: 'AuditLogs', label: 'legacy audit logs table' },
  { name: 'AuditLog', label: 'audit log' },
];

function usage() {
  console.log(`
CYMS — Clear Business Data, Preserve Users

Preview only:
  node scripts/clear-business-data-preserve-users.js

Execute delete:
  node scripts/clear-business-data-preserve-users.js --confirm

Execute delete + remove public/uploads files:
  node scripts/clear-business-data-preserve-users.js --confirm --delete-uploads

Preserved:
  ${PRESERVED_TABLES.join(', ')}

Safety notes:
  - Does not delete Users or password_hash.
  - Does not run seed-users.js.
  - Clears DocumentSequences so document numbers restart after the reset.
  - Take a DB backup and public/uploads backup before using --confirm.
`);
}

function quoteIdent(name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe table name: ${name}`);
  }
  return `[dbo].[${name.replace(/]/g, ']]')}]`;
}

function sqlString(value) {
  return String(value).replace(/'/g, "''");
}

async function tableExists(db, tableName, requestFactory = () => db.request()) {
  const result = await requestFactory()
    .input('tableName', sql.NVarChar, tableName)
    .query(`
      SELECT 1 AS exists_flag
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = @tableName
    `);
  return result.recordset.length > 0;
}

async function countRows(db, tableName, requestFactory = () => db.request()) {
  const result = await requestFactory().query(`SELECT COUNT_BIG(1) AS row_count FROM ${quoteIdent(tableName)}`);
  return Number(result.recordset[0]?.row_count || 0);
}

async function hasIdentity(tableName, requestFactory) {
  const objectName = `dbo.${tableName}`;
  const result = await requestFactory()
    .query(`
      SELECT OBJECTPROPERTY(OBJECT_ID(N'${sqlString(objectName)}'), 'TableHasIdentity') AS has_identity
    `);
  return Number(result.recordset[0]?.has_identity || 0) === 1;
}

async function collectPlan(pool) {
  const rows = [];
  for (const item of CLEAR_TABLES) {
    const exists = await tableExists(pool, item.name);
    if (!exists) {
      rows.push({ ...item, exists: false, count: 0 });
      continue;
    }
    const count = await countRows(pool, item.name);
    rows.push({ ...item, exists: true, count });
  }
  return rows;
}

function printPlan(rows) {
  console.log('');
  console.log('🧹 CYMS — Clear Business Data, Preserve Users');
  console.log('='.repeat(72));
  console.log(`Database: ${config.server}:${config.port}/${config.database}`);
  console.log('');
  console.log('Preserved auth/config tables:');
  console.log(`  ${PRESERVED_TABLES.join(', ')}`);
  console.log('');
  console.log('Tables to clear:');

  let totalRows = 0;
  for (const row of rows) {
    if (!row.exists) {
      console.log(`  - ${row.name.padEnd(32)} skipped (missing)`);
      continue;
    }
    totalRows += row.count;
    console.log(`  - ${row.name.padEnd(32)} ${String(row.count).padStart(8)} rows  ${row.label}`);
  }

  console.log('');
  console.log(`Total rows scheduled for delete: ${totalRows}`);
  console.log('');

  if (!isConfirmed) {
    console.log('Preview only. To execute, run:');
    console.log('  node scripts/clear-business-data-preserve-users.js --confirm');
    console.log('');
  }

  return totalRows;
}

async function clearDatabase(pool, rows) {
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    let totalDeleted = 0;

    for (const row of rows) {
      if (!row.exists) continue;

      const requestFactory = () => new sql.Request(tx);
      const deleteResult = await requestFactory().query(`DELETE FROM ${quoteIdent(row.name)}`);
      const deleted = Number(deleteResult.rowsAffected?.[0] || 0);
      totalDeleted += deleted;
      console.log(`  🗑️  ${row.name.padEnd(32)} deleted ${deleted} rows`);

      if (await hasIdentity(row.name, requestFactory)) {
        await requestFactory().query(`DBCC CHECKIDENT ('dbo.${sqlString(row.name)}', RESEED, 0) WITH NO_INFOMSGS`);
      }
    }

    await tx.commit();
    return totalDeleted;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

function deleteUploads() {
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  const expectedRoot = path.resolve(process.cwd(), 'public');

  if (!uploadsDir.startsWith(expectedRoot + path.sep)) {
    throw new Error(`Refusing to delete unexpected uploads path: ${uploadsDir}`);
  }

  if (!fs.existsSync(uploadsDir)) {
    console.log(`  📁 uploads directory does not exist: ${uploadsDir}`);
    return;
  }

  for (const entry of fs.readdirSync(uploadsDir)) {
    fs.rmSync(path.join(uploadsDir, entry), { recursive: true, force: true });
  }
  console.log(`  📁 cleared files under ${uploadsDir}`);
}

async function run() {
  if (isHelp) {
    usage();
    return;
  }

  let pool;
  try {
    pool = await sql.connect(config);
    const plan = await collectPlan(pool);
    const totalRows = printPlan(plan);

    if (!isConfirmed) return;

    if (totalRows === 0) {
      console.log('Nothing to delete.');
    } else {
      console.log('Executing delete in a single transaction...');
      const totalDeleted = await clearDatabase(pool, plan);
      console.log('');
      console.log(`✅ Database clear complete. Deleted ${totalDeleted} rows.`);
    }

    if (shouldDeleteUploads) {
      console.log('');
      console.log('Clearing public/uploads...');
      deleteUploads();
    } else {
      console.log('');
      console.log('Uploads were not deleted. Add --delete-uploads if you also want to clear files.');
    }

    console.log('');
    console.log('Next steps:');
    console.log('  1. node scripts/migrate-runtime-core-schema.js');
    console.log('  2. Restart the app/dev server');
    console.log('  3. Login with existing Users/passwords');
  } catch (error) {
    console.error('');
    console.error('❌ Clear failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

run();
