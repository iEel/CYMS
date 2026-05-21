export interface TariffSimulationInput {
  charge_type: string;
  rate: number;
  unit: string;
  free_days?: number | null;
  dwell_days?: number | null;
  quantity?: number | null;
  vat_rate?: number | null;
}

export interface TariffSimulationResult {
  charge_type: string;
  unit: string;
  rate: number;
  dwell_days: number;
  free_days: number;
  billable_days: number;
  quantity: number;
  charge_quantity: number;
  subtotal: number;
  vat_amount: number;
  grand_total: number;
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function chargeQuantity(unit: string, billableDays: number, quantity: number) {
  if (unit === 'per_day') return billableDays * quantity;
  if (unit === 'fixed') return 1;
  return quantity;
}

export function simulateTariffCharge(input: TariffSimulationInput): TariffSimulationResult {
  const rate = Math.max(0, safeNumber(input.rate));
  const dwellDays = Math.max(0, Math.floor(safeNumber(input.dwell_days)));
  const freeDays = Math.max(0, Math.floor(safeNumber(input.free_days)));
  const quantity = Math.max(1, Math.floor(safeNumber(input.quantity, 1)));
  const billableDays = input.unit === 'per_day' ? Math.max(0, dwellDays - freeDays) : 0;
  const chargeQty = chargeQuantity(input.unit, billableDays, quantity);
  const subtotal = roundMoney(rate * chargeQty);
  const vatRate = input.vat_rate ?? 0.07;
  const vatAmount = roundMoney(subtotal * vatRate);

  return {
    charge_type: input.charge_type,
    unit: input.unit,
    rate,
    dwell_days: dwellDays,
    free_days: freeDays,
    billable_days: billableDays,
    quantity,
    charge_quantity: chargeQty,
    subtotal,
    vat_amount: vatAmount,
    grand_total: roundMoney(subtotal + vatAmount),
  };
}

export function buildTariffSimulatorScenarios(tariff: {
  charge_type: string;
  rate: number;
  unit: string;
  free_days?: number | null;
}, quantity = 1) {
  return [7, 14, 30].map(days => ({
    label: `${days} วัน`,
    result: simulateTariffCharge({
      ...tariff,
      dwell_days: days,
      quantity,
    }),
  }));
}
