// ===================================
// CYMS — Seed Demo Users Script
// เพิ่มบัญชีทดสอบเข้าฐานข้อมูล
// ===================================

const sql = require('mssql');
const bcrypt = require('bcryptjs');
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

const demoUsers = [
  { username: 'admin',     password: 'admin123',   fullName: 'ผู้ดูแลระบบ',      roleCode: 'yard_manager',    email: 'admin@cyms.local',     yardIds: [1, 2] },
  { username: 'gate01',    password: 'gate123',    fullName: 'สมชาย ประตูลาน',   roleCode: 'gate_clerk',      email: 'gate01@cyms.local',    yardIds: [1] },
  { username: 'survey01',  password: 'survey123',  fullName: 'สมหญิง สำรวจ',     roleCode: 'surveyor',        email: 'survey01@cyms.local',  yardIds: [1, 2] },
  { username: 'driver01',  password: 'driver123',  fullName: 'สมศักดิ์ ขับรถยก',  roleCode: 'rs_driver',       email: 'driver01@cyms.local',  yardIds: [1] },
  { username: 'billing01', password: 'billing123', fullName: 'สมปอง บัญชี',      roleCode: 'billing_officer', email: 'billing01@cyms.local', yardIds: [1, 2] },
];

async function run() {
  let pool;
  try {
    console.log('🔌 เชื่อมต่อฐานข้อมูล CYMS_DB...');
    pool = await sql.connect(config);
    console.log('✅ เชื่อมต่อสำเร็จ!\n');

    // ลบ user เก่าทั้งหมด (ยกเว้น system data)
    console.log('🗑️  ล้างข้อมูล user เดิม...');
    await pool.request().query('DELETE FROM UserYardAccess');
    await pool.request().query('DELETE FROM Users');
    console.log('  ✅ ล้างเรียบร้อย\n');

    console.log('👤 กำลังเพิ่มบัญชีทดสอบ...');
    for (const user of demoUsers) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(user.password, salt);

      // หา role_id จาก role_code
      const roleResult = await pool.request()
        .input('roleCode', sql.NVarChar, user.roleCode)
        .query('SELECT role_id FROM Roles WHERE role_code = @roleCode');
      
      const roleId = roleResult.recordset[0]?.role_id;
      if (!roleId) {
        console.log(`  ❌ ไม่พบ role: ${user.roleCode}`);
        continue;
      }

      // เพิ่ม user
      const insertResult = await pool.request()
        .input('username', sql.NVarChar, user.username)
        .input('passwordHash', sql.NVarChar, hash)
        .input('fullName', sql.NVarChar, user.fullName)
        .input('roleId', sql.Int, roleId)
        .input('email', sql.NVarChar, user.email)
        .query(`
          INSERT INTO Users (username, password_hash, full_name, role_id, email, status)
          OUTPUT INSERTED.user_id
          VALUES (@username, @passwordHash, @fullName, @roleId, @email, 'active')
        `);
      
      const userId = insertResult.recordset[0].user_id;

      // เพิ่มสิทธิ์เข้าถึงลาน
      for (const yardId of user.yardIds) {
        await pool.request()
          .input('userId', sql.Int, userId)
          .input('yardId', sql.Int, yardId)
          .query('INSERT INTO UserYardAccess (user_id, yard_id) VALUES (@userId, @yardId)');
      }

      console.log(`  ✅ ${user.username} (${user.fullName}) — role: ${user.roleCode}, yards: [${user.yardIds.join(',')}]`);
    }

    console.log('\n🎉 เพิ่มบัญชีทดสอบเสร็จสมบูรณ์!');
    console.log('=============================================');
    console.log('\nบัญชีทดสอบ:');
    console.log('  admin     / admin123    — ผู้จัดการลาน');
    console.log('  gate01    / gate123     — พนักงานประตู');
    console.log('  survey01  / survey123   — พนักงานสำรวจ');
    console.log('  driver01  / driver123   — คนขับรถยก');
    console.log('  billing01 / billing123  — พนักงานบัญชี');

  } catch (err) {
    console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

run();
