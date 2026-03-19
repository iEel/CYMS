/**
 * Migration: สร้างตาราง CEDEXCodes + Seed ข้อมูลเริ่มต้น
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

    // === Seed default CEDEX codes ===
    const countCheck = await sql.query`SELECT COUNT(*) as cnt FROM CEDEXCodes`;
    if (countCheck.recordset[0].cnt > 0) {
      console.log(`✅ CEDEXCodes already has ${countCheck.recordset[0].cnt} rows, skipping seed.`);
    } else {
      console.log('🌱 Seeding default CEDEX codes...');
      const codes = [
        ['DT01', 'Panel',       'Dent',              'Straighten',        1.5,  200],
        ['DT02', 'Panel',       'Hole',              'Patch & weld',      3.0,  500],
        ['DT03', 'Panel',       'Buckle',            'Straighten & reinforce', 2.0, 350],
        ['RS01', 'Panel',       'Rust',              'Sand & repaint',    2.0,  300],
        ['RS02', 'Panel',       'Corrosion',         'Cut & replace panel', 4.0, 900],
        ['CR01', 'Corner Post', 'Crack',             'Weld repair',       4.0,  800],
        ['CR02', 'Corner Post', 'Bent',              'Straighten post',   3.0,  600],
        ['DR01', 'Door',        'Hinge broken',      'Replace hinge',     2.5,  600],
        ['DR02', 'Door',        'Gasket damaged',    'Replace gasket',    1.0,  400],
        ['DR03', 'Door',        'Locking bar bent',  'Straighten/replace', 2.0, 500],
        ['FL01', 'Floor',       'Delamination',      'Patch floor',       3.5,  700],
        ['FL02', 'Floor',       'Hole',              'Replace section',   5.0,  1200],
        ['FL03', 'Floor',       'Warping',           'Replace boards',    4.0,  1000],
        ['RF01', 'Roof',        'Puncture',          'Patch & seal',      2.0,  350],
        ['RF02', 'Roof',        'Dent',              'Press & repaint',   1.5,  250],
        ['RR01', 'Rail',        'Bent top rail',     'Straighten rail',   2.5,  450],
        ['RR02', 'Rail',        'Bottom rail damage','Replace section',   3.5,  650],
        ['WL01', 'Side Wall',   'Bulge',             'Press & reshape',   2.0,  350],
        ['WL02', 'Side Wall',   'Cut/tear',          'Weld & patch',      2.5,  400],
        ['FR01', 'Front Wall',  'Dent',              'Straighten',        1.5,  250],
        ['LB01', 'Label',       'Missing/illegible', 'Re-stencil',        0.5,  100],
        ['VN01', 'Ventilation', 'Blocked/damaged',   'Clean/replace',     1.0,  200],
        ['SK01', 'Seal',        'Missing/broken',    'Replace seal',      0.3,   50],
        ['FW01', 'Forklift Pocket', 'Deformed',      'Reshape pocket',    3.0,  550],
      ];

      for (const [code, component, damage, repair, labor, material] of codes) {
        await sql.query`
          INSERT INTO CEDEXCodes (code, component, damage, repair, labor_hours, material_cost)
          VALUES (${code}, ${component}, ${damage}, ${repair}, ${labor}, ${material})
        `;
      }
      console.log(`✅ Seeded ${codes.length} CEDEX codes!`);
    }

    console.log('\n🎉 CEDEX migration completed!');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await sql.close();
  }
}

migrate();
