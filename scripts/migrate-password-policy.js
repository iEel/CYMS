/**
 * Migration: Add password policy & account lockout columns to Users table
 * Run: node scripts/migrate-password-policy.js
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

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

async function migrate() {
  const pool = await sql.connect(config);
  console.log('✅ Connected to DB');

  // 1. Add columns to Users table
  const columns = [
    { name: 'failed_login_count', type: 'INT DEFAULT 0' },
    { name: 'locked_at', type: 'DATETIME2 NULL' },
    { name: 'password_changed_at', type: 'DATETIME2 NULL' },
  ];

  for (const col of columns) {
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = '${col.name}')
        ALTER TABLE Users ADD ${col.name} ${col.type}
      `);
      console.log(`  ✅ Column Users.${col.name} — ready`);
    } catch (err) {
      console.log(`  ⚠️ Column Users.${col.name}:`, err.message);
    }
  }

  // 2. Ensure SystemSettings table exists
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings')
      CREATE TABLE SystemSettings (
        setting_key   NVARCHAR(100) PRIMARY KEY,
        setting_value NVARCHAR(MAX),
        updated_at    DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('  ✅ SystemSettings table — ready');
  } catch (err) {
    console.log('  ⚠️ SystemSettings:', err.message);
  }

  // 3. Seed default password_policy if not exists
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM SystemSettings WHERE setting_key = 'password_policy')
      INSERT INTO SystemSettings (setting_key, setting_value) VALUES (
        'password_policy',
        '${JSON.stringify({
          min_length: 8,
          require_uppercase: true,
          require_lowercase: true,
          require_number: true,
          require_special: true,
          max_login_attempts: 5,
          lockout_duration_min: 30
        })}'
      )
    `);
    console.log('  ✅ Default password_policy seeded');
  } catch (err) {
    console.log('  ⚠️ password_policy seed:', err.message);
  }

  await pool.close();
  console.log('\\n🎉 Migration complete!');
  process.exit(0);
}

migrate().catch(err => { console.error('❌ Migration failed:', err); process.exit(1); });
