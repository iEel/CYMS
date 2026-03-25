// Migration: Create BookingContainers table + Add columns to Bookings
// Run: node scripts/migrate-booking-containers.js

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

    // 1. Create BookingContainers junction table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BookingContainers' AND xtype='U')
      CREATE TABLE BookingContainers (
        id                INT PRIMARY KEY IDENTITY(1,1),
        booking_id        INT NOT NULL REFERENCES Bookings(booking_id),
        container_id      INT NULL REFERENCES Containers(container_id),
        container_number  NVARCHAR(20),
        status            NVARCHAR(20) DEFAULT 'pending',
        gate_in_at        DATETIME2 NULL,
        gate_out_at       DATETIME2 NULL,
        created_at        DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('✅ BookingContainers table created');

    // 2. Add new columns to Bookings (if not exist)
    const columns = [
      { name: 'valid_from', type: 'DATETIME2 NULL' },
      { name: 'valid_to', type: 'DATETIME2 NULL' },
      { name: 'received_count', type: 'INT DEFAULT 0' },
      { name: 'released_count', type: 'INT DEFAULT 0' },
    ];

    for (const col of columns) {
      const exists = await pool.request().query(`
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = '${col.name}'
      `);
      if (exists.recordset.length === 0) {
        await pool.request().query(`ALTER TABLE Bookings ADD ${col.name} ${col.type}`);
        console.log(`✅ Added Bookings.${col.name}`);
      } else {
        console.log(`⏭️ Bookings.${col.name} already exists`);
      }
    }

    console.log('\n🎉 Booking migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
