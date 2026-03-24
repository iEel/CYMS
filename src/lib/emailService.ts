import nodemailer from 'nodemailer';

// ===== Types =====
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

interface EmailConfig {
  enabled: boolean;
  provider: 'azure' | 'smtp';
  azure: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    mailFrom: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
}

// ===== Azure AD Token Cache =====
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAzureToken(config: EmailConfig['azure']): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure AD token error: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
  return cachedToken.token;
}

// ===== Send via Azure Graph API =====
async function sendViaAzure(config: EmailConfig['azure'], options: EmailOptions): Promise<void> {
  const token = await getAzureToken(config);
  const toRecipients = (Array.isArray(options.to) ? options.to : [options.to]).map(email => ({
    emailAddress: { address: email },
  }));

  const message: Record<string, unknown> = {
    subject: options.subject,
    body: { contentType: 'HTML', content: options.html },
    toRecipients,
    attachments: options.attachments?.map(a => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.filename,
      contentType: a.contentType || 'application/octet-stream',
      contentBytes: typeof a.content === 'string' ? Buffer.from(a.content).toString('base64') : a.content.toString('base64'),
    })),
  };

  if (options.cc?.length) {
    message.ccRecipients = options.cc.map(email => ({ emailAddress: { address: email } }));
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${config.mailFrom}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Graph API sendMail error: ${res.status} ${errText}`);
  }
}

// ===== Send via SMTP (Fallback) =====
async function sendViaSMTP(config: EmailConfig['smtp'], options: EmailOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });

  await transporter.sendMail({
    from: config.from || config.user,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    cc: options.cc?.join(', '),
    bcc: options.bcc?.join(', '),
    subject: options.subject,
    html: options.html,
    attachments: options.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}

// ===== Get Config: secrets from .env, basic settings from DB =====
let configCache: { config: EmailConfig; expiresAt: number } | null = null;

export async function getEmailConfig(): Promise<EmailConfig> {
  if (configCache && configCache.expiresAt > Date.now()) {
    return configCache.config;
  }

  // Read non-sensitive settings from DB
  let dbSettings: Record<string, string> = {};
  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    const result = await db.request().query(`
      SELECT setting_key, setting_value FROM SystemSettings 
      WHERE setting_key LIKE 'email_%'
    `);
    for (const row of result.recordset) {
      dbSettings[row.setting_key] = row.setting_value;
    }
  } catch { /* fallback to env only */ }

  const config: EmailConfig = {
    enabled: dbSettings.email_enabled === 'true',
    provider: (dbSettings.email_provider as 'azure' | 'smtp') || (process.env.AZURE_CLIENT_ID ? 'azure' : 'smtp'),
    azure: {
      tenantId: dbSettings.email_azure_tenant_id || process.env.AZURE_TENANT_ID || '',
      clientId: dbSettings.email_azure_client_id || process.env.AZURE_CLIENT_ID || '',
      clientSecret: process.env.AZURE_CLIENT_SECRET || '',         // .env only
      mailFrom: dbSettings.email_azure_mail_from || process.env.AZURE_MAIL_FROM || '',
    },
    smtp: {
      host: dbSettings.email_smtp_host || process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(dbSettings.email_smtp_port || process.env.SMTP_PORT || '587'),
      user: dbSettings.email_smtp_user || process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',                           // .env only
      from: dbSettings.email_smtp_from || process.env.SMTP_FROM || '',
    },
  };

  configCache = { config, expiresAt: Date.now() + 30000 };
  return config;
}

// ===== Main Send Function =====
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; provider: string; error?: string }> {
  try {
    const config = await getEmailConfig();
    if (!config.enabled) {
      return { success: false, provider: 'none', error: 'Email disabled' };
    }

    // Try Azure AD first
    if (config.provider === 'azure' && config.azure.clientId) {
      try {
        await sendViaAzure(config.azure, options);
        return { success: true, provider: 'azure' };
      } catch (azureErr) {
        console.error('⚠️ Azure email failed, falling back to SMTP:', azureErr);
        // Fall through to SMTP
      }
    }

    // SMTP fallback
    if (config.smtp.host && config.smtp.user) {
      await sendViaSMTP(config.smtp, options);
      return { success: true, provider: 'smtp' };
    }

    return { success: false, provider: 'none', error: 'No email provider configured' };
  } catch (error) {
    console.error('❌ Email send error:', error);
    return { success: false, provider: 'unknown', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ===== Email Templates =====

export function gateNotificationEmail(data: {
  type: 'gate_in' | 'gate_out';
  containerNumber: string;
  customerName: string;
  yardName: string;
  dateTime: string;
  driverName?: string;
  truckPlate?: string;
}) {
  const isIn = data.type === 'gate_in';
  return {
    subject: `[CYMS] ${isIn ? 'Gate-In' : 'Gate-Out'}: ${data.containerNumber}`,
    html: emailWrapper(`
      <h2 style="color:${isIn ? '#3B82F6' : '#EF4444'};margin:0 0 16px">${isIn ? '📥 Gate-In' : '📤 Gate-Out'} Notification</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px;color:#64748B;width:120px">Container</td><td style="padding:8px;font-weight:bold;font-family:monospace;font-size:16px">${data.containerNumber}</td></tr>
        <tr><td style="padding:8px;color:#64748B">Customer</td><td style="padding:8px">${data.customerName}</td></tr>
        <tr><td style="padding:8px;color:#64748B">Yard</td><td style="padding:8px">${data.yardName}</td></tr>
        <tr><td style="padding:8px;color:#64748B">Date/Time</td><td style="padding:8px">${data.dateTime}</td></tr>
        ${data.driverName ? `<tr><td style="padding:8px;color:#64748B">Driver</td><td style="padding:8px">${data.driverName}</td></tr>` : ''}
        ${data.truckPlate ? `<tr><td style="padding:8px;color:#64748B">Truck</td><td style="padding:8px">${data.truckPlate}</td></tr>` : ''}
      </table>
    `),
  };
}

export function paymentConfirmationEmail(data: {
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paidAt: string;
  containerNumber?: string;
}) {
  return {
    subject: `[CYMS] Payment Confirmed: ${data.invoiceNumber}`,
    html: emailWrapper(`
      <h2 style="color:#10B981;margin:0 0 16px">✅ Payment Confirmed</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px;color:#64748B;width:120px">Invoice</td><td style="padding:8px;font-weight:bold">${data.invoiceNumber}</td></tr>
        <tr><td style="padding:8px;color:#64748B">Customer</td><td style="padding:8px">${data.customerName}</td></tr>
        <tr><td style="padding:8px;color:#64748B">Amount</td><td style="padding:8px;font-size:18px;font-weight:bold;color:#10B981">฿ ${data.amount.toLocaleString()}</td></tr>
        <tr><td style="padding:8px;color:#64748B">Paid At</td><td style="padding:8px">${data.paidAt}</td></tr>
        ${data.containerNumber ? `<tr><td style="padding:8px;color:#64748B">Container</td><td style="padding:8px;font-family:monospace">${data.containerNumber}</td></tr>` : ''}
      </table>
    `),
  };
}

function emailWrapper(content: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1E40AF,#3B82F6);padding:20px 24px">
        <h1 style="color:#fff;margin:0;font-size:18px">📦 CYMS</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:12px">Container Yard Management System</p>
      </div>
      <div style="padding:24px">${content}</div>
      <div style="background:#F8FAFC;padding:16px 24px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#94A3B8">
        This is an automated notification from CYMS. Do not reply.
      </div>
    </div>
  `;
}
