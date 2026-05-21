import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function defaultDateFrom() {
  return new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
}

function defaultDateTo() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  return DATE_RE.test(value) ? value : null;
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
    const actor = await requirePermission(request, db, 'reports.view', 'คุณไม่มีสิทธิ์ดูรายงาน');
    if (actor instanceof NextResponse) return actor;

    const summary = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT
          COUNT(*) AS total_rf,
          COUNT(CASE WHEN latestCheck.status = 'normal' THEN 1 END) AS normal_count,
          COUNT(CASE WHEN latestCheck.status = 'out_of_range' THEN 1 END) AS out_of_range_count,
          COUNT(CASE WHEN latestCheck.status = 'unreadable' THEN 1 END) AS unreadable_count,
          COUNT(CASE WHEN latestCheck.status = 'power_issue' THEN 1 END) AS power_issue_count,
          COUNT(CASE WHEN latestCheck.check_id IS NULL THEN 1 END) AS not_checked_count,
          COUNT(CASE WHEN activeException.exception_id IS NOT NULL THEN 1 END) AS active_exceptions,
          CAST(
            CASE WHEN COUNT(*) = 0 THEN 0
              ELSE 100.0 * COUNT(CASE WHEN latestCheck.status = 'normal' THEN 1 END) / COUNT(*)
            END AS DECIMAL(6,2)
          ) AS compliance_rate
        FROM Containers c
        OUTER APPLY (
          SELECT TOP 1 rc.check_id, rc.status
          FROM ReeferTemperatureChecks rc
          WHERE rc.container_id = c.container_id
          ORDER BY rc.checked_at DESC, rc.check_id DESC
        ) latestCheck
        OUTER APPLY (
          SELECT TOP 1 e.exception_id
          FROM ReeferExceptions e
          WHERE e.container_id = c.container_id
            AND e.status IN ('open', 'in_progress')
          ORDER BY e.created_at DESC, e.exception_id DESC
        ) activeException
        WHERE c.yard_id = @yardId
          AND c.type = 'RF'
      `);

    const trend = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('dateFrom', sql.NVarChar, dateFrom)
      .input('dateTo', sql.NVarChar, dateTo)
      .query(`
        SELECT
          CAST(rc.checked_at AS DATE) AS check_date,
          COUNT(*) AS total_checks,
          COUNT(CASE WHEN rc.status = 'normal' THEN 1 END) AS normal_count,
          COUNT(CASE WHEN rc.status <> 'normal' THEN 1 END) AS exception_count,
          CAST(
            CASE WHEN COUNT(*) = 0 THEN 0
              ELSE 100.0 * COUNT(CASE WHEN rc.status = 'normal' THEN 1 END) / COUNT(*)
            END AS DECIMAL(6,2)
          ) AS compliance_rate
        FROM ReeferTemperatureChecks rc
        WHERE rc.yard_id = @yardId
          AND CAST(rc.checked_at AS DATE) BETWEEN @dateFrom AND @dateTo
        GROUP BY CAST(rc.checked_at AS DATE)
        ORDER BY CAST(rc.checked_at AS DATE) ASC
      `);

    const openExceptions = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT TOP 50
          e.exception_id,
          e.severity,
          e.status,
          e.reason,
          e.recommended_action,
          DATEDIFF(hour, e.created_at, GETDATE()) AS age_hours,
          e.created_at,
          c.container_id,
          c.container_number,
          c.size,
          c.shipping_line,
          z.zone_name,
          rc.measured_temp_c,
          rc.set_point_c,
          rc.checked_at
        FROM ReeferExceptions e
        LEFT JOIN Containers c ON c.container_id = e.container_id
        LEFT JOIN YardZones z ON z.zone_id = c.zone_id
        LEFT JOIN ReeferTemperatureChecks rc ON rc.check_id = e.check_id
        WHERE e.yard_id = @yardId
          AND e.status IN ('open', 'in_progress')
        ORDER BY
          CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
          e.created_at ASC
      `);

    const byCustomer = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT TOP 20
          ISNULL(cu.customer_name, N'ไม่ระบุ') AS customer_name,
          COUNT(DISTINCT c.container_id) AS container_count,
          COUNT(DISTINCT activeException.exception_id) AS exception_count,
          CAST(AVG(CAST(latestCheck.measured_temp_c AS FLOAT)) AS DECIMAL(6,2)) AS avg_temp_c
        FROM Containers c
        OUTER APPLY (
          SELECT TOP 1 rc.measured_temp_c, rc.customer_id
          FROM ReeferTemperatureChecks rc
          WHERE rc.container_id = c.container_id
          ORDER BY rc.checked_at DESC, rc.check_id DESC
        ) latestCheck
        OUTER APPLY (
          SELECT TOP 1 b.customer_id
          FROM BookingContainers bc
          JOIN Bookings b ON b.booking_id = bc.booking_id
          WHERE bc.container_id = c.container_id
             OR bc.container_number = c.container_number
          ORDER BY COALESCE(b.eta, b.created_at) DESC, b.booking_id DESC
        ) latestBooking
        OUTER APPLY (
          SELECT TOP 1 e.exception_id
          FROM ReeferExceptions e
          WHERE e.container_id = c.container_id
            AND e.status IN ('open', 'in_progress')
          ORDER BY e.created_at DESC, e.exception_id DESC
        ) activeException
        LEFT JOIN Customers cu ON cu.customer_id = COALESCE(latestCheck.customer_id, latestBooking.customer_id, c.billing_customer_id, c.container_owner_id)
        WHERE c.yard_id = @yardId
          AND c.type = 'RF'
        GROUP BY cu.customer_name
        ORDER BY exception_count DESC, container_count DESC, customer_name ASC
      `);

    return NextResponse.json({
      summary: summary.recordset[0] || {
        total_rf: 0,
        normal_count: 0,
        out_of_range_count: 0,
        unreadable_count: 0,
        power_issue_count: 0,
        not_checked_count: 0,
        active_exceptions: 0,
        compliance_rate: 0,
      },
      trend: trend.recordset,
      openExceptions: openExceptions.recordset,
      byCustomer: byCustomer.recordset,
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ GET reefer report error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายงานตู้เย็นได้' }, { status: 500 });
  }
}
