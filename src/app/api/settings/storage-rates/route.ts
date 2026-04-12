import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

type StorageRateTier = {
  customer_id: number | null;
  cargo_status: string;
};

// Auto-migrate: ensure customer_id + cargo_status columns
async function ensureColumns(pool: Awaited<ReturnType<typeof getDb>>) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StorageRateTiers' AND COLUMN_NAME = 'customer_id')
      ALTER TABLE StorageRateTiers ADD customer_id INT NULL
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'StorageRateTiers' AND COLUMN_NAME = 'cargo_status')
      ALTER TABLE StorageRateTiers ADD cargo_status VARCHAR(10) DEFAULT 'any'
    `);
  } catch { /* columns may already exist */ }
}

function normalizeCargoStatus(value: unknown): 'any' | 'laden' | 'empty' {
  return value === 'laden' || value === 'empty' ? value : 'any';
}

function chooseTierSet<T extends StorageRateTier>(
  tiers: T[],
  customerId: number | null,
  cargoStatus: 'any' | 'laden' | 'empty'
) {
  const exactCargo = (t: T) => normalizeCargoStatus(t.cargo_status) === cargoStatus;
  const anyCargo = (t: T) => normalizeCargoStatus(t.cargo_status) === 'any';

  const customerExact = customerId !== null
    ? tiers.filter(t => t.customer_id !== null && exactCargo(t))
    : [];
  const customerAny = customerId !== null
    ? tiers.filter(t => t.customer_id !== null && anyCargo(t))
    : [];
  const defaultExact = tiers.filter(t => t.customer_id === null && exactCargo(t));
  const defaultAny = tiers.filter(t => t.customer_id === null && anyCargo(t));

  const selected = customerExact.length > 0 ? customerExact
    : customerAny.length > 0 ? customerAny
      : defaultExact.length > 0 ? defaultExact
        : defaultAny;

  return {
    selected,
    customerExact,
    customerAny,
    defaultExact,
    defaultAny,
    hasCustomerRate: customerExact.length > 0 || customerAny.length > 0,
    rateSource: customerExact.length > 0 ? 'customer_exact'
      : customerAny.length > 0 ? 'customer_any'
        : defaultExact.length > 0 ? 'default_exact'
          : defaultAny.length > 0 ? 'default_any'
            : 'none',
  };
}

/**
 * GET /api/settings/storage-rates?yard_id=1&customer_id=5&cargo_status=laden
 * Returns tiered storage rates (customer-specific or yard default)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const customerId = searchParams.get('customer_id') ? parseInt(searchParams.get('customer_id')!) : null;
    const cargoStatus = normalizeCargoStatus(searchParams.get('cargo_status')); // any/laden/empty

    const db = await getDb();
    await ensureColumns(db);

    let query = `
      SELECT tier_id, yard_id, tier_name, from_day, to_day,
             rate_20, rate_40, rate_45, applies_to, sort_order, is_active,
             customer_id, ISNULL(cargo_status, 'any') as cargo_status
      FROM StorageRateTiers
      WHERE yard_id = @yardId AND is_active = 1
    `;
    const req = db.request().input('yardId', sql.Int, yardId);

    if (customerId !== null) {
      // Return customer-specific rates; if none found, will fallback to default in response
      query += ' AND (customer_id = @customerId OR customer_id IS NULL)';
      req.input('customerId', sql.Int, customerId);
    } else {
      // Only return yard default (customer_id IS NULL) rates
      query += ' AND customer_id IS NULL';
    }

    query += ` AND (ISNULL(cargo_status, 'any') = @cargoStatus OR ISNULL(cargo_status, 'any') = 'any')`;
    req.input('cargoStatus', sql.VarChar, cargoStatus);

    query += `
      ORDER BY
        CASE WHEN customer_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN ISNULL(cargo_status, 'any') = @cargoStatus THEN 0 ELSE 1 END,
        sort_order,
        from_day
    `;

    const result = await req.query(query);

    const selected = chooseTierSet(result.recordset, customerId, cargoStatus);

    return NextResponse.json({
      tiers: selected.selected,
      customer_tiers: selected.customerExact.length > 0 ? selected.customerExact : selected.customerAny,
      default_tiers: selected.defaultExact.length > 0 ? selected.defaultExact : selected.defaultAny,
      has_customer_rate: selected.hasCustomerRate,
      rate_source: selected.rateSource,
    });
  } catch (error) {
    console.error('❌ GET storage-rates error:', error);
    return NextResponse.json({ tiers: [], customer_tiers: [], default_tiers: [], has_customer_rate: false, rate_source: 'none' });
  }
}

/**
 * POST /api/settings/storage-rates
 * Save all tiers (replace all for a yard+customer combination)
 * Body: { yard_id, tiers: [...], customer_id?: number, cargo_status?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { yard_id, tiers, customer_id, cargo_status } = await request.json();
    if (!yard_id || !Array.isArray(tiers)) {
      return NextResponse.json({ error: 'Missing yard_id or tiers' }, { status: 400 });
    }

    const db = await getDb();
    await ensureColumns(db);
    const selectedCargoStatus = normalizeCargoStatus(cargo_status);

    // Soft-delete only this yard + customer + cargo status combination.
    if (customer_id) {
      await db.request()
        .input('yardId', sql.Int, yard_id)
        .input('customerId', sql.Int, customer_id)
        .input('cargoStatus', sql.VarChar, selectedCargoStatus)
        .query('UPDATE StorageRateTiers SET is_active = 0, updated_at = GETDATE() WHERE yard_id = @yardId AND customer_id = @customerId AND ISNULL(cargo_status, \'any\') = @cargoStatus');
    } else {
      await db.request()
        .input('yardId', sql.Int, yard_id)
        .input('cargoStatus', sql.VarChar, selectedCargoStatus)
        .query('UPDATE StorageRateTiers SET is_active = 0, updated_at = GETDATE() WHERE yard_id = @yardId AND customer_id IS NULL AND ISNULL(cargo_status, \'any\') = @cargoStatus');
    }

    // Insert new tiers
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      await db.request()
        .input('yardId', sql.Int, yard_id)
        .input('tierName', sql.NVarChar, t.tier_name || `ขั้นที่ ${i + 1}`)
        .input('fromDay', sql.Int, t.from_day || 1)
        .input('toDay', sql.Int, t.to_day || 999)
        .input('rate20', sql.Decimal(12, 2), t.rate_20 || 0)
        .input('rate40', sql.Decimal(12, 2), t.rate_40 || 0)
        .input('rate45', sql.Decimal(12, 2), t.rate_45 || 0)
        .input('appliesTo', sql.NVarChar, t.applies_to || 'all')
        .input('sortOrder', sql.Int, i + 1)
        .input('customerId', sql.Int, customer_id || null)
        .input('cargoStatus', sql.VarChar, selectedCargoStatus)
        .query(`
          INSERT INTO StorageRateTiers (yard_id, tier_name, from_day, to_day, rate_20, rate_40, rate_45, applies_to, sort_order, customer_id, cargo_status)
          VALUES (@yardId, @tierName, @fromDay, @toDay, @rate20, @rate40, @rate45, @appliesTo, @sortOrder, @customerId, @cargoStatus)
        `);
    }

    await logAudit({
      yardId: yard_id,
      action: 'storage_rates_update',
      entityType: 'storage_rate',
      details: { yard_id, customer_id: customer_id || 'default', cargo_status: selectedCargoStatus, tier_count: tiers.length },
    });
    return NextResponse.json({ success: true, message: `บันทึก ${tiers.length} ขั้นอัตราสำเร็จ` });
  } catch (error) {
    console.error('❌ POST storage-rates error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกได้' }, { status: 500 });
  }
}
