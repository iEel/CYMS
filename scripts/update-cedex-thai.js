/**
 * อัปเดตข้อมูล CEDEX ที่มีอยู่ให้เป็นภาษาไทย
 * รัน: node scripts/update-cedex-thai.js
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('mssql');

async function update() {
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

    const updates = [
      ['DT01', 'แผงผนัง',        'บุบ',                    'ดัดให้ตรง'],
      ['DT02', 'แผงผนัง',        'เป็นรู',                  'ปะ+เชื่อม'],
      ['DT03', 'แผงผนัง',        'โก่ง/บิดงอ',             'ดัดตรง+เสริมแรง'],
      ['RS01', 'แผงผนัง',        'สนิม',                   'ขัดสนิม+ทาสี'],
      ['RS02', 'แผงผนัง',        'ผุกร่อนรุนแรง',           'ตัด+เปลี่ยนแผง'],
      ['CR01', 'เสาหัวมุม',       'แตกร้าว',                'เชื่อมซ่อม'],
      ['CR02', 'เสาหัวมุม',       'งอ',                     'ดัดเสาให้ตรง'],
      ['DR01', 'ประตู',           'บานพับหัก',              'เปลี่ยนบานพับ'],
      ['DR02', 'ประตู',           'ยางประตูเสีย',            'เปลี่ยนยางประตู'],
      ['DR03', 'ประตู',           'คานล็อคงอ',              'ดัด/เปลี่ยนคาน'],
      ['FL01', 'พื้น',            'พื้นลอก/แยกชั้น',         'ซ่อมปะพื้น'],
      ['FL02', 'พื้น',            'เป็นรู',                  'เปลี่ยนพื้นบางส่วน'],
      ['FL03', 'พื้น',            'บวม/โก่ง',               'เปลี่ยนไม้พื้น'],
      ['RF01', 'หลังคา',          'ทะลุ',                   'ปะ+ซีล'],
      ['RF02', 'หลังคา',          'บุบ',                    'กดเรียบ+ทาสี'],
      ['RR01', 'ราง/คาน',         'รางบนงอ',                'ดัดรางให้ตรง'],
      ['RR02', 'ราง/คาน',         'รางล่างเสียหาย',          'เปลี่ยนรางบางส่วน'],
      ['WL01', 'ผนังข้าง',        'บวมนูน',                 'กด+ขึ้นรูปใหม่'],
      ['WL02', 'ผนังข้าง',        'ฉีก/ขาด',                'เชื่อม+ปะ'],
      ['FR01', 'ผนังหน้า',        'บุบ',                    'ดัดให้ตรง'],
      ['LB01', 'ป้ายเลขตู้',      'ลบเลือน/หาย',            'พ่นสีใหม่'],
      ['VN01', 'ช่องระบายอากาศ',   'อุดตัน/เสียหาย',          'ล้าง/เปลี่ยน'],
      ['SK01', 'ซีล',             'หาย/ชำรุด',              'เปลี่ยนซีลใหม่'],
      ['FW01', 'ช่องรถยก',        'บิดเบี้ยว',              'ดัดช่องรถยก'],
    ];

    let updated = 0;
    for (const [code, component, damage, repair] of updates) {
      const result = await sql.query`
        UPDATE CEDEXCodes SET
          component = ${component},
          damage = ${damage},
          repair = ${repair},
          updated_at = GETDATE()
        WHERE code = ${code}
      `;
      if (result.rowsAffected[0] > 0) {
        console.log(`  ✅ ${code}: ${component} — ${damage} → ${repair}`);
        updated++;
      } else {
        console.log(`  ⚠️ ${code}: ไม่พบในฐานข้อมูล (ข้าม)`);
      }
    }

    console.log(`\n🎉 อัปเดตเป็นภาษาไทยแล้ว ${updated}/${updates.length} รายการ`);
  } catch (error) {
    console.error('❌ Update error:', error.message);
  } finally {
    await sql.close();
  }
}

update();
