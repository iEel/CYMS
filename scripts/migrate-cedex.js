/**
 * Migration: สร้างตาราง CEDEXCodes + Seed ข้อมูลเริ่มต้น (ภาษาไทย)
 * รันครั้งเดียว: node scripts/migrate-cedex.js
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

async function migrate() {
  const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: process.env.DB_INSTANCE || undefined,
    },
  };

  try {
    console.log('🔌 Connecting to database...');
    await sql.connect(config);

    // === CEDEXCodes Table ===
    const check = await sql.query`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CEDEXCodes'`;
    if (check.recordset.length > 0) {
      console.log('✅ Table CEDEXCodes already exists, skipping create.');
    } else {
      console.log('📦 Creating CEDEXCodes table...');
      await sql.query`
        CREATE TABLE CEDEXCodes (
          cedex_id        INT PRIMARY KEY IDENTITY(1,1),
          code            NVARCHAR(20) UNIQUE NOT NULL,
          component       NVARCHAR(100) NOT NULL,
          damage          NVARCHAR(200) NOT NULL,
          repair          NVARCHAR(200) NOT NULL,
          labor_hours     DECIMAL(5,2) DEFAULT 0,
          material_cost   DECIMAL(10,2) DEFAULT 0,
          is_active       BIT DEFAULT 1,
          created_at      DATETIME2 DEFAULT GETDATE(),
          updated_at      DATETIME2 DEFAULT GETDATE()
        )
      `;
      console.log('✅ CEDEXCodes table created!');
    }

    // === Seed default CEDEX codes (ภาษาไทย) ===
    const countCheck = await sql.query`SELECT COUNT(*) as cnt FROM CEDEXCodes`;
    if (countCheck.recordset[0].cnt > 0) {
      console.log(`✅ CEDEXCodes already has ${countCheck.recordset[0].cnt} rows, skipping seed.`);
      console.log('💡 ถ้าต้องการอัปเดตเป็นภาษาไทย ให้รัน: node scripts/update-cedex-thai.js');
    } else {
      console.log('🌱 Seeding default CEDEX codes (ภาษาไทย)...');
      const codes = [
        // [code, ชิ้นส่วน, ความเสียหาย, วิธีซ่อม, ชม.แรงงาน, ค่าวัสดุ]
        ['DT01', 'แผงผนัง',        'บุบ',                    'ดัดให้ตรง',             1.5,  200],
        ['DT02', 'แผงผนัง',        'เป็นรู',                  'ปะ+เชื่อม',             3.0,  500],
        ['DT03', 'แผงผนัง',        'โก่ง/บิดงอ',             'ดัดตรง+เสริมแรง',       2.0,  350],
        ['RS01', 'แผงผนัง',        'สนิม',                   'ขัดสนิม+ทาสี',          2.0,  300],
        ['RS02', 'แผงผนัง',        'ผุกร่อนรุนแรง',           'ตัด+เปลี่ยนแผง',        4.0,  900],
        ['CR01', 'เสาหัวมุม',       'แตกร้าว',                'เชื่อมซ่อม',             4.0,  800],
        ['CR02', 'เสาหัวมุม',       'งอ',                     'ดัดเสาให้ตรง',          3.0,  600],
        ['DR01', 'ประตู',           'บานพับหัก',              'เปลี่ยนบานพับ',          2.5,  600],
        ['DR02', 'ประตู',           'ยางประตูเสีย',            'เปลี่ยนยางประตู',        1.0,  400],
        ['DR03', 'ประตู',           'คานล็อคงอ',              'ดัด/เปลี่ยนคาน',        2.0,  500],
        ['FL01', 'พื้น',            'พื้นลอก/แยกชั้น',         'ซ่อมปะพื้น',            3.5,  700],
        ['FL02', 'พื้น',            'เป็นรู',                  'เปลี่ยนพื้นบางส่วน',     5.0,  1200],
        ['FL03', 'พื้น',            'บวม/โก่ง',               'เปลี่ยนไม้พื้น',         4.0,  1000],
        ['RF01', 'หลังคา',          'ทะลุ',                   'ปะ+ซีล',               2.0,  350],
        ['RF02', 'หลังคา',          'บุบ',                    'กดเรียบ+ทาสี',          1.5,  250],
        ['RR01', 'ราง/คาน',         'รางบนงอ',                'ดัดรางให้ตรง',          2.5,  450],
        ['RR02', 'ราง/คาน',         'รางล่างเสียหาย',          'เปลี่ยนรางบางส่วน',     3.5,  650],
        ['WL01', 'ผนังข้าง',        'บวมนูน',                 'กด+ขึ้นรูปใหม่',        2.0,  350],
        ['WL02', 'ผนังข้าง',        'ฉีก/ขาด',                'เชื่อม+ปะ',             2.5,  400],
        ['FR01', 'ผนังหน้า',        'บุบ',                    'ดัดให้ตรง',             1.5,  250],
        ['LB01', 'ป้ายเลขตู้',      'ลบเลือน/หาย',            'พ่นสีใหม่',             0.5,  100],
        ['VN01', 'ช่องระบายอากาศ',   'อุดตัน/เสียหาย',          'ล้าง/เปลี่ยน',          1.0,  200],
        ['SK01', 'ซีล',             'หาย/ชำรุด',              'เปลี่ยนซีลใหม่',        0.3,   50],
        ['FW01', 'ช่องรถยก',        'บิดเบี้ยว',              'ดัดช่องรถยก',           3.0,  550],
      ];

      for (const [code, component, damage, repair, labor, material] of codes) {
        await sql.query`
          INSERT INTO CEDEXCodes (code, component, damage, repair, labor_hours, material_cost)
          VALUES (${code}, ${component}, ${damage}, ${repair}, ${labor}, ${material})
        `;
      }
      console.log(`✅ Seeded ${codes.length} CEDEX codes! (ภาษาไทย)`);
    }

    console.log('\n🎉 CEDEX migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
