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
    two_fa_enabled  BIT DEFAULT 0,
    bound_device_mac NVARCHAR(50),     -- Device Binding สำหรับคนขับรถยก
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
