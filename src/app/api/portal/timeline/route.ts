import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import {
  getPortalCustomerId,
  portalBookingVisibilitySql,
  portalContainerVisibilitySql,
} from '@/lib/portalAccess';
import { requirePortalAction } from '@/lib/customerPortalPermissions';

function positiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeTimeline(rows: Array<Record<string, unknown>>) {
  return rows
    .filter(row => row.event_time)
    .sort((a, b) => new Date(b.event_time as string).getTime() - new Date(a.event_time as string).getTime())
    .slice(0, 100);
}

function sanitizeTimelineFields(
  rows: Array<Record<string, unknown>>,
  canViewTrucking: boolean,
  canViewDriver: boolean
) {
  return rows.map(row => {
    const sanitized = { ...row };
    if (!canViewTrucking) delete sanitized.truck_plate;
    if (!canViewDriver) delete sanitized.driver_name;
    return sanitized;
  });
}

export async function GET(request: NextRequest) {
  try {
    const cid = getPortalCustomerId(request);
    if (cid instanceof NextResponse) return cid;

    const { searchParams } = new URL(request.url);
    const bookingId = positiveInt(searchParams.get('booking_id'));
    const containerId = positiveInt(searchParams.get('container_id'));
    if (!bookingId && !containerId) {
      return NextResponse.json({ error: 'ต้องระบุ booking_id หรือ container_id' }, { status: 400 });
    }

    const db = await getDb();
    const portalActor = await requirePortalAction(
      request,
      db,
      bookingId ? 'portal.booking.view' : 'portal.container.view'
    );
    if (portalActor instanceof NextResponse) return portalActor;

    const events: Array<Record<string, unknown>> = [];
    const canViewTrucking = portalActor.actions.has('portal.trucking.view');
    const canViewDriver = portalActor.actions.has('portal.driver.view');

    if (bookingId) {
      const booking = await db.request()
        .input('cid', sql.Int, cid)
        .input('bookingId', sql.Int, bookingId)
        .query(`
          SELECT TOP 1 b.booking_id, b.booking_number
          FROM Bookings b
          WHERE b.booking_id = @bookingId
            AND ${portalBookingVisibilitySql('b')}
        `);
      const row = booking.recordset[0];
      if (!row) return NextResponse.json({ error: 'ไม่พบ Booking หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });

      const gate = await db.request()
        .input('bookingId', sql.Int, bookingId)
        .input('bookingNumber', sql.NVarChar, row.booking_number)
        .query(`
          SELECT TOP 100
            g.transaction_type AS event_type,
            CASE WHEN g.transaction_type = 'gate_in' THEN 'Gate In' ELSE 'Gate Out' END AS title,
            g.created_at AS event_time,
            g.container_number,
            g.eir_number AS reference_number,
            g.truck_plate,
            g.driver_name,
            g.remarks AS detail
          FROM GateTransactions g
          WHERE g.booking_ref = @bookingNumber
             OR EXISTS (
              SELECT 1
              FROM BookingContainers bc
              WHERE bc.booking_id = @bookingId
                AND (bc.container_id = g.container_id OR bc.container_number = g.container_number)
             )
          ORDER BY g.created_at DESC
        `);
      events.push(...gate.recordset);

      const checks = await db.request()
        .input('bookingId', sql.Int, bookingId)
        .query(`
          SELECT TOP 100
            'reefer_check' AS event_type,
            'Reefer Check' AS title,
            rc.checked_at AS event_time,
            c.container_number,
            CAST(rc.measured_temp_c AS NVARCHAR(30)) AS reference_number,
            rc.status,
            rc.notes AS detail
          FROM ReeferTemperatureChecks rc
          LEFT JOIN Containers c ON c.container_id = rc.container_id
          WHERE rc.booking_id = @bookingId
          ORDER BY rc.checked_at DESC
        `);
      events.push(...checks.recordset);

      const exceptions = await db.request()
        .input('bookingId', sql.Int, bookingId)
        .query(`
          SELECT TOP 100
            'reefer_exception' AS event_type,
            'Reefer Exception' AS title,
            e.created_at AS event_time,
            c.container_number,
            e.severity AS reference_number,
            e.status,
            e.reason AS detail
          FROM ReeferExceptions e
          LEFT JOIN Containers c ON c.container_id = e.container_id
          WHERE e.booking_id = @bookingId
          ORDER BY e.created_at DESC
        `);
      events.push(...exceptions.recordset);
    } else if (containerId) {
      const container = await db.request()
        .input('cid', sql.Int, cid)
        .input('containerId', sql.Int, containerId)
        .query(`
          SELECT TOP 1 c.container_id, c.container_number
          FROM Containers c
          WHERE c.container_id = @containerId
            AND ${portalContainerVisibilitySql('c')}
        `);
      const row = container.recordset[0];
      if (!row) return NextResponse.json({ error: 'ไม่พบตู้หรือไม่มีสิทธิ์เข้าถึง' }, { status: 404 });

      const gate = await db.request()
        .input('containerId', sql.Int, containerId)
        .input('containerNumber', sql.NVarChar, row.container_number)
        .query(`
          SELECT TOP 100
            g.transaction_type AS event_type,
            CASE WHEN g.transaction_type = 'gate_in' THEN 'Gate In' ELSE 'Gate Out' END AS title,
            g.created_at AS event_time,
            g.container_number,
            g.eir_number AS reference_number,
            g.truck_plate,
            g.driver_name,
            g.remarks AS detail
          FROM GateTransactions g
          WHERE g.container_id = @containerId OR g.container_number = @containerNumber
          ORDER BY g.created_at DESC
        `);
      events.push(...gate.recordset);

      const checks = await db.request()
        .input('containerId', sql.Int, containerId)
        .query(`
          SELECT TOP 100
            'reefer_check' AS event_type,
            'Reefer Check' AS title,
            rc.checked_at AS event_time,
            c.container_number,
            CAST(rc.measured_temp_c AS NVARCHAR(30)) AS reference_number,
            rc.status,
            rc.notes AS detail
          FROM ReeferTemperatureChecks rc
          LEFT JOIN Containers c ON c.container_id = rc.container_id
          WHERE rc.container_id = @containerId
          ORDER BY rc.checked_at DESC
        `);
      events.push(...checks.recordset);
    }

    return NextResponse.json({
      timeline: sanitizeTimelineFields(normalizeTimeline(events), canViewTrucking, canViewDriver),
      read_only: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Portal timeline error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลด audit trail ได้' }, { status: 500 });
  }
}
