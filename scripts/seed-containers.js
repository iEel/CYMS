// ===================================
// CYMS — Seed Demo Containers
// เพิ่มตู้ตัวอย่างเข้าฐานข้อมูล
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

// ต้องสร้าง zones ก่อน
const ZONES = [
  { yard_id: 1, zone_name: 'A', zone_type: 'dry', max_tier: 5, max_bay: 10, max_row: 6 },
  { yard_id: 1, zone_name: 'B', zone_type: 'dry', max_tier: 5, max_bay: 10, max_row: 6 },
  { yard_id: 1, zone_name: 'C', zone_type: 'dry', max_tier: 4, max_bay: 8, max_row: 6 },
  { yard_id: 1, zone_name: 'R1', zone_type: 'reefer', max_tier: 3, max_bay: 6, max_row: 4, has_reefer_plugs: true },
  { yard_id: 1, zone_name: 'H', zone_type: 'hazmat', max_tier: 2, max_bay: 4, max_row: 4 },
  { yard_id: 1, zone_name: 'E', zone_type: 'empty', max_tier: 6, max_bay: 12, max_row: 8 },
  { yard_id: 1, zone_name: 'M', zone_type: 'repair', max_tier: 2, max_bay: 4, max_row: 4 },
  { yard_id: 2, zone_name: 'A', zone_type: 'dry', max_tier: 5, max_bay: 8, max_row: 6 },
  { yard_id: 2, zone_name: 'B', zone_type: 'dry', max_tier: 5, max_bay: 8, max_row: 6 },
  { yard_id: 2, zone_name: 'R1', zone_type: 'reefer', max_tier: 3, max_bay: 4, max_row: 4, has_reefer_plugs: true },
];

const SHIPPING_LINES = ['Evergreen', 'MSC', 'Maersk', 'COSCO', 'CMA CGM', 'ONE', 'Yang Ming', 'HMM', 'ZIM', 'PIL'];
const SIZES = ['20', '40', '40'];
const TYPES = ['GP', 'GP', 'HC', 'RF', 'OT'];
const STATUSES = ['in_yard', 'in_yard', 'in_yard', 'in_yard', 'hold', 'repair'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function generateContainerNumber() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const owner = Array.from({length: 3}, () => letters[randomInt(0, 25)]).join('') + 'U';
  const num = String(randomInt(1000000, 9999999)).slice(0, 7);
  return owner + num;
}

