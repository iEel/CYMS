/**
 * Migration: Customer Portal
 * เพิ่ม customer_id ใน Users + is_portal_enabled ใน Customers
 */
const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true },
};

async function migrate() {
  const pool = await sql.connect(config);
  console.log('🔧 Customer Portal Migration...\n');

  // 1. Add customer_id to Users
  try {
    const check1 = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'customer_id'
    `);
    if (check1.recordset.length === 0) {
      await pool.request().query(`ALTER TABLE Users ADD customer_id INT NULL`);
      await pool.request().query(`
        ALTER TABLE Users ADD CONSTRAINT FK_Users_Customer
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id)
      `);
      console.log('  ✅ Users.customer_id added');
    } else {
      console.log('  ℹ️ Users.customer_id already exists');
    }
  } catch (err) {
    console.error('  ❌ Users.customer_id error:', err.message);
  }

  // 2. Add is_portal_enabled to Customers
  try {
    const check2 = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Customers' AND COLUMN_NAME = 'is_portal_enabled'
    `);
    if (check2.recordset.length === 0) {
      await pool.request().query(`ALTER TABLE Customers ADD is_portal_enabled BIT DEFAULT 0`);
      console.log('  ✅ Customers.is_portal_enabled added');
    } else {
      console.log('  ℹ️ Customers.is_portal_enabled already exists');
    }
  } catch (err) {
    console.error('  ❌ Customers.is_portal_enabled error:', err.message);
  }

  // 3. Ensure 'customer' role exists
  try {
    const check3 = await pool.request().query(`
      SELECT role_id FROM Roles WHERE role_code = 'customer'
    `);
    if (check3.recordset.length === 0) {
      await pool.request().query(`
        INSERT INTO Roles (role_code, role_name, description)
        VALUES ('customer', 'ลูกค้า', 'Customer Portal — ดูสถานะตู้ + Invoice ของตัวเอง')
      `);
      console.log('  ✅ customer role created');
    } else {
      console.log('  ℹ️ customer role already exists');
    }
  } catch (err) {
    console.error('  ❌ customer role error:', err.message);
  }

  console.log('\n✅ Migration complete');
  await pool.close();
  process.exit(0);
}

migrate().catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
