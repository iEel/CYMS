import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

type StorageRateTier = {
  tier_name: string;
  from_day: number;
  to_day: number;
  rate_20: number;
  rate_40: number;
  rate_45: number;
  customer_id: number | null;
  cargo_status: string;
};

function normalizeCargoStatus(value: unknown): 'any' | 'laden' | 'empty' {
  return value === 'laden' || value === 'empty' ? value : 'any';
}

function chooseStorageRateTiers(
  tiers: StorageRateTier[],
  hasBillingCustomer: boolean,
  cargoStatus: 'laden' | 'empty'
) {
  const exactCargo = (t: StorageRateTier) => normalizeCargoStatus(t.cargo_status) === cargoStatus;
  const anyCargo = (t: StorageRateTier) => normalizeCargoStatus(t.cargo_status) === 'any';

  const customerExact = hasBillingCustomer
    ? tiers.filter(t => t.customer_id !== null && exactCargo(t))
    : [];
  const customerAny = hasBillingCustomer
    ? tiers.filter(t => t.customer_id !== null && anyCargo(t))
    : [];
  const defaultExact = tiers.filter(t => t.customer_id === null && exactCargo(t));
  const defaultAny = tiers.filter(t => t.customer_id === null && anyCargo(t));

  if (customerExact.length > 0) return { tiers: customerExact, hasCustomerRate: true, rateSource: 'customer_exact' };
  if (customerAny.length > 0) return { tiers: customerAny, hasCustomerRate: true, rateSource: 'customer_any' };
  if (defaultExact.length > 0) return { tiers: defaultExact, hasCustomerRate: false, rateSource: 'default_exact' };
  return { tiers: defaultAny, hasCustomerRate: false, rateSource: defaultAny.length > 0 ? 'default_any' : 'none' };
}

/**
 * POST /api/billing/gate-check
 * Gate-Out billing check: calculate charges using tiered storage rates + detect credit customer
 * Body: { yard_id, container_id, billing_customer_id?, container_owner_id?, booking_ref? }
 * Returns: { container, owner, billing_customer, charges, summary, is_credit, credit_term, needs_customer_selection?, candidates? }
 */
