/**
 * Migration: GateTransactions — เพิ่ม container_owner_id + billing_customer_id + Containers.is_soc
 * รันครั้งเดียว: node scripts/migrate-gate-owner.js
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

    // 1. Add container_owner_id to GateTransactions
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'GateTransactions' AND COLUMN_NAME = 'container_owner_id')
        ALTER TABLE GateTransactions ADD container_owner_id INT NULL
      `;
      console.log('✅ container_owner_id added to GateTransactions');
    } catch (e) {
      console.log('⚠️ container_owner_id may already exist');
    }

    // 2. Add billing_customer_id to GateTransactions
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'GateTransactions' AND COLUMN_NAME = 'billing_customer_id')
        ALTER TABLE GateTransactions ADD billing_customer_id INT NULL
      `;
      console.log('✅ billing_customer_id added to GateTransactions');
    } catch (e) {
      console.log('⚠️ billing_customer_id may already exist');
    }

    // 3. Add FK constraints
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_GateTx_Owner')
        ALTER TABLE GateTransactions ADD CONSTRAINT FK_GateTx_Owner FOREIGN KEY (container_owner_id) REFERENCES Customers(customer_id)
      `;
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_GateTx_Billing')
        ALTER TABLE GateTransactions ADD CONSTRAINT FK_GateTx_Billing FOREIGN KEY (billing_customer_id) REFERENCES Customers(customer_id)
      `;
      console.log('✅ FK constraints added');
    } catch (e) {
      console.log('⚠️ FK constraints may already exist');
    }

    // 4. Add is_soc to Containers
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Containers' AND COLUMN_NAME = 'is_soc')
        ALTER TABLE Containers ADD is_soc BIT DEFAULT 0
      `;
      console.log('✅ is_soc added to Containers');
    } catch (e) {
      console.log('⚠️ is_soc may already exist');
    }

    // 5. Add container_owner_id to Containers (persistent owner reference)
    try {
      await sql.query`
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Containers' AND COLUMN_NAME = 'container_owner_id')
        ALTER TABLE Containers ADD container_owner_id INT NULL
      `;
      console.log('✅ container_owner_id added to Containers');
    } catch (e) {
      console.log('⚠️ container_owner_id on Containers may already exist');
    }

    console.log('\n🎉 Gate Owner/Billing migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
