import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const type = searchParams.get('type') || 'daily_in';
    const date = searchParams.get('date');         // YYYY-MM-DD (daily)
    const dateFrom = searchParams.get('date_from'); // YYYY-MM-DD (summary)
    const dateTo = searchParams.get('date_to');     // YYYY-MM-DD (summary)

    const db = await getDb();

    // ─────────────── DAILY IN / OUT ───────────────
    if (type === 'daily_in' || type === 'daily_out') {
      const txType = type === 'daily_in' ? 'gate_in' : 'gate_out';
      const targetDate = date || new Date().toISOString().slice(0, 10);

      // Transaction list
      const txList = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('targetDate', sql.NVarChar, targetDate)
        .query(`
          SELECT
            g.transaction_id, g.eir_number, g.created_at,
            g.driver_name, g.driver_license, g.truck_plate,
            g.seal_number, g.booking_ref, g.notes,
            c.container_number, c.size, c.type AS container_type,
            c.shipping_line, c.is_laden,
            z.zone_name, c.bay, c.[row], c.tier,
            u.full_name AS operator_name
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          LEFT JOIN YardZones z ON c.zone_id = z.zone_id
          LEFT JOIN Users u ON g.processed_by = u.user_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) = @targetDate
          ORDER BY g.created_at ASC
        `);

      // Summary cards
      const summary = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('targetDate', sql.NVarChar, targetDate)
        .query(`
          SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN c.is_laden = 1 THEN 1 END) AS laden,
            COUNT(CASE WHEN c.is_laden = 0 OR c.is_laden IS NULL THEN 1 END) AS empty,
            COUNT(CASE WHEN c.size = '20' THEN 1 END) AS size_20,
            COUNT(CASE WHEN c.size = '40' THEN 1 END) AS size_40,
            COUNT(CASE WHEN c.size = '45' THEN 1 END) AS size_45
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) = @targetDate
        `);

      // By Shipping Line
      const byShippingLine = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('targetDate', sql.NVarChar, targetDate)
        .query(`
          SELECT
            ISNULL(c.shipping_line, 'ไม่ระบุ') AS shipping_line,
            COUNT(*) AS count
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) = @targetDate
          GROUP BY c.shipping_line
          ORDER BY count DESC
        `);

      return NextResponse.json({
        type,
        date: targetDate,
        summary: summary.recordset[0],
        transactions: txList.recordset,
        byShippingLine: byShippingLine.recordset,
        generatedAt: new Date().toISOString(),
      });
    }

    // ─────────────── SUMMARY IN / OUT ───────────────
    if (type === 'summary_in' || type === 'summary_out') {
      const txType = type === 'summary_in' ? 'gate_in' : 'gate_out';
      const fromDate = dateFrom || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const toDate = dateTo || new Date().toISOString().slice(0, 10);

      // ── Section 1: KPI Cards ──
      const kpi = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT
            COUNT(*) AS total,
            COUNT(CASE WHEN c.is_laden = 1 THEN 1 END) AS laden,
            COUNT(CASE WHEN c.is_laden = 0 OR c.is_laden IS NULL THEN 1 END) AS empty,
            DATEDIFF(day, CAST(@fromDate AS DATE), CAST(@toDate AS DATE)) + 1 AS date_range_days
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
        `);

      // Peak day
      const peakDay = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT TOP 1
            CAST(g.created_at AS DATE) AS peak_date,
            COUNT(*) AS peak_count
          FROM GateTransactions g
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
          GROUP BY CAST(g.created_at AS DATE)
          ORDER BY peak_count DESC
        `);

      // ── Section 2: Daily Trend ──
      const dailyTrend = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT
            CAST(g.created_at AS DATE) AS date,
            COUNT(*) AS count,
            COUNT(CASE WHEN c.is_laden = 1 THEN 1 END) AS laden,
            COUNT(CASE WHEN c.is_laden = 0 OR c.is_laden IS NULL THEN 1 END) AS empty
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
          GROUP BY CAST(g.created_at AS DATE)
          ORDER BY CAST(g.created_at AS DATE) ASC
        `);

      // ── Section 3: By Shipping Line (Top 10) ──
      const byShippingLine = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT TOP 10
            ISNULL(c.shipping_line, 'ไม่ระบุ') AS shipping_line,
            COUNT(*) AS count,
            COUNT(CASE WHEN c.is_laden = 1 THEN 1 END) AS laden,
            COUNT(CASE WHEN c.is_laden = 0 OR c.is_laden IS NULL THEN 1 END) AS empty
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
          GROUP BY c.shipping_line
          ORDER BY count DESC
        `);

      // ── Section 4: By Container Size ──
      const bySize = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT
            ISNULL(c.size, 'ไม่ระบุ') AS size,
            COUNT(*) AS count
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
          GROUP BY c.size
          ORDER BY count DESC
        `);

      // ── Section 5: By Container Type ──
      const byType = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT
            ISNULL(c.type, 'ไม่ระบุ') AS container_type,
            COUNT(*) AS count
          FROM GateTransactions g
          LEFT JOIN Containers c ON g.container_id = c.container_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
          GROUP BY c.type
          ORDER BY count DESC
        `);

      // ── Section 6: By Hour of Day ──
      const byHour = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT
            DATEPART(HOUR, g.created_at) AS hour,
            COUNT(*) AS count
          FROM GateTransactions g
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
          GROUP BY DATEPART(HOUR, g.created_at)
          ORDER BY hour ASC
        `);

      // ── Section 7: By Operator ──
      const byOperator = await db.request()
        .input('yardId', sql.Int, yardId)
        .input('txType', sql.NVarChar, txType)
        .input('fromDate', sql.NVarChar, fromDate)
        .input('toDate', sql.NVarChar, toDate)
        .query(`
          SELECT
            ISNULL(u.full_name, 'ไม่ระบุ') AS operator_name,
            COUNT(*) AS count
          FROM GateTransactions g
          LEFT JOIN Users u ON g.processed_by = u.user_id
          WHERE g.yard_id = @yardId
            AND g.transaction_type = @txType
            AND CAST(g.created_at AS DATE) BETWEEN @fromDate AND @toDate
          GROUP BY u.full_name
          ORDER BY count DESC
        `);

      const kpiData = kpi.recordset[0];
      const peak = peakDay.recordset[0] || null;
      const dateRangeDays = kpiData?.date_range_days || 1;
      const avgPerDay = kpiData?.total
        ? Math.round((kpiData.total / dateRangeDays) * 10) / 10
        : 0;

      return NextResponse.json({
        type,
        date_from: fromDate,
        date_to: toDate,
        kpi: {
          total: kpiData?.total || 0,
          laden: kpiData?.laden || 0,
          empty: kpiData?.empty || 0,
          avg_per_day: avgPerDay,
          date_range_days: dateRangeDays,
          peak_date: peak?.peak_date || null,
          peak_count: peak?.peak_count || 0,
        },
        dailyTrend: dailyTrend.recordset,
        byShippingLine: byShippingLine.recordset,
        bySize: bySize.recordset,
        byType: byType.recordset,
        byHour: byHour.recordset,
        byOperator: byOperator.recordset,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'ประเภทรายงานไม่ถูกต้อง' }, { status: 400 });

  } catch (error) {
    console.error('❌ GET gate report error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายงาน Gate ได้' }, { status: 500 });
  }
}