async function run() {
  let pool;
  try {
    console.log('🔌 เชื่อมต่อ CYMS_DB...');
    pool = await sql.connect(config);
    console.log('✅ เชื่อมต่อสำเร็จ!\n');

    // สร้าง zones (ถ้ายังไม่มี)
    const existingZones = await pool.request().query('SELECT COUNT(*) as cnt FROM YardZones');
    if (existingZones.recordset[0].cnt === 0) {
      console.log('📦 กำลังสร้าง Zones...');
      for (const zone of ZONES) {
        await pool.request()
          .input('yardId', sql.Int, zone.yard_id)
          .input('zoneName', sql.NVarChar, zone.zone_name)
          .input('zoneType', sql.NVarChar, zone.zone_type)
          .input('maxTier', sql.Int, zone.max_tier)
          .input('maxBay', sql.Int, zone.max_bay)
          .input('maxRow', sql.Int, zone.max_row)
          .input('hasReeferPlugs', sql.Bit, zone.has_reefer_plugs || false)
          .query(`
            INSERT INTO YardZones (yard_id, zone_name, zone_type, max_tier, max_bay, max_row, has_reefer_plugs)
            VALUES (@yardId, @zoneName, @zoneType, @maxTier, @maxBay, @maxRow, @hasReeferPlugs)
          `);
        console.log(`  ✅ Zone ${zone.zone_name} (${zone.zone_type}) — Yard ${zone.yard_id}`);
      }
    } else {
      console.log(`ℹ️  Zones มีอยู่แล้ว (${existingZones.recordset[0].cnt})\n`);
    }

    // ดึง zone_ids
    const zonesResult = await pool.request().query('SELECT zone_id, yard_id, zone_name, zone_type, max_bay, max_row, max_tier FROM YardZones');
    const zones = zonesResult.recordset;

    // สร้าง containers ตัวอย่าง
    const existingContainers = await pool.request().query('SELECT COUNT(*) as cnt FROM Containers');
    if (existingContainers.recordset[0].cnt > 0) {
      // ลบของเก่าแล้ว seed ใหม่
      console.log(`🗑️  ลบ Containers เดิม (${existingContainers.recordset[0].cnt}) แล้ว seed ใหม่...`);
      await pool.request().query('DELETE FROM Containers');
    }

    console.log('\n🚢 กำลังสร้าง Containers (stack จากพื้นขึ้นบน)...');
    let count = 0;
    const usedNumbers = new Set();

    for (const zone of zones) {
      // สร้าง grid — แต่ละ bay×row มีตู้กี่ tier (stack from ground up)
      // เติม ~30-60% ของ capacity
      const capacity = zone.max_bay * zone.max_row * zone.max_tier;
      const fillCount = Math.floor(capacity * (0.3 + Math.random() * 0.3));

      // สร้าง stack heights per bay×row slot
      const stacks = {}; // key: "bay-row" → current tier count
      let placed = 0;

      // สุ่มเลือก bay×row slots แล้ววาง tier ทีละชั้น
      const slots = [];
      for (let b = 1; b <= zone.max_bay; b++) {
        for (let r = 1; r <= zone.max_row; r++) {
          slots.push({ bay: b, row: r });
        }
      }

      while (placed < fillCount) {
        // สุ่มเลือก slot ที่ยังไม่เต็ม
        const availableSlots = slots.filter(s => {
          const key = `${s.bay}-${s.row}`;
          return (stacks[key] || 0) < zone.max_tier;
        });
        if (availableSlots.length === 0) break;

        const slot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        const key = `${slot.bay}-${slot.row}`;
        const currentTier = (stacks[key] || 0) + 1; // วางชั้นถัดไป (1, 2, 3...)
        stacks[key] = currentTier;

        let containerNum;
        do { containerNum = generateContainerNumber(); } while (usedNumbers.has(containerNum));
        usedNumbers.add(containerNum);

        const size = randomItem(SIZES);
        const type = zone.zone_type === 'reefer' ? 'RF' : randomItem(TYPES);
        const status = randomItem(STATUSES);
        const isLaden = Math.random() > 0.4;
        const shippingLine = randomItem(SHIPPING_LINES);
        const daysAgo = randomInt(0, 30);
        const gateInDate = new Date(Date.now() - daysAgo * 86400000);

        try {
          await pool.request()
            .input('cn', sql.NVarChar, containerNum)
            .input('sz', sql.NVarChar, size)
            .input('tp', sql.NVarChar, type)
            .input('st', sql.NVarChar, status)
            .input('yi', sql.Int, zone.yard_id)
            .input('zi', sql.Int, zone.zone_id)
            .input('b', sql.Int, slot.bay)
            .input('r', sql.Int, slot.row)
            .input('t', sql.Int, currentTier)
            .input('sl', sql.NVarChar, shippingLine)
            .input('il', sql.Bit, isLaden)
            .input('gd', sql.DateTime2, gateInDate)
            .query(`
              INSERT INTO Containers (container_number, size, type, status, yard_id, zone_id, bay, [row], tier, shipping_line, is_laden, gate_in_date)
              VALUES (@cn, @sz, @tp, @st, @yi, @zi, @b, @r, @t, @sl, @il, @gd)
            `);
          count++;
          placed++;
        } catch (e) { /* skip duplicates */ }
      }
      console.log(`  ✅ Zone ${zone.zone_name} — ${placed} ตู้ (stacked ถูกต้อง)`);
    }
    console.log(`  📦 รวม ${count} ตู้`);

    // สรุป
    const summary = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_yard' THEN 1 ELSE 0 END) as in_yard,
        SUM(CASE WHEN status = 'hold' THEN 1 ELSE 0 END) as on_hold,
        SUM(CASE WHEN status = 'repair' THEN 1 ELSE 0 END) as in_repair
      FROM Containers
    `);
    const s = summary.recordset[0];
    console.log(`\n📊 สรุป: ${s.total} ตู้ทั้งหมด | ${s.in_yard} ในลาน | ${s.on_hold} hold | ${s.in_repair} ซ่อม`);
    console.log(`\n🎉 เสร็จสมบูรณ์!`);

  } catch (err) {
    console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

run();
