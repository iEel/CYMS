import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

/**
 * POST /api/billing/gate-check
 * Gate-Out billing check: calculate charges using tiered storage rates + detect credit customer
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
    const containerSize = parseInt(container.size) || 20; // 20, 40, 45

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

    // 3. Calculate storage charges using TIERED RATES (per-size pricing)
    const tierResult = await db.request()
      .input('yardId2', sql.Int, yard_id)
      .query(`
        SELECT tier_name, from_day, to_day, rate_20, rate_40, rate_45
        FROM StorageRateTiers
        WHERE yard_id = @yardId2 AND is_active = 1
        ORDER BY sort_order, from_day
      `);

    const tiers = tierResult.recordset;

    const charges: Array<{
      charge_type: string;
      description: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      free_days: number;
      billable_days: number;
    }> = [];

    if (tiers.length > 0 && dwellDays > 0) {
      // Calculate per-tier charges
      let remainingDays = dwellDays;

      for (const tier of tiers) {
        if (remainingDays <= 0) break;

        const tierSpan = tier.to_day - tier.from_day + 1;
        const daysInTier = Math.min(remainingDays, tierSpan);

        // Pick rate based on container size
        let rate = tier.rate_20;
        if (containerSize >= 45) rate = tier.rate_45;
        else if (containerSize >= 40) rate = tier.rate_40;

        if (daysInTier > 0 && rate > 0) {
          charges.push({
            charge_type: 'storage',
            description: `${tier.tier_name} (วัน ${tier.from_day}-${tier.to_day}) — ${container.size}'`,
            quantity: daysInTier,
            unit_price: rate,
            subtotal: daysInTier * rate,
            free_days: 0,
            billable_days: daysInTier,
          });
        } else if (daysInTier > 0 && rate === 0) {
          // Free period — record but no charge
          charges.push({
            charge_type: 'storage',
            description: `${tier.tier_name} (วัน ${tier.from_day}-${tier.to_day}) — ฟรี`,
            quantity: daysInTier,
            unit_price: 0,
            subtotal: 0,
            free_days: daysInTier,
            billable_days: 0,
          });
        }

        remainingDays -= daysInTier;
      }
    } else if (dwellDays > 0) {
      // Fallback: use flat Tariffs table if no tiers exist
      const tResult = await db.request()
        .input('yardId3', sql.Int, yard_id)
        .query(`
          SELECT charge_type, description, rate, unit, free_days
          FROM Tariffs
          WHERE yard_id = @yardId3 AND is_active = 1
          ORDER BY charge_type
        `);

      for (const tariff of tResult.recordset) {
        if (tariff.unit === 'per_day' && tariff.charge_type === 'storage') {
          const billableDays = Math.max(0, dwellDays - (tariff.free_days || 0));
          if (billableDays > 0) {
            charges.push({
              charge_type: 'storage',
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
            description: tariff.description || tariff.charge_type,
            quantity: 1,
            unit_price: tariff.rate,
            subtotal: tariff.rate,
            free_days: 0,
            billable_days: 0,
          });
        }
      }
    }

    // 4. Also add non-storage charges from Tariffs (LOLO, gate, etc.)
    const otherResult = await db.request()
      .input('yardId4', sql.Int, yard_id)
      .query(`
        SELECT charge_type, description, rate, unit
        FROM Tariffs
        WHERE yard_id = @yardId4 AND is_active = 1 AND charge_type != 'storage'
        ORDER BY charge_type
      `);

    const CHARGE_LABELS: Record<string, string> = {
      lolo: 'ค่ายก LOLO', gate: 'ค่า Gate', mnr: 'ค่าซ่อม M&R',
      washing: 'ค่าล้างตู้', pti: 'ค่า PTI', reefer: 'ค่าปลั๊กเย็น',
    };

    for (const tariff of otherResult.recordset) {
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

    // Filter out zero-subtotal charges for cleaner display
    const billableCharges = charges.filter(c => c.subtotal > 0);
    const freeCharges = charges.filter(c => c.subtotal === 0 && c.free_days > 0);

    const totalBeforeVat = billableCharges.reduce((s, c) => s + c.subtotal, 0);
    const vatAmount = Math.round(totalBeforeVat * 0.07 * 100) / 100;
    const grandTotal = totalBeforeVat + vatAmount;

    // 5. Check existing invoices for this container (unpaid AND paid)
    const existingInv = await db.request()
      .input('cid', sql.Int, container_id)
      .query(`
        SELECT invoice_id, invoice_number, grand_total, status, paid_at
        FROM Invoices
        WHERE container_id = @cid
        ORDER BY created_at DESC
      `);

    const paidInvoices = existingInv.recordset.filter((i: { status: string }) => i.status === 'paid');
    const unpaidInvoices = existingInv.recordset.filter((i: { status: string }) => ['issued', 'draft'].includes(i.status));

    return NextResponse.json({
      container: {
        ...container,
        dwell_days: dwellDays,
      },
      customer,
      is_credit: isCredit,
      credit_term: creditTerm,
      charges: [...freeCharges, ...billableCharges],
      summary: {
        total_before_vat: totalBeforeVat,
        vat_rate: 7,
        vat_amount: vatAmount,
        grand_total: grandTotal,
      },
      existing_invoices: unpaidInvoices,
      paid_invoices: paidInvoices,
      already_paid: paidInvoices.length > 0,
      has_hold: container.hold_status === 'billing_hold',
    });
  } catch (error) {
    console.error('❌ POST billing/gate-check error:', error);
    return NextResponse.json({ error: 'ไม่สามารถคำนวณค่าบริการได้' }, { status: 500 });
  }
}
