import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึง audit log
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const entityType = searchParams.get('entity_type');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = await getDb();
    const req = db.request();
    const conditions: string[] = [];

    if (yardId) {
      conditions.push('a.yard_id = @yardId');
      req.input('yardId', sql.Int, parseInt(yardId));
    }
    if (entityType) {
      conditions.push('a.entity_type = @entityType');
      req.input('entityType', sql.NVarChar, entityType);
    }

    req.input('limit', sql.Int, limit);
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT TOP (@limit) a.log_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
        u.full_name, u.username
      FROM AuditLog a
      LEFT JOIN Users u ON a.user_id = u.user_id
      ${where}
      ORDER BY a.created_at DESC
    `);

    return NextResponse.json({ logs: result.recordset });
  } catch (error) {
    console.error('❌ GET audit-log error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง audit log ได้' }, { status: 500 });
  }
}

// POST — บันทึก audit log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { yard_id, action, entity_type, entity_id, details, user_id } = body;

    const db = await getDb();
    await db.request()
      .input('userId', sql.Int, user_id || null)
      .input('yardId', sql.Int, yard_id || null)
      .input('action', sql.NVarChar, action)
      .input('entityType', sql.NVarChar, entity_type)
      .input('entityId', sql.Int, entity_id || null)
      .input('details', sql.NVarChar, typeof details === 'string' ? details : JSON.stringify(details))
      .query(`
        INSERT INTO AuditLog (user_id, yard_id, action, entity_type, entity_id, details, created_at)
        VALUES (@userId, @yardId, @action, @entityType, @entityId, @details, GETDATE())
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST audit-log error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก audit log ได้' }, { status: 500 });
  }
}
