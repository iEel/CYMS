import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

/**
 * POST /api/billing/gate-in-check
 * Gate-In billing: calculate upfront charges (lift-on, gate fee, etc.) — NO storage
 * Body: { yard_id, container_number, size, shipping_line }
 */
export async function POST(request: NextRequest) {
  try {
    const { yard_id, container_number, size, shipping_line } = await request.json();
    const db = await getDb();
    const containerSize = parseInt(size) || 20;

    // 1. Find customer via PrefixMapping (container prefix) or shipping_line match
    let customer = null;
    let isCredit = false;
    let creditTerm = 0;

    // Extract 4-char prefix from container number (e.g. MSCU from MSCU1234566)
    const prefix = container_number ? container_number.substring(0, 4).toUpperCase() : '';

    if (prefix) {
      // Try PrefixMapping first — most accurate for gate-in
      const prefixResult = await db.request()
        .input('prefix', sql.NVarChar, prefix)
        .query(`
          SELECT TOP 1 c.customer_id, c.customer_name, c.credit_term, c.tax_id, c.address,
                 ISNULL(c.is_line, 0) as is_line, ISNULL(c.is_trucking, 0) as is_trucking
          FROM Customers c
          INNER JOIN PrefixMapping pm ON pm.customer_id = c.customer_id
          WHERE pm.prefix_code = @prefix AND c.is_active = 1
          ORDER BY c.customer_id
        `);

      if (prefixResult.recordset.length > 0) {
        customer = prefixResult.recordset[0];
      }
    }

    // Fallback: match by shipping_line name
    if (!customer && shipping_line) {
      const codeResult = await db.request()
        .input('slCode', sql.NVarChar, shipping_line)
        .query(`
          SELECT TOP 1 customer_id, customer_name, credit_term, tax_id, address,
                 ISNULL(is_line, 0) as is_line, ISNULL(is_trucking, 0) as is_trucking
          FROM Customers
          WHERE (shipping_line_code = @slCode OR customer_name = @slCode OR customer_name LIKE '%' + @slCode + '%') AND is_active = 1
          ORDER BY CASE WHEN shipping_line_code = @slCode THEN 0 WHEN customer_name = @slCode THEN 1 ELSE 2 END, customer_id
        `);

      if (codeResult.recordset.length > 0) {
        customer = codeResult.recordset[0];
      }
    }

    if (customer) {
      creditTerm = customer.credit_term || 0;
      isCredit = creditTerm > 0;
    }

    // 2. Get per-container charges from Tariffs (LOLO, gate, washing, PTI, reefer, etc.)
    const tariffResult = await db.request()
      .input('yardId', sql.Int, yard_id)
      .query(`
        SELECT charge_type, description, rate, unit
        FROM Tariffs
        WHERE yard_id = @yardId AND is_active = 1
        ORDER BY charge_type
      `);

    const CHARGE_LABELS: Record<string, string> = {
      lolo: 'ค่ายก Lift-On (LOLO)',
      gate: 'ค่า Gate-In',
      mnr: 'ค่าซ่อม M&R',
      washing: 'ค่าล้างตู้',
      pti: 'ค่า PTI',
      reefer: 'ค่าปลั๊กเย็น',
    };

    interface BillingCharge {
      charge_type: string;
      description: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      free_days: number;
      billable_days: number;
    }

    const charges: BillingCharge[] = [];

    for (const tariff of tariffResult.recordset) {
      // Skip storage — it's calculated at gate-out
      if (tariff.charge_type === 'storage') continue;

      // Per-container charges
      if (tariff.unit === 'per_container') {
        let rate = tariff.rate;
        // If rate varies by size and there are size-specific rates, adjust
        // (for now use flat rate from Tariffs)
        charges.push({
          charge_type: tariff.charge_type,
          description: tariff.description || CHARGE_LABELS[tariff.charge_type] || tariff.charge_type,
          quantity: 1,
          unit_price: rate,
          subtotal: rate,
          free_days: 0,
          billable_days: 0,
        });
      }
    }

    const totalBeforeVat = charges.reduce((s, c) => s + c.subtotal, 0);
    const vatAmount = Math.round(totalBeforeVat * 0.07 * 100) / 100;
    const grandTotal = totalBeforeVat + vatAmount;

    return NextResponse.json({
      customer,
      is_credit: isCredit,
      credit_term: creditTerm,
      container_size: containerSize,
      charges,
      summary: {
        total_before_vat: totalBeforeVat,
        vat_rate: 7,
        vat_amount: vatAmount,
        grand_total: grandTotal,
      },
    });
  } catch (error) {
    console.error('❌ POST billing/gate-in-check error:', error);
    return NextResponse.json({ error: 'ไม่สามารถคำนวณค่าบริการได้' }, { status: 500 });
  }
}
