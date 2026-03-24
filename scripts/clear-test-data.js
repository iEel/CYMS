/**
 * 🧹 Clear Test Data — เคลียข้อมูลทดสอบก่อนขึ้น Production
 * 
 * ลบเฉพาะ "ข้อมูลธุรกรรม" (ตู้, บิล, gate, work orders ฯลฯ)
 * เก็บ "ข้อมูลตั้งค่า" ไว้ (users, permissions, tariff, yards, zones, customers, CEDEX codes)
 * 
 * Usage: node scripts/clear-test-data.js
 * 
 * ⚠️ คำเตือน: ลบข้อมูลถาวร ไม่สามารถกู้คืนได้!
 */

require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

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

async function clearTestData() {
  console.log('');
  console.log('🧹 ═══════════════════════════════════════════════');
  console.log('   CYMS — Clear Test Data');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  คำเตือน: จะลบข้อมูลธุรกรรมทั้งหมด!');
  console.log('   ข้อมูลที่จะถูกลบ:');
  console.log('   - ตู้คอนเทนเนอร์ (Containers)');
  console.log('   - ธุรกรรม Gate-In/Out (GateTransactions)');
  console.log('   - ใบแจ้งหนี้ + รายการ (Invoices, InvoiceItems)');
  console.log('   - ใบสั่งงาน (WorkOrders)');
  console.log('   - ใบสั่งซ่อม (MaintenanceRepair)');
  console.log('   - EDI Logs + Bookings');
  console.log('   - Audit Logs');
  console.log('   - Hold/Release records');
  console.log('');
  console.log('   ✅ ข้อมูลที่เก็บไว้:');
  console.log('   - Users + Permissions');
  console.log('   - Yards + Zones');
  console.log('   - Customers');
  console.log('   - Tariff + Storage Rates + Demurrage Rates');
  console.log('   - CEDEX Codes');
  console.log('   - Company Profile');
  console.log('   - System Settings');
  console.log('   - EDI Endpoints Config');
  console.log('');

  // Safety check: require --confirm flag
  if (!process.argv.includes('--confirm')) {
    console.log('❌ เพื่อความปลอดภัย ต้องใส่ --confirm');
    console.log('');
    console.log('   node scripts/clear-test-data.js --confirm');
    console.log('');
    process.exit(1);
  }

  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ เชื่อมต่อ DB สำเร็จ\n');

    // ลำดับลบสำคัญ — ต้องลบ child tables ก่อน parent tables
    const tables = [
      // Children first
      { name: 'InvoiceItems', label: 'รายการในบิล' },
      { name: 'Invoices', label: 'ใบแจ้งหนี้/ใบเสร็จ' },
      { name: 'AuditLogs', label: 'Audit Logs' },
      { name: 'WorkOrders', label: 'ใบสั่งงาน' },
      { name: 'MaintenanceRepair', label: 'ใบสั่งซ่อม M&R' },
      { name: 'ContainerHolds', label: 'Hold/Release' },
      { name: 'EDISendLog', label: 'EDI Send Log' },
      { name: 'Bookings', label: 'Bookings/Manifest' },
      { name: 'GateTransactions', label: 'ธุรกรรม Gate' },
      // Parent last
      { name: 'Containers', label: 'ตู้คอนเทนเนอร์' },
    ];

    let totalDeleted = 0;

    for (const t of tables) {
      try {
        // Check if table exists
        const check = await pool.request().query(`
          SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_NAME = '${t.name}'
        `);
        if (check.recordset[0].cnt === 0) {
          console.log(`   ⏭️  ${t.name} — ไม่พบตาราง (ข้าม)`);
          continue;
        }

        // Count before delete
        const countResult = await pool.request().query(`SELECT COUNT(*) as cnt FROM ${t.name}`);
        const count = countResult.recordset[0].cnt;

        if (count === 0) {
          console.log(`   ✓  ${t.name} — ว่างอยู่แล้ว`);
          continue;
        }

        // Delete all rows
        await pool.request().query(`DELETE FROM ${t.name}`);
        totalDeleted += count;
        console.log(`   🗑️  ${t.name} — ลบ ${count} รายการ (${t.label})`);
      } catch (err) {
        console.log(`   ⚠️  ${t.name} — ข้ามเนื่องจาก: ${err.message.substring(0, 60)}`);
      }
    }

    // Reset identity columns
    console.log('\n🔄 Reset running numbers...');
    for (const t of tables) {
      try {
        await pool.request().query(`
          IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${t.name}')
            DBCC CHECKIDENT ('${t.name}', RESEED, 0)
        `);
      } catch { /* some tables may not have identity */ }
    }

    // Also delete uploaded files info
    console.log('\n📁 หมายเหตุ: ไฟล์ใน public/uploads/ ต้องลบเองถ้าต้องการ');
    console.log('   rm -rf public/uploads/gate-photos/*');
    console.log('   rm -rf public/uploads/exit-photos/*');
    console.log('   rm -rf public/uploads/repair-photos/*');

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`✅ เคลียข้อมูลทดสอบสำเร็จ! ลบทั้งหมด ${totalDeleted} รายการ`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\n💡 ขั้นตอนถัดไป:');
    console.log('   1. ลบไฟล์ uploads (ถ้ามี): rm -rf public/uploads/*/');
    console.log('   2. Restart: pm2 restart cyms');
    console.log('   3. เริ่มใช้งาน Production ได้เลย! 🚀\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

clearTestData();
