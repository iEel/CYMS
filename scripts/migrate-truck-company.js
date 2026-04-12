require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

const cfg = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.DB_INSTANCE },
};

(async () => {
  const pool = await sql.connect(cfg);
  try {
    await pool.request().query("ALTER TABLE GateTransactions ADD truck_company NVARCHAR(100) NULL");
    console.log('✅ truck_company column added to GateTransactions');
  } catch (e) {
    console.log('⏭️ Skip:', e.message);
  }
  pool.close();
})();
