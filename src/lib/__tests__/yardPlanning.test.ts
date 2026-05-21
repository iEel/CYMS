import { buildYardPlanningSnapshot } from '../yardPlanning';

describe('yard planning helpers', () => {
  const now = new Date('2026-05-21T08:00:00.000Z');
  const zones = [
    { zone_id: 1, zone_name: 'A', zone_type: 'dry', capacity: 10, container_count: 9, occupancy_pct: 90, max_bay: 1, max_row: 2, max_tier: 3 },
    { zone_id: 2, zone_name: 'B', zone_type: 'empty', capacity: 10, container_count: 4, occupancy_pct: 40, max_bay: 1, max_row: 1, max_tier: 2 },
    { zone_id: 3, zone_name: 'C', zone_type: 'empty', capacity: 10, container_count: 0, occupancy_pct: 0, max_bay: 1, max_row: 1, max_tier: 1 },
  ];
  const containers = [
    {
      container_id: 1,
      container_number: 'MSKU1111111',
      zone_id: 1,
      zone_name: 'A',
      bay: 1,
      row: 1,
      tier: 3,
      status: 'in_yard',
      gate_in_date: '2026-04-01T08:00:00.000Z',
      container_grade: 'A',
      is_laden: false,
      booking_ref: 'BK-READY',
    },
    {
      container_id: 2,
      container_number: 'MSKU2222222',
      zone_id: 1,
      zone_name: 'A',
      bay: 1,
      row: 1,
      tier: 1,
      status: 'in_yard',
      gate_in_date: '2026-05-20T08:00:00.000Z',
      container_grade: 'B',
      is_laden: false,
      booking_ref: 'BK-READY',
    },
    {
      container_id: 3,
      container_number: 'MSKU3333333',
      zone_id: 2,
      zone_name: 'B',
      bay: 2,
      row: 1,
      tier: 1,
      status: 'hold',
      gate_in_date: '2026-05-18T08:00:00.000Z',
      container_grade: 'C',
      is_laden: true,
      booking_ref: null,
    },
  ];

  it('builds slot aging heatmap and congestion risk by zone', () => {
    const snapshot = buildYardPlanningSnapshot({ zones, containers, now });

    expect(snapshot.zone_heatmap[0]).toMatchObject({
      zone_name: 'A',
      occupancy_pct: 90,
      risk: 'critical',
    });
    expect(snapshot.zone_heatmap[0].max_age_days).toBeGreaterThan(40);
    expect(snapshot.congestion_forecast[0]).toMatchObject({
      zone_name: 'A',
      risk: 'critical',
    });
  });

  it('recommends old high-tier ready-release containers for pre-marshalling', () => {
    const snapshot = buildYardPlanningSnapshot({ zones, containers, now });

    expect(snapshot.move_recommendations[0]).toMatchObject({
      container_id: 1,
      container_number: 'MSKU1111111',
      action: 'pre_marshal_for_release',
      from_slot: 'A B1-R1-T3',
      to_zone_id: 3,
      to_slot: 'C B1-R1-T1',
    });
  });

  it('forecasts daily release work from ready containers', () => {
    const snapshot = buildYardPlanningSnapshot({ zones, containers, now });

    expect(snapshot.daily_release_forecast).toMatchObject({
      ready_today: 2,
      blocked: 1,
    });
  });
});
