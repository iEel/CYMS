import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { getPortalCustomerId, portalContainerVisibilitySql } from '@/lib/portalAccess';

function parsePositiveInt(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const { searchParams } = new URL(request.url);
    const containerId = parsePositiveInt(searchParams.get('container_id'));
    const db = await getDb();
    const req = db.request().input('cid', sql.Int, cid);
    const filters = [portalContainerVisibilitySql('c'), "c.type = 'RF'"];
    if (containerId) {
      req.input('containerId', sql.Int, containerId);
      filters.push('c.container_id = @containerId');
    }

    const result = await req.query(`
      SELECT
        c.container_id, c.container_number, c.size, c.type, c.shipping_line,
        c.status AS container_status, c.is_laden, c.yard_id,
        z.zone_name, y.yard_name,
        latestBooking.booking_id, latestBooking.booking_number,
        latestCheck.check_id AS latest_check_id,
        latestCheck.measured_temp_c AS latest_measured_temp_c,
        latestCheck.set_point_c AS latest_set_point_c,
        latestCheck.supply_temp_c AS latest_supply_temp_c,
        latestCheck.return_temp_c AS latest_return_temp_c,
        latestCheck.status AS latest_check_status,
        latestCheck.photo_url AS latest_photo_url,
        latestCheck.notes AS latest_notes,
        latestCheck.checked_at AS latest_checked_at
      FROM Containers c
      LEFT JOIN YardZones z ON z.zone_id = c.zone_id
      LEFT JOIN Yards y ON y.yard_id = c.yard_id
      OUTER APPLY (
        SELECT TOP 1 b.booking_id, b.booking_number
        FROM BookingContainers bc
        JOIN Bookings b ON b.booking_id = bc.booking_id
        WHERE bc.container_id = c.container_id
          OR bc.container_number = c.container_number
        ORDER BY COALESCE(b.eta, b.created_at) DESC, b.booking_id DESC
      ) latestBooking
      OUTER APPLY (
        SELECT TOP 1 rc.*
        FROM ReeferTemperatureChecks rc
        WHERE rc.container_id = c.container_id
        ORDER BY rc.checked_at DESC, rc.check_id DESC
      ) latestCheck
      WHERE ${filters.join(' AND ')}
      ORDER BY c.container_number ASC
    `);

    const historyResult = containerId ? await db.request()
      .input('cid', sql.Int, cid)
      .input('containerId', sql.Int, containerId)
      .query(`
        SELECT TOP 100
          rc.check_id, rc.container_id, rc.booking_id, rc.measured_temp_c,
          rc.set_point_c, rc.supply_temp_c, rc.return_temp_c, rc.status,
          rc.photo_url, rc.notes, rc.checked_at
        FROM ReeferTemperatureChecks rc
        JOIN Containers c ON c.container_id = rc.container_id
        WHERE rc.container_id = @containerId
          AND ${portalContainerVisibilitySql('c')}
          AND c.type = 'RF'
        ORDER BY rc.checked_at DESC, rc.check_id DESC
      `) : { recordset: [] };

    return NextResponse.json({ items: result.recordset, history: historyResult.recordset });
  } catch (error) {
    console.error('❌ Portal reefer error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลตู้เย็นได้' }, { status: 500 });
  }
}
