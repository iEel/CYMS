import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { buildPromptPayPayload, sanitizePromptPayId } from '@/lib/promptPay';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

const SETTING_KEY = 'payment_promptpay';
const PAYMENT_QR_PERMISSIONS = [
  'billing.payment.receive',
  'billing.invoice.create',
  'reports.view',
];

interface PaymentConfig {
  enabled: boolean;
  promptpay_id: string;
  merchant_name?: string;
}

function parsePaymentConfig(rawValue?: string | null): PaymentConfig {
  const envId = process.env.PROMPTPAY_ID || '';
  const config: PaymentConfig = {
    enabled: Boolean(envId),
    promptpay_id: envId,
  };

  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue);
      return {
        enabled: parsed.enabled !== false,
        promptpay_id: sanitizePromptPayId(parsed.promptpay_id || envId),
        merchant_name: parsed.merchant_name || undefined,
      };
    } catch {
      return config;
    }
  }

  return {
    ...config,
    promptpay_id: sanitizePromptPayId(config.promptpay_id),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = parseInt(searchParams.get('invoice_id') || '', 10);
    if (!invoiceId) {
      return NextResponse.json({ error: 'กรุณาระบุ invoice_id' }, { status: 400 });
    }

    const db = await getDb();
    const permission = await requireAnyPermission(
      request,
      db,
      PAYMENT_QR_PERMISSIONS,
      'คุณไม่มีสิทธิ์สร้าง QR ชำระเงิน'
    );
    if (permission instanceof Response) return permission;

    const settingResult = await db.request()
      .input('key', sql.NVarChar, SETTING_KEY)
      .query('SELECT setting_value FROM SystemSettings WHERE setting_key = @key');
    const config = parsePaymentConfig(settingResult.recordset[0]?.setting_value);

    if (!config.enabled || !config.promptpay_id) {
      return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า PromptPay สำหรับรับชำระเงิน' }, { status: 400 });
    }

    const invoiceResult = await db.request()
      .input('invoiceId', sql.Int, invoiceId)
      .query(`
        SELECT i.invoice_id, i.yard_id, i.invoice_number, i.status, i.grand_total, c.customer_name
        FROM Invoices i
        LEFT JOIN Customers c ON i.customer_id = c.customer_id
        WHERE i.invoice_id = @invoiceId
      `);

    const invoice = invoiceResult.recordset[0];
    if (!invoice) {
      return NextResponse.json({ error: 'ไม่พบใบแจ้งหนี้' }, { status: 404 });
    }

    const yardAccess = await requireYardAccess(request, db, invoice.yard_id, 'คุณไม่มีสิทธิ์สร้าง QR ของใบแจ้งหนี้ลานนี้');
    if (yardAccess instanceof Response) return yardAccess;

    if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'credit_note') {
      return NextResponse.json({ error: 'ใบแจ้งหนี้นี้ไม่อยู่ในสถานะรอชำระ' }, { status: 400 });
    }

    const amount = Number(invoice.grand_total || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'ยอดชำระไม่ถูกต้อง' }, { status: 400 });
    }

    const qrPayload = buildPromptPayPayload({
      promptPayId: config.promptpay_id,
      amount,
    });

    return NextResponse.json({
      success: true,
      provider: 'promptpay',
      invoice_id: invoice.invoice_id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      amount,
      qr_payload: qrPayload,
      merchant_name: config.merchant_name || null,
    });
  } catch (error) {
    console.error('❌ GET payment QR error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง QR ชำระเงินได้' }, { status: 500 });
  }
}
