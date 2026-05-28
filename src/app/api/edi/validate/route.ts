import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

const EDI_VALIDATE_PERMISSIONS = ['gate.in', 'gate.out', 'booking.manage', 'integration.send'];

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// POST — Seal Cross-Validation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { container_number, seal_number, yard_id } = body;
    const yardId = parsePositiveInt(yard_id);

    if (!yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }
    if (!container_number) {
      return NextResponse.json({ error: 'ต้องระบุ container_number' }, { status: 400 });
    }

    const db = await getDb();
    const permission = await requireAnyPermission(
      request,
      db,
      EDI_VALIDATE_PERMISSIONS,
      'คุณไม่มีสิทธิ์ตรวจสอบข้อมูล EDI'
    );
    if (permission instanceof Response) return permission;

    const yardAccess = await requireYardAccess(request, db, yardId, 'คุณไม่มีสิทธิ์ตรวจสอบข้อมูลของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    // Find container
    const containerResult = await db.request()
      .input('containerNumber', sql.NVarChar, container_number)
      .input('yardId', sql.Int, yardId)
      .query('SELECT * FROM Containers WHERE container_number = @containerNumber AND yard_id = @yardId');

    // Find matching booking
    const bookingResult = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('sealNumber', sql.NVarChar, seal_number || '')
      .query(`
        SELECT * FROM Bookings
        WHERE yard_id = @yardId AND seal_number = @sealNumber AND status IN ('pending','confirmed')
      `);

    const container = containerResult.recordset[0] || null;
    const booking = bookingResult.recordset[0] || null;

    const validations = [];

    // Container exists?
    if (container) {
      validations.push({ check: 'ตู้อยู่ในระบบ', status: 'pass', detail: `${container.container_number} — ${container.size}'${container.type}` });
    } else {
      validations.push({ check: 'ตู้อยู่ในระบบ', status: 'fail', detail: `ไม่พบตู้ ${container_number}` });
    }

    // Seal matches?
    if (container && seal_number) {
      if (container.seal_number === seal_number) {
        validations.push({ check: 'เลขซีลตรงกับตู้', status: 'pass', detail: `ซีล ${seal_number} ✓` });
      } else {
        validations.push({ check: 'เลขซีลตรงกับตู้', status: 'warning', detail: `ซีลในระบบ: ${container.seal_number || 'ว่าง'}, ซีลที่ตรวจ: ${seal_number}` });
      }
    }

    // Booking matches?
    if (booking) {
      validations.push({ check: 'พบ Booking ที่ตรงกัน', status: 'pass', detail: `Booking ${booking.booking_number} — ${booking.vessel_name || ''} ${booking.voyage_number || ''}` });
    } else if (seal_number) {
      validations.push({ check: 'พบ Booking ที่ตรงกัน', status: 'warning', detail: 'ไม่พบ Booking ที่มีเลขซีลตรงกัน' });
    }

    const overallStatus = validations.every(v => v.status === 'pass') ? 'pass' :
      validations.some(v => v.status === 'fail') ? 'fail' : 'warning';

    return NextResponse.json({
      container,
      booking,
      validations,
      overall_status: overallStatus,
    });
  } catch (error) {
    console.error('❌ Validate error:', error);
    return NextResponse.json({ error: 'ไม่สามารถตรวจสอบได้' }, { status: 500 });
  }
}
