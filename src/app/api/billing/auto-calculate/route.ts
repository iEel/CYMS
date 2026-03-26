import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// FR6.2 — Auto-Billing Engine: Calculate storage charges from Dwell Time
export async function POST(req: NextRequest) {
  try {
    const { yard_id, container_id } = await req.json();
    const pool = await getDb();

    // Get container info with gate_in_date
    const cResult = await pool.request()
      .input('container_id', container_id)
      .input('yard_id', yard_id)
      .query(`
        SELECT c.container_id, c.container_number, c.size, c.type, c.status,
               c.gate_in_date, c.shipping_line, c.is_laden,
               DATEDIFF(day, c.gate_in_date, GETDATE()) as dwell_days
        FROM containers c
        WHERE c.container_id = @container_id AND c.yard_id = @yard_id
      `);

    if (!cResult.recordset.length) {
      return NextResponse.json({ error: 'ไม่พบตู้' }, { status: 404 });
    }

    const container = cResult.recordset[0];
    const dwellDays = container.dwell_days || 0;

    // Get applicable tariffs
    const tResult = await pool.request()
      .input('yard_id', yard_id)
      .query(`
        SELECT t.tariff_id, t.charge_type, t.description, t.rate, t.unit, t.free_days,
               c.customer_name
        FROM tariffs t
        LEFT JOIN customers c ON t.customer_id = c.customer_id
        WHERE t.yard_id = @yard_id AND t.is_active = 1
        ORDER BY t.charge_type
      `);

    const tariffs = tResult.recordset;

    // Calculate charges
    const charges: Array<{
      charge_type: string;
      description: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      free_days: number;
      billable_days: number;
    }> = [];

    for (const tariff of tariffs) {
      if (tariff.unit === 'per_day' && tariff.charge_type === 'storage') {
        const billableDays = Math.max(0, dwellDays - (tariff.free_days || 0));
        if (billableDays > 0) {
          charges.push({
            charge_type: tariff.charge_type,
            description: tariff.description || `ค่าฝากตู้ ${container.container_number}`,
            quantity: billableDays,
            unit_price: tariff.rate,
            subtotal: billableDays * tariff.rate,
            free_days: tariff.free_days || 0,
            billable_days: billableDays,
          });
        }
      } else if (tariff.unit === 'per_container') {
        charges.push({
          charge_type: tariff.charge_type,
          description: tariff.description || CHARGE_LABELS[tariff.charge_type] || tariff.charge_type,
          quantity: 1,
          unit_price: tariff.rate,
          subtotal: tariff.rate,
          free_days: 0,
          billable_days: 0,
        });
      }
    }

    const totalBeforeVat = charges.reduce((s, c) => s + c.subtotal, 0);
    const vatAmount = Math.round(totalBeforeVat * 0.07 * 100) / 100;
    const grandTotal = totalBeforeVat + vatAmount;

    return NextResponse.json({
      container,
      dwell_days: dwellDays,
      charges,
      summary: {
        total_before_vat: totalBeforeVat,
        vat_rate: 7,
        vat_amount: vatAmount,
        grand_total: grandTotal,
      },
    });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const CHARGE_LABELS: Record<string, string> = {
  storage: 'ค่าฝากตู้', lolo: 'ค่ายก LOLO', mnr: 'ค่าซ่อม M&R',
  washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น',
};
