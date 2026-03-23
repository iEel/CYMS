// ===================================
// CYMS — Seed Permissions Script
// เพิ่ม Permissions + RolePermissions (Granular RBAC) เข้า DB
// ===================================

const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'CYMS_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
  },
};

// สิทธิ์ทั้งหมด แยกตาม module + action
const PERMISSIONS = [
  // Dashboard
  { module: 'dashboard', action: 'read', description: 'ดูแดชบอร์ด' },

  // Yard Management
  { module: 'yard', action: 'create', description: 'เพิ่มโซน/โครงสร้างลาน' },
  { module: 'yard', action: 'read', description: 'ดูแผนผังลาน/ค้นหาตู้' },
  { module: 'yard', action: 'update', description: 'แก้ไขโครงสร้างลาน' },
  { module: 'yard', action: 'delete', description: 'ลบโซน/โครงสร้างลาน' },

  // Gate
  { module: 'gate', action: 'create', description: 'สร้าง Gate-In/Out + ออก EIR' },
  { module: 'gate', action: 'read', description: 'ดูข้อมูล Gate Movement' },
  { module: 'gate', action: 'update', description: 'แก้ไขข้อมูล Gate' },
  { module: 'gate', action: 'delete', description: 'ยกเลิก Gate Record' },

  // Operations
  { module: 'operations', action: 'create', description: 'สร้างคำสั่งงานรถยก' },
  { module: 'operations', action: 'read', description: 'ดูคำสั่งงาน/Job Queue' },
  { module: 'operations', action: 'update', description: 'อัปเดตสถานะงาน' },
  { module: 'operations', action: 'delete', description: 'ยกเลิกคำสั่งงาน' },

  // EDI
  { module: 'edi', action: 'create', description: 'นำเข้าข้อมูล EDI/Booking' },
  { module: 'edi', action: 'read', description: 'ดูข้อมูล Booking/Manifest' },
  { module: 'edi', action: 'update', description: 'แก้ไขข้อมูล EDI' },
  { module: 'edi', action: 'delete', description: 'ลบข้อมูล EDI' },

  // M&R
  { module: 'mnr', action: 'create', description: 'สร้างใบ EOR' },
  { module: 'mnr', action: 'read', description: 'ดูรายการซ่อม/EOR' },
  { module: 'mnr', action: 'update', description: 'แก้ไข/อนุมัติ EOR' },
  { module: 'mnr', action: 'delete', description: 'ยกเลิก EOR' },

  // Billing
  { module: 'billing', action: 'create', description: 'สร้างใบแจ้งหนี้/ใบเสร็จ' },
  { module: 'billing', action: 'read', description: 'ดูรายการบัญชี' },
  { module: 'billing', action: 'update', description: 'แก้ไขเอกสารบัญชี' },
  { module: 'billing', action: 'delete', description: 'ยกเลิกเอกสารบัญชี' },

  // Settings
  { module: 'settings', action: 'create', description: 'เพิ่มข้อมูลตั้งค่า' },
  { module: 'settings', action: 'read', description: 'ดูการตั้งค่าระบบ' },
  { module: 'settings', action: 'update', description: 'แก้ไขการตั้งค่า' },
  { module: 'settings', action: 'delete', description: 'ลบการตั้งค่า' },

  // Customer Management
  { module: 'customers', action: 'create', description: 'เพิ่มข้อมูลลูกค้า' },
  { module: 'customers', action: 'read', description: 'ดูข้อมูลลูกค้า' },
  { module: 'customers', action: 'update', description: 'แก้ไขข้อมูลลูกค้า' },
  { module: 'customers', action: 'delete', description: 'ลบข้อมูลลูกค้า' },

  // Audit Trail
  { module: 'audit_trail', action: 'read', description: 'ดูประวัติการใช้งาน (Audit Trail)' },
];

// สิทธิ์เริ่มต้นตาม Role
const ROLE_PERMISSIONS = {
  yard_manager: ['*'], // ทุกสิทธิ์
  gate_clerk: [
    'dashboard:read',
    'gate:create', 'gate:read', 'gate:update',
    'yard:read',
    'edi:read',
    'customers:read',
  ],
  surveyor: [
    'dashboard:read',
    'yard:read',
    'gate:read',
    'operations:read', 'operations:update',
    'mnr:create', 'mnr:read',
  ],
  rs_driver: [
    'dashboard:read',
    'operations:read', 'operations:update',
    'yard:read',
  ],
  billing_officer: [
    'dashboard:read',
    'billing:create', 'billing:read', 'billing:update',
    'mnr:create', 'mnr:read', 'mnr:update',
    'yard:read',
    'customers:create', 'customers:read', 'customers:update', 'customers:delete',
  ],
  customer: [
    'dashboard:read',
    'yard:read',
    'mnr:read', 'mnr:update', // อนุมัติ EOR
    'billing:read',
  ],
};

async function run() {
  let pool;
  try {
    console.log('🔌 เชื่อมต่อ CYMS_DB...');
    pool = await sql.connect(config);
    console.log('✅ เชื่อมต่อสำเร็จ!\n');

    // ล้าง permissions เดิม
    console.log('🗑️  ล้าง Permissions เดิม...');
    await pool.request().query('DELETE FROM RolePermissions');
    await pool.request().query('DELETE FROM Permissions');
    console.log('  ✅ ล้างเรียบร้อย\n');

    // เพิ่ม Permissions
    console.log('🔐 กำลังเพิ่ม Permissions...');
    const permissionMap = {};
    for (const perm of PERMISSIONS) {
      const result = await pool.request()
        .input('module', sql.NVarChar, perm.module)
        .input('action', sql.NVarChar, perm.action)
        .input('description', sql.NVarChar, perm.description)
        .query(`
          INSERT INTO Permissions (module, action, description)
          OUTPUT INSERTED.permission_id
          VALUES (@module, @action, @description)
        `);
      const permId = result.recordset[0].permission_id;
      permissionMap[`${perm.module}:${perm.action}`] = permId;
      console.log(`  ✅ ${perm.module}:${perm.action} — ${perm.description}`);
    }

    // เพิ่ม RolePermissions
    console.log('\n👥 กำลังกำหนดสิทธิ์ตาม Role...');
    const allPermKeys = Object.keys(permissionMap);

    for (const [roleCode, perms] of Object.entries(ROLE_PERMISSIONS)) {
      // หา role_id
      const roleResult = await pool.request()
        .input('roleCode', sql.NVarChar, roleCode)
        .query('SELECT role_id FROM Roles WHERE role_code = @roleCode');

      const roleId = roleResult.recordset[0]?.role_id;
      if (!roleId) { console.log(`  ❌ ไม่พบ role: ${roleCode}`); continue; }

      const permKeys = perms[0] === '*' ? allPermKeys : perms;
      let count = 0;

      for (const key of permKeys) {
        const permId = permissionMap[key];
        if (!permId) continue;

        await pool.request()
          .input('roleId', sql.Int, roleId)
          .input('permId', sql.Int, permId)
          .query('INSERT INTO RolePermissions (role_id, permission_id) VALUES (@roleId, @permId)');
        count++;
      }

      console.log(`  ✅ ${roleCode} — ${count} สิทธิ์`);
    }

    console.log('\n🎉 Granular RBAC สร้างเสร็จสมบูรณ์!');
    console.log('=============================================\n');

  } catch (err) {
    console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

run();
