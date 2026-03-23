// Migration: Create DemurrageRates table
// Run: node scripts/migrate-demurrage.js

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
    const pool = await sql.connect(config);

    // Create DemurrageRates table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DemurrageRates' AND xtype='U')
      CREATE TABLE DemurrageRates (
        demurrage_id    INT PRIMARY KEY IDENTITY(1,1),
        yard_id         INT NOT NULL REFERENCES Yards(yard_id),
        customer_id     INT REFERENCES Customers(customer_id),
        charge_type     NVARCHAR(20) NOT NULL DEFAULT 'demurrage',
        free_days       INT DEFAULT 7,
        rate_20         DECIMAL(12,2) DEFAULT 0,
        rate_40         DECIMAL(12,2) DEFAULT 0,
        rate_45         DECIMAL(12,2) DEFAULT 0,
        description     NVARCHAR(200),
        is_active       BIT DEFAULT 1,
        created_at      DATETIME2 DEFAULT GETDATE(),
        updated_at      DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('✅ DemurrageRates table created');

    // Insert default rates
    const existing = await pool.request().query('SELECT COUNT(*) as cnt FROM DemurrageRates');
    if (existing.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO DemurrageRates (yard_id, charge_type, free_days, rate_20, rate_40, rate_45, description)
        VALUES 
          (1, 'demurrage', 7, 500, 800, 900, N'ค่า Demurrage มาตรฐาน (หลัง 7 วัน)'),
          (1, 'detention', 14, 300, 500, 600, N'ค่า Detention มาตรฐาน (หลัง 14 วัน)')
      `);
      console.log('✅ Default demurrage rates inserted');
    }

    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
