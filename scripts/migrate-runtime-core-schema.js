// Run: node scripts/migrate-runtime-core-schema.js
// Moves core operational schema guards out of API request handlers.

require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
  },
};

async function runStep(pool, label, statement) {
  console.log(`- ${label}`);
  await pool.request().query(statement);
}

async function migrate() {
  let pool;
  try {
    console.log('Connecting to database...');
    pool = await sql.connect(config);

    await runStep(pool, 'Gate/billing clearance columns', `
      IF COL_LENGTH('Containers', 'container_grade') IS NULL
        ALTER TABLE Containers ADD container_grade NVARCHAR(1) NOT NULL CONSTRAINT DF_Containers_Grade DEFAULT 'A';

      IF OBJECT_ID('BillingClearances', 'U') IS NULL
      BEGIN
        CREATE TABLE BillingClearances (
          clearance_id INT PRIMARY KEY IDENTITY(1,1),
          yard_id INT NOT NULL,
          transaction_type NVARCHAR(20) NOT NULL,
          container_id INT NULL,
          container_number NVARCHAR(15) NULL,
          customer_id INT NULL,
          clearance_type NVARCHAR(20) NOT NULL,
          original_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          final_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          reason NVARCHAR(500) NULL,
          invoice_id INT NULL,
          approved_by INT NULL,
          charges NVARCHAR(MAX) NULL,
          created_by INT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE()
        );
      END;

      IF COL_LENGTH('GateTransactions', 'billing_clearance_id') IS NULL
        ALTER TABLE GateTransactions ADD billing_clearance_id INT NULL;
    `);

    await runStep(pool, 'Invoice document relationship columns', `
      IF COL_LENGTH('Invoices', 'ref_invoice_id') IS NULL
        ALTER TABLE Invoices ADD ref_invoice_id INT NULL;
      IF COL_LENGTH('Invoices', 'replaces_invoice_id') IS NULL
        ALTER TABLE Invoices ADD replaces_invoice_id INT NULL;
      IF COL_LENGTH('Invoices', 'document_type') IS NULL
        ALTER TABLE Invoices ADD document_type NVARCHAR(30) NULL;
      IF COL_LENGTH('Invoices', 'balance_amount') IS NULL
        ALTER TABLE Invoices ADD balance_amount DECIMAL(12,2) NULL;
    `);

    await runStep(pool, 'M&R extended columns', `
      IF COL_LENGTH('RepairOrders', 'customer_id') IS NULL
        ALTER TABLE RepairOrders ADD customer_id INT NULL;
      IF COL_LENGTH('RepairOrders', 'source_eir_number') IS NULL
        ALTER TABLE RepairOrders ADD source_eir_number NVARCHAR(80) NULL;
      IF COL_LENGTH('RepairOrders', 'cedex_rate_version') IS NULL
        ALTER TABLE RepairOrders ADD cedex_rate_version NVARCHAR(80) NULL;
      IF COL_LENGTH('RepairOrders', 'repair_photos') IS NULL
        ALTER TABLE RepairOrders ADD repair_photos NVARCHAR(MAX) NULL;
      IF COL_LENGTH('RepairOrders', 'repair_photo_evidence') IS NULL
        ALTER TABLE RepairOrders ADD repair_photo_evidence NVARCHAR(MAX) NULL;
      IF COL_LENGTH('RepairOrders', 'invoice_id') IS NULL
        ALTER TABLE RepairOrders ADD invoice_id INT NULL;
      IF COL_LENGTH('RepairOrders', 'billing_customer_id') IS NULL
        ALTER TABLE RepairOrders ADD billing_customer_id INT NULL;
      IF COL_LENGTH('RepairOrders', 'completed_at') IS NULL
        ALTER TABLE RepairOrders ADD completed_at DATETIME2 NULL;
      IF COL_LENGTH('RepairOrders', 'customer_approved_by') IS NULL
        ALTER TABLE RepairOrders ADD customer_approved_by NVARCHAR(200) NULL;
      IF COL_LENGTH('RepairOrders', 'customer_approved_at') IS NULL
        ALTER TABLE RepairOrders ADD customer_approved_at DATETIME2 NULL;
      IF COL_LENGTH('RepairOrders', 'customer_approval_channel') IS NULL
        ALTER TABLE RepairOrders ADD customer_approval_channel NVARCHAR(50) NULL;
      IF COL_LENGTH('RepairOrders', 'customer_approval_reference') IS NULL
        ALTER TABLE RepairOrders ADD customer_approval_reference NVARCHAR(200) NULL;
      IF COL_LENGTH('RepairOrders', 'completion_grade') IS NULL
        ALTER TABLE RepairOrders ADD completion_grade NVARCHAR(1) NULL;
      IF COL_LENGTH('RepairOrders', 'completion_status') IS NULL
        ALTER TABLE RepairOrders ADD completion_status NVARCHAR(30) NULL;
      IF COL_LENGTH('RepairOrders', 'repair_inspected_by') IS NULL
        ALTER TABLE RepairOrders ADD repair_inspected_by NVARCHAR(200) NULL;
      IF COL_LENGTH('RepairOrders', 'repair_inspected_at') IS NULL
        ALTER TABLE RepairOrders ADD repair_inspected_at DATETIME2 NULL;
      IF COL_LENGTH('Containers', 'customer_id') IS NULL
        ALTER TABLE Containers ADD customer_id INT NULL;
    `);

    await runStep(pool, 'Customer master columns and branches', `
      IF COL_LENGTH('Customers', 'is_line') IS NULL
        ALTER TABLE Customers ADD is_line BIT DEFAULT 0;
      IF COL_LENGTH('Customers', 'is_forwarder') IS NULL
        ALTER TABLE Customers ADD is_forwarder BIT DEFAULT 0;
      IF COL_LENGTH('Customers', 'is_trucking') IS NULL
        ALTER TABLE Customers ADD is_trucking BIT DEFAULT 0;
      IF COL_LENGTH('Customers', 'is_shipper') IS NULL
        ALTER TABLE Customers ADD is_shipper BIT DEFAULT 0;
      IF COL_LENGTH('Customers', 'is_consignee') IS NULL
        ALTER TABLE Customers ADD is_consignee BIT DEFAULT 0;
      IF COL_LENGTH('Customers', 'customer_code') IS NULL
        ALTER TABLE Customers ADD customer_code VARCHAR(20) NULL;
      IF COL_LENGTH('Customers', 'billing_address') IS NULL
        ALTER TABLE Customers ADD billing_address NVARCHAR(MAX) NULL;
      IF COL_LENGTH('Customers', 'default_payment_type') IS NULL
        ALTER TABLE Customers ADD default_payment_type VARCHAR(20) DEFAULT 'CASH';
      IF COL_LENGTH('Customers', 'edi_prefix') IS NULL
        ALTER TABLE Customers ADD edi_prefix NVARCHAR(10) NULL;
      IF COL_LENGTH('Customers', 'credit_limit') IS NULL
        ALTER TABLE Customers ADD credit_limit DECIMAL(12,2) NULL;
      IF COL_LENGTH('Customers', 'credit_hold') IS NULL
        ALTER TABLE Customers ADD credit_hold BIT NOT NULL CONSTRAINT DF_Customers_CreditHold DEFAULT 0;
      IF COL_LENGTH('Customers', 'credit_hold_reason') IS NULL
        ALTER TABLE Customers ADD credit_hold_reason NVARCHAR(300) NULL;
      IF COL_LENGTH('Customers', 'branch_type') IS NULL
        ALTER TABLE Customers ADD branch_type NVARCHAR(20) DEFAULT 'head_office';
      IF COL_LENGTH('Customers', 'branch_number') IS NULL
        ALTER TABLE Customers ADD branch_number NVARCHAR(10) DEFAULT '00000';
      IF COL_LENGTH('Customers', 'shipping_line_code') IS NULL
        ALTER TABLE Customers ADD shipping_line_code NVARCHAR(50) NULL;

      UPDATE Customers SET is_line = 1
      WHERE customer_type = 'shipping_line' AND (is_line IS NULL OR is_line = 0);
      UPDATE Customers SET is_trucking = 1
      WHERE customer_type IN ('trucker', 'trucking') AND (is_trucking IS NULL OR is_trucking = 0);
      UPDATE Customers SET customer_code = 'CUST-' + RIGHT('00000' + CAST(customer_id AS VARCHAR), 5)
      WHERE customer_code IS NULL OR customer_code = '';

      IF OBJECT_ID('CustomerBranches', 'U') IS NULL
      BEGIN
        CREATE TABLE CustomerBranches (
          branch_id       INT PRIMARY KEY IDENTITY(1,1),
          customer_id     INT NOT NULL REFERENCES Customers(customer_id),
          branch_code     VARCHAR(10) NOT NULL DEFAULT '00000',
          branch_name     NVARCHAR(200),
          billing_address NVARCHAR(MAX),
          contact_name    NVARCHAR(100),
          contact_phone   NVARCHAR(50),
          contact_email   NVARCHAR(100),
          is_default      BIT DEFAULT 0,
          is_active       BIT DEFAULT 1,
          created_at      DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT UQ_Customer_Branch UNIQUE (customer_id, branch_code)
        );
      END;
    `);

    await runStep(pool, 'Gate owner/billing columns for customer 360', `
      IF COL_LENGTH('GateTransactions', 'billing_customer_id') IS NULL
        ALTER TABLE GateTransactions ADD billing_customer_id INT NULL;
      IF COL_LENGTH('GateTransactions', 'container_owner_id') IS NULL
        ALTER TABLE GateTransactions ADD container_owner_id INT NULL;
    `);

    console.log('Runtime core schema migration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

migrate();
