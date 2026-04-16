import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { formatAuditLogs, type RawAuditLog } from '@/lib/auditFormatter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const containerId = searchParams.get('container_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    if (!containerId && (!entityType || !entityId)) {
      return NextResponse.json({ error: 'container_id หรือ entity_type + entity_id required' }, { status: 400 });
    }

    const db = await getDb();
    const hasBillingClearances = await db.request()
      .query("SELECT CASE WHEN OBJECT_ID('BillingClearances', 'U') IS NULL THEN 0 ELSE 1 END AS exists_flag");
    const includeBillingClearances = hasBillingClearances.recordset[0]?.exists_flag === 1;

    const req = db.request().input('limit', sql.Int, limit);
    const conditions: string[] = [];

    if (yardId) {
      conditions.push('(a.yard_id = @yardId OR a.yard_id IS NULL)');
      req.input('yardId', sql.Int, parseInt(yardId));
    }

    if (containerId) {
      const cid = parseInt(containerId);
      req.input('containerId', sql.Int, cid);
      conditions.push(`(
        (a.entity_type = 'container' AND a.entity_id = @containerId)
        OR (a.entity_type = 'invoice' AND EXISTS (
          SELECT 1 FROM Invoices i WHERE i.invoice_id = a.entity_id AND i.container_id = @containerId
        ))
        ${includeBillingClearances ? `OR (a.entity_type = 'billing_clearance' AND EXISTS (
          SELECT 1 FROM BillingClearances bc WHERE bc.clearance_id = a.entity_id AND bc.container_id = @containerId
        ))` : ''}
      )`);
    } else {
      req.input('entityType', sql.NVarChar, entityType);
      req.input('entityId', sql.Int, parseInt(entityId || '0'));
      conditions.push('a.entity_type = @entityType AND a.entity_id = @entityId');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await req.query(`
      SELECT TOP (@limit)
        a.log_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
        u.full_name, u.username
      FROM AuditLog a
      LEFT JOIN Users u ON a.user_id = u.user_id
      ${where}
      ORDER BY a.created_at DESC
    `);

    const logs = formatAuditLogs(result.recordset as RawAuditLog[]);
    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    console.error('❌ GET readable audit trail error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง Audit Trail ได้' }, { status: 500 });
  }
}
