/**
 * Migration: Add to_yard_id column to GateTransactions table
 * Run: node scripts/migrate-transfer-yard.js
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

    // Add to_yard_id column
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('GateTransactions') AND name = 'to_yard_id')
        ALTER TABLE GateTransactions ADD to_yard_id INT NULL
      `;
      console.log('  ✅ Column GateTransactions.to_yard_id — ready');
    } catch (err) {
      console.log('  ⚠️ Column to_yard_id:', err.message);
    }

    // Backfill: parse existing transfer notes to set to_yard_id
    try {
      const transfers = await sql.query`
        SELECT transaction_id, notes
        FROM GateTransactions
        WHERE transaction_type = 'transfer' AND to_yard_id IS NULL AND notes IS NOT NULL
      `;

      let updated = 0;
      for (const row of transfers.recordset) {
        try {
          const parsed = JSON.parse(row.notes);
          if (parsed.transfer_to_yard) {
            await sql.query`
              UPDATE GateTransactions
              SET to_yard_id = ${parsed.transfer_to_yard}
              WHERE transaction_id = ${row.transaction_id}
            `;
            updated++;
          }
        } catch { /* notes not JSON, skip */ }
      }
      console.log(`  ✅ Backfilled ${updated} existing transfer records`);
    } catch (err) {
      console.log('  ⚠️ Backfill:', err.message);
    }

    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
