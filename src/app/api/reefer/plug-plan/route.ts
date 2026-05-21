import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultDateFrom() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDateTo() {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

function normalizeDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return DATE_RE.test(value) ? value : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawYardId = searchParams.get('yard_id');
    const yardId = Number(rawYardId);
    const dateFrom = normalizeDate(searchParams.get('date_from'), defaultDateFrom());
    const dateTo = normalizeDate(searchParams.get('date_to'), defaultDateTo());

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, rawYardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const actor = await requirePermission(request, db, 'reefer.check.read', 'คุณไม่มีสิทธิ์ดูแผนปลั๊กตู้เย็น');
    if (actor instanceof NextResponse) return actor;

    const capacity = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM YardZones WHERE yard_id = @yardId AND is_active = 1 AND has_reefer_plugs = 1) AS reefer_zones,
          (SELECT ISNULL(SUM(ISNULL(max_bay, 0) * ISNULL(max_row, 0)), 0)
             FROM YardZones
             WHERE yard_id = @yardId AND is_active = 1 AND has_reefer_plugs = 1) AS plug_capacity,
          (SELECT COUNT(*) FROM Containers
             WHERE yard_id = @yardId AND type = 'RF' AND status NOT IN ('released', 'gated_out')) AS current_rf,
          (SELECT COUNT(*)
             FROM Containers c
             JOIN YardZones z ON z.zone_id = c.zone_id
             WHERE c.yard_id = @yardId AND c.type = 'RF'
               AND c.status NOT IN ('released', 'gated_out')
               AND z.has_reefer_plugs = 1) AS current_in_reefer_zone,
          (SELECT COUNT(*)
             FROM Containers c
             LEFT JOIN YardZones z ON z.zone_id = c.zone_id
             WHERE c.yard_id = @yardId AND c.type = 'RF'
               AND c.status NOT IN ('released', 'gated_out')
               AND (z.zone_id IS NULL OR ISNULL(z.has_reefer_plugs, 0) = 0)) AS current_unplugged_risk
      `);

    const upcomingBookings = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('dateFrom', sql.NVarChar, dateFrom)
      .input('dateTo', sql.NVarChar, dateTo)
      .query(`
        SELECT TOP 50
          b.booking_id,
          b.booking_number,
          b.status,
          b.customer_id,
          c.customer_name,
          b.container_count,
          b.container_size,
          b.container_type,
          b.eta,
          b.valid_from,
          b.valid_to,
          p.policy_id,
          p.interval_hours,
          p.warning_grace_minutes,
          p.min_temp_c,
          p.max_temp_c
        FROM Bookings b
        LEFT JOIN Customers c ON c.customer_id = b.customer_id
        LEFT JOIN ReeferCheckPolicies p ON p.booking_id = b.booking_id
          AND p.scope_type = 'booking'
          AND p.is_active = 1
        WHERE b.yard_id = @yardId
          AND UPPER(ISNULL(b.container_type, '')) IN ('RF', 'RH', 'REEFER')
          AND b.status IN ('pending', 'confirmed')
          AND CAST(COALESCE(b.eta, b.valid_from, b.created_at) AS DATE) BETWEEN @dateFrom AND @dateTo
        ORDER BY COALESCE(b.eta, b.valid_from, b.created_at) ASC, b.booking_id DESC
      `);

    const byDay = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('dateFrom', sql.NVarChar, dateFrom)
      .input('dateTo', sql.NVarChar, dateTo)
      .query(`
        SELECT
          CAST(COALESCE(b.eta, b.valid_from, b.created_at) AS DATE) AS plan_date,
          ISNULL(SUM(ISNULL(b.container_count, 0)), 0) AS expected_rf
        FROM Bookings b
        WHERE b.yard_id = @yardId
          AND UPPER(ISNULL(b.container_type, '')) IN ('RF', 'RH', 'REEFER')
          AND b.status IN ('pending', 'confirmed')
          AND CAST(COALESCE(b.eta, b.valid_from, b.created_at) AS DATE) BETWEEN @dateFrom AND @dateTo
        GROUP BY CAST(COALESCE(b.eta, b.valid_from, b.created_at) AS DATE)
        ORDER BY CAST(COALESCE(b.eta, b.valid_from, b.created_at) AS DATE) ASC
      `);

    const base = capacity.recordset[0] || {};
    const upcomingRf = upcomingBookings.recordset.reduce((sum, booking) => sum + toNumber(booking.container_count), 0);
    const plugCapacity = toNumber(base.plug_capacity);
    const currentRf = toNumber(base.current_rf);
    const projectedRequiredPlugs = currentRf + upcomingRf;
    const projectedShortage = Math.max(0, projectedRequiredPlugs - plugCapacity);
    const utilizationPercent = plugCapacity > 0
      ? Math.round((projectedRequiredPlugs / plugCapacity) * 100)
      : 0;

    return NextResponse.json({
      summary: {
        reefer_zones: toNumber(base.reefer_zones),
        plug_capacity: plugCapacity,
        current_rf: currentRf,
        current_in_reefer_zone: toNumber(base.current_in_reefer_zone),
        current_unplugged_risk: toNumber(base.current_unplugged_risk),
        upcoming_rf: upcomingRf,
        projected_required_plugs: projectedRequiredPlugs,
        projected_shortage: projectedShortage,
        utilization_percent: utilizationPercent,
      },
      upcomingBookings: upcomingBookings.recordset,
      byDay: byDay.recordset,
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ GET reefer plug plan error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดแผนปลั๊กตู้เย็นได้' }, { status: 500 });
  }
}
