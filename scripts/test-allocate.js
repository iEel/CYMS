const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const config = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'CYMS_DB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      instanceName: process.env.DB_INSTANCE || undefined,
    },
  };

  console.log('Connecting to', config.server, '/', config.options.instanceName, '/', config.database);
  const pool = await sql.connect(config);
  console.log('Connected!\n');

  // 1. Active zones
  const zones = await pool.request().input('yardId', sql.Int, 1).query(`
    SELECT zone_id, zone_name, zone_type, max_bay, max_row, max_tier, size_restriction
    FROM YardZones WHERE yard_id = @yardId AND is_active = 1 ORDER BY zone_name
  `);
  console.log('=== ACTIVE ZONES ===');
  for (const z of zones.recordset) {
    console.log(`  Zone ${z.zone_name} (id=${z.zone_id}): type=${z.zone_type}, ${z.max_bay}×${z.max_row}×${z.max_tier}=${z.max_bay*z.max_row*z.max_tier} slots, size=${z.size_restriction}`);
  }

  // 2. Containers distribution
  const dist = await pool.request().input('yardId', sql.Int, 1).query(`
    SELECT z.zone_name, c.size, c.type, COUNT(*) as cnt
    FROM Containers c
    LEFT JOIN YardZones z ON c.zone_id = z.zone_id
    WHERE c.yard_id = @yardId AND c.status = 'in_yard'
    GROUP BY z.zone_name, c.size, c.type
    ORDER BY z.zone_name, c.size, c.type
  `);
  console.log('\n=== CONTAINERS BY ZONE/SIZE/TYPE ===');
  let total = 0;
  for (const d of dist.recordset) {
    total += d.cnt;
    console.log(`  ${d.zone_name || 'NULL'}: ${d.size}'${d.type} × ${d.cnt}`);
  }
  console.log(`  TOTAL: ${total}`);

  // 3. Allocation rules
  const rules = await pool.request().query("SELECT setting_value FROM SystemSettings WHERE setting_key = 'allocation_rules'");
  console.log('\n=== ALLOCATION RULES ===');
  let rulesMap = {};
  if (rules.recordset.length > 0) {
    const parsed = JSON.parse(rules.recordset[0].setting_value);
    if (parsed.rules) {
      for (const r of parsed.rules) {
        rulesMap[r.id] = r;
        console.log(`  ${r.id}: enabled=${r.enabled}, value=${r.value}`);
      }
    }
  } else {
    console.log('  No allocation rules — using defaults (all enabled)');
  }

  const isEnabled = (id) => rulesMap[id] ? rulesMap[id].enabled : true;
  const ruleValue = (id, fallback) => rulesMap[id]?.value ?? fallback;

  // 4. Simulate auto-allocate
  console.log('\n=== SIMULATING AUTO-ALLOCATE (20ft GP) ===');
  const size = '20';
  const containerType = 'GP';

  const allC = await pool.request().input('yardId', sql.Int, 1).query(`
    SELECT zone_id, bay, [row], tier, size, type FROM Containers
    WHERE yard_id = @yardId AND status = 'in_yard'
  `);

  for (const zone of zones.recordset) {
    if (zone.size_restriction && zone.size_restriction !== 'any' && zone.size_restriction !== size) {
      console.log(`  ⏭ Zone ${zone.zone_name}: SKIP (size_restriction=${zone.size_restriction})`);
      continue;
    }
    if (isEnabled('reefer_zone') && containerType !== 'RF' && zone.zone_type === 'reefer') {
      console.log(`  ⏭ Zone ${zone.zone_name}: SKIP (reefer zone, GP container)`);
      continue;
    }
    if (isEnabled('dg_zone') && containerType !== 'DG' && zone.zone_type === 'hazmat') {
      console.log(`  ⏭ Zone ${zone.zone_name}: SKIP (hazmat zone, GP container)`);
      continue;
    }
    if (zone.zone_type === 'repair') {
      console.log(`  ⏭ Zone ${zone.zone_name}: SKIP (repair zone)`);
      continue;
    }

    const zc = allC.recordset.filter(c => c.zone_id === zone.zone_id);
    
    // Segregate size check
    if (isEnabled('segregate_size') && ruleValue('segregate_size', 'strict') === 'strict') {
      const otherSizes = zc.filter(c => c.size !== size);
      if (otherSizes.length > 0 && zc.length > 0) {
        const uniqueSizes = [...new Set(zc.map(c => c.size))];
        console.log(`  ⏭ Zone ${zone.zone_name}: SKIP (segregate_size strict: has [${uniqueSizes}], need ${size}, ${zc.length} containers)`);
        continue;
      }
    }

    // Count slots
    const stackMap = {};
    for (const c of zc) {
      const key = `${c.bay}-${c.row}`;
      stackMap[key] = Math.max(stackMap[key] || 0, c.tier);
    }
    const maxT = Math.min(zone.max_tier, isEnabled('max_tier') ? (ruleValue('max_tier', '5,3').split(',').map(Number)[0] || 5) : zone.max_tier);
    let available = 0;
    for (let b = 1; b <= zone.max_bay; b++) {
      for (let r = 1; r <= zone.max_row; r++) {
        const h = stackMap[`${b}-${r}`] || 0;
        if (h + 1 <= maxT) available++;
      }
    }
    console.log(`  ✅ Zone ${zone.zone_name}: ${zc.length} containers, ${available} slots available (maxTier=${maxT})`);
  }

  await pool.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
