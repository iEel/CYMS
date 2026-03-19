import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

/**
 * POST /api/billing/gate-check
 * Gate-Out billing check: calculate charges + detect credit customer
 * Body: { yard_id, container_id }
 * Returns: { container, customer, charges, summary, is_credit, credit_term }
 */
export async function POST(request: NextRequest) {
  try {
    const { yard_id, container_id } = await request.json();
    const db = await getDb();

    // 1. Get container info + dwell days
    const cResult = await db.request()
      .input('containerId', sql.Int, container_id)
      .input('yardId', sql.Int, yard_id)
      .query(`
        SELECT c.container_id, c.container_number, c.size, c.type, c.status,
               c.gate_in_date, c.shipping_line, c.is_laden, c.hold_status,
               DATEDIFF(day, c.gate_in_date, GETDATE()) as dwell_days
        FROM Containers c
        WHERE c.container_id = @containerId AND c.yard_id = @yardId
      `);

    if (!cResult.recordset.length) {
      return NextResponse.json({ error: 'ไม่พบตู้' }, { status: 404 });
    }

    const container = cResult.recordset[0];
    const dwellDays = container.dwell_days || 0;

    // 2. Find matching customer by shipping_line → check credit_term
    let customer = null;
    let isCredit = false;
    let creditTerm = 0;

    if (container.shipping_line) {
      const custResult = await db.request()
        .input('shippingLine', sql.NVarChar, container.shipping_line)
        .query(`
          SELECT TOP 1 customer_id, customer_name, customer_type, credit_term, tax_id, address
          FROM Customers
          WHERE customer_name = @shippingLine AND is_active = 1
          ORDER BY customer_id
        `);

      if (custResult.recordset.length > 0) {
        customer = custResult.recordset[0];
        creditTerm = customer.credit_term || 0;
        isCredit = creditTerm > 0;
      }
    }

    // 3. Get applicable tariffs and calculate charges
    const tResult = await db.request()
      .input('yardId2', sql.Int, yard_id)
      .query(`
        SELECT tariff_id, charge_type, description, rate, unit, free_days
        FROM Tariffs
        WHERE yard_id = @yardId2 AND is_active = 1
        ORDER BY charge_type
      `);

    const tariffs = tResult.recordset;

    const CHARGE_LABELS: Record<string, string> = {
      storage: 'ค่าฝากตู้', lolo: 'ค่ายก LOLO', gate: 'ค่า Gate',
      mnr: 'ค่าซ่อม M&R', washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น',
    };

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

    // 4. Check existing unpaid invoices for this container
    const existingInv = await db.request()
      .input('cid', sql.Int, container_id)
      .query(`
        SELECT invoice_id, invoice_number, grand_total, status
        FROM Invoices
        WHERE container_id = @cid AND status IN ('issued', 'draft')
        ORDER BY created_at DESC
      `);

    return NextResponse.json({
      container: {
        ...container,
        dwell_days: dwellDays,
      },
      customer,
      is_credit: isCredit,
      credit_term: creditTerm,
      charges,
      summary: {
        total_before_vat: totalBeforeVat,
        vat_rate: 7,
        vat_amount: vatAmount,
        grand_total: grandTotal,
      },
      existing_invoices: existingInv.recordset,
      has_hold: container.hold_status === 'billing_hold',
    });
  } catch (error) {
    console.error('❌ POST billing/gate-check error:', error);
    return NextResponse.json({ error: 'ไม่สามารถคำนวณค่าบริการได้' }, { status: 500 });
  }
}
