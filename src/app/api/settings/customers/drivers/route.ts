import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

import { getDb } from '@/lib/db';
import { requireAnyPermission } from '@/lib/apiAuth';

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const truckingCompanyId = positiveInt(searchParams.get('trucking_company_id'));
    if (!truckingCompanyId) {
      return NextResponse.json({ error: 'trucking_company_id required' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requireAnyPermission(
      request,
      db,
      ['gate.in', 'gate.out', 'yard.slot.move', 'yard.location.assign'],
      'คุณไม่มีสิทธิ์ค้นหาผู้ใช้คนขับ',
    );
    if (actor instanceof NextResponse) return actor;

    const result = await db.request()
      .input('truckingCompanyId', sql.Int, truckingCompanyId)
      .query(`
        SELECT u.user_id, u.username, u.full_name, u.customer_id
        FROM Users u
        JOIN Roles r ON r.role_id = u.role_id
        WHERE u.customer_id = @truckingCompanyId
          AND u.customer_portal_role = 'driver_user'
          AND r.role_code = 'customer'
          AND u.status = 'active'
        ORDER BY u.full_name, u.username
      `);

    return NextResponse.json({ drivers: result.recordset });
  } catch (error) {
    console.error('❌ GET customer drivers error:', error);
    return NextResponse.json({ error: 'ไม่สามารถค้นหาผู้ใช้คนขับได้' }, { status: 500 });
  }
}
