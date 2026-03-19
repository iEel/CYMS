import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึงกิจกรรมล่าสุด (เป็น notifications)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id') || '1';
    const limit = searchParams.get('limit') || '20';

    const db = await getDb();

    // 1. Recent Gate Transactions (gate_in / gate_out)
    const gateRes = await db.request()
      .input('yardId', sql.Int, parseInt(yardId))
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT TOP (@limit)
          'gate' AS source,
          g.transaction_type AS event_type,
          g.container_number,
          g.driver_name,
          g.truck_plate,
          g.eir_number,
          g.created_at AS event_time,
          c.size, c.type
        FROM GateTransactions g
        LEFT JOIN Containers c ON g.container_number = c.container_number
        WHERE g.yard_id = @yardId
        ORDER BY g.created_at DESC
      `);

    // 2. Recent Work Order updates
    const woRes = await db.request()
      .input('yardId', sql.Int, parseInt(yardId))
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        SELECT TOP (@limit)
          'work_order' AS source,
          w.order_type AS event_type,
          c.container_number,
          w.status,
          w.priority,
          tz.zone_name AS to_zone_name,
          w.to_bay, w.to_row, w.to_tier,
          COALESCE(w.completed_at, w.started_at, w.created_at) AS event_time
        FROM WorkOrders w
        LEFT JOIN Containers c ON w.container_id = c.container_id
        LEFT JOIN YardZones tz ON w.to_zone_id = tz.zone_id
        WHERE w.yard_id = @yardId
        ORDER BY COALESCE(w.completed_at, w.started_at, w.created_at) DESC
      `);

    // Merge and sort by time
    const notifications = [
      ...gateRes.recordset.map((g: Record<string, unknown>) => ({
        id: `gate-${g.event_time}-${g.container_number}`,
        source: 'gate',
        type: g.event_type as string,
        title: g.event_type === 'gate_in'
          ? `📥 ตู้เข้าลาน ${g.container_number}`
          : `📤 ตู้ออกลาน ${g.container_number}`,
        detail: `${g.size}'${g.type}${g.driver_name ? ` • คนขับ: ${g.driver_name}` : ''}${g.eir_number ? ` • EIR: ${g.eir_number}` : ''}`,
        time: g.event_time,
      })),
      ...woRes.recordset.map((w: Record<string, unknown>) => {
        const statusText: Record<string, string> = {
          pending: '🆕 งานใหม่',
          assigned: '👤 มอบหมายแล้ว',
          in_progress: '🔄 กำลังดำเนินการ',
          completed: '✅ เสร็จสิ้น',
          cancelled: '❌ ยกเลิก',
        };
        return {
          id: `wo-${w.event_time}-${w.container_number}`,
          source: 'work_order',
          type: w.status as string,
          title: `${statusText[w.status as string] || '📋 งาน'} ${w.container_number || ''}`,
          detail: `${w.event_type}${w.to_zone_name ? ` → Zone ${w.to_zone_name} B${w.to_bay}-R${w.to_row}-T${w.to_tier}` : ''}`,
          time: w.event_time,
        };
      }),
    ]
      .sort((a, b) => new Date(b.time as string).getTime() - new Date(a.time as string).getTime())
      .slice(0, parseInt(limit));

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('❌ GET notifications error:', error);
    return NextResponse.json({ notifications: [] });
  }
}
