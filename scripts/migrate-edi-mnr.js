/**
 * Migration: สร้างตาราง Bookings + RepairOrders
 * รันครั้งเดียว: node scripts/migrate-edi-mnr.js
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

    // === Bookings Table ===
    const check1 = await sql.query`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Bookings'`;
    if (check1.recordset.length > 0) {
      console.log('✅ Table Bookings already exists, skipping.');
    } else {
      console.log('📦 Creating Bookings table...');
      await sql.query`
        CREATE TABLE Bookings (
          booking_id      INT PRIMARY KEY IDENTITY(1,1),
          booking_number  NVARCHAR(50) UNIQUE NOT NULL,
          yard_id         INT REFERENCES Yards(yard_id),
          customer_id     INT REFERENCES Customers(customer_id),
          booking_type    NVARCHAR(20) NOT NULL,
          vessel_name     NVARCHAR(100),
          voyage_number   NVARCHAR(50),
          container_count INT DEFAULT 1,
          container_size  NVARCHAR(5),
          container_type  NVARCHAR(10),
          eta             DATETIME2,
          status          NVARCHAR(20) DEFAULT 'pending',
          seal_number     NVARCHAR(50),
          notes           NVARCHAR(500),
          created_at      DATETIME2 DEFAULT GETDATE()
        )
      `;
      console.log('✅ Bookings table created!');
    }

    // === RepairOrders Table ===
    const check2 = await sql.query`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RepairOrders'`;
    if (check2.recordset.length > 0) {
      console.log('✅ Table RepairOrders already exists, skipping.');
    } else {
      console.log('📦 Creating RepairOrders table...');
      await sql.query`
        CREATE TABLE RepairOrders (
          eor_id          INT PRIMARY KEY IDENTITY(1,1),
          eor_number      NVARCHAR(50) UNIQUE,
          container_id    INT REFERENCES Containers(container_id),
          yard_id         INT REFERENCES Yards(yard_id),
          customer_id     INT REFERENCES Customers(customer_id),
          damage_details  NVARCHAR(MAX),
          estimated_cost  DECIMAL(12,2) DEFAULT 0,
          actual_cost     DECIMAL(12,2),
          status          NVARCHAR(20) DEFAULT 'draft',
          approved_by     NVARCHAR(100),
          approved_at     DATETIME2,
          created_by      INT REFERENCES Users(user_id),
          created_at      DATETIME2 DEFAULT GETDATE()
        )
      `;
      console.log('✅ RepairOrders table created!');
    }

    console.log('\n🎉 Migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
