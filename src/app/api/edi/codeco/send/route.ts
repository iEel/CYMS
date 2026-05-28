import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';
import { runCodecoSendJob } from '@/lib/codecoSendJob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// POST — Send CODECO file via Email/SFTP/FTP/API to a specific endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint_id, yard_id, date_from, date_to, type, shipping_line } = body;
    const endpointId = parsePositiveInt(endpoint_id);
    const yardId = parsePositiveInt(yard_id);

    if (!endpointId) {
      return NextResponse.json({ error: 'ต้องระบุ endpoint_id ที่ถูกต้อง' }, { status: 400 });
    }
    if (!yardId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id ที่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requirePermission(
      request,
      db,
      'integration.send',
      'คุณไม่มีสิทธิ์ส่ง EDI'
    );
    if (actor instanceof Response) return actor;

    const yardAccess = await requireYardAccess(request, db, yardId, 'คุณไม่มีสิทธิ์ส่ง EDI ของลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    const result = await runCodecoSendJob({
      endpoint_id: endpointId,
      yard_id: yardId,
      date_from,
      date_to,
      type,
      shipping_line,
      actorUserId: actor.userId,
    }, db);

    return NextResponse.json(result.body, result.status ? { status: result.status } : undefined);
  } catch (error) {
    console.error('❌ EDI send error:', error);
    return NextResponse.json({ error: 'ไม่สามารถส่ง CODECO ได้' }, { status: 500 });
  }
}

// GET — Send log history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpointId = parsePositiveInt(searchParams.get('endpoint_id'));

    const db = await getDb();
    const actor = await requirePermission(
      request,
      db,
      'integration.logs.view',
      'คุณไม่มีสิทธิ์ดูประวัติการส่ง EDI'
    );
    if (actor instanceof Response) return actor;

    const req = db.request();
    let query = `
      SELECT l.*, e.name as endpoint_name, e.host, e.shipping_line
      FROM EDISendLog l
      LEFT JOIN EDIEndpoints e ON l.endpoint_id = e.endpoint_id
    `;
    if (endpointId) {
      query += ` WHERE l.endpoint_id = @epId`;
      req.input('epId', sql.Int, endpointId);
    }
    query += ` ORDER BY l.sent_at DESC`;
    const result = await req.query(query);
    return NextResponse.json({ logs: result.recordset });
  } catch (error) {
    console.error('❌ GET send log error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงประวัติได้' }, { status: 500 });
  }
}
