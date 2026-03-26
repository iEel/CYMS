import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import SftpClient from 'ssh2-sftp-client';
import { logAudit } from '@/lib/audit';
import { formatCODECO, legacyFormatToTemplate, type CODECOTransaction, type EDITemplate } from '@/lib/ediFormatter';

// POST — Send CODECO file via SFTP/Email to a specific endpoint
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
    const transactions = txResult.recordset as CODECOTransaction[];

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'ไม่มีรายการ Gate ในช่วงที่เลือก' }, { status: 400 });
    }

    // 3. Get company info
    let companyName = 'CYMS';
    try {
      const cr = await db.request().query('SELECT TOP 1 company_name FROM CompanyProfile');
      if (cr.recordset[0]) companyName = cr.recordset[0].company_name;
    } catch { /* */ }

    // 4. Load template (from endpoint config or legacy format)
    let template: EDITemplate | null = null;
    if (ep.template_id) {
      try {
        const tplResult = await db.request()
          .input('tplId', sql.Int, ep.template_id)
          .query('SELECT * FROM EDITemplates WHERE template_id = @tplId');
        if (tplResult.recordset[0]) {
          template = tplResult.recordset[0] as EDITemplate;
        }
      } catch { /* fallback */ }
    }
    if (!template) {
      template = legacyFormatToTemplate(ep.format || 'CSV');
    }

    // 5. Generate file content using shared formatter
    const output = formatCODECO(transactions, template, companyName, ep.shipping_line || shipping_line || undefined);
    const { content: fileContent, filename } = output;

    // 6. Send based on endpoint type
    let sendStatus = 'sent';
    let errorMsg = '';
    let deliveryInfo = '';

    if (ep.type === 'email') {
      // ===== EMAIL DELIVERY =====
      try {
        const { sendEmail } = await import('@/lib/emailService');
        const recipients = (ep.host || '').split(',').map((e: string) => e.trim()).filter(Boolean);
        if (recipients.length === 0) {
          return NextResponse.json({ error: 'ไม่ได้ระบุอีเมลผู้รับ (ตั้งค่าใน Host field)' }, { status: 400 });
        }

        const result = await sendEmail({
          to: recipients,
          subject: `[CYMS EDI] CODECO — ${ep.shipping_line || 'ALL'} — ${transactions.length} records — ${new Date().toLocaleDateString('th-TH')}`,
          html: `
            <div style="font-family:sans-serif;padding:20px">
              <h2 style="color:#1E40AF">📦 CODECO EDI Message</h2>
              <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
                <tr><td style="padding:6px 12px;color:#64748B">Sender</td><td style="padding:6px 12px;font-weight:bold">${companyName}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748B">Shipping Line</td><td style="padding:6px 12px">${ep.shipping_line || 'ALL'}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748B">Records</td><td style="padding:6px 12px;font-weight:bold">${transactions.length}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748B">Format</td><td style="padding:6px 12px">${template?.template_name || ep.format}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748B">Generated</td><td style="padding:6px 12px">${new Date().toLocaleString('th-TH')}</td></tr>
              </table>
              <p style="color:#64748B;font-size:12px">ไฟล์ CODECO แนบมาพร้อมอีเมลนี้ — กรุณาตรวจสอบ</p>
            </div>
          `,
          attachments: [{
            filename,
            content: Buffer.from(fileContent, 'utf-8'),
            contentType: output.contentType,
          }],
        });

        if (!result.success) {
          sendStatus = 'failed';
          errorMsg = result.error || 'Email send failed';
        } else {
          deliveryInfo = `📧 ส่งอีเมลไปที่ ${recipients.join(', ')}`;
        }
      } catch (emailError: unknown) {
        sendStatus = 'failed';
        errorMsg = emailError instanceof Error ? emailError.message : String(emailError);
      }

    } else {
      // ===== SFTP DELIVERY (default) =====
      const sftp = new SftpClient();
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
        deliveryInfo = `📁 ส่งไฟล์ไปที่ ${ep.host}:${ep.remote_path}/${filename}`;
      } catch (sftpError: unknown) {
        sendStatus = 'failed';
        errorMsg = sftpError instanceof Error ? sftpError.message : String(sftpError);
        try { await sftp.end(); } catch { /* */ }
      }
    }

    // 7. Log the send
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
      await logAudit({
        userId: null, yardId: yard_id || 1,
        action: 'edi_send_failed',
        entityType: 'edi_endpoint', entityId: endpoint_id,
        details: {
          endpoint_name: ep.name, delivery_type: ep.type, format: template?.template_name || ep.format,
          shipping_line: ep.shipping_line || 'ALL', record_count: transactions.length, filename,
          date_from: date_from || 'today', date_to: date_to || 'today', error: errorMsg,
        },
      });

      return NextResponse.json({
        success: false,
        error: `${ep.type === 'email' ? 'Email' : 'SFTP'} failed: ${errorMsg}`,
        filename, record_count: transactions.length,
      });
    }

    await logAudit({
      userId: null, yardId: yard_id || 1,
      action: 'edi_send_success',
      entityType: 'edi_endpoint', entityId: endpoint_id,
      details: {
        endpoint_name: ep.name, delivery_type: ep.type, format: template?.template_name || ep.format,
        shipping_line: ep.shipping_line || 'ALL', record_count: transactions.length, filename,
        date_from: date_from || 'today', date_to: date_to || 'today',
        recipients: ep.type === 'email' ? ep.host : `${ep.host}:${ep.remote_path}`,
      },
    });

    return NextResponse.json({
      success: true, filename, record_count: transactions.length,
      endpoint: ep.name, delivery_type: ep.type,
      message: `✅ ส่ง ${transactions.length} รายการ — ${deliveryInfo}`,
    });
  } catch (error) {
    console.error('❌ EDI send error:', error);
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
