import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = requireRole(request, ['yard_manager'], 'เฉพาะ Yard Manager เท่านั้นที่ดูสิทธิ์ Customer Portal ได้');
  if (actor instanceof NextResponse) return actor;

  const { searchParams } = new URL(request.url);
  const customerId = Number(searchParams.get('customer_id') || 0);
  const entityType = searchParams.get('entity_type') || '';
  const active = searchParams.get('active') || '1';
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

  const db = await getDb();
  const req = db.request()
    .input('limit', sql.Int, limit)
    .input('customerId', sql.Int, Number.isFinite(customerId) && customerId > 0 ? customerId : null)
    .input('entityType', sql.NVarChar, entityType || null)
    .input('isActive', sql.Bit, active === 'all' ? null : active !== '0');

  const result = await req.query(`
    SELECT TOP (@limit)
      pea.access_id,
      pea.customer_id,
      c.customer_name,
      pea.entity_type,
      pea.entity_id,
      pea.entity_ref,
      pea.access_role,
      pea.source_table,
      pea.source_id,
      pea.permission_scope,
      pea.valid_from,
      pea.valid_until,
      pea.is_active,
      pea.created_at,
      pea.updated_at
    FROM PortalEntityAccess pea
    JOIN Customers c ON c.customer_id = pea.customer_id
    WHERE (@customerId IS NULL OR pea.customer_id = @customerId)
      AND (@entityType IS NULL OR pea.entity_type = @entityType)
      AND (@isActive IS NULL OR pea.is_active = @isActive)
    ORDER BY pea.updated_at DESC, pea.created_at DESC, pea.access_id DESC
  `);

  return NextResponse.json({ grants: result.recordset });
}
