import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import {
  getPortalCustomerId,
  portalBookingVisibilitySql,
  portalContainerVisibilitySql,
} from '@/lib/portalAccess';
import {
  filterNotificationsByPreferences,
  getPortalNotificationPreferences,
} from '@/lib/portalNotificationPreferences';

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 10;
  return Math.min(parsed, 50);
}

function formatTemp(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)}°C` : '-';
}

export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const db = await getDb();
    const preferences = await getPortalNotificationPreferences(db, cid);

    const reeferExceptions = await db.request()
      .input('cid', sql.Int, cid)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          e.exception_id,
          e.container_id,
          c.container_number,
          e.severity,
          e.reason,
          e.recommended_action,
          e.created_at AS event_time,
          rc.measured_temp_c,
          rc.set_point_c
        FROM ReeferExceptions e
        JOIN Containers c ON c.container_id = e.container_id
        LEFT JOIN ReeferTemperatureChecks rc ON rc.check_id = e.check_id
        WHERE ${portalContainerVisibilitySql('c')}
          AND c.type = 'RF'
          AND e.status IN ('open', 'in_progress')
        ORDER BY
          CASE e.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
          e.created_at DESC
      `);

    const bookingUpdates = await db.request()
      .input('cid', sql.Int, cid)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          b.booking_id,
          b.booking_number,
          b.status,
          b.eta,
          b.created_at AS event_time
        FROM Bookings b
        WHERE ${portalBookingVisibilitySql('b')}
          AND b.status IN ('pending', 'confirmed', 'cancelled', 'completed')
        ORDER BY b.created_at DESC
      `);

    const notifications = filterNotificationsByPreferences([
      ...reeferExceptions.recordset.map((row: Record<string, unknown>) => ({
        id: `reefer-${row.exception_id}`,
        type: 'reefer_exception',
        severity: row.severity || 'high',
        title: `อุณหภูมิตู้เย็นผิดปกติ ${row.container_number}`,
        detail: `${row.reason || 'ตรวจพบ exception'} · measured ${formatTemp(row.measured_temp_c)} / set ${formatTemp(row.set_point_c)}`,
        time: row.event_time,
        deep_link: `/portal/reefer?container_id=${row.container_id}`,
      })),
      ...bookingUpdates.recordset.map((row: Record<string, unknown>) => ({
        id: `booking-${row.booking_id}-${row.status}`,
        type: 'booking_status',
        severity: row.status === 'cancelled' ? 'warning' : 'info',
        title: `Booking ${row.booking_number}`,
        detail: `สถานะ ${row.status}${row.eta ? ` · ETA ${new Date(row.eta as string).toLocaleDateString('th-TH')}` : ''}`,
        time: row.event_time,
        deep_link: '/portal/bookings',
      })),
    ], preferences)
      .sort((a, b) => new Date(b.time as string).getTime() - new Date(a.time as string).getTime())
      .slice(0, limit);

    return NextResponse.json({
      notifications,
      notification_count: notifications.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Portal notifications error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดการแจ้งเตือนได้' }, { status: 500 });
  }
}
