import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { ensureIntegrationLogTable } from '@/lib/integrationLog';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const system = searchParams.get('system');
    const status = searchParams.get('status');
    const direction = searchParams.get('direction');
    const search = searchParams.get('search');
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100')));

    const db = await getDb();
    await ensureIntegrationLogTable(db);

    const req = db.request().input('limit', sql.Int, limit);
    const conditions: string[] = [];

    if (yardId) {
      conditions.push('yard_id = @yardId');
      req.input('yardId', sql.Int, parseInt(yardId));
    }
    if (system) {
      conditions.push('system = @system');
      req.input('system', sql.NVarChar, system);
    }
    if (status) {
      conditions.push('status = @status');
      req.input('status', sql.NVarChar, status);
    }
    if (direction) {
      conditions.push('direction = @direction');
      req.input('direction', sql.NVarChar, direction);
    }
    if (search) {
      conditions.push(`(
        message_type LIKE @search OR destination LIKE @search OR endpoint_name LIKE @search OR
        reference_number LIKE @search OR filename LIKE @search OR error_message LIKE @search
      )`);
      req.input('search', sql.NVarChar, `%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const logs = await req.query(`
      SELECT TOP (@limit) *
      FROM IntegrationLogs
      ${where}
      ORDER BY created_at DESC
    `);

    const statsReq = db.request();
    const statsConditions: string[] = [];
    if (yardId) {
      statsConditions.push('yard_id = @yardId');
      statsReq.input('yardId', sql.Int, parseInt(yardId));
    }
    const statsWhere = statsConditions.length > 0 ? `WHERE ${statsConditions.join(' AND ')}` : '';
    const stats = await statsReq.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'success' THEN 1 END) AS success_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_count,
        COUNT(CASE WHEN status = 'retrying' THEN 1 END) AS retrying_count,
        ISNULL(SUM(record_count), 0) AS total_records
      FROM IntegrationLogs
      ${statsWhere}
    `);

    return NextResponse.json({ logs: logs.recordset, stats: stats.recordset[0] });
  } catch (error) {
    console.error('GET integration logs error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง Integration Logs ได้' }, { status: 500 });
  }
}

