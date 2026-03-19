/**
 * Migration: สร้างตาราง GateTransactions
 * รันครั้งเดียว: node scripts/migrate-gate-transactions.js
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

    // Check if table exists
    const check = await sql.query`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'GateTransactions'
    `;

    if (check.recordset.length > 0) {
      console.log('✅ Table GateTransactions already exists, skipping.');
    } else {
      console.log('📦 Creating GateTransactions table...');
      await sql.query`
        CREATE TABLE GateTransactions (
          transaction_id  INT PRIMARY KEY IDENTITY(1,1),
          container_id    INT REFERENCES Containers(container_id),
          yard_id         INT REFERENCES Yards(yard_id),
          transaction_type NVARCHAR(10) NOT NULL,
          driver_name     NVARCHAR(100),
          driver_license  NVARCHAR(50),
          truck_plate     NVARCHAR(20),
          seal_number     NVARCHAR(50),
          booking_ref     NVARCHAR(50),
          eir_number      NVARCHAR(50),
          notes           NVARCHAR(500),
          damage_report   NVARCHAR(MAX),
          processed_by    INT REFERENCES Users(user_id),
          created_at      DATETIME2 DEFAULT GETDATE()
        )
      `;
      console.log('✅ GateTransactions table created!');
    }

    // Seed EIR document format if not exists
    const fmtCheck = await sql.query`
      SELECT * FROM DocumentFormats WHERE document_type = 'EIR'
    `;
    if (fmtCheck.recordset.length === 0) {
      console.log('📝 Seeding EIR document format...');
      await sql.query`
        INSERT INTO DocumentFormats (document_type, prefix, current_number, year_format, sample_format, yard_id)
        VALUES ('EIR', 'EIR', 0, 'YYYY', 'EIR-IN-2025-000001', 1)
      `;
      console.log('✅ EIR format seeded.');
    }

    console.log('\n🎉 Migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
