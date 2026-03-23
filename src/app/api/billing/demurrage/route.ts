import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

/**
 * GET /api/billing/demurrage?yard_id=X
 * Returns demurrage rates config
 *
 * GET /api/billing/demurrage?yard_id=X&container_id=Y
 * Returns demurrage calculation for specific container
 *
 * GET /api/billing/demurrage?yard_id=X&mode=overview
 * Returns all containers approaching/exceeding demurrage free days
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const containerId = searchParams.get('container_id');
    const mode = searchParams.get('mode');
    const db = await getDb();

    // Mode: overview — list containers approaching demurrage
    if (mode === 'overview') {
      const result = await db.request()
        .input('yardId', sql.Int, yardId)
        .query(`
          SELECT c.container_id, c.container_number, c.size, c.type,
                 c.shipping_line, c.gate_in_date, c.is_laden, c.status,
                 DATEDIFF(day, c.gate_in_date, GETDATE()) as dwell_days,
                 dr.free_days as demurrage_free_days,
                 dr.rate_20, dr.rate_40, dr.rate_45,
                 dr.charge_type as demurrage_type
          FROM Containers c
          LEFT JOIN DemurrageRates dr ON dr.yard_id = c.yard_id AND dr.is_active = 1 AND dr.charge_type = 'demurrage'
            AND (dr.customer_id IS NULL OR dr.customer_id IN (
              SELECT pm2.customer_id FROM PrefixMapping pm2 WHERE pm2.prefix_code = LEFT(c.container_number, 4)
            ))
          WHERE c.yard_id = @yardId AND c.status = 'in_yard' AND c.gate_in_date IS NOT NULL
          ORDER BY dwell_days DESC
        `);

      const containers = result.recordset.map((c: { container_id: number; container_number: string; size: string; type: string; shipping_line: string; gate_in_date: string; is_laden: boolean; status: string; dwell_days: number; demurrage_free_days: number; rate_20: number; rate_40: number; rate_45: number; demurrage_type: string }) => {
        const freeDays = c.demurrage_free_days || 7;
        const size = parseInt(c.size) || 20;
        let rate = c.rate_20 || 0;
        if (size >= 45) rate = c.rate_45 || 0;
        else if (size >= 40) rate = c.rate_40 || 0;

        const overDays = Math.max(0, c.dwell_days - freeDays);
        const demurrageAmount = overDays * rate;
        const daysUntilDemurrage = Math.max(0, freeDays - c.dwell_days);

        return {
          ...c,
          free_days: freeDays,
          over_days: overDays,
          days_until_demurrage: daysUntilDemurrage,
          daily_rate: rate,
          demurrage_amount: demurrageAmount,
          risk_level: overDays > 0 ? 'exceeded' : daysUntilDemurrage <= 2 ? 'warning' : 'safe',
        };
      });

      return NextResponse.json({
        containers,
        summary: {
          total: containers.length,
          exceeded: containers.filter((c: { risk_level: string }) => c.risk_level === 'exceeded').length,
          warning: containers.filter((c: { risk_level: string }) => c.risk_level === 'warning').length,
          safe: containers.filter((c: { risk_level: string }) => c.risk_level === 'safe').length,
          total_demurrage: containers.reduce((s: number, c: { demurrage_amount: number }) => s + c.demurrage_amount, 0),
        },
      });
    }

    // Mode: single container calculation
    if (containerId) {
      const cResult = await db.request()
        .input('containerId', sql.Int, parseInt(containerId))
        .input('yardId', sql.Int, yardId)
        .query(`
          SELECT c.container_id, c.container_number, c.size, c.type,
                 c.shipping_line, c.gate_in_date, c.is_laden, c.status,
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

      // Get demurrage + detention rates
      const drResult = await db.request()
        .input('yardId2', sql.Int, yardId)
        .query(`
          SELECT dr.*, c2.customer_name
          FROM DemurrageRates dr
          LEFT JOIN Customers c2 ON dr.customer_id = c2.customer_id
          WHERE dr.yard_id = @yardId2 AND dr.is_active = 1
          ORDER BY dr.charge_type, dr.customer_id
        `);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const charges: any[] = [];

      for (const rate of drResult.recordset) {
        let dailyRate = rate.rate_20;
        if (containerSize >= 45) dailyRate = rate.rate_45;
        else if (containerSize >= 40) dailyRate = rate.rate_40;

        const overDays = Math.max(0, dwellDays - (rate.free_days || 0));
        const amount = overDays * dailyRate;

        charges.push({
          charge_type: rate.charge_type,
          description: rate.description || (rate.charge_type === 'demurrage' ? 'Demurrage' : 'Detention'),
          free_days: rate.free_days,
          dwell_days: dwellDays,
          over_days: overDays,
          daily_rate: dailyRate,
          amount,
          customer_name: rate.customer_name,
          is_applicable: overDays > 0,
        });
      }

      return NextResponse.json({
        container: { ...container, dwell_days: dwellDays },
        charges,
        total_demurrage: charges.filter((c: { charge_type: string }) => c.charge_type === 'demurrage').reduce((s: number, c: { amount: number }) => s + c.amount, 0),
        total_detention: charges.filter((c: { charge_type: string }) => c.charge_type === 'detention').reduce((s: number, c: { amount: number }) => s + c.amount, 0),
      });
    }

    // Default: return rates config
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT dr.*, c.customer_name
        FROM DemurrageRates dr
        LEFT JOIN Customers c ON dr.customer_id = c.customer_id
        WHERE dr.yard_id = @yardId
        ORDER BY dr.charge_type, dr.customer_id
      `);

    return NextResponse.json({ rates: result.recordset });
  } catch (error) {
    console.error('❌ GET demurrage error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

/**
 * POST /api/billing/demurrage — create/update rate
 * PUT /api/billing/demurrage — update existing rate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    const result = await db.request()
      .input('yardId', sql.Int, body.yard_id)
      .input('customerId', sql.Int, body.customer_id || null)
      .input('chargeType', sql.NVarChar, body.charge_type || 'demurrage')
      .input('freeDays', sql.Int, body.free_days || 7)
      .input('rate20', sql.Decimal(12, 2), body.rate_20 || 0)
      .input('rate40', sql.Decimal(12, 2), body.rate_40 || 0)
      .input('rate45', sql.Decimal(12, 2), body.rate_45 || 0)
      .input('description', sql.NVarChar, body.description || '')
      .query(`
        INSERT INTO DemurrageRates (yard_id, customer_id, charge_type, free_days, rate_20, rate_40, rate_45, description)
        OUTPUT INSERTED.*
        VALUES (@yardId, @customerId, @chargeType, @freeDays, @rate20, @rate40, @rate45, @description)
      `);

    return NextResponse.json({ success: true, rate: result.recordset[0] });
  } catch (error) {
    console.error('❌ POST demurrage error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกได้' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    if (body.action === 'delete') {
      await db.request()
        .input('id', sql.Int, body.demurrage_id)
        .query('UPDATE DemurrageRates SET is_active = 0 WHERE demurrage_id = @id');
    } else {
      await db.request()
        .input('id', sql.Int, body.demurrage_id)
        .input('freeDays', sql.Int, body.free_days || 7)
        .input('rate20', sql.Decimal(12, 2), body.rate_20 || 0)
        .input('rate40', sql.Decimal(12, 2), body.rate_40 || 0)
        .input('rate45', sql.Decimal(12, 2), body.rate_45 || 0)
        .input('description', sql.NVarChar, body.description || '')
        .query(`
          UPDATE DemurrageRates SET free_days = @freeDays, rate_20 = @rate20, rate_40 = @rate40, rate_45 = @rate45,
                 description = @description, updated_at = GETDATE()
          WHERE demurrage_id = @id
        `);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT demurrage error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}
