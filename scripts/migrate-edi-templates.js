// Migration: Create EDITemplates table + seed defaults + add template_id to EDIEndpoints
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

const DEFAULT_FIELDS = JSON.stringify({
  fields: [
    { source: 'container_number', header: 'CONTAINER NO', enabled: true },
    { source: 'transaction_type', header: 'MOVE TYPE', enabled: true },
    { source: 'eir_number', header: 'EIR', enabled: true },
    { source: 'transaction_date', header: 'DATE', enabled: true },
    { source: 'size', header: 'SIZE', enabled: true },
    { source: 'container_type', header: 'TYPE', enabled: true },
    { source: 'shipping_line', header: 'SHIPPING LINE', enabled: true },
    { source: 'is_laden', header: 'F/E', format: 'laden_fe', enabled: true },
    { source: 'seal_number', header: 'SEAL', enabled: true },
    { source: 'truck_plate', header: 'TRUCK', enabled: true },
    { source: 'truck_company', header: 'TRUCK COMPANY', enabled: true },
    { source: 'driver_name', header: 'DRIVER', enabled: true },
    { source: 'booking_ref', header: 'BOOKING', enabled: true },
    { source: 'container_grade', header: 'GRADE', enabled: true },
    { source: 'condition', header: 'CONDITION', enabled: true },
    { source: 'yard_code', header: 'YARD', enabled: true },
  ],
});

const DEFAULT_REQUIRED_FIELDS = JSON.stringify([
  'container_number',
  'transaction_type',
  'eir_number',
  'transaction_date',
  'size',
  'container_type',
  'shipping_line',
  'yard_code',
]);

const DEFAULT_EDIFACT_CONFIG = JSON.stringify({
  bgm_code: '36',
  gate_in_function: '34',
  gate_out_function: '36',
  location_qualifier: '89',
  include_driver: true,
  include_booking: true,
  include_truck_company: false,
  include_grade: false,
  include_condition: false,
});

async function migrate() {
  const pool = await sql.connect(config);
  console.log('✅ Connected to DB');

  // 1. Create EDITemplates table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EDITemplates')
    CREATE TABLE EDITemplates (
      template_id     INT IDENTITY(1,1) PRIMARY KEY,
      template_name   NVARCHAR(100) NOT NULL,
      base_format     NVARCHAR(20) NOT NULL DEFAULT 'csv',
      description     NVARCHAR(500),
      field_mapping   NVARCHAR(MAX),
      required_fields NVARCHAR(MAX),
      csv_delimiter   NVARCHAR(5) DEFAULT ',',
      csv_headers     NVARCHAR(MAX),
      date_format     NVARCHAR(50) DEFAULT 'DD/MM/YYYY HH:mm',
      edifact_version NVARCHAR(20) DEFAULT 'D:95B:UN',
      edifact_sender  NVARCHAR(100),
      edifact_config  NVARCHAR(MAX),
      is_system       BIT DEFAULT 0,
      is_active       BIT DEFAULT 1,
      created_at      DATETIME2 DEFAULT GETDATE(),
      updated_at      DATETIME2 DEFAULT GETDATE()
    )
  `);
  console.log('✅ EDITemplates table ready');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EDITemplates' AND COLUMN_NAME = 'required_fields')
      ALTER TABLE EDITemplates ADD required_fields NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EDITemplates' AND COLUMN_NAME = 'edifact_config')
      ALTER TABLE EDITemplates ADD edifact_config NVARCHAR(MAX) NULL;
  `);
  console.log('✅ EDITemplates extra columns ready');

  // 2. Seed 3 default system templates (if not already seeded)
  const existing = await pool.request().query(`SELECT COUNT(*) as cnt FROM EDITemplates WHERE is_system = 1`);
  if (existing.recordset[0].cnt === 0) {
    // EDIFACT default
    await pool.request()
      .input('name', sql.NVarChar, 'Standard EDIFACT (D:95B)')
      .input('format', sql.NVarChar, 'edifact')
      .input('desc', sql.NVarChar, 'UN/EDIFACT CODECO D:95B:UN — มาตรฐานสากลสำหรับสายเรือทั่วไป')
      .input('fields', sql.NVarChar, DEFAULT_FIELDS)
      .input('required', sql.NVarChar, DEFAULT_REQUIRED_FIELDS)
      .input('ediConfig', sql.NVarChar, DEFAULT_EDIFACT_CONFIG)
      .input('dateFormat', sql.NVarChar, 'YYMMDD:HHmm')
      .query(`INSERT INTO EDITemplates (template_name, base_format, description, field_mapping, required_fields, date_format, edifact_version, edifact_config, is_system)
              VALUES (@name, @format, @desc, @fields, @required, @dateFormat, 'D:95B:UN', @ediConfig, 1)`);

    // CSV default
    await pool.request()
      .input('name', sql.NVarChar, 'Standard CSV')
      .input('format', sql.NVarChar, 'csv')
      .input('desc', sql.NVarChar, 'CSV คั่นด้วยจุลภาค — header ภาษาอังกฤษมาตรฐาน')
      .input('fields', sql.NVarChar, DEFAULT_FIELDS)
      .input('required', sql.NVarChar, DEFAULT_REQUIRED_FIELDS)
      .input('dateFormat', sql.NVarChar, 'DD/MM/YYYY HH:mm')
      .query(`INSERT INTO EDITemplates (template_name, base_format, description, field_mapping, required_fields, date_format, csv_delimiter, is_system)
              VALUES (@name, @format, @desc, @fields, @required, @dateFormat, ',', 1)`);

    // JSON default
    await pool.request()
      .input('name', sql.NVarChar, 'Standard JSON')
      .input('format', sql.NVarChar, 'json')
      .input('desc', sql.NVarChar, 'JSON — สำหรับ REST API integration')
      .input('fields', sql.NVarChar, DEFAULT_FIELDS)
      .input('required', sql.NVarChar, DEFAULT_REQUIRED_FIELDS)
      .input('dateFormat', sql.NVarChar, 'ISO8601')
      .query(`INSERT INTO EDITemplates (template_name, base_format, description, field_mapping, required_fields, date_format, is_system)
              VALUES (@name, @format, @desc, @fields, @required, @dateFormat, 1)`);

    console.log('✅ Seeded 3 default templates');
  } else {
    console.log('⏭️ Default templates already exist');
  }

  // 3. Add template_id column to EDIEndpoints (if not exists)
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'EDIEndpoints' AND COLUMN_NAME = 'template_id')
      ALTER TABLE EDIEndpoints ADD template_id INT NULL
    `);
    console.log('✅ Added template_id to EDIEndpoints');
  } catch (e) {
    console.log('⏭️ template_id column may already exist');
  }

  await pool.close();
  console.log('🚀 Migration complete!');
  process.exit(0);
}

migrate().catch(e => { console.error('❌', e); process.exit(1); });
