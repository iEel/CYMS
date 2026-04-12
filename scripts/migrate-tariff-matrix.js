/**
 * Migration: Tariff Matrix — เพิ่ม customer_id + cargo_status ใน StorageRateTiers
 * รันครั้งเดียว: node scripts/migrate-tariff-matrix.js
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

async function migrate() {
  const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: process.env.DB_INSTANCE || undefined,
    },
  };

  try {
    console.log('🔌 Connecting to database...');
    await sql.connect(config);

    // 1. Add customer_id column (NULL = yard default rate)
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StorageRateTiers' AND COLUMN_NAME = 'customer_id')
        ALTER TABLE StorageRateTiers ADD customer_id INT NULL
      `;
      console.log('✅ customer_id column added to StorageRateTiers');
    } catch (e) {
      console.log('⚠️ customer_id column may already exist');
    }

    // 2. Add cargo_status column ('laden', 'empty', 'any')
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StorageRateTiers' AND COLUMN_NAME = 'cargo_status')
        ALTER TABLE StorageRateTiers ADD cargo_status VARCHAR(10) DEFAULT 'any'
      `;
      console.log('✅ cargo_status column added to StorageRateTiers');
    } catch (e) {
      console.log('⚠️ cargo_status column may already exist');
    }

    // 3. Add FK to Customers (if not exists)
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_StorageTiers_Customer')
        ALTER TABLE StorageRateTiers ADD CONSTRAINT FK_StorageTiers_Customer FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
      `;
      console.log('✅ FK constraint added');
    } catch (e) {
      console.log('⚠️ FK constraint may already exist');
    }

    // 4. Update existing rows to have cargo_status = 'any'
    await sql.query`
      UPDATE StorageRateTiers SET cargo_status = 'any' WHERE cargo_status IS NULL
    `;
    console.log('✅ Existing rows updated with cargo_status = any');

    console.log('\n🎉 Tariff Matrix migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
