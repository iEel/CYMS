// Migration: Create EDIEndpoints table for SFTP/API configurations
const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'CYMS_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true, instanceName: process.env.DB_INSTANCE || undefined },
};

async function migrate() {
  const pool = await sql.connect(config);
  console.log('✅ Connected to DB');

  // EDI Endpoints table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EDIEndpoints')
    CREATE TABLE EDIEndpoints (
      endpoint_id     INT IDENTITY(1,1) PRIMARY KEY,
      name            NVARCHAR(100) NOT NULL,
      shipping_line   NVARCHAR(50),
      type            NVARCHAR(10) NOT NULL DEFAULT 'sftp',  -- sftp, ftp, api
      host            NVARCHAR(255) NOT NULL,
      port            INT NOT NULL DEFAULT 22,
      username        NVARCHAR(100),
      password        NVARCHAR(255),
      remote_path     NVARCHAR(255) DEFAULT '/',
      format          NVARCHAR(10) DEFAULT 'EDIFACT',  -- EDIFACT, CSV, JSON
      is_active       BIT DEFAULT 1,
      last_sent_at    DATETIME2,
      last_status     NVARCHAR(50),
      created_at      DATETIME2 DEFAULT GETDATE(),
      updated_at      DATETIME2 DEFAULT GETDATE()
    )
  `);
  console.log('✅ EDIEndpoints table ready');

  // EDI Send Log table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EDISendLog')
    CREATE TABLE EDISendLog (
      log_id          INT IDENTITY(1,1) PRIMARY KEY,
      endpoint_id     INT NOT NULL,
      message_type    NVARCHAR(20) DEFAULT 'CODECO',
      filename        NVARCHAR(255),
      record_count    INT DEFAULT 0,
      status          NVARCHAR(20) DEFAULT 'pending',  -- pending, sent, failed
      error_message   NVARCHAR(MAX),
      sent_at         DATETIME2 DEFAULT GETDATE(),
      FOREIGN KEY (endpoint_id) REFERENCES EDIEndpoints(endpoint_id)
    )
  `);
  console.log('✅ EDISendLog table ready');

  await pool.close();
  console.log('🚀 Migration complete!');
  process.exit(0);
}

migrate().catch(e => { console.error('❌', e); process.exit(1); });
