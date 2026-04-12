/**
 * Migration: Prefix Mapping One-to-Many — ลบ UQ_Prefix, เพิ่ม is_primary + UNIQUE(prefix_code, customer_id)
 * รันครั้งเดียว: node scripts/migrate-prefix-multi.js
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

    // 1. Check if PrefixMapping table exists
    const tableCheck = await sql.query`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PrefixMapping'
    `;
    if (tableCheck.recordset.length === 0) {
      console.log('⚠️ PrefixMapping table does not exist yet — will be created by API on first access');
      await sql.close();
      return;
    }

    // 2. Drop the old UNIQUE constraint on prefix_code alone (if exists)
    try {
      // Find the constraint name
      const constraints = await sql.query`
        SELECT name FROM sys.indexes 
        WHERE object_id = OBJECT_ID('PrefixMapping') 
          AND is_unique = 1 
          AND name LIKE '%Prefix%'
      `;
      for (const c of constraints.recordset) {
        console.log(`🗑️ Dropping constraint: ${c.name}`);
        await sql.query(`ALTER TABLE PrefixMapping DROP CONSTRAINT [${c.name}]`);
      }
      // Also try direct name
      await sql.query`
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('PrefixMapping') AND name = 'UQ_Prefix')
        ALTER TABLE PrefixMapping DROP CONSTRAINT UQ_Prefix
      `;
      console.log('✅ Old UQ_Prefix constraint removed');
    } catch (e) {
      console.log('⚠️ UQ_Prefix constraint may not exist:', e.message);
    }

    // 3. Add is_primary column
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PrefixMapping' AND COLUMN_NAME = 'is_primary')
        ALTER TABLE PrefixMapping ADD is_primary BIT DEFAULT 0
      `;
      console.log('✅ is_primary column added');
    } catch (e) {
      console.log('⚠️ is_primary column may already exist');
    }

    // 4. Set existing records as primary (since they were unique before)
    await sql.query`
      UPDATE PrefixMapping SET is_primary = 1 WHERE is_primary IS NULL OR is_primary = 0
    `;
    console.log('✅ Existing prefixes marked as primary');

    // 5. Add new UNIQUE constraint on (prefix_code, customer_id)
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('PrefixMapping') AND name = 'UQ_Prefix_Customer')
        ALTER TABLE PrefixMapping ADD CONSTRAINT UQ_Prefix_Customer UNIQUE (prefix_code, customer_id)
      `;
      console.log('✅ New UNIQUE(prefix_code, customer_id) constraint added');
    } catch (e) {
      console.log('⚠️ UNIQUE constraint may already exist:', e.message);
    }

    console.log('\n🎉 Prefix Mapping One-to-Many migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
