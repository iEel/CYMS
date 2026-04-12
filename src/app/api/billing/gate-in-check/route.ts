import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

/**
 * POST /api/billing/gate-in-check
 * Gate-In billing: calculate upfront charges (lift-on, gate fee, etc.) — NO storage
 * Body: { yard_id, container_number, size, shipping_line, booking_ref?, billing_customer_id?, container_owner_id? }
 */
export async function POST(request: NextRequest) {
  try {
    const { yard_id, container_number, size, shipping_line, booking_ref, billing_customer_id, container_owner_id } = await request.json();
    const db = await getDb();
    const containerSize = parseInt(size) || 20;

    // 1. Resolve Owner + Billing Customer (with priority logic)
    let owner = null;
    let billingCustomer = null;
    let isCredit = false;
    let creditTerm = 0;
    let needsCustomerSelection = false;
    let candidates: Array<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean; credit_term: number; is_primary: boolean }> = [];

    // 1a. Booking Priority — highest priority
    if (booking_ref) {
      const bResult = await db.request()
        .input('bref', sql.NVarChar, booking_ref)
        .query(`
          SELECT TOP 1 b.customer_id, c.customer_name, c.credit_term, c.tax_id, c.address,
                 ISNULL(c.is_line, 0) as is_line, ISNULL(c.is_trucking, 0) as is_trucking
          FROM Bookings b
          JOIN Customers c ON b.customer_id = c.customer_id
          WHERE b.booking_number = @bref AND c.is_active = 1
        `);
      if (bResult.recordset.length > 0) {
        owner = bResult.recordset[0];
        billingCustomer = owner;
      }
    }

    // 1b. Use explicit IDs if provided
    if (billing_customer_id) {
      const bcResult = await db.request()
        .input('bcId', sql.Int, billing_customer_id)
        .query(`
          SELECT customer_id, customer_name, credit_term, tax_id, address,
                 ISNULL(is_line, 0) as is_line, ISNULL(is_trucking, 0) as is_trucking
          FROM Customers WHERE customer_id = @bcId AND is_active = 1
        `);
      if (bcResult.recordset.length > 0) billingCustomer = bcResult.recordset[0];
    }

    if (container_owner_id && !owner) {
      const owResult = await db.request()
        .input('ownId', sql.Int, container_owner_id)
        .query(`
          SELECT customer_id, customer_name, credit_term, tax_id, address,
                 ISNULL(is_line, 0) as is_line, ISNULL(is_trucking, 0) as is_trucking
          FROM Customers WHERE customer_id = @ownId AND is_active = 1
        `);
      if (owResult.recordset.length > 0) {
        owner = owResult.recordset[0];
        if (!billingCustomer) billingCustomer = owner;
      }
    }

    // 1c. PrefixMapping (with multi-match detection)
    if (!owner) {
      const prefix = container_number ? container_number.substring(0, 4).toUpperCase() : '';
      if (prefix) {
        const prefixResult = await db.request()
          .input('prefix', sql.NVarChar, prefix)
          .query(`
            SELECT c.customer_id, c.customer_name, c.credit_term, c.tax_id, c.address,
                   ISNULL(c.is_line, 0) as is_line, ISNULL(c.is_trucking, 0) as is_trucking,
                   ISNULL(c.is_forwarder, 0) as is_forwarder,
                   ISNULL(pm.is_primary, 0) as is_primary
            FROM Customers c
            INNER JOIN PrefixMapping pm ON pm.customer_id = c.customer_id
            WHERE pm.prefix_code = @prefix AND c.is_active = 1
            ORDER BY pm.is_primary DESC, c.customer_name
          `);

        if (prefixResult.recordset.length === 1) {
          owner = prefixResult.recordset[0];
          if (!billingCustomer) billingCustomer = owner;
        } else if (prefixResult.recordset.length > 1) {
          // HALT RULE
          needsCustomerSelection = true;
          candidates = prefixResult.recordset.map((r: Record<string, unknown>) => ({
            customer_id: r.customer_id as number,
            customer_name: r.customer_name as string,
            is_line: r.is_line as boolean,
            is_trucking: r.is_trucking as boolean,
            is_forwarder: r.is_forwarder as boolean,
            credit_term: r.credit_term as number,
            is_primary: r.is_primary as boolean,
          }));
        }
      }

      // Fallback: shipping_line name match
      if (!owner && !needsCustomerSelection && shipping_line) {
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
          owner = codeResult.recordset[0];
          if (!billingCustomer) billingCustomer = owner;
        }
      }
    }

    if (billingCustomer) {
      creditTerm = billingCustomer.credit_term || 0;
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

      if (tariff.unit === 'per_container') {
        const rate = tariff.rate;
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
      // Separation of concerns: owner vs billing
      owner,
      billing_customer: billingCustomer,
      customer: billingCustomer, // Legacy compat
      is_credit: isCredit,
      credit_term: creditTerm,
      container_size: containerSize,
      // Halt rule
      needs_customer_selection: needsCustomerSelection,
      candidates,
      // Charges
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
