/**
 * Migration: สร้างตาราง Tariffs + Invoices
 * รันครั้งเดียว: node scripts/migrate-billing.js
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

    // === Tariffs Table ===
    const check1 = await sql.query`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tariffs'`;
    if (check1.recordset.length > 0) {
      console.log('✅ Table Tariffs already exists, skipping.');
    } else {
      console.log('📦 Creating Tariffs table...');
      await sql.query`
        CREATE TABLE Tariffs (
          tariff_id       INT PRIMARY KEY IDENTITY(1,1),
          yard_id         INT REFERENCES Yards(yard_id),
          charge_type     NVARCHAR(20) NOT NULL,
          description     NVARCHAR(200),
          rate            DECIMAL(12,2) NOT NULL,
          unit            NVARCHAR(20) NOT NULL,
          free_days       INT DEFAULT 0,
          customer_id     INT REFERENCES Customers(customer_id),
          is_active       BIT DEFAULT 1,
          created_at      DATETIME2 DEFAULT GETDATE()
        )
      `;
      console.log('✅ Tariffs table created!');
    }

    // === Invoices Table ===
    const check2 = await sql.query`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Invoices'`;
    if (check2.recordset.length > 0) {
      console.log('✅ Table Invoices already exists, skipping.');
    } else {
      console.log('📦 Creating Invoices table...');
      await sql.query`
        CREATE TABLE Invoices (
          invoice_id      INT PRIMARY KEY IDENTITY(1,1),
          invoice_number  NVARCHAR(50) UNIQUE NOT NULL,
          yard_id         INT REFERENCES Yards(yard_id),
          customer_id     INT REFERENCES Customers(customer_id),
          container_id    INT REFERENCES Containers(container_id),
          charge_type     NVARCHAR(20) NOT NULL,
          description     NVARCHAR(200),
          quantity        DECIMAL(10,2) DEFAULT 1,
          unit_price      DECIMAL(12,2) NOT NULL,
          total_amount    DECIMAL(12,2) NOT NULL,
          vat_amount      DECIMAL(12,2) DEFAULT 0,
          grand_total     DECIMAL(12,2) NOT NULL,
          status          NVARCHAR(20) DEFAULT 'draft',
          due_date        DATETIME2,
          paid_at         DATETIME2,
          notes           NVARCHAR(500),
          created_at      DATETIME2 DEFAULT GETDATE()
        )
      `;
      console.log('✅ Invoices table created!');
    }

    // === Add hold_status to Containers if not exists ===
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Containers' AND COLUMN_NAME = 'hold_status')
        ALTER TABLE Containers ADD hold_status NVARCHAR(30) NULL
      `;
      console.log('✅ hold_status column checked/added to Containers');
    } catch (e) {
      console.log('⚠️ hold_status column may already exist');
    }

    console.log('\n🎉 Migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
