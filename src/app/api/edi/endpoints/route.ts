import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — List EDI Endpoints
export async function GET() {
  try {
    const db = await getDb();
    const result = await db.request().query(`
      SELECT e.*, 
        (SELECT TOP 1 status FROM EDISendLog WHERE endpoint_id = e.endpoint_id ORDER BY sent_at DESC) as last_log_status,
        (SELECT COUNT(*) FROM EDISendLog WHERE endpoint_id = e.endpoint_id AND status = 'sent') as total_sent
      FROM EDIEndpoints e
      ORDER BY e.created_at ASC
    `);
    return NextResponse.json({ endpoints: result.recordset });
  } catch (error) {
    console.error('❌ GET EDI endpoints error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// POST — Create EDI Endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();
    const result = await db.request()
      .input('name', sql.NVarChar, body.name)
      .input('shipping_line', sql.NVarChar, body.shipping_line || null)
      .input('type', sql.NVarChar, body.type || 'sftp')
      .input('host', sql.NVarChar, body.host)
      .input('port', sql.Int, body.port || 22)
      .input('username', sql.NVarChar, body.username || null)
      .input('password', sql.NVarChar, body.password || null)
      .input('remote_path', sql.NVarChar, body.remote_path || '/')
      .input('format', sql.NVarChar, body.format || 'EDIFACT')
      .query(`
        INSERT INTO EDIEndpoints (name, shipping_line, type, host, port, username, password, remote_path, format)
        OUTPUT INSERTED.*
        VALUES (@name, @shipping_line, @type, @host, @port, @username, @password, @remote_path, @format)
      `);
    return NextResponse.json({ success: true, endpoint: result.recordset[0] });
  } catch (error) {
    console.error('❌ POST EDI endpoint error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง Endpoint ได้' }, { status: 500 });
  }
}

// PUT — Update EDI Endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();
    await db.request()
      .input('id', sql.Int, body.endpoint_id)
      .input('name', sql.NVarChar, body.name)
      .input('shipping_line', sql.NVarChar, body.shipping_line || null)
      .input('type', sql.NVarChar, body.type || 'sftp')
      .input('host', sql.NVarChar, body.host)
      .input('port', sql.Int, body.port || 22)
      .input('username', sql.NVarChar, body.username || null)
      .input('password', sql.NVarChar, body.password || null)
      .input('remote_path', sql.NVarChar, body.remote_path || '/')
      .input('format', sql.NVarChar, body.format || 'EDIFACT')
      .input('is_active', sql.Bit, body.is_active !== false ? 1 : 0)
      .query(`
        UPDATE EDIEndpoints SET
          name = @name, shipping_line = @shipping_line, type = @type,
          host = @host, port = @port, username = @username, password = @password,
          remote_path = @remote_path, format = @format, is_active = @is_active,
          updated_at = GETDATE()
        WHERE endpoint_id = @id
      `);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT EDI endpoint error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตได้' }, { status: 500 });
  }
}

// DELETE — Remove EDI Endpoint
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('endpoint_id') || '0');
    const db = await getDb();
    await db.request().input('id', sql.Int, id)
      .query('DELETE FROM EDISendLog WHERE endpoint_id = @id');
    await db.request().input('id2', sql.Int, id)
      .query('DELETE FROM EDIEndpoints WHERE endpoint_id = @id2');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE EDI endpoint error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบได้' }, { status: 500 });
  }
}
