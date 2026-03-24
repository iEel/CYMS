// Migration: Add schedule columns to EDIEndpoints table
const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'CYMS_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.DB_INSTANCE || undefined },
};

async function migrate() {
  const pool = await sql.connect(config);
  console.log('✅ Connected to DB');

  // Add schedule columns to EDIEndpoints
  const columns = [
    { name: 'schedule_enabled', type: 'BIT DEFAULT 0' },
    { name: 'schedule_cron', type: "NVARCHAR(50) DEFAULT '0 18 * * *'" },  // default: daily 18:00
    { name: 'schedule_last_run', type: 'DATETIME2' },
    { name: 'schedule_yard_id', type: 'INT DEFAULT 1' },
  ];

  for (const col of columns) {
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EDIEndpoints' AND COLUMN_NAME = '${col.name}')
        ALTER TABLE EDIEndpoints ADD ${col.name} ${col.type}
      `);
      console.log(`  ✅ Column ${col.name} ready`);
    } catch (e) {
      console.log(`  ⚠️  Column ${col.name}: ${e.message}`);
    }
  }

  console.log('✅ EDIEndpoints schedule columns ready');

  await pool.close();
  console.log('🚀 Migration complete!');
  process.exit(0);
}

migrate().catch(e => { console.error('❌', e); process.exit(1); });
