export interface YardPlanningZone {
  zone_name: string;
  zone_type?: string | null;
  capacity?: number | null;
  container_count?: number | null;
  occupancy_pct?: number | null;
}

export interface YardPlanningContainer {
  container_id?: number;
  container_number: string;
  zone_name?: string | null;
  bay?: number | null;
  row?: number | null;
  tier?: number | null;
  status?: string | null;
  gate_in_date?: string | null;
  container_grade?: string | null;
  hold_status?: string | null;
  is_laden?: boolean | null;
  booking_ref?: string | null;
}

export interface YardPlanningInput {
  zones: YardPlanningZone[];
  containers: YardPlanningContainer[];
  now?: Date;
}

export interface YardZoneHeatmapRow {
  zone_name: string;
  zone_type: string;
  occupancy_pct: number;
  avg_age_days: number;
  max_age_days: number;
  active_count: number;
  risk: 'low' | 'watch' | 'high' | 'critical';
}

export interface YardMoveRecommendation {
  container_number: string;
  action: 'pre_marshal_for_release' | 'move_to_repair_review' | 'rebalance_congested_zone';
  from_slot: string;
  reason: string;
  priority: number;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dwellDays(value?: string | null, now = new Date()) {
  if (!value) return 0;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  const diff = startOfDay(now).getTime() - startOfDay(parsed).getTime();
  return Math.max(1, Math.floor(diff / 86_400_000) + 1);
}

function active(container: YardPlanningContainer) {
  return container.status !== 'released' && container.status !== 'gated_out';
}

function riskFrom(occupancy: number, avgAge: number, maxAge: number): YardZoneHeatmapRow['risk'] {
  if (occupancy >= 90 || maxAge >= 45) return 'critical';
  if (occupancy >= 80 || avgAge >= 21) return 'high';
  if (occupancy >= 65 || avgAge >= 14) return 'watch';
  return 'low';
}

function slotLabel(container: YardPlanningContainer) {
  return `${container.zone_name || '-'} B${container.bay || '-'}-R${container.row || '-'}-T${container.tier || '-'}`;
}

function isReleaseReady(container: YardPlanningContainer) {
  const grade = (container.container_grade || 'A').toUpperCase();
  return active(container)
    && container.status === 'in_yard'
    && Boolean(container.booking_ref)
    && !container.hold_status
    && !container.is_laden
    && ['A', 'B'].includes(grade);
}

function isBlocked(container: YardPlanningContainer) {
  const grade = (container.container_grade || 'A').toUpperCase();
  return active(container)
    && (Boolean(container.hold_status) || ['hold', 'repair'].includes(container.status || '') || ['C', 'D'].includes(grade) || Boolean(container.is_laden));
}

export function buildYardPlanningSnapshot(input: YardPlanningInput) {
  const now = input.now || new Date();
  const activeContainers = input.containers.filter(active);

  const zoneHeatmap: YardZoneHeatmapRow[] = input.zones.map(zone => {
    const zoneContainers = activeContainers.filter(container => container.zone_name === zone.zone_name);
    const ages = zoneContainers.map(container => dwellDays(container.gate_in_date, now));
    const avgAge = ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : 0;
    const maxAge = ages.length ? Math.max(...ages) : 0;
    const occupancy = Number(zone.occupancy_pct || 0);
    return {
      zone_name: zone.zone_name,
      zone_type: zone.zone_type || 'dry',
      occupancy_pct: occupancy,
      avg_age_days: avgAge,
      max_age_days: maxAge,
      active_count: zoneContainers.length,
      risk: riskFrom(occupancy, avgAge, maxAge),
    };
  }).sort((a, b) => {
    const order = { critical: 4, high: 3, watch: 2, low: 1 };
    return order[b.risk] - order[a.risk] || b.max_age_days - a.max_age_days;
  });

  const moveRecommendations: YardMoveRecommendation[] = activeContainers.flatMap<YardMoveRecommendation>(container => {
    const age = dwellDays(container.gate_in_date, now);
    const tier = Number(container.tier || 0);
    if (isReleaseReady(container) && (age >= 14 || tier >= 3)) {
      return [{
        container_number: container.container_number,
        action: 'pre_marshal_for_release' as const,
        from_slot: slotLabel(container),
        reason: `Ready booking ${container.booking_ref}; dwell ${age} days; tier ${tier || '-'}`,
        priority: age + tier * 5,
      }];
    }
    if (isBlocked(container) && age >= 7) {
      return [{
        container_number: container.container_number,
        action: 'move_to_repair_review' as const,
        from_slot: slotLabel(container),
        reason: `Blocked/hold container aging ${age} days`,
        priority: age,
      }];
    }
    return [];
  }).sort((a, b) => b.priority - a.priority).slice(0, 8);

  const readyToday = activeContainers.filter(isReleaseReady).length;
  const blocked = activeContainers.filter(isBlocked).length;
  const congestionForecast = zoneHeatmap
    .filter(zone => zone.risk !== 'low')
    .map(zone => ({
      zone_name: zone.zone_name,
      risk: zone.risk,
      message: zone.risk === 'critical'
        ? 'Near capacity or very old dwell. Pre-marshal and open overflow slots.'
        : zone.risk === 'high'
          ? 'Watch congestion. Prioritize releases and avoid stacking old containers.'
          : 'Monitor occupancy and dwell aging.',
    }));

  return {
    zone_heatmap: zoneHeatmap,
    move_recommendations: moveRecommendations,
    daily_release_forecast: {
      ready_today: readyToday,
      next_3_days: readyToday + Math.ceil(activeContainers.filter(container => !isBlocked(container) && dwellDays(container.gate_in_date, now) >= 7).length * 0.25),
      blocked,
    },
    congestion_forecast: congestionForecast,
  };
}
