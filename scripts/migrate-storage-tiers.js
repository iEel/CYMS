/**
 * Migration: Create StorageRateTiers table
 * Run: node scripts/migrate-storage-tiers.js
 */
const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'CYMS_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
  },
};

async function migrate() {
  const pool = await sql.connect(config);
  console.log('✅ Connected to DB');

  // Create StorageRateTiers table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StorageRateTiers' AND xtype='U')
    CREATE TABLE StorageRateTiers (
      tier_id       INT PRIMARY KEY IDENTITY(1,1),
      yard_id       INT NOT NULL REFERENCES Yards(yard_id),
      tier_name     NVARCHAR(100) NOT NULL,
      from_day      INT NOT NULL DEFAULT 1,
      to_day        INT NOT NULL DEFAULT 999,
      rate_20       DECIMAL(12,2) NOT NULL DEFAULT 0,
      rate_40       DECIMAL(12,2) NOT NULL DEFAULT 0,
      rate_45       DECIMAL(12,2) NOT NULL DEFAULT 0,
      applies_to    NVARCHAR(20) NOT NULL DEFAULT 'all',
      sort_order    INT NOT NULL DEFAULT 0,
      is_active     BIT NOT NULL DEFAULT 1,
      created_at    DATETIME2 DEFAULT GETDATE(),
      updated_at    DATETIME2 DEFAULT GETDATE()
    )
  `);
  console.log('✅ StorageRateTiers table created');

  // Insert default tiers for yard 1
  const existing = await pool.request().query('SELECT COUNT(*) as cnt FROM StorageRateTiers');
  if (existing.recordset[0].cnt === 0) {
    await pool.request().query(`
      INSERT INTO StorageRateTiers (yard_id, tier_name, from_day, to_day, rate_20, rate_40, rate_45, sort_order) VALUES
      (1, 'Free Period',    1,  3,    0,    0,    0, 1),
      (1, 'Standard Rate',  4,  7,  150,  250,  300, 2),
      (1, 'Extended Rate',  8, 14,  250,  400,  500, 3),
      (1, 'Penalty Rate',  15, 999, 500,  800, 1000, 4)
    `);
    console.log('✅ Default tiers inserted');
  }

  await pool.close();
  console.log('✅ Migration complete');
  process.exit(0);
}

migrate().catch(err => { console.error('❌', err); process.exit(1); });
