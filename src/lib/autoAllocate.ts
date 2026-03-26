import sql from 'mssql';

/**
 * Smart Auto-Allocation Logic
 * Shared between Gate-In and Transfer Receive
 * Reads allocation rules from SystemSettings
 */

interface AllocRule { id: string; enabled: boolean; value: string; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAllocationRules(db: any): Promise<Record<string, AllocRule>> {
  try {
    const result = await db.request().query(
      "SELECT setting_value FROM SystemSettings WHERE setting_key = 'allocation_rules'"
    );
    if (result.recordset.length > 0) {
      const parsed = JSON.parse(result.recordset[0].setting_value);
      if (parsed.rules && Array.isArray(parsed.rules)) {
        const map: Record<string, AllocRule> = {};
        for (const r of parsed.rules) map[r.id] = r;
        return map;
      }
    }
  } catch { /* use defaults */ }
  return {};
}

export interface AllocationResult {
  zone_id: number;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  reason: string;
  score: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function autoAllocate(
  db: any,
  yardId: number,
  size: string,
  containerType: string,
  shippingLine?: string,
  isLaden?: boolean
): Promise<AllocationResult | null> {
  const rulesMap = await loadAllocationRules(db);
  const isEnabled = (id: string) => rulesMap[id] ? rulesMap[id].enabled : true; // default enabled
  const ruleValue = (id: string, fallback: string) => rulesMap[id]?.value ?? fallback;

  // Parse max_tier from rule (format: "emptyMax,ladenMax")
  const maxTierParts = ruleValue('max_tier', '5,3').split(',').map(Number);
  const maxTierEmpty = maxTierParts[0] || 5;
  const maxTierLaden = maxTierParts[1] || 3;
  const effectiveMaxTier = isLaden ? maxTierLaden : maxTierEmpty;

  // 1. ดึงโซนทั้งหมดในลาน
  const zonesResult = await db.request()
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT z.zone_id, z.zone_name, z.zone_type, z.max_bay, z.max_row, z.max_tier,
        z.has_reefer_plugs, z.size_restriction
      FROM YardZones z
      WHERE z.yard_id = @yardId AND z.is_active = 1
      ORDER BY z.zone_name
    `);
  const zones = zonesResult.recordset;
  if (zones.length === 0) return null;

  // 2. ดึงตู้ปัจจุบันในลาน
  const containersResult = await db.request()
    .input('yardId', sql.Int, yardId)
    .query(`
      SELECT zone_id, bay, [row], tier, shipping_line, size, type
      FROM Containers
      WHERE yard_id = @yardId AND status = 'in_yard'
    `);
  const containers = containersResult.recordset;

  // 3. กฎวางตู้ (Allocation Rules — read from DB)
  let bestSlot: AllocationResult | null = null;

  for (const zone of zones) {
    // Size restriction (from zone config)
    if (zone.size_restriction && zone.size_restriction !== 'any' && zone.size_restriction !== size) continue;

    // Reefer zone rule
    if (isEnabled('reefer_zone')) {
      if (containerType === 'RF' && zone.zone_type !== 'reefer') continue;
      if (containerType !== 'RF' && zone.zone_type === 'reefer') continue;
    }

    // DG zone rule
    if (isEnabled('dg_zone')) {
      if (containerType === 'DG' && zone.zone_type !== 'hazmat') continue;
      if (containerType !== 'DG' && zone.zone_type === 'hazmat') continue;
    }

    // Skip repair zones always
    if (zone.zone_type === 'repair') continue;

    const zoneContainers = containers.filter((c: Record<string, unknown>) => c.zone_id === zone.zone_id);

    // Segregate by size: skip zone if it has different-size containers (strict mode)
    if (isEnabled('segregate_size') && ruleValue('segregate_size', 'strict') === 'strict') {
      const hasOtherSize = zoneContainers.some((c: Record<string, unknown>) => c.size !== size);
      if (hasOtherSize && zoneContainers.length > 0) continue;
    }

    // Segregate by type: skip zone if it has different-type containers (strict mode)
    if (isEnabled('segregate_type') && ruleValue('segregate_type', 'preferred') === 'strict') {
      const hasOtherType = zoneContainers.some((c: Record<string, unknown>) => c.type !== containerType);
      if (hasOtherType && zoneContainers.length > 0) continue;
    }

    const stackMap: Record<string, number> = {};
    for (const c of zoneContainers) {
      const key = `${c.bay}-${c.row}`;
      stackMap[key] = Math.max(stackMap[key] || 0, c.tier as number);
    }

    // สายเรือเดียวกัน → Bay เดียวกัน (if enabled)
    const sameLineBays = new Set<number>();
    if (isEnabled('segregate_line') && shippingLine) {
      zoneContainers.filter((c: Record<string, unknown>) => c.shipping_line === shippingLine)
        .forEach((c: Record<string, unknown>) => sameLineBays.add(c.bay as number));
    }

    // Use zone max_tier capped by rule max_tier
    const zoneMaxTier = Math.min(zone.max_tier, isEnabled('max_tier') ? effectiveMaxTier : zone.max_tier);

    for (let bay = 1; bay <= zone.max_bay; bay++) {
      for (let row = 1; row <= zone.max_row; row++) {
        const key = `${bay}-${row}`;
        const currentHeight = stackMap[key] || 0;
        const nextTier = currentHeight + 1;
        if (nextTier > zoneMaxTier) continue;

        let score = 100;
        const reasons: string[] = [];

        // Shipping line grouping bonus
        if (isEnabled('segregate_line') && shippingLine && sameLineBays.has(bay)) {
          score += 30;
          reasons.push(`สายเรือ ${shippingLine} อยู่ Bay นี้`);
        }

        // Type preference bonus (preferred mode)
        if (isEnabled('segregate_type') && ruleValue('segregate_type', 'preferred') === 'preferred') {
          const sameTypeInZone = zoneContainers.filter((c: Record<string, unknown>) => c.type === containerType).length;
          if (sameTypeInZone > 0) {
            score += 10;
            reasons.push('ประเภทตู้ตรงกับโซน');
          }
        }

        // Lower tier = easier to pick
        score += (zoneMaxTier - nextTier) * 5;
        if (nextTier === 1) reasons.push('วางบนพื้น (หยิบง่าย)');

        // Spread-even: bonus for zones with more free space
        if (isEnabled('spread_even')) {
          const zoneLoad = zoneContainers.length / (zone.max_bay * zone.max_row * zone.max_tier);
          if (zoneLoad < 0.5) {
            score += 15;
            reasons.push(`โซนว่าง ${((1 - zoneLoad) * 100).toFixed(0)}%`);
          }
          if (zoneLoad < 0.2) score += 10; // extra bonus for very empty zones
        }

        // Nearest gate: prefer lower bay numbers
        if (isEnabled('nearest_gate')) {
          const gateBonus = Math.max(0, (zone.max_bay - bay + 1) * 2);
          score += gateBonus;
          if (bay <= 3) reasons.push('ใกล้ประตู');
        }

        // Penalty for high stacking
        if (nextTier > 3) score -= (nextTier - 3) * 10;

        if (!bestSlot || score > bestSlot.score) {
          bestSlot = {
            zone_id: zone.zone_id, zone_name: zone.zone_name,
            bay, row, tier: nextTier,
            reason: reasons.length > 0 ? reasons.join(' • ') : `โซน ${zone.zone_name} ว่าง`,
            score,
          };
        }
      }
    }
  }

  return bestSlot;
}
