import { simulateTariffCharge, buildTariffSimulatorScenarios } from '../billingTariffSimulator';

describe('billing tariff simulator', () => {
  it('calculates storage charge from dwell days after free days', () => {
    const result = simulateTariffCharge({
      charge_type: 'storage',
      rate: 120,
      unit: 'per_day',
      free_days: 5,
      dwell_days: 12,
      quantity: 2,
      vat_rate: 0.07,
    });

    expect(result).toMatchObject({
      billable_days: 7,
      charge_quantity: 14,
      subtotal: 1680,
      vat_amount: 117.6,
      grand_total: 1797.6,
    });
  });

  it('calculates per-container charges without dwell days', () => {
    const result = simulateTariffCharge({
      charge_type: 'lolo',
      rate: 850,
      unit: 'per_container',
      free_days: 0,
      dwell_days: 30,
      quantity: 3,
    });

    expect(result).toMatchObject({
      billable_days: 0,
      charge_quantity: 3,
      subtotal: 2550,
      grand_total: 2728.5,
    });
  });

  it('builds practical dwell scenarios for tariff preview', () => {
    const scenarios = buildTariffSimulatorScenarios({
      charge_type: 'storage',
      rate: 100,
      unit: 'per_day',
      free_days: 3,
    });

    expect(scenarios.map(item => item.label)).toEqual(['7 วัน', '14 วัน', '30 วัน']);
    expect(scenarios.map(item => item.result.billable_days)).toEqual([4, 11, 27]);
  });
});
