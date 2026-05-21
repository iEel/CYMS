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

    await runStep(pool, 'Document numbering and lifecycle tables', `
      IF OBJECT_ID('DocumentSequences', 'U') IS NULL
      BEGIN
        CREATE TABLE DocumentSequences (
          sequence_id INT PRIMARY KEY IDENTITY(1,1),
          yard_id INT NOT NULL,
          document_type NVARCHAR(30) NOT NULL,
          sequence_year INT NOT NULL,
          sequence_month INT NOT NULL,
          prefix NVARCHAR(20) NOT NULL,
          next_number INT NOT NULL DEFAULT 1,
          padding INT NOT NULL DEFAULT 6,
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          CONSTRAINT UQ_DocumentSequences_Month UNIQUE (yard_id, document_type, sequence_year, sequence_month)
        );
      END
      ELSE
      BEGIN
        IF COL_LENGTH('DocumentSequences', 'sequence_month') IS NULL
          ALTER TABLE DocumentSequences ADD sequence_month INT NOT NULL CONSTRAINT DF_DocumentSequences_Month DEFAULT 0;

        IF EXISTS (
          SELECT 1
          FROM sys.key_constraints
          WHERE parent_object_id = OBJECT_ID('DocumentSequences')
            AND name = 'UQ_DocumentSequences'
        )
          ALTER TABLE DocumentSequences DROP CONSTRAINT UQ_DocumentSequences;

        IF NOT EXISTS (
          SELECT 1
          FROM sys.key_constraints
          WHERE parent_object_id = OBJECT_ID('DocumentSequences')
            AND name = 'UQ_DocumentSequences_Month'
        )
          ALTER TABLE DocumentSequences
          ADD CONSTRAINT UQ_DocumentSequences_Month UNIQUE (yard_id, document_type, sequence_year, sequence_month);
      END;

      IF OBJECT_ID('DocumentLifecycle', 'U') IS NULL
      BEGIN
        CREATE TABLE DocumentLifecycle (
          lifecycle_id BIGINT PRIMARY KEY IDENTITY(1,1),
          document_type NVARCHAR(30) NOT NULL,
          document_id INT NULL,
          document_number NVARCHAR(80) NOT NULL,
          status NVARCHAR(30) NOT NULL,
          event_type NVARCHAR(50) NOT NULL,
          related_document_type NVARCHAR(30) NULL,
          related_document_id INT NULL,
          related_document_number NVARCHAR(80) NULL,
          reason NVARCHAR(500) NULL,
          details NVARCHAR(MAX) NULL,
          user_id INT NULL,
          yard_id INT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE()
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('DocumentLifecycle') AND name = 'IX_DocumentLifecycle_Document')
        CREATE INDEX IX_DocumentLifecycle_Document
          ON DocumentLifecycle (document_type, document_id, document_number, created_at);

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('DocumentLifecycle') AND name = 'IX_DocumentLifecycle_Related')
        CREATE INDEX IX_DocumentLifecycle_Related
          ON DocumentLifecycle (related_document_type, related_document_id, related_document_number, created_at);
    `);

    await runStep(pool, 'Attachment, approval, and integration support tables', `
      IF OBJECT_ID('EntityAttachments', 'U') IS NULL
      BEGIN
        CREATE TABLE EntityAttachments (
          attachment_id BIGINT PRIMARY KEY IDENTITY(1,1),
          entity_type NVARCHAR(40) NOT NULL,
          entity_id INT NULL,
          entity_number NVARCHAR(80) NULL,
          category NVARCHAR(50) NOT NULL,
          file_url NVARCHAR(MAX) NOT NULL,
          file_name NVARCHAR(255) NULL,
          mime_type NVARCHAR(100) NULL,
          source NVARCHAR(50) NULL,
          uploaded_by INT NULL,
          yard_id INT NULL,
          metadata NVARCHAR(MAX) NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE()
        );
      END;

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('EntityAttachments') AND name = 'IX_EntityAttachments_Entity')
        CREATE INDEX IX_EntityAttachments_Entity
          ON EntityAttachments (entity_type, entity_id, entity_number, created_at);

      IF OBJECT_ID('ApprovalReviews', 'U') IS NULL
      BEGIN
        CREATE TABLE ApprovalReviews (
          review_id INT PRIMARY KEY IDENTITY(1,1),
          yard_id INT NULL,
          permission_code NVARCHAR(100) NOT NULL,
          action NVARCHAR(100) NOT NULL,
          entity_type NVARCHAR(50) NOT NULL,
          entity_id INT NULL,
          status NVARCHAR(20) NOT NULL DEFAULT 'pending_review',
          requested_by INT NULL,
          approved_by INT NULL,
          reason NVARCHAR(500) NULL,
          details NVARCHAR(MAX) NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          reviewed_at DATETIME2 NULL
        );
      END;

      IF OBJECT_ID('IntegrationLogs', 'U') IS NULL
      BEGIN
        CREATE TABLE IntegrationLogs (
          integration_log_id INT PRIMARY KEY IDENTITY(1,1),
          yard_id INT NULL,
          system NVARCHAR(30) NOT NULL,
          direction NVARCHAR(20) NOT NULL DEFAULT 'outbound',
          message_type NVARCHAR(80) NOT NULL,
          destination NVARCHAR(300) NULL,
          endpoint_name NVARCHAR(150) NULL,
          reference_type NVARCHAR(80) NULL,
          reference_id NVARCHAR(80) NULL,
          reference_number NVARCHAR(150) NULL,
          payload_summary NVARCHAR(MAX) NULL,
          status NVARCHAR(30) NOT NULL,
          error_message NVARCHAR(MAX) NULL,
          retry_count INT NOT NULL DEFAULT 0,
          record_count INT NOT NULL DEFAULT 0,
          filename NVARCHAR(255) NULL,
          request_id NVARCHAR(100) NULL,
          actor_id INT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
        );
      END;

      IF COL_LENGTH('IntegrationLogs', 'retry_count') IS NULL
        ALTER TABLE IntegrationLogs ADD retry_count INT NOT NULL DEFAULT 0;
      IF COL_LENGTH('IntegrationLogs', 'record_count') IS NULL
        ALTER TABLE IntegrationLogs ADD record_count INT NOT NULL DEFAULT 0;
      IF COL_LENGTH('IntegrationLogs', 'request_id') IS NULL
        ALTER TABLE IntegrationLogs ADD request_id NVARCHAR(100) NULL;
    `);

    await runStep(pool, 'EDI, CEDEX, and tariff helper schema', `
      IF OBJECT_ID('EDITemplates', 'U') IS NULL
      BEGIN
        CREATE TABLE EDITemplates (
          template_id INT IDENTITY(1,1) PRIMARY KEY,
          template_name NVARCHAR(100) NOT NULL,
          base_format NVARCHAR(20) NOT NULL DEFAULT 'csv',
          description NVARCHAR(500),
          field_mapping NVARCHAR(MAX),
          required_fields NVARCHAR(MAX),
          csv_delimiter NVARCHAR(5) DEFAULT ',',
          csv_headers NVARCHAR(MAX),
          date_format NVARCHAR(50) DEFAULT 'DD/MM/YYYY HH:mm',
          edifact_version NVARCHAR(20) DEFAULT 'D:95B:UN',
          edifact_sender NVARCHAR(100),
          edifact_config NVARCHAR(MAX),
          is_system BIT DEFAULT 0,
          is_active BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
      END;

      IF COL_LENGTH('EDITemplates', 'required_fields') IS NULL
        ALTER TABLE EDITemplates ADD required_fields NVARCHAR(MAX) NULL;
      IF COL_LENGTH('EDITemplates', 'edifact_config') IS NULL
        ALTER TABLE EDITemplates ADD edifact_config NVARCHAR(MAX) NULL;

      IF COL_LENGTH('GateTransactions', 'truck_company') IS NULL
        ALTER TABLE GateTransactions ADD truck_company NVARCHAR(100) NULL;

      IF OBJECT_ID('CEDEXCodes', 'U') IS NULL
      BEGIN
        CREATE TABLE CEDEXCodes (
          cedex_id INT PRIMARY KEY IDENTITY(1,1),
          code NVARCHAR(20) UNIQUE NOT NULL,
          component NVARCHAR(100) NOT NULL,
          damage NVARCHAR(200) NOT NULL,
          repair NVARCHAR(200) NOT NULL,
          labor_hours DECIMAL(5,2) DEFAULT 0,
          material_cost DECIMAL(10,2) DEFAULT 0,
          is_active BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
      END;

      IF COL_LENGTH('CEDEXCodes', 'rate_version') IS NULL
        ALTER TABLE CEDEXCodes ADD rate_version INT NOT NULL CONSTRAINT DF_CEDEXCodes_RateVersion DEFAULT 1;
      IF COL_LENGTH('CEDEXCodes', 'updated_at') IS NULL
        ALTER TABLE CEDEXCodes ADD updated_at DATETIME2 NULL;

      IF OBJECT_ID('StorageRateTiers', 'U') IS NULL
      BEGIN
        CREATE TABLE StorageRateTiers (
          tier_id INT PRIMARY KEY IDENTITY(1,1),
          yard_id INT NOT NULL REFERENCES Yards(yard_id),
          tier_name NVARCHAR(100) NOT NULL,
          from_day INT NOT NULL DEFAULT 1,
          to_day INT NOT NULL DEFAULT 999,
          rate_20 DECIMAL(12,2) NOT NULL DEFAULT 0,
          rate_40 DECIMAL(12,2) NOT NULL DEFAULT 0,
          rate_45 DECIMAL(12,2) NOT NULL DEFAULT 0,
          applies_to NVARCHAR(20) NOT NULL DEFAULT 'all',
          sort_order INT NOT NULL DEFAULT 0,
          is_active BIT NOT NULL DEFAULT 1,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
      END;

      IF COL_LENGTH('StorageRateTiers', 'customer_id') IS NULL
        ALTER TABLE StorageRateTiers ADD customer_id INT NULL;
      IF COL_LENGTH('StorageRateTiers', 'cargo_status') IS NULL
        ALTER TABLE StorageRateTiers ADD cargo_status VARCHAR(10) DEFAULT 'any';
    `);

    await runStep(pool, 'Settings and master-data support schema', `
      IF COL_LENGTH('Yards', 'branch_type') IS NULL
        ALTER TABLE Yards ADD branch_type NVARCHAR(20) DEFAULT 'head_office';
      IF COL_LENGTH('Yards', 'branch_number') IS NULL
        ALTER TABLE Yards ADD branch_number NVARCHAR(10) DEFAULT '00000';

      IF OBJECT_ID('CompanyProfile', 'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('CompanyProfile', 'branch_type') IS NULL
          ALTER TABLE CompanyProfile ADD branch_type NVARCHAR(20) DEFAULT 'head_office';
        IF COL_LENGTH('CompanyProfile', 'branch_number') IS NULL
          ALTER TABLE CompanyProfile ADD branch_number NVARCHAR(10) DEFAULT '00000';
        ALTER TABLE CompanyProfile ALTER COLUMN logo_url NVARCHAR(MAX);
      END;

      IF OBJECT_ID('SystemSettings', 'U') IS NULL
      BEGIN
        CREATE TABLE SystemSettings (
          setting_key NVARCHAR(100) PRIMARY KEY,
          setting_value NVARCHAR(MAX),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
      END;

      IF OBJECT_ID('PrefixMapping', 'U') IS NULL
      BEGIN
        CREATE TABLE PrefixMapping (
          prefix_id INT IDENTITY PRIMARY KEY,
          prefix_code NVARCHAR(4) NOT NULL,
          customer_id INT NOT NULL,
          is_primary BIT DEFAULT 0,
          notes NVARCHAR(200),
          created_at DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT FK_Prefix_Customer FOREIGN KEY (customer_id) REFERENCES Customers(customer_id),
          CONSTRAINT UQ_Prefix_Customer UNIQUE (prefix_code, customer_id)
        );
      END;

      IF COL_LENGTH('PrefixMapping', 'is_primary') IS NULL
        ALTER TABLE PrefixMapping ADD is_primary BIT DEFAULT 0;

      IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('PrefixMapping') AND name = 'UQ_Prefix')
        ALTER TABLE PrefixMapping DROP CONSTRAINT UQ_Prefix;

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('PrefixMapping') AND name = 'UQ_Prefix_Customer')
        ALTER TABLE PrefixMapping ADD CONSTRAINT UQ_Prefix_Customer UNIQUE (prefix_code, customer_id);
    `);

    await runStep(pool, 'Granular RBAC permission columns', `
      IF COL_LENGTH('Permissions', 'permission_code') IS NULL
        ALTER TABLE Permissions ADD permission_code NVARCHAR(100) NULL;

      UPDATE Permissions
      SET permission_code = CONCAT(module, '.', action, '.', permission_id)
      WHERE permission_code IS NULL;

      ALTER TABLE Permissions ALTER COLUMN permission_code NVARCHAR(100) NOT NULL;

      IF EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('Permissions')
          AND name = 'action'
          AND max_length < 100
      )
        ALTER TABLE Permissions ALTER COLUMN action NVARCHAR(50) NOT NULL;

      IF EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('Permissions')
          AND name = 'description'
          AND max_length < 510
      )
        ALTER TABLE Permissions ALTER COLUMN description NVARCHAR(255) NULL;

      IF COL_LENGTH('Permissions', 'requires_approval') IS NULL
        ALTER TABLE Permissions ADD requires_approval BIT NOT NULL CONSTRAINT DF_Permissions_requires_approval DEFAULT 0;

      IF COL_LENGTH('Permissions', 'approval_permission_code') IS NULL
        ALTER TABLE Permissions ADD approval_permission_code NVARCHAR(100) NULL;

      IF COL_LENGTH('Permissions', 'risk_level') IS NULL
        ALTER TABLE Permissions ADD risk_level NVARCHAR(20) NULL;
    `);

    console.log('Runtime schema migration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

migrate();
