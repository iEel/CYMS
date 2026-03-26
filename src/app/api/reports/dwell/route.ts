import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const overdueDays = parseInt(searchParams.get('overdue_days') || '30');

    const db = await getDb();

    // ─── By Shipping Line ───
    const byShippingLine = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT
          ISNULL(c.shipping_line, 'ไม่ระบุ') AS shipping_line,
          COUNT(*) AS container_count,
          ROUND(AVG(CAST(DATEDIFF(day, gt.created_at, GETDATE()) + 1 AS FLOAT)), 1) AS avg_dwell_days,
          MAX(DATEDIFF(day, gt.created_at, GETDATE()) + 1) AS max_dwell_days,
          MIN(DATEDIFF(day, gt.created_at, GETDATE()) + 1) AS min_dwell_days,
          SUM(DATEDIFF(day, gt.created_at, GETDATE()) + 1) AS total_dwell_days,
          COUNT(CASE WHEN DATEDIFF(day, gt.created_at, GETDATE()) + 1 > 30 THEN 1 END) AS overdue_count
        FROM Containers c
        LEFT JOIN (
          SELECT container_id, MAX(created_at) AS created_at
          FROM GateTransactions
          WHERE transaction_type = 'gate_in'
          GROUP BY container_id
        ) gt ON c.container_id = gt.container_id
        WHERE c.yard_id = @yardId AND c.status = 'in_yard'
        GROUP BY c.shipping_line
        ORDER BY avg_dwell_days DESC
      `);

    // ─── Overdue List ───
    const overdueList = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('overdueDays', sql.Int, overdueDays)
      .query(`
        SELECT
          c.container_id,
          c.container_number,
          ISNULL(c.shipping_line, 'ไม่ระบุ') AS shipping_line,
          c.size,
          c.type,
          c.status,
          z.zone_name,
          c.bay,
          c.row,
          c.tier,
          DATEDIFF(day, gt.created_at, GETDATE()) + 1 AS dwell_days,
          gt.created_at AS gate_in_date,
          -- Check if has pending invoice
          (SELECT COUNT(*) FROM Invoices i WHERE i.container_id = c.container_id AND i.status IN ('issued','pending')) AS pending_invoice_count
        FROM Containers c
        LEFT JOIN (
          SELECT container_id, MAX(created_at) AS created_at
          FROM GateTransactions
          WHERE transaction_type = 'gate_in'
          GROUP BY container_id
        ) gt ON c.container_id = gt.container_id
        LEFT JOIN YardZones z ON c.zone_id = z.zone_id
        WHERE c.yard_id = @yardId
          AND c.status = 'in_yard'
          AND DATEDIFF(day, gt.created_at, GETDATE()) + 1 > @overdueDays
        ORDER BY dwell_days DESC
      `);

    // ─── Overall Summary ───
    const summary = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('overdueDays', sql.Int, overdueDays)
      .query(`
        SELECT
          COUNT(*) AS total_in_yard,
          ROUND(AVG(CAST(DATEDIFF(day, gt.created_at, GETDATE()) + 1 AS FLOAT)), 1) AS avg_dwell_days,
          MAX(DATEDIFF(day, gt.created_at, GETDATE()) + 1) AS max_dwell_days,
          COUNT(CASE WHEN DATEDIFF(day, gt.created_at, GETDATE()) + 1 > @overdueDays THEN 1 END) AS overdue_count,
          COUNT(CASE WHEN DATEDIFF(day, gt.created_at, GETDATE()) + 1 <= 7 THEN 1 END) AS within_7_days,
          COUNT(CASE WHEN DATEDIFF(day, gt.created_at, GETDATE()) + 1 BETWEEN 8 AND 14 THEN 1 END) AS within_8_14_days,
          COUNT(CASE WHEN DATEDIFF(day, gt.created_at, GETDATE()) + 1 BETWEEN 15 AND 30 THEN 1 END) AS within_15_30_days,
          COUNT(CASE WHEN DATEDIFF(day, gt.created_at, GETDATE()) + 1 > 30 THEN 1 END) AS over_30_days
        FROM Containers c
        LEFT JOIN (
          SELECT container_id, MAX(created_at) AS created_at
          FROM GateTransactions
          WHERE transaction_type = 'gate_in'
          GROUP BY container_id
        ) gt ON c.container_id = gt.container_id
        WHERE c.yard_id = @yardId AND c.status = 'in_yard'
      `);

    return NextResponse.json({
      summary: summary.recordset[0],
      byShippingLine: byShippingLine.recordset,
      overdueList: overdueList.recordset,
      overdueDays,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ GET dwell report error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงรายงาน Dwell ได้' }, { status: 500 });
  }
}
