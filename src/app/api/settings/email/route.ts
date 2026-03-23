import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { sendEmail } from '@/lib/emailService';

// GET — ดึงค่า email settings
export async function GET() {
  try {
    const db = await getDb();
    const result = await db.request().query(`
      SELECT setting_key, setting_value FROM SystemSettings 
      WHERE setting_key LIKE 'email_%'
    `);

    const settings: Record<string, string> = {};
    for (const row of result.recordset) {
      settings[row.setting_key] = row.setting_value;
    }

    return NextResponse.json({
      enabled: settings.email_enabled === 'true',
      provider: settings.email_provider || 'azure',
      azure: {
        tenantId: settings.email_azure_tenant_id || '',
        clientId: settings.email_azure_client_id || '',
        clientSecret: settings.email_azure_client_secret ? '••••••••' : '',
        mailFrom: settings.email_azure_mail_from || '',
      },
      smtp: {
        host: settings.email_smtp_host || 'smtp.office365.com',
        port: parseInt(settings.email_smtp_port || '587'),
        user: settings.email_smtp_user || '',
        pass: settings.email_smtp_pass ? '••••••••' : '',
        from: settings.email_smtp_from || '',
      },
      notifyGate: settings.email_notify_gate === 'true',
      notifyPayment: settings.email_notify_payment === 'true',
      notifyTo: settings.email_notify_to || '',
    });
  } catch (error) {
    console.error('❌ GET email settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงค่า email settings ได้' }, { status: 500 });
  }
}

// PUT — อัปเดต email settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    const settingsToSave: Record<string, string> = {
      email_enabled: String(body.enabled ?? false),
      email_provider: body.provider || 'azure',
      email_notify_gate: String(body.notifyGate ?? false),
      email_notify_payment: String(body.notifyPayment ?? false),
      email_notify_to: body.notifyTo || '',
    };

    // Azure settings
    if (body.azure) {
      if (body.azure.tenantId) settingsToSave.email_azure_tenant_id = body.azure.tenantId;
      if (body.azure.clientId) settingsToSave.email_azure_client_id = body.azure.clientId;
      if (body.azure.clientSecret && body.azure.clientSecret !== '••••••••') {
        settingsToSave.email_azure_client_secret = body.azure.clientSecret;
      }
      if (body.azure.mailFrom) settingsToSave.email_azure_mail_from = body.azure.mailFrom;
    }

    // SMTP settings
    if (body.smtp) {
      if (body.smtp.host) settingsToSave.email_smtp_host = body.smtp.host;
      if (body.smtp.port) settingsToSave.email_smtp_port = String(body.smtp.port);
      if (body.smtp.user) settingsToSave.email_smtp_user = body.smtp.user;
      if (body.smtp.pass && body.smtp.pass !== '••••••••') {
        settingsToSave.email_smtp_pass = body.smtp.pass;
      }
      if (body.smtp.from) settingsToSave.email_smtp_from = body.smtp.from;
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(settingsToSave)) {
      await db.request()
        .input('key', sql.NVarChar, key)
        .input('value', sql.NVarChar, value)
        .query(`
          IF EXISTS (SELECT 1 FROM SystemSettings WHERE setting_key = @key)
            UPDATE SystemSettings SET setting_value = @value, updated_at = GETDATE() WHERE setting_key = @key
          ELSE
            INSERT INTO SystemSettings (setting_key, setting_value) VALUES (@key, @value)
        `);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT email settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต email settings ได้' }, { status: 500 });
  }
}

// POST — ส่ง test email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const to = body.to;

    if (!to) {
      return NextResponse.json({ error: 'กรุณาระบุอีเมลปลายทาง' }, { status: 400 });
    }

    const result = await sendEmail({
      to,
      subject: '[CYMS] Test Email — ทดสอบระบบแจ้งเตือน',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#1E40AF,#3B82F6);padding:20px 24px">
            <h1 style="color:#fff;margin:0;font-size:18px">📦 CYMS</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:12px">Container Yard Management System</p>
          </div>
          <div style="padding:24px;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">✅</div>
            <h2 style="color:#10B981;margin:0 0 8px">Test Email Successful!</h2>
            <p style="color:#64748B;margin:0;font-size:14px">ระบบ Email ทำงานปกติ</p>
            <p style="color:#94A3B8;margin:12px 0 0;font-size:12px">Sent at: ${new Date().toLocaleString('th-TH')}</p>
          </div>
        </div>
      `,
    });

    if (result.success) {
      return NextResponse.json({ success: true, provider: result.provider });
    } else {
      return NextResponse.json({ error: result.error || 'ส่ง email ไม่สำเร็จ', provider: result.provider }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ POST test email error:', error);
    return NextResponse.json({ error: 'ส่ง test email ไม่สำเร็จ' }, { status: 500 });
  }
}
