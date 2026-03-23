import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import SftpClient from 'ssh2-sftp-client';

// POST — Send CODECO file via SFTP to a specific endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint_id, yard_id, date_from, date_to, type, shipping_line } = body;

    const db = await getDb();

    // 1. Get endpoint config
    const epResult = await db.request()
      .input('epId', sql.Int, endpoint_id)
      .query('SELECT * FROM EDIEndpoints WHERE endpoint_id = @epId');

    if (epResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Endpoint' }, { status: 404 });
    }
    const ep = epResult.recordset[0];

    // 2. Generate CODECO data
    const req = db.request().input('yardId', sql.Int, yard_id || 1);
    let query = `
      SELECT g.transaction_id, g.transaction_type, g.eir_number,
             g.driver_name, g.truck_plate, g.seal_number, g.booking_ref,
             g.created_at as transaction_date,
             c.container_number, c.size, c.type as container_type,
             c.shipping_line, c.is_laden,
             y.yard_name, y.yard_code
      FROM GateTransactions g
      LEFT JOIN Containers c ON g.container_id = c.container_id
      LEFT JOIN Yards y ON g.yard_id = y.yard_id
      WHERE g.yard_id = @yardId
    `;

    if (type && type !== 'all') {
      query += ` AND g.transaction_type = @txType`;
      req.input('txType', sql.NVarChar, type);
    }
    if (shipping_line) {
      query += ` AND c.shipping_line = @sl`;
      req.input('sl', sql.NVarChar, shipping_line);
    }
    if (date_from) {
      query += ` AND CAST(g.created_at AS DATE) >= @df`;
      req.input('df', sql.NVarChar, date_from);
    }
    if (date_to) {
      query += ` AND CAST(g.created_at AS DATE) <= @dt`;
      req.input('dt', sql.NVarChar, date_to);
    }
    query += ` ORDER BY g.created_at DESC`;
    const txResult = await req.query(query);
    const transactions = txResult.recordset;

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'ไม่มีรายการ Gate ในช่วงที่เลือก' }, { status: 400 });
    }

    // 3. Get company info
    let companyName = 'CYMS';
    try {
      const cr = await db.request().query('SELECT TOP 1 company_name FROM CompanyProfile');
      if (cr.recordset[0]) companyName = cr.recordset[0].company_name;
    } catch { /* */ }

    // 4. Generate file content based on format
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const filename = `CODECO_${ep.shipping_line || 'ALL'}_${dateStr}_${now.getTime().toString().slice(-6)}.${ep.format === 'EDIFACT' ? 'edi' : ep.format === 'CSV' ? 'csv' : 'json'}`;
    let fileContent: string;

    if (ep.format === 'EDIFACT') {
      const fmtDT = (d: Date) => {
        const y = d.getFullYear().toString().slice(-2);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${y}${m}${dd}:${hh}${mi}`;
      };
      const msgRef = `CODECO${now.getTime()}`;
      const lines: string[] = [];
      lines.push(`UNB+UNOC:3+${companyName.substring(0, 35)}+${ep.shipping_line || 'SHIPPING'}+${fmtDT(now)}+${msgRef}'`);
      lines.push(`UNH+1+CODECO:D:95B:UN'`);
      lines.push(`BGM+36+${msgRef}+9'`);

      transactions.forEach((tx: Record<string, unknown>) => {
        const txDate = new Date(tx.transaction_date as string);
        const giFn = (tx.transaction_type as string) === 'gate_in' ? '34' : '36';
        lines.push(`TDT+${giFn}'`);
        lines.push(`LOC+89+${tx.yard_code || 'YARD'}:139:6'`);
        lines.push(`DTM+137:${fmtDT(txDate)}:203'`);
        const sizeCode = (tx.size as string) === '40' ? '42' : (tx.size as string) === '45' ? '45' : '22';
        lines.push(`EQD+CN+${tx.container_number}+${sizeCode}G1:102:5'`);
        if (tx.seal_number) lines.push(`SEL+${tx.seal_number}+CA'`);
        if (tx.truck_plate) lines.push(`TDT+1++3+++++${tx.truck_plate}'`);
        if (tx.booking_ref) lines.push(`RFF+BN:${tx.booking_ref}'`);
        lines.push(`FTX+AAA+++${tx.is_laden ? 'LADEN' : 'EMPTY'}'`);
      });

      lines.push(`UNT+${lines.length - 1}+1'`);
      lines.push(`UNZ+1+${msgRef}'`);
      fileContent = lines.join('\n');

    } else if (ep.format === 'CSV') {
      const fmtDate = (d: unknown) => {
        if (!d) return '';
        const dt = new Date(d as string);
        return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      };
      const headers = 'message_type,transaction_type,eir_number,date,container_number,size,type,shipping_line,laden_empty,seal_number,truck_plate,driver_name,booking_ref';
      const rows = transactions.map((tx: Record<string, unknown>) =>
        `CODECO,${tx.transaction_type},${tx.eir_number || ''},${fmtDate(tx.transaction_date)},${tx.container_number},${tx.size},${tx.container_type},${tx.shipping_line || ''},${tx.is_laden ? 'F' : 'E'},${tx.seal_number || ''},${tx.truck_plate || ''},"${tx.driver_name || ''}",${tx.booking_ref || ''}`
      );
      fileContent = [headers, ...rows].join('\n');

    } else {
      fileContent = JSON.stringify({
        message_type: 'CODECO',
        sender: companyName,
        generated_at: now.toISOString(),
        record_count: transactions.length,
        transactions: transactions.map((tx: Record<string, unknown>) => ({
          type: tx.transaction_type, container: tx.container_number,
          size: tx.size, shipping_line: tx.shipping_line,
          laden: tx.is_laden ? 'LADEN' : 'EMPTY', seal: tx.seal_number,
          truck: tx.truck_plate, date: tx.transaction_date,
        })),
      }, null, 2);
    }

    // 5. Send via SFTP
    const sftp = new SftpClient();
    let sendStatus = 'sent';
    let errorMsg = '';

    try {
      await sftp.connect({
        host: ep.host,
        port: ep.port || 22,
        username: ep.username,
        password: ep.password,
      });

      const remotePath = `${ep.remote_path.replace(/\/$/, '')}/${filename}`;
      await sftp.put(Buffer.from(fileContent, 'utf-8'), remotePath);
      await sftp.end();
    } catch (sftpError: unknown) {
      sendStatus = 'failed';
      errorMsg = sftpError instanceof Error ? sftpError.message : String(sftpError);
      try { await sftp.end(); } catch { /* */ }
    }

    // 6. Log the send
    await db.request()
      .input('epId2', sql.Int, endpoint_id)
      .input('filename', sql.NVarChar, filename)
      .input('recordCount', sql.Int, transactions.length)
      .input('status', sql.NVarChar, sendStatus)
      .input('error', sql.NVarChar, errorMsg || null)
      .query(`
        INSERT INTO EDISendLog (endpoint_id, message_type, filename, record_count, status, error_message)
        VALUES (@epId2, 'CODECO', @filename, @recordCount, @status, @error)
      `);

    // Update last_sent info on endpoint
    await db.request()
      .input('epId3', sql.Int, endpoint_id)
      .input('lastStatus', sql.NVarChar, sendStatus)
      .query(`
        UPDATE EDIEndpoints SET last_sent_at = GETDATE(), last_status = @lastStatus, updated_at = GETDATE()
        WHERE endpoint_id = @epId3
      `);

    if (sendStatus === 'failed') {
      return NextResponse.json({
        success: false,
        error: `SFTP failed: ${errorMsg}`,
        filename,
        record_count: transactions.length,
      });
    }

    return NextResponse.json({
      success: true,
      filename,
      record_count: transactions.length,
      endpoint: ep.name,
      message: `✅ ส่ง ${transactions.length} รายการไปที่ ${ep.host}:${ep.remote_path}/${filename}`,
    });
  } catch (error) {
    console.error('❌ SFTP send error:', error);
    return NextResponse.json({ error: 'ไม่สามารถส่ง CODECO ได้' }, { status: 500 });
  }
}

// GET — Send log history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get('endpoint_id');

    const db = await getDb();
    const req = db.request();
    let query = `
      SELECT l.*, e.name as endpoint_name, e.host, e.shipping_line
      FROM EDISendLog l
      LEFT JOIN EDIEndpoints e ON l.endpoint_id = e.endpoint_id
    `;
    if (endpointId) {
      query += ` WHERE l.endpoint_id = @epId`;
      req.input('epId', sql.Int, parseInt(endpointId));
    }
    query += ` ORDER BY l.sent_at DESC`;
    const result = await req.query(query);
    return NextResponse.json({ logs: result.recordset });
  } catch (error) {
    console.error('❌ GET send log error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงประวัติได้' }, { status: 500 });
  }
}
