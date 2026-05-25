-- ===================================
-- CYMS_DB — Smart Container Yard Management System
-- Database Schema (Phase 1-2: Foundation + Auth)
-- ===================================

-- สร้างฐานข้อมูล
-- CREATE DATABASE CYMS_DB;
-- GO
-- USE CYMS_DB;
-- GO

-- ===================================
-- ตาราง: ข้อมูลบริษัท (Company Profile)
-- ===================================
CREATE TABLE CompanyProfile (
    company_id      INT PRIMARY KEY IDENTITY(1,1),
    company_name    NVARCHAR(200) NOT NULL,
    tax_id          NVARCHAR(20),
    address         NVARCHAR(500),
    phone           NVARCHAR(50),
    email           NVARCHAR(100),
    logo_url        NVARCHAR(500),
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: สาขาลาน (Yards)
-- ===================================
CREATE TABLE Yards (
    yard_id         INT PRIMARY KEY IDENTITY(1,1),
    yard_name       NVARCHAR(100) NOT NULL,
    yard_code       NVARCHAR(20) UNIQUE NOT NULL,
    address         NVARCHAR(500),
    latitude        DECIMAL(10, 7),
    longitude       DECIMAL(10, 7),
    geofence_radius INT DEFAULT 500,    -- เมตร
    is_active       BIT DEFAULT 1,
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: โซนลาน (Yard Zones)
-- ===================================
CREATE TABLE YardZones (
    zone_id             INT PRIMARY KEY IDENTITY(1,1),
    yard_id             INT NOT NULL REFERENCES Yards(yard_id),
    zone_name           NVARCHAR(50) NOT NULL,
    zone_type           NVARCHAR(30) NOT NULL,    -- 'dry','reefer','hazmat','empty','repair','wash'
    max_tier            INT DEFAULT 5,
    max_bay             INT DEFAULT 20,
    max_row             INT DEFAULT 10,
    max_weight_kg       INT,                       -- ขีดจำกัดน้ำหนัก
    size_restriction    NVARCHAR(10) DEFAULT 'any', -- '20','40','45','any'
    has_reefer_plugs    BIT DEFAULT 0,
    plug_capacity       INT NULL,                  -- จำนวนปลั๊ก reefer จริง; NULL = fallback max_bay × max_row
    is_active           BIT DEFAULT 1,
    created_at          DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: บทบาทผู้ใช้ (Roles)
-- ===================================
CREATE TABLE Roles (
    role_id         INT PRIMARY KEY IDENTITY(1,1),
    role_code       NVARCHAR(30) UNIQUE NOT NULL,
    role_name       NVARCHAR(100) NOT NULL,
    description     NVARCHAR(500),
    is_system       BIT DEFAULT 0,      -- บทบาทระบบ ลบไม่ได้
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: สิทธิ์ RBAC (Permissions)
-- ===================================
CREATE TABLE Permissions (
    permission_id   INT PRIMARY KEY IDENTITY(1,1),
    module          NVARCHAR(50) NOT NULL,     -- 'gate','yard','billing','mnr','settings'
    action          NVARCHAR(20) NOT NULL,     -- 'create','read','update','delete'
    description     NVARCHAR(200)
);

-- ===================================
-- ตาราง: สิทธิ์ตามบทบาท (Role Permissions)
-- ===================================
CREATE TABLE RolePermissions (
    role_id         INT NOT NULL REFERENCES Roles(role_id),
    permission_id   INT NOT NULL REFERENCES Permissions(permission_id),
    PRIMARY KEY (role_id, permission_id)
);

-- ===================================
-- ตาราง: ผู้ใช้งาน (Users)
-- ===================================
CREATE TABLE Users (
    user_id         INT PRIMARY KEY IDENTITY(1,1),
    username        NVARCHAR(50) UNIQUE NOT NULL,
    password_hash   NVARCHAR(255) NOT NULL,
    full_name       NVARCHAR(100) NOT NULL,
    role_id         INT NOT NULL REFERENCES Roles(role_id),
    email           NVARCHAR(100),
    phone           NVARCHAR(20),
    avatar_url      NVARCHAR(500),
    status          NVARCHAR(20) DEFAULT 'active',  -- 'active','suspend','resign'
    customer_portal_role NVARCHAR(40) NULL,
    two_fa_enabled  BIT DEFAULT 0,
    two_fa_secret   NVARCHAR(128) NULL, -- TOTP secret (base32)
    two_fa_confirmed_at DATETIME2 NULL, -- เวลาเปิดใช้งาน 2FA สำเร็จ
    bound_device_mac NVARCHAR(128),    -- Trusted browser device id (legacy column name; ไม่ใช่ MAC จริง)
    failed_login_count INT DEFAULT 0,  -- จำนวน login ผิดติดต่อกัน
    locked_at       DATETIME2 NULL,    -- เวลาที่ถูกล็อค (NULL = ไม่ถูกล็อค)
    password_changed_at DATETIME2 NULL,-- เวลาเปลี่ยนรหัสผ่านล่าสุด
    notif_last_read_at DATETIME2 NULL, -- เวลาที่อ่านการแจ้งเตือนล่าสุด (ซิงค์ข้าม browser)
    created_at      DATETIME2 DEFAULT GETDATE(),
    updated_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: สิทธิ์เข้าถึงลาน (User Yard Access)
-- ===================================
CREATE TABLE UserYardAccess (
    user_id     INT NOT NULL REFERENCES Users(user_id),
    yard_id     INT NOT NULL REFERENCES Yards(yard_id),
    PRIMARY KEY (user_id, yard_id)
);

-- ===================================
-- ตาราง: สายอนุมัติ (Approval Hierarchy)
-- ===================================
CREATE TABLE ApprovalHierarchy (
    hierarchy_id    INT PRIMARY KEY IDENTITY(1,1),
    document_type   NVARCHAR(30) NOT NULL,     -- 'eor','credit_note','gate_release'
    step_order      INT NOT NULL,
    approver_role_id INT NOT NULL REFERENCES Roles(role_id),
    yard_id         INT REFERENCES Yards(yard_id),
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: ตู้คอนเทนเนอร์ (Containers)
-- ===================================
CREATE TABLE Containers (
    container_id        INT PRIMARY KEY IDENTITY(1,1),
    container_number    NVARCHAR(11) UNIQUE NOT NULL,   -- ISO 6346
    size                NVARCHAR(5) NOT NULL,            -- '20','40','45'
    type                NVARCHAR(10) NOT NULL,           -- 'GP','HC','RF','OT','FR','TK'
    status              NVARCHAR(20) DEFAULT 'available',
    yard_id             INT REFERENCES Yards(yard_id),
    zone_id             INT REFERENCES YardZones(zone_id),
    bay                 INT,
    row                 INT,
    tier                INT,
    shipping_line       NVARCHAR(50),
    is_laden            BIT DEFAULT 0,
    is_soc              BIT DEFAULT 0,                   -- Shipper Owned Container (ตู้ของลูกค้าเอง)
    container_owner_id  INT NULL,                        -- FK→Customers (เจ้าของกรรมสิทธิ์ตู้)
    container_grade     NVARCHAR(1) DEFAULT 'A',          -- A/B/C/D current operational grade
    seal_number         NVARCHAR(50),
    gate_in_date        DATETIME2,
    gate_out_date       DATETIME2,
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: ลูกค้า (Customers) — Multi-role
-- ===================================
CREATE TABLE Customers (
    customer_id         INT PRIMARY KEY IDENTITY(1,1),
    customer_code       VARCHAR(20) UNIQUE,           -- รหัสอ้างอิง EDI/Accounting (auto-generated)
    customer_name       NVARCHAR(200) NOT NULL,
    customer_type       NVARCHAR(30) NULL,            -- legacy: 'shipping_line','trucker','general'

    -- *** Multi-role Boolean Flags ***
    is_line             BIT DEFAULT 0,                -- เจ้าของตู้ / สายเรือ
    is_forwarder        BIT DEFAULT 0,                -- ตัวแทนจัดการขนส่ง
    is_trucking         BIT DEFAULT 0,                -- บริษัทรถบรรทุก
    is_shipper          BIT DEFAULT 0,                -- ผู้ส่งออก
    is_consignee        BIT DEFAULT 0,                -- ผู้นำเข้า

    -- ข้อมูลภาษี
    tax_id              NVARCHAR(20),                 -- เลขประจำตัวผู้เสียภาษี 13 หลัก
    address             NVARCHAR(500),
    billing_address     NVARCHAR(MAX),                -- ที่อยู่สำหรับออกบิล
    contact_name        NVARCHAR(100),
    contact_phone       NVARCHAR(50),
    contact_email       NVARCHAR(100),

    -- เงื่อนไขการชำระเงิน
    default_payment_type VARCHAR(20) DEFAULT 'CASH',  -- 'CASH' หรือ 'CREDIT'
    credit_term         INT DEFAULT 0,                -- วันเครดิต
    edi_prefix          NVARCHAR(10),                 -- EDI prefix (บังคับเมื่อ is_line=1)

    is_active           BIT DEFAULT 1,
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: สาขาลูกค้า (Customer Branches)
-- ===================================
CREATE TABLE CustomerBranches (
    branch_id           INT PRIMARY KEY IDENTITY(1,1),
    customer_id         INT NOT NULL REFERENCES Customers(customer_id),
    branch_code         VARCHAR(10) NOT NULL DEFAULT '00000',  -- 00000 = สำนักงานใหญ่
    branch_name         NVARCHAR(200),                         -- เช่น 'สำนักงานใหญ่', 'สาขาแหลมฉบัง'
    billing_address     NVARCHAR(MAX),
    contact_name        NVARCHAR(100),
    contact_phone       NVARCHAR(50),
    contact_email       NVARCHAR(100),
    is_default          BIT DEFAULT 0,
    is_active           BIT DEFAULT 1,
    created_at          DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UQ_Customer_Branch UNIQUE (customer_id, branch_code)
);

-- ===================================
-- ตาราง: Portal Entity Access (สิทธิ์ลูกค้าต่อ entity)
-- ===================================
CREATE TABLE PortalEntityAccess (
    access_id           BIGINT PRIMARY KEY IDENTITY(1,1),
    customer_id         INT NOT NULL REFERENCES Customers(customer_id),
    entity_type         NVARCHAR(40) NOT NULL,        -- 'container','booking','gate_transaction','invoice'
    entity_id           INT NULL,                     -- primary key ของ entity (ถ้ามี)
    entity_ref          NVARCHAR(100) NULL,           -- เลขตู้/booking/invoice/EIR สำหรับกรณี pre-link
    access_role         NVARCHAR(40) NOT NULL,        -- owner,billing,booking_customer,invoice_customer,forwarder,shipper,consignee
    permission_scope    NVARCHAR(MAX) NULL,
    valid_from          DATETIME2 NULL,
    valid_until         DATETIME2 NULL,
    source_table        NVARCHAR(80) NOT NULL,        -- แหล่งข้อมูลที่สร้าง grant
    source_id           INT NULL,
    is_active           BIT DEFAULT 1,
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 NULL,
    CONSTRAINT CK_PortalEntityAccess_Target CHECK (entity_id IS NOT NULL OR entity_ref IS NOT NULL)
);

CREATE INDEX IX_PortalEntityAccess_Customer_Entity
ON PortalEntityAccess (customer_id, entity_type, entity_id, is_active);

CREATE INDEX IX_PortalEntityAccess_EntityRef
ON PortalEntityAccess (entity_type, entity_ref, customer_id, is_active);

-- ===================================
-- ตาราง: Portal Booking Amendments (คำขอแก้ไข/ยกเลิก Booking จากลูกค้า)
-- ===================================
CREATE TABLE PortalBookingAmendments (
    amendment_id        BIGINT PRIMARY KEY IDENTITY(1,1),
    booking_id          INT NOT NULL REFERENCES Bookings(booking_id),
    booking_number      NVARCHAR(100) NULL,
    customer_id         INT NOT NULL REFERENCES Customers(customer_id),
    yard_id             INT NULL REFERENCES Yards(yard_id),
    request_type        NVARCHAR(20) NOT NULL,        -- amend,cancel
    requested_changes   NVARCHAR(MAX) NULL,           -- JSON allowlist เท่านั้น
    reason              NVARCHAR(1000) NULL,
    status              NVARCHAR(30) NOT NULL DEFAULT 'pending',
    review_note         NVARCHAR(1000) NULL,
    reviewed_by_user_id INT NULL REFERENCES Users(user_id),
    reviewed_at         DATETIME2 NULL,
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 NULL
);

CREATE INDEX IX_PortalBookingAmendments_Customer_Status
ON PortalBookingAmendments (customer_id, status, created_at);

CREATE INDEX IX_PortalBookingAmendments_Yard_Status
ON PortalBookingAmendments (yard_id, status, created_at);

CREATE INDEX IX_PortalBookingAmendments_Booking_Status
ON PortalBookingAmendments (booking_id, status);

-- ===================================
-- ตาราง: Portal Notification Preferences
-- ===================================
CREATE TABLE PortalNotificationPreferences (
    preference_id       INT PRIMARY KEY IDENTITY(1,1),
    customer_id         INT NOT NULL REFERENCES Customers(customer_id),
    notification_type   NVARCHAR(40) NOT NULL,        -- reefer_exception, booking_status, invoice, gate_activity
    enabled             BIT NOT NULL DEFAULT 1,
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 NULL,
    CONSTRAINT UQ_PortalNotificationPreferences UNIQUE (customer_id, notification_type)
);

CREATE INDEX IX_PortalNotificationPreferences_Customer
ON PortalNotificationPreferences (customer_id, enabled);

-- ===================================
-- ตาราง: Payment Reconciliation Rows (รายการรับเงินจาก Statement)
-- ===================================
CREATE TABLE PaymentReconciliationRows (
    reconciliation_id   BIGINT PRIMARY KEY IDENTITY(1,1),
    yard_id             INT NOT NULL REFERENCES Yards(yard_id),
    statement_ref       NVARCHAR(120) NOT NULL,
    paid_at             DATETIME2 NULL,
    payer_name          NVARCHAR(255) NULL,
    amount              DECIMAL(12,2) NOT NULL,
    invoice_number_hint NVARCHAR(80) NULL,
    source_file         NVARCHAR(255) NULL,
    status              NVARCHAR(30) NOT NULL DEFAULT 'pending',
    invoice_id          INT NULL REFERENCES Invoices(invoice_id),
    note                NVARCHAR(1000) NULL,
    matched_by_user_id  INT NULL REFERENCES Users(user_id),
    matched_at          DATETIME2 NULL,
    created_at          DATETIME2 DEFAULT GETDATE(),
    updated_at          DATETIME2 NULL
);

CREATE INDEX IX_PaymentReconciliationRows_Yard_Status
ON PaymentReconciliationRows (yard_id, status, created_at);

CREATE INDEX IX_PaymentReconciliationRows_Invoice
ON PaymentReconciliationRows (invoice_id, status);

-- ===================================
-- ตาราง: Billing Statements / Payments
-- ===================================
CREATE TABLE BillingStatements (
    statement_id       INT PRIMARY KEY IDENTITY(1,1),
    statement_number   NVARCHAR(80) UNIQUE NOT NULL,
    yard_id            INT NOT NULL REFERENCES Yards(yard_id),
    customer_id        INT NOT NULL REFERENCES Customers(customer_id),
    period_from        DATETIME2 NULL,
    period_to          DATETIME2 NULL,
    due_date           DATETIME2 NULL,
    total_amount       DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total        DECIMAL(12,2) NOT NULL DEFAULT 0,
    status             NVARCHAR(30) NOT NULL DEFAULT 'draft',
    notes              NVARCHAR(1000) NULL,
    issued_by_user_id  INT NULL REFERENCES Users(user_id),
    issued_at          DATETIME2 NULL,
    created_at         DATETIME2 DEFAULT GETDATE(),
    updated_at         DATETIME2 NULL
);

CREATE TABLE BillingStatementLines (
    line_id       INT PRIMARY KEY IDENTITY(1,1),
    statement_id  INT NOT NULL REFERENCES BillingStatements(statement_id),
    invoice_id    INT NOT NULL REFERENCES Invoices(invoice_id),
    line_number   INT NOT NULL,
    line_total    DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at    DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UQ_BillingStatementLines_Statement_Invoice UNIQUE (statement_id, invoice_id)
);

CREATE INDEX IX_BillingStatements_Yard_Customer
ON BillingStatements (yard_id, customer_id, status, created_at);

CREATE INDEX IX_BillingStatementLines_Invoice
ON BillingStatementLines (invoice_id);

CREATE TABLE BillingPayments (
    payment_id          INT PRIMARY KEY IDENTITY(1,1),
    payment_number      NVARCHAR(80) UNIQUE NOT NULL,
    receipt_number      NVARCHAR(80) NULL,
    yard_id             INT NOT NULL REFERENCES Yards(yard_id),
    customer_id         INT NULL REFERENCES Customers(customer_id),
    amount              DECIMAL(12,2) NOT NULL,
    payment_method      NVARCHAR(30) NOT NULL,
    payment_ref         NVARCHAR(120) NULL,
    status              NVARCHAR(30) NOT NULL DEFAULT 'posted',
    received_by_user_id INT NULL REFERENCES Users(user_id),
    received_at         DATETIME2 NULL,
    notes               NVARCHAR(1000) NULL,
    created_at          DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE BillingPaymentAllocations (
    allocation_id    INT PRIMARY KEY IDENTITY(1,1),
    payment_id       INT NOT NULL REFERENCES BillingPayments(payment_id),
    invoice_id       INT NOT NULL REFERENCES Invoices(invoice_id),
    allocated_amount DECIMAL(12,2) NOT NULL,
    balance_after    DECIMAL(12,2) NOT NULL,
    created_at       DATETIME2 DEFAULT GETDATE()
);

CREATE INDEX IX_BillingPayments_Yard_Customer
ON BillingPayments (yard_id, customer_id, created_at);

CREATE INDEX IX_BillingPaymentAllocations_Invoice
ON BillingPaymentAllocations (invoice_id);

-- ===================================
-- ตาราง: Reefer Monitoring Policies + Checks
-- ===================================
CREATE TABLE ReeferCheckPolicies (
    policy_id              INT PRIMARY KEY IDENTITY(1,1),
    yard_id                INT NULL REFERENCES Yards(yard_id),
    customer_id            INT NULL REFERENCES Customers(customer_id),
    booking_id             INT NULL,
    container_id           INT NULL REFERENCES Containers(container_id),
    scope_type             NVARCHAR(20) NOT NULL,      -- default,yard,customer,booking,container
    cargo_profile          NVARCHAR(40) NULL,          -- general,frozen,chilled,pharma
    interval_hours         INT NOT NULL DEFAULT 4,
    warning_grace_minutes  INT NOT NULL DEFAULT 30,
    min_temp_c             DECIMAL(6,2) NULL,
    max_temp_c             DECIMAL(6,2) NULL,
    is_active              BIT NOT NULL DEFAULT 1,
    created_at             DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at             DATETIME2 NULL
);

CREATE INDEX IX_ReeferCheckPolicies_Scope
ON ReeferCheckPolicies (scope_type, yard_id, customer_id, booking_id, container_id, is_active);

CREATE TABLE ReeferTemperatureChecks (
    check_id            INT PRIMARY KEY IDENTITY(1,1),
    container_id        INT NOT NULL REFERENCES Containers(container_id),
    booking_id          INT NULL,
    yard_id             INT NOT NULL REFERENCES Yards(yard_id),
    customer_id         INT NULL REFERENCES Customers(customer_id),
    measured_temp_c     DECIMAL(6,2) NULL,
    set_point_c         DECIMAL(6,2) NULL,
    supply_temp_c       DECIMAL(6,2) NULL,
    return_temp_c       DECIMAL(6,2) NULL,
    status              NVARCHAR(30) NOT NULL DEFAULT 'normal',
    photo_url           NVARCHAR(500) NULL,
    notes               NVARCHAR(1000) NULL,
    checked_by_user_id  INT NULL REFERENCES Users(user_id),
    checked_at          DATETIME2 NOT NULL DEFAULT GETDATE(),
    policy_snapshot     NVARCHAR(MAX) NULL,
    created_at          DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_ReeferTemperatureChecks_Container_Time
ON ReeferTemperatureChecks (container_id, checked_at DESC);

CREATE INDEX IX_ReeferTemperatureChecks_Yard_Status
ON ReeferTemperatureChecks (yard_id, status, checked_at DESC);

CREATE TABLE ReeferExceptions (
    exception_id            INT PRIMARY KEY IDENTITY(1,1),
    check_id                INT NOT NULL REFERENCES ReeferTemperatureChecks(check_id),
    container_id            INT NOT NULL REFERENCES Containers(container_id),
    booking_id              INT NULL,
    yard_id                 INT NOT NULL REFERENCES Yards(yard_id),
    customer_id             INT NULL REFERENCES Customers(customer_id),
    severity                NVARCHAR(20) NOT NULL DEFAULT 'high',
    status                  NVARCHAR(30) NOT NULL DEFAULT 'open',
    reason                  NVARCHAR(80) NOT NULL,
    recommended_action      NVARCHAR(500) NULL,
    resolution_note         NVARCHAR(1000) NULL,
    assigned_to_user_id     INT NULL REFERENCES Users(user_id),
    acknowledged_by_user_id INT NULL REFERENCES Users(user_id),
    acknowledged_at         DATETIME2 NULL,
    resolved_by_user_id     INT NULL REFERENCES Users(user_id),
    resolved_at             DATETIME2 NULL,
    created_at              DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME2 NULL
);

CREATE INDEX IX_ReeferExceptions_Yard_Status
ON ReeferExceptions (yard_id, status, severity, created_at DESC);

CREATE INDEX IX_ReeferExceptions_Container_Open
ON ReeferExceptions (container_id, status, reason);

-- ===================================
-- ตาราง: รหัสตู้มาตรฐาน ISO (ISO Container Codes)
-- ===================================
CREATE TABLE ISOContainerCodes (
    code_id         INT PRIMARY KEY IDENTITY(1,1),
    iso_code        NVARCHAR(10) UNIQUE NOT NULL,   -- e.g. '22G1','42G1'
    size            NVARCHAR(5) NOT NULL,
    type            NVARCHAR(10) NOT NULL,
    description     NVARCHAR(200)
);

-- ===================================
-- ตาราง: รูปแบบเลขเอกสาร (Document Running Formats)
-- ===================================
CREATE TABLE DocumentFormats (
    format_id       INT PRIMARY KEY IDENTITY(1,1),
    document_type   NVARCHAR(20) NOT NULL,  -- 'BN','INV','REC','CN','EIR','EOR'
    prefix          NVARCHAR(20) NOT NULL,
    current_number  INT DEFAULT 0,
    year_format     NVARCHAR(10),           -- 'YYYY','YY'
    sample_format   NVARCHAR(50),           -- e.g. 'INV-2024-000001'
    yard_id         INT REFERENCES Yards(yard_id),
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: Gate Transactions
-- ===================================
CREATE TABLE GateTransactions (
    transaction_id  INT PRIMARY KEY IDENTITY(1,1),
    container_id    INT REFERENCES Containers(container_id),
    yard_id         INT REFERENCES Yards(yard_id),
    transaction_type NVARCHAR(10) NOT NULL,     -- 'gate_in','gate_out'
    driver_name     NVARCHAR(100),
    driver_license  NVARCHAR(50),
    truck_plate     NVARCHAR(20),
    truck_company   NVARCHAR(100),                -- บริษัทรถขนส่ง
    seal_number     NVARCHAR(50),
    booking_ref     NVARCHAR(50),
    eir_number      NVARCHAR(50),
    notes           NVARCHAR(500),
    damage_report   NVARCHAR(MAX),              -- JSON damage data
    processed_by    INT REFERENCES Users(user_id),
    to_yard_id      INT REFERENCES Yards(yard_id),  -- ลานปลายทาง (สำหรับ transfer)
    container_owner_id  INT NULL,               -- เจ้าของกรรมสิทธิ์ตู้ (FK→Customers)
    billing_customer_id INT NULL,               -- คนรับผิดชอบจ่ายเงิน (FK→Customers)
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ตาราง: EIR Access Log
-- ===================================
CREATE TABLE EIRAccessLog (
    access_id           BIGINT PRIMARY KEY IDENTITY(1,1),
    eir_number          NVARCHAR(80) NOT NULL,
    gate_transaction_id INT NULL,
    user_id             INT NULL,
    customer_id         INT NULL,
    view_type           NVARCHAR(40) NOT NULL,
    action              NVARCHAR(30) NOT NULL,
    ip_address          NVARCHAR(100) NULL,
    user_agent          NVARCHAR(500) NULL,
    accessed_at         DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CK_EIRAccessLog_Action CHECK (action IN ('view', 'download', 'print', 'public_verify'))
);

CREATE INDEX IX_EIRAccessLog_EIR
ON EIRAccessLog (eir_number, accessed_at);

-- ===================================
-- ตาราง: บันทึกประวัติ (Audit Log)
-- ===================================
CREATE TABLE AuditLog (
    log_id          BIGINT PRIMARY KEY IDENTITY(1,1),
    user_id         INT REFERENCES Users(user_id),
    yard_id         INT REFERENCES Yards(yard_id),
    action          NVARCHAR(50) NOT NULL,
    entity_type     NVARCHAR(50),
    entity_id       INT,
    details         NVARCHAR(MAX),          -- JSON
    ip_address      NVARCHAR(45),
    device_info     NVARCHAR(200),
    created_at      DATETIME2 DEFAULT GETDATE()
);

-- ===================================
-- ข้อมูลเริ่มต้น: บทบาทระบบ
-- ===================================
INSERT INTO Roles (role_code, role_name, description, is_system) VALUES
('yard_manager', N'ผู้จัดการลาน / Admin', N'กำหนดค่าเริ่มต้น วางแผนผังลาน ดูภาพรวม', 1),
('gate_clerk', N'พนักงานหน้าประตู', N'จัดการรถเข้า-ออก ออกเอกสาร EIR', 1),
('surveyor', N'พนักงานสำรวจลาน', N'ตรวจสภาพตู้ ถ่ายรูป ตรวจนับพิกัดตู้', 1),
('rs_driver', N'คนขับรถยก', N'รับคำสั่งงานและอัปเดตสถานะยกตู้', 1),
('billing_officer', N'พนักงานบัญชีและซ่อมบำรุง', N'ประเมินราคาซ่อม จัดการเอกสารการเงิน', 1),
('customer', N'ลูกค้า (สายเรือ/ขนส่ง)', N'ดูสถานะตู้ ประวัติ อนุมัติ EOR', 1);

-- ===================================
-- ข้อมูลเริ่มต้น: Admin User (password: admin123)
-- ===================================
INSERT INTO Users (username, password_hash, full_name, role_id, email, status)
VALUES ('admin', '$2b$10$dummyhashfornow', N'ผู้ดูแลระบบ', 1, 'admin@cyms.local', 'active');

-- ===================================
-- ข้อมูลเริ่มต้น: ลานตัวอย่าง
-- ===================================
INSERT INTO Yards (yard_name, yard_code, address) VALUES
(N'ลานตู้สาขาหลัก', 'YARD-01', N'กรุงเทพมหานคร'),
(N'ลานตู้สาขา 2', 'YARD-02', N'แหลมฉบัง ชลบุรี');

INSERT INTO UserYardAccess (user_id, yard_id) VALUES (1, 1), (1, 2);
