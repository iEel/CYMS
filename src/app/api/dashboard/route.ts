import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');

    const db = await getDb();

    // ===== 1. KPI Cards =====

    // Total containers in yard
    const containerCount = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'in_yard' THEN 1 END) as in_yard,
          COUNT(CASE WHEN status = 'gated_out' THEN 1 END) as gated_out,
          COUNT(CASE WHEN hold_status IS NOT NULL THEN 1 END) as on_hold
        FROM Containers WHERE yard_id = @yardId
      `);

    // Yesterday's container count for comparison
    const yesterdayCount = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT COUNT(*) as cnt FROM Containers 
        WHERE yard_id = @yardId AND created_at < DATEADD(DAY, -1, CAST(GETDATE() AS DATE))
      `);

    // Yard capacity (sum of all zone slots)
    const capacity = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT ISNULL(SUM(max_bay * max_row * max_tier), 1) as total_slots
        FROM YardZones WHERE yard_id = @yardId AND is_active = 1
      `);

    const inYard = containerCount.recordset[0].in_yard || 0;
    const totalSlots = capacity.recordset[0].total_slots || 1;
    const occupancyRate = Math.round((inYard / totalSlots) * 100);

    // Gate-In today count
    const gateInToday = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT COUNT(*) as cnt FROM GateTransactions 
        WHERE yard_id = @yardId AND transaction_type = 'gate_in' 
        AND CAST(transaction_date AS DATE) = CAST(GETDATE() AS DATE)
      `);

    // Gate-In yesterday for comparison
    const gateInYesterday = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT COUNT(*) as cnt FROM GateTransactions 
        WHERE yard_id = @yardId AND transaction_type = 'gate_in' 
        AND CAST(transaction_date AS DATE) = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE)
      `);

    // Revenue today
    const revenueToday = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT ISNULL(SUM(grand_total), 0) as total FROM Invoices 
        WHERE yard_id = @yardId AND status = 'paid' 
        AND CAST(paid_at AS DATE) = CAST(GETDATE() AS DATE)
      `);

    // Revenue yesterday for comparison
    const revenueYesterday = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT ISNULL(SUM(grand_total), 0) as total FROM Invoices 
        WHERE yard_id = @yardId AND status = 'paid' 
        AND CAST(paid_at AS DATE) = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE)
      `);

    // Pending work orders
    const pendingWO = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT COUNT(*) as cnt FROM WorkOrders 
        WHERE yard_id = @yardId AND status IN ('pending', 'assigned')
      `);

    // ===== 2. Container Status Summary =====
    const statusSummary = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT 
          COUNT(CASE WHEN status = 'in_yard' AND hold_status IS NULL THEN 1 END) as available,
          COUNT(CASE WHEN status = 'in_yard' THEN 1 END) as in_yard,
          COUNT(CASE WHEN status = 'gated_out' AND CAST(updated_at AS DATE) = CAST(GETDATE() AS DATE) THEN 1 END) as gated_out_today,
          COUNT(CASE WHEN hold_status IS NOT NULL THEN 1 END) as on_hold,
          COUNT(CASE WHEN status = 'in_yard' AND type = 'RF' THEN 1 END) as reefer
        FROM Containers WHERE yard_id = @yardId
      `);

    // ===== 3. Recent Activities from AuditLog =====
    const activities = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('limit', sql.Int, 10)
      .query(`
        SELECT TOP (@limit) a.log_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
          u.full_name, u.username
        FROM AuditLog a
        LEFT JOIN Users u ON a.user_id = u.user_id
        WHERE a.yard_id = @yardId OR a.yard_id IS NULL
        ORDER BY a.created_at DESC
      `);

    // ===== Build Response =====
    const todayTotal = containerCount.recordset[0].total || 0;
    const yesterdayTotal = yesterdayCount.recordset[0].cnt || 0;
    const containerDiff = todayTotal - yesterdayTotal;

    const gateInTodayCount = gateInToday.recordset[0].cnt || 0;
    const gateInYesterdayCount = gateInYesterday.recordset[0].cnt || 0;
    const gateInDiff = gateInTodayCount - gateInYesterdayCount;

    const revToday = revenueToday.recordset[0].total || 0;
    const revYesterday = revenueYesterday.recordset[0].total || 0;
    const revChange = revYesterday > 0 ? Math.round(((revToday - revYesterday) / revYesterday) * 100 * 10) / 10 : 0;

    return NextResponse.json({
      kpi: {
        containers: { value: inYard, change: containerDiff },
        occupancy: { value: occupancyRate, totalSlots },
        gateInToday: { value: gateInTodayCount, change: gateInDiff },
        revenue: { value: revToday, change: revChange },
        pendingOrders: pendingWO.recordset[0].cnt || 0,
      },
      statusSummary: statusSummary.recordset[0],
      activities: activities.recordset,
    });
  } catch (error) {
    console.error('❌ GET dashboard error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลแดชบอร์ดได้' }, { status: 500 });
  }
}
