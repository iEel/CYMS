// ===================================
// CYMS — Database Setup Script
// สร้างฐานข้อมูล CYMS_DB และตารางทั้งหมด
// ===================================

const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const masterConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
  },
};

const dbName = process.env.DB_NAME || 'CYMS_DB';

async function run() {
  let pool;

  try {
    // ขั้นที่ 1: เชื่อมต่อ master เพื่อสร้าง Database
    console.log('🔌 กำลังเชื่อมต่อ MS SQL Server...');
    console.log(`   Server: ${masterConfig.server}\\${masterConfig.options.instanceName || '(default)'}`);
    console.log(`   Port: ${masterConfig.port}`);
    
    pool = await sql.connect({ ...masterConfig, database: 'master' });
    console.log('✅ เชื่อมต่อสำเร็จ!\n');

    // ตรวจว่า database มีอยู่แล้วหรือไม่
    const dbCheck = await pool.request().query(
      `SELECT name FROM sys.databases WHERE name = '${dbName}'`
    );

    if (dbCheck.recordset.length === 0) {
      console.log(`📦 กำลังสร้างฐานข้อมูล "${dbName}"...`);
      await pool.request().query(`CREATE DATABASE [${dbName}]`);
      console.log(`✅ สร้างฐานข้อมูล "${dbName}" สำเร็จ!\n`);
    } else {
      console.log(`ℹ️  ฐานข้อมูล "${dbName}" มีอยู่แล้ว\n`);
    }

    await pool.close();

    // ขั้นที่ 2: เชื่อมต่อ CYMS_DB เพื่อสร้างตาราง
    console.log(`🔌 เชื่อมต่อฐานข้อมูล "${dbName}"...`);
    pool = await sql.connect({ ...masterConfig, database: dbName });
    console.log('✅ เชื่อมต่อสำเร็จ!\n');

    // สร้างตารางทีละตาราง (ต้องเรียงลำดับตาม FK dependencies)
    const tables = [
      {
        name: 'CompanyProfile',
        sql: `CREATE TABLE CompanyProfile (
          company_id      INT PRIMARY KEY IDENTITY(1,1),
          company_name    NVARCHAR(200) NOT NULL,
          tax_id          NVARCHAR(20),
          address         NVARCHAR(500),
          phone           NVARCHAR(50),
          email           NVARCHAR(100),
          logo_url        NVARCHAR(500),
          created_at      DATETIME2 DEFAULT GETDATE(),
          updated_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'Yards',
        sql: `CREATE TABLE Yards (
          yard_id         INT PRIMARY KEY IDENTITY(1,1),
          yard_name       NVARCHAR(100) NOT NULL,
          yard_code       NVARCHAR(20) UNIQUE NOT NULL,
          address         NVARCHAR(500),
          latitude        DECIMAL(10, 7),
          longitude       DECIMAL(10, 7),
          geofence_radius INT DEFAULT 500,
          is_active       BIT DEFAULT 1,
          created_at      DATETIME2 DEFAULT GETDATE(),
          updated_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'YardZones',
        sql: `CREATE TABLE YardZones (
          zone_id             INT PRIMARY KEY IDENTITY(1,1),
          yard_id             INT NOT NULL REFERENCES Yards(yard_id),
          zone_name           NVARCHAR(50) NOT NULL,
          zone_type           NVARCHAR(30) NOT NULL,
          max_tier            INT DEFAULT 5,
          max_bay             INT DEFAULT 20,
          max_row             INT DEFAULT 10,
          max_weight_kg       INT,
          size_restriction    NVARCHAR(10) DEFAULT 'any',
          has_reefer_plugs    BIT DEFAULT 0,
          is_active           BIT DEFAULT 1,
          created_at          DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'Roles',
        sql: `CREATE TABLE Roles (
          role_id         INT PRIMARY KEY IDENTITY(1,1),
          role_code       NVARCHAR(30) UNIQUE NOT NULL,
          role_name       NVARCHAR(100) NOT NULL,
          description     NVARCHAR(500),
          is_system       BIT DEFAULT 0,
          created_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'Permissions',
        sql: `CREATE TABLE Permissions (
          permission_id   INT PRIMARY KEY IDENTITY(1,1),
          module          NVARCHAR(50) NOT NULL,
          action          NVARCHAR(20) NOT NULL,
          description     NVARCHAR(200)
        )`,
      },
      {
        name: 'RolePermissions',
        sql: `CREATE TABLE RolePermissions (
          role_id         INT NOT NULL REFERENCES Roles(role_id),
          permission_id   INT NOT NULL REFERENCES Permissions(permission_id),
          PRIMARY KEY (role_id, permission_id)
        )`,
      },
      {
        name: 'Users',
        sql: `CREATE TABLE Users (
          user_id         INT PRIMARY KEY IDENTITY(1,1),
          username        NVARCHAR(50) UNIQUE NOT NULL,
          password_hash   NVARCHAR(255) NOT NULL,
          full_name       NVARCHAR(100) NOT NULL,
          role_id         INT NOT NULL REFERENCES Roles(role_id),
          email           NVARCHAR(100),
          phone           NVARCHAR(20),
          avatar_url      NVARCHAR(500),
          status          NVARCHAR(20) DEFAULT 'active',
          two_fa_enabled  BIT DEFAULT 0,
          bound_device_mac NVARCHAR(50),
          created_at      DATETIME2 DEFAULT GETDATE(),
          updated_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'UserYardAccess',
        sql: `CREATE TABLE UserYardAccess (
          user_id     INT NOT NULL REFERENCES Users(user_id),
          yard_id     INT NOT NULL REFERENCES Yards(yard_id),
          PRIMARY KEY (user_id, yard_id)
        )`,
      },
      {
        name: 'ApprovalHierarchy',
        sql: `CREATE TABLE ApprovalHierarchy (
          hierarchy_id    INT PRIMARY KEY IDENTITY(1,1),
          document_type   NVARCHAR(30) NOT NULL,
          step_order      INT NOT NULL,
          approver_role_id INT NOT NULL REFERENCES Roles(role_id),
          yard_id         INT REFERENCES Yards(yard_id),
          created_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'Containers',
        sql: `CREATE TABLE Containers (
          container_id        INT PRIMARY KEY IDENTITY(1,1),
          container_number    NVARCHAR(11) UNIQUE NOT NULL,
          size                NVARCHAR(5) NOT NULL,
          type                NVARCHAR(10) NOT NULL,
          status              NVARCHAR(20) DEFAULT 'available',
          yard_id             INT REFERENCES Yards(yard_id),
          zone_id             INT REFERENCES YardZones(zone_id),
          bay                 INT,
          [row]               INT,
          tier                INT,
          shipping_line       NVARCHAR(50),
          is_laden            BIT DEFAULT 0,
          seal_number         NVARCHAR(50),
          gate_in_date        DATETIME2,
          gate_out_date       DATETIME2,
          created_at          DATETIME2 DEFAULT GETDATE(),
          updated_at          DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'Customers',
        sql: `CREATE TABLE Customers (
          customer_id     INT PRIMARY KEY IDENTITY(1,1),
          customer_name   NVARCHAR(200) NOT NULL,
          customer_type   NVARCHAR(30) NOT NULL,
          tax_id          NVARCHAR(20),
          address         NVARCHAR(500),
          contact_name    NVARCHAR(100),
          contact_phone   NVARCHAR(50),
          contact_email   NVARCHAR(100),
          credit_term     INT DEFAULT 0,
          is_active       BIT DEFAULT 1,
          created_at      DATETIME2 DEFAULT GETDATE(),
          updated_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'ISOContainerCodes',
        sql: `CREATE TABLE ISOContainerCodes (
          code_id         INT PRIMARY KEY IDENTITY(1,1),
          iso_code        NVARCHAR(10) UNIQUE NOT NULL,
          size            NVARCHAR(5) NOT NULL,
          type            NVARCHAR(10) NOT NULL,
          description     NVARCHAR(200)
        )`,
      },
      {
        name: 'DocumentFormats',
        sql: `CREATE TABLE DocumentFormats (
          format_id       INT PRIMARY KEY IDENTITY(1,1),
          document_type   NVARCHAR(20) NOT NULL,
          prefix          NVARCHAR(20) NOT NULL,
          current_number  INT DEFAULT 0,
          year_format     NVARCHAR(10),
          sample_format   NVARCHAR(50),
          yard_id         INT REFERENCES Yards(yard_id),
          created_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
      {
        name: 'AuditLog',
        sql: `CREATE TABLE AuditLog (
          log_id          BIGINT PRIMARY KEY IDENTITY(1,1),
          user_id         INT REFERENCES Users(user_id),
          yard_id         INT REFERENCES Yards(yard_id),
          action          NVARCHAR(50) NOT NULL,
          entity_type     NVARCHAR(50),
          entity_id       INT,
          details         NVARCHAR(MAX),
          ip_address      NVARCHAR(45),
          device_info     NVARCHAR(200),
          created_at      DATETIME2 DEFAULT GETDATE()
        )`,
      },
    ];

    // สร้างตารางทีละตาราง
    for (const table of tables) {
      const exists = await pool.request().query(
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${table.name}'`
      );
      if (exists.recordset.length > 0) {
        console.log(`  ⏭️  ตาราง ${table.name} — มีอยู่แล้ว (ข้าม)`);
      } else {
        await pool.request().query(table.sql);
        console.log(`  ✅ ตาราง ${table.name} — สร้างสำเร็จ`);
      }
    }

    // ขั้นที่ 3: ใส่ข้อมูลเริ่มต้น (Seed Data)
    console.log('\n📝 กำลังใส่ข้อมูลเริ่มต้น...');

    // Roles
    const rolesCheck = await pool.request().query('SELECT COUNT(*) as cnt FROM Roles');
    if (rolesCheck.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO Roles (role_code, role_name, description, is_system) VALUES
        ('yard_manager', N'ผู้จัดการลาน / Admin', N'กำหนดค่าเริ่มต้น วางแผนผังลาน ดูภาพรวม', 1),
        ('gate_clerk', N'พนักงานหน้าประตู', N'จัดการรถเข้า-ออก ออกเอกสาร EIR', 1),
        ('surveyor', N'พนักงานสำรวจลาน', N'ตรวจสภาพตู้ ถ่ายรูป ตรวจนับพิกัดตู้', 1),
        ('rs_driver', N'คนขับรถยก', N'รับคำสั่งงานและอัปเดตสถานะยกตู้', 1),
        ('billing_officer', N'พนักงานบัญชีและซ่อมบำรุง', N'ประเมินราคาซ่อม จัดการเอกสารการเงิน', 1),
        ('customer', N'ลูกค้า (สายเรือ/ขนส่ง)', N'ดูสถานะตู้ ประวัติ อนุมัติ EOR', 1)
      `);
      console.log('  ✅ Roles — 6 บทบาท');
    } else {
      console.log('  ⏭️  Roles — มีข้อมูลแล้ว');
    }

    // Admin User
    const usersCheck = await pool.request().query('SELECT COUNT(*) as cnt FROM Users');
    if (usersCheck.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO Users (username, password_hash, full_name, role_id, email, status)
        VALUES ('admin', '$2b$10$placeholder_hash_for_setup', N'ผู้ดูแลระบบ', 1, 'admin@cyms.local', 'active')
      `);
      console.log('  ✅ Users — admin user');
    } else {
      console.log('  ⏭️  Users — มีข้อมูลแล้ว');
    }

    // Yards
    const yardsCheck = await pool.request().query('SELECT COUNT(*) as cnt FROM Yards');
    if (yardsCheck.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO Yards (yard_name, yard_code, address) VALUES
        (N'ลานตู้สาขาหลัก', 'YARD-01', N'กรุงเทพมหานคร'),
        (N'ลานตู้สาขา 2', 'YARD-02', N'แหลมฉบัง ชลบุรี')
      `);
      console.log('  ✅ Yards — 2 สาขา');

      await pool.request().query(`
        INSERT INTO UserYardAccess (user_id, yard_id) VALUES (1, 1), (1, 2)
      `);
      console.log('  ✅ UserYardAccess — admin → ทุกสาขา');
    } else {
      console.log('  ⏭️  Yards — มีข้อมูลแล้ว');
    }

    console.log('\n🎉 สร้างฐานข้อมูล CYMS_DB เสร็จสมบูรณ์!');
    console.log('=============================================\n');

  } catch (err) {
    console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
    if (err.code === 'ESOCKET') {
      console.error('   → ไม่สามารถเชื่อมต่อ Server ได้ กรุณาตรวจสอบ:');
      console.error('     1. MS SQL Server เปิดอยู่หรือไม่');
      console.error('     2. IP/Port ถูกต้องหรือไม่');
      console.error('     3. Firewall อนุญาต port 1433 หรือไม่');
    }
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

run();
