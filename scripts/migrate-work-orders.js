/**
 * Migration: สร้างตาราง WorkOrders
 * รันครั้งเดียว: node scripts/migrate-work-orders.js
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

    const check = await sql.query`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'WorkOrders'
    `;

    if (check.recordset.length > 0) {
      console.log('✅ Table WorkOrders already exists, skipping.');
    } else {
      console.log('📦 Creating WorkOrders table...');
      await sql.query`
        CREATE TABLE WorkOrders (
          order_id       INT PRIMARY KEY IDENTITY(1,1),
          yard_id        INT REFERENCES Yards(yard_id),
          order_type     NVARCHAR(20) NOT NULL,
          container_id   INT REFERENCES Containers(container_id),
          from_zone_id   INT,
          from_bay       INT,
          from_row       INT,
          from_tier      INT,
          to_zone_id     INT,
          to_bay         INT,
          to_row         INT,
          to_tier        INT,
          priority       INT DEFAULT 3,
          status         NVARCHAR(20) DEFAULT 'pending',
          assigned_to    INT REFERENCES Users(user_id),
          notes          NVARCHAR(500),
          created_by     INT REFERENCES Users(user_id),
          started_at     DATETIME2,
          completed_at   DATETIME2,
          created_at     DATETIME2 DEFAULT GETDATE()
        )
      `;
      console.log('✅ WorkOrders table created!');
    }

    console.log('\n🎉 Migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
