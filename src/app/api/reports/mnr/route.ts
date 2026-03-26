import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const dateFrom = searchParams.get('date_from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const dateTo = searchParams.get('date_to') || new Date().toISOString().slice(0, 10);
    const status = searchParams.get('status') || ''; // '' = all

    const db = await getDb();

    const statusFilter = status ? `AND r.status = @status` : '';

    // ─── Overall Summary ───
    const summary = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('dateFrom', sql.NVarChar, dateFrom)
      .input('dateTo', sql.NVarChar, dateTo)
      .input('status', sql.NVarChar, status)
      .query(`
        SELECT
          COUNT(*) AS total_eor,
          COUNT(CASE WHEN r.status = 'approved' THEN 1 END) AS approved_count,
          COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) AS rejected_count,
          COUNT(CASE WHEN r.status IN ('pending','submitted') THEN 1 END) AS pending_count,
          COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS completed_count,
          ISNULL(SUM(r.estimated_cost), 0) AS total_estimated,
          ISNULL(SUM(r.actual_cost), 0) AS total_actual,
          ISNULL(AVG(r.estimated_cost), 0) AS avg_estimated,
          ISNULL(AVG(r.actual_cost), 0) AS avg_actual
        FROM RepairOrders r
        LEFT JOIN Containers c ON r.container_id = c.container_id
        WHERE c.yard_id = @yardId
          AND CAST(r.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
          ${statusFilter}
      `);

    // ─── By Damage Type (CEDEX component) ───
    // damage_details is JSON array of CEDEX code strings like ["P1-DM1-RP1","P2-DM2-RP1"]
    // We extract component prefix (e.g. "P1") - group by first 2 chars as component
    const byDamageType = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('dateFrom', sql.NVarChar, dateFrom)
      .input('dateTo', sql.NVarChar, dateTo)
      .input('status', sql.NVarChar, status)
      .query(`
        SELECT
          r.status,
          COUNT(*) AS count,
          ISNULL(SUM(r.estimated_cost), 0) AS total_estimated,
          ISNULL(SUM(r.actual_cost), 0) AS total_actual,
          ISNULL(AVG(r.estimated_cost), 0) AS avg_cost
        FROM RepairOrders r
        LEFT JOIN Containers c ON r.container_id = c.container_id
        WHERE c.yard_id = @yardId
          AND CAST(r.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
          ${statusFilter}
        GROUP BY r.status
        ORDER BY count DESC
      `);

    // ─── EOR List ───
    const eorList = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('dateFrom', sql.NVarChar, dateFrom)
      .input('dateTo', sql.NVarChar, dateTo)
      .input('status', sql.NVarChar, status)
      .query(`
        SELECT
          r.eor_id,
          r.eor_number,
          c.container_number,
          c.size,
          c.type,
          ISNULL(c.shipping_line, N'ไม่ระบุ') AS shipping_line,
          r.damage_details,
          r.estimated_cost,
          r.actual_cost,
          r.status,
          r.created_at,
          r.approved_at,
          u.full_name AS created_name
        FROM RepairOrders r
        LEFT JOIN Containers c ON r.container_id = c.container_id
        LEFT JOIN Users u ON r.created_by = u.user_id
        WHERE c.yard_id = @yardId
          AND CAST(r.created_at AS DATE) BETWEEN @dateFrom AND @dateTo
          ${statusFilter}
        ORDER BY r.created_at DESC
      `);

    // ─── Monthly Trend (last 6 months) ───
    const trend = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT
          FORMAT(r.created_at, 'yyyy-MM') AS month,
          COUNT(*) AS total,
          COUNT(CASE WHEN r.status = 'approved' OR r.status = 'completed' THEN 1 END) AS approved,
          COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) AS rejected,
          ISNULL(SUM(r.actual_cost), 0) AS total_actual_cost
        FROM RepairOrders r
        LEFT JOIN Containers c ON r.container_id = c.container_id
        WHERE c.yard_id = @yardId
          AND r.created_at >= DATEADD(month, -6, GETDATE())
        GROUP BY FORMAT(r.created_at, 'yyyy-MM')
        ORDER BY month DESC
      `);

    return NextResponse.json({
      summary: summary.recordset[0],
      byStatus: byDamageType.recordset,
      eorList: eorList.recordset,
      trend: trend.recordset,
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ GET M&R report error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายงาน M&R ได้' }, { status: 500 });
  }
}