export async function POST(request: NextRequest) {
  try {
    const { yard_id, container_id, billing_customer_id, container_owner_id, booking_ref } = await request.json();
    const db = await getDb();

    // 1. Get container info + dwell days
    const cResult = await db.request()
      .input('containerId', sql.Int, container_id)
      .input('yardId', sql.Int, yard_id)
      .query(`
        SELECT c.container_id, c.container_number, c.size, c.type, c.status,
               c.gate_in_date, c.shipping_line, c.is_laden, c.hold_status,
               ISNULL(c.is_soc, 0) as is_soc, c.container_owner_id,
               DATEDIFF(day, c.gate_in_date, GETDATE()) as dwell_days
        FROM Containers c
        WHERE c.container_id = @containerId AND c.yard_id = @yardId
      `);

    if (!cResult.recordset.length) {
      return NextResponse.json({ error: 'ไม่พบตู้' }, { status: 404 });
    }

    const container = cResult.recordset[0];
    const dwellDays = container.dwell_days || 0;
    const containerSize = parseInt(container.size) || 20;
    const cargoStatus: 'laden' | 'empty' = container.is_laden ? 'laden' : 'empty';

    // 2. Resolve Owner + Billing Customer
    let owner = null;
    let billingCustomer = null;
    let isCredit = false;
    let creditTerm = 0;
    let needsCustomerSelection = false;
    let candidates: Array<{ customer_id: number; customer_name: string; is_line: boolean; is_trucking: boolean; is_forwarder: boolean; credit_term: number; is_primary: boolean }> = [];

    // 2a. Booking Priority — if booking_ref provided, use customer from booking
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
        billingCustomer = owner; // Default: owner = billing customer
      }
    }

    // 2b. Use explicit billing_customer_id if provided (from UI selection)
    if (billing_customer_id) {
      const bcResult = await db.request()
        .input('bcId', sql.Int, billing_customer_id)
        .query(`
          SELECT customer_id, customer_name, credit_term, tax_id, address,
                 ISNULL(is_line, 0) as is_line, ISNULL(is_trucking, 0) as is_trucking
          FROM Customers WHERE customer_id = @bcId AND is_active = 1
        `);
      if (bcResult.recordset.length > 0) {
        billingCustomer = bcResult.recordset[0];
      }
    }

    // 2c. Use explicit container_owner_id if provided
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

    // 2d. Fall back to PrefixMapping (with multi-match detection)
    if (!owner) {
      const prefix = container.container_number ? container.container_number.substring(0, 4).toUpperCase() : '';
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
          // HALT RULE: Multiple matches — require manual selection
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

      // Fallback: match by shipping_line name
      if (!owner && !needsCustomerSelection && container.shipping_line) {
        const nameResult = await db.request()
          .input('shippingLine', sql.NVarChar, container.shipping_line)
          .query(`
            SELECT TOP 1 customer_id, customer_name, credit_term, tax_id, address,
                   ISNULL(is_line, 0) as is_line, ISNULL(is_trucking, 0) as is_trucking
            FROM Customers
            WHERE (customer_name = @shippingLine OR customer_name LIKE '%' + @shippingLine + '%') AND is_active = 1
            ORDER BY CASE WHEN customer_name = @shippingLine THEN 0 ELSE 1 END, customer_id
          `);
        if (nameResult.recordset.length > 0) {
          owner = nameResult.recordset[0];
          if (!billingCustomer) billingCustomer = owner;
        }
      }
    }

    // Determine credit status from BILLING customer (not owner)
    if (billingCustomer) {
      creditTerm = billingCustomer.credit_term || 0;
      isCredit = creditTerm > 0;
    }

    // 3. Calculate storage charges — CUSTOMER-SPECIFIC tiered rates with cargo_status
    const tierReq = db.request().input('yardId2', sql.Int, yard_id);
    let tierQuery = `
      SELECT tier_name, from_day, to_day, rate_20, rate_40, rate_45, customer_id, ISNULL(cargo_status, 'any') as cargo_status
      FROM StorageRateTiers
      WHERE yard_id = @yardId2 AND is_active = 1
    `;

    // Priority: customer-specific -> yard default
    if (billingCustomer?.customer_id) {
      tierQuery += ' AND (customer_id = @custId OR customer_id IS NULL)';
      tierReq.input('custId', sql.Int, billingCustomer.customer_id);
    } else {
      tierQuery += ' AND customer_id IS NULL';
    }

    // Filter by cargo status
    tierQuery += ` AND (ISNULL(cargo_status, 'any') = @cargoSt OR ISNULL(cargo_status, 'any') = 'any')`;
    tierReq.input('cargoSt', sql.VarChar, cargoStatus);

    tierQuery += `
      ORDER BY
        CASE WHEN customer_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN ISNULL(cargo_status, 'any') = @cargoSt THEN 0 ELSE 1 END,
        sort_order,
        from_day
    `;
    const tierResult = await tierReq.query(tierQuery);

    const selectedRate = chooseStorageRateTiers(
      tierResult.recordset,
      Boolean(billingCustomer?.customer_id),
      cargoStatus
    );
    const tiers = selectedRate.tiers;

    const charges: Array<{
      charge_type: string;
      description: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      free_days: number;
      billable_days: number;
    }> = [];

    if (tiers.length > 0) {
      let remainingDays = Math.max(dwellDays, 0);

      for (const tier of tiers) {
        if (remainingDays <= 0) break;

        const tierSpan = tier.to_day - tier.from_day + 1;
        const daysInTier = Math.min(remainingDays, tierSpan);

        let rate = tier.rate_20;
        if (containerSize >= 45) rate = tier.rate_45;
        else if (containerSize >= 40) rate = tier.rate_40;

        if (daysInTier > 0 && rate > 0) {
          charges.push({
            charge_type: 'storage',
            description: `${tier.tier_name} (วัน ${tier.from_day}-${tier.to_day}) — ${container.size}' ${cargoStatus === 'laden' ? '(มีสินค้า)' : '(ตู้เปล่า)'}`,
            quantity: daysInTier,
            unit_price: rate,
            subtotal: daysInTier * rate,
            free_days: 0,
            billable_days: daysInTier,
          });
        } else if (daysInTier > 0 && rate === 0) {
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

    // 5. Check existing GATE-OUT invoices for this container
    const existingInv = await db.request()
      .input('cid', sql.Int, container_id)
      .query(`
        SELECT invoice_id, invoice_number, grand_total, status, paid_at, description
        FROM Invoices
        WHERE container_id = @cid AND (description LIKE 'Gate-Out%' OR description NOT LIKE 'Gate-In%')
        ORDER BY created_at DESC
      `);

    const gateOutInvoices = existingInv.recordset.filter((i: { description?: string }) =>
      !i.description || !i.description.startsWith('Gate-In')
    );
    const paidInvoices = gateOutInvoices.filter((i: { status: string }) => i.status === 'paid');
    const unpaidInvoices = gateOutInvoices.filter((i: { status: string }) => ['issued', 'draft'].includes(i.status));

    return NextResponse.json({
      container: {
        ...container,
        dwell_days: dwellDays,
        cargo_status: cargoStatus,
      },
      // Separation of concerns: owner vs billing
      owner,
      billing_customer: billingCustomer,
      is_credit: isCredit,
      credit_term: creditTerm,
      // Customer-specific rate info
      has_customer_rate: selectedRate.hasCustomerRate,
      storage_rate_source: selectedRate.rateSource,
      // Halt rule: multi-match
      needs_customer_selection: needsCustomerSelection,
      candidates,
      // Charges
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
      // Legacy compat
      customer: billingCustomer,
    });
  } catch (error) {
    console.error('❌ POST billing/gate-check error:', error);
    return NextResponse.json({ error: 'ไม่สามารถคำนวณค่าบริการได้' }, { status: 500 });
  }
}
