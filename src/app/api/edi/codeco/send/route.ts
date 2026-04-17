import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { writeIntegrationLog } from '@/lib/integrationLog';
import {
  formatCODECO,
  legacyFormatToTemplate,
  validateCODECOTransactions,
  type CODECOTransaction,
  type EDITemplate,
} from '@/lib/ediFormatter';
import { uploadFTP } from '@/lib/ftpClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — Send CODECO file via Email/SFTP/FTP/API to a specific endpoint
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
    if (ep.is_active === false || ep.is_active === 0) {
      return NextResponse.json({ error: 'Endpoint นี้ถูกปิดใช้งาน' }, { status: 400 });
    }

    // 2. Generate CODECO data
    const req = db.request().input('yardId', sql.Int, yard_id || 1);
    await db.request().query(`
      IF COL_LENGTH('GateTransactions', 'truck_company') IS NULL
        ALTER TABLE GateTransactions ADD truck_company NVARCHAR(100) NULL;
      IF COL_LENGTH('Containers', 'container_grade') IS NULL
        ALTER TABLE Containers ADD container_grade NVARCHAR(1) NULL;
      IF COL_LENGTH('EDITemplates', 'required_fields') IS NULL
        ALTER TABLE EDITemplates ADD required_fields NVARCHAR(MAX) NULL;
      IF COL_LENGTH('EDITemplates', 'edifact_config') IS NULL
        ALTER TABLE EDITemplates ADD edifact_config NVARCHAR(MAX) NULL;
    `);
    let query = `
      SELECT g.transaction_id, g.transaction_type, g.eir_number,
             g.driver_name, g.truck_plate, g.truck_company, g.seal_number, g.booking_ref,
             g.created_at as transaction_date,
             c.container_number, c.size, c.type as container_type,
             c.container_grade, c.shipping_line, c.is_laden,
             CASE
               WHEN c.container_grade = 'A' THEN 'GOOD'
               WHEN c.container_grade = 'B' THEN 'MINOR_DAMAGE'
               WHEN c.container_grade = 'C' THEN 'MAJOR_DAMAGE'
               WHEN c.container_grade = 'D' THEN 'UNSERVICEABLE'
               ELSE NULL
             END AS condition,
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
    const effectiveShippingLine = shipping_line || ep.shipping_line;
    if (effectiveShippingLine) {
      query += ` AND c.shipping_line = @sl`;
      req.input('sl', sql.NVarChar, effectiveShippingLine);
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

    const validation = validateCODECOTransactions(transactions, template);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'ข้อมูล EDI ยังไม่ครบตาม Required Fields ของ Template',
        required_fields: validation.required_fields,
        validation_errors: validation.errors.slice(0, 50),
        error_count: validation.errors.length,
      }, { status: 400 });
    }

    // 5. Generate file content using shared formatter
    const output = formatCODECO(transactions, template, companyName, effectiveShippingLine || undefined);
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
          subject: `[CYMS EDI] CODECO — ${effectiveShippingLine || 'ALL'} — ${transactions.length} records — ${new Date().toLocaleDateString('th-TH')}`,
          html: `
            <div style="font-family:sans-serif;padding:20px">
              <h2 style="color:#1E40AF">📦 CODECO EDI Message</h2>
              <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
                <tr><td style="padding:6px 12px;color:#64748B">Sender</td><td style="padding:6px 12px;font-weight:bold">${companyName}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748B">Shipping Line</td><td style="padding:6px 12px">${effectiveShippingLine || 'ALL'}</td></tr>
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

    } else if (ep.type === 'sftp') {
      // ===== SFTP DELIVERY =====
      const { default: SftpClient } = await import('ssh2-sftp-client');
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
    } else if (ep.type === 'ftp') {
      // ===== FTP DELIVERY =====
      try {
        const remotePath = `${(ep.remote_path || '/').replace(/\/$/, '')}/${filename}`;
        await uploadFTP({
          host: ep.host,
          port: ep.port || 21,
          username: ep.username || 'anonymous',
          password: ep.password || 'anonymous@',
          remotePath,
          content: Buffer.from(fileContent, 'utf-8'),
        });
        deliveryInfo = `📁 ส่ง FTP ไปที่ ${ep.host}:${ep.remote_path}/${filename}`;
      } catch (ftpError: unknown) {
        sendStatus = 'failed';
        errorMsg = ftpError instanceof Error ? ftpError.message : String(ftpError);
      }
    } else if (ep.type === 'api') {
      // ===== REST API DELIVERY =====
      try {
        const headers: Record<string, string> = {
          'Content-Type': output.contentType.includes('json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
          'X-CYMS-EDI-Filename': filename,
          'X-CYMS-EDI-Message-Type': 'CODECO',
        };
        if (ep.username || ep.password) {
          headers.Authorization = `Basic ${Buffer.from(`${ep.username || ''}:${ep.password || ''}`).toString('base64')}`;
        }
        const res = await fetch(ep.host, {
          method: 'POST',
          headers,
          body: fileContent,
        });
        if (!res.ok) {
          throw new Error(`API responded ${res.status}: ${(await res.text()).slice(0, 500)}`);
        }
        deliveryInfo = `🌐 ส่ง API ไปที่ ${ep.host}`;
      } catch (apiError: unknown) {
        sendStatus = 'failed';
        errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
      }
    } else {
      sendStatus = 'failed';
      errorMsg = `ไม่รองรับ Endpoint type: ${ep.type}`;
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

    await writeIntegrationLog({
      yardId: yard_id || 1,
      system: 'EDI',
      direction: 'outbound',
      messageType: 'CODECO',
      destination: ep.type === 'email' ? ep.host : ep.type === 'api' ? ep.host : `${ep.host}:${ep.remote_path || ''}`,
      endpointName: ep.name,
      referenceType: 'edi_endpoint',
      referenceId: endpoint_id,
      referenceNumber: effectiveShippingLine || 'ALL',
      payloadSummary: {
        delivery_type: ep.type,
        format: template?.template_name || ep.format,
        date_from: date_from || null,
        date_to: date_to || null,
        transaction_type: type || 'all',
      },
      status: sendStatus === 'sent' ? 'success' : 'failed',
      errorMessage: errorMsg || null,
      retryCount: 0,
      recordCount: transactions.length,
      filename,
    });

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
          shipping_line: effectiveShippingLine || 'ALL', record_count: transactions.length, filename,
          date_from: date_from || 'today', date_to: date_to || 'today', error: errorMsg,
        },
      });

      return NextResponse.json({
        success: false,
        error: `${String(ep.type).toUpperCase()} failed: ${errorMsg}`,
        filename, record_count: transactions.length,
      });
    }

    await logAudit({
      userId: null, yardId: yard_id || 1,
      action: 'edi_send_success',
      entityType: 'edi_endpoint', entityId: endpoint_id,
      details: {
        endpoint_name: ep.name, delivery_type: ep.type, format: template?.template_name || ep.format,
        shipping_line: effectiveShippingLine || 'ALL', record_count: transactions.length, filename,
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
