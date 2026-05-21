import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { getPromptPayTargetType, sanitizePromptPayId } from '@/lib/promptPay';
import { requirePermission } from '@/lib/apiAuth';

const SETTING_KEY = 'payment_promptpay';

function sanitizeConfig(value: Record<string, unknown>) {
  const promptpayId = sanitizePromptPayId(String(value.promptpay_id || ''));
  return {
    enabled: !!value.enabled,
    promptpay_id: promptpayId,
    merchant_name: String(value.merchant_name || '').trim().slice(0, 80),
  };
}

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.request()
      .input('key', sql.NVarChar, SETTING_KEY)
      .query('SELECT setting_value FROM SystemSettings WHERE setting_key = @key');

    const envId = sanitizePromptPayId(process.env.PROMPTPAY_ID || '');
    const stored = result.recordset[0]?.setting_value ? JSON.parse(result.recordset[0].setting_value) : {};
    const config = sanitizeConfig({
      enabled: Boolean(envId),
      promptpay_id: envId,
      ...stored,
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error('❌ GET payment settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงค่าการชำระเงินได้' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const config = sanitizeConfig(body.config || {});
    if (config.enabled && !getPromptPayTargetType(config.promptpay_id)) {
      return NextResponse.json({ error: 'เลข PromptPay ไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์แก้ไขการตั้งค่าการชำระเงิน');
    if (actor instanceof NextResponse) return actor;
    await db.request()
      .input('key', sql.NVarChar, SETTING_KEY)
      .input('value', sql.NVarChar, JSON.stringify(config))
      .query(`
        MERGE SystemSettings AS target
        USING (SELECT @key AS setting_key) AS source
        ON target.setting_key = source.setting_key
        WHEN MATCHED THEN UPDATE SET setting_value = @value, updated_at = GETDATE()
        WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES (@key, @value);
      `);

    await logAudit({
      userId: actor.userId,
      action: 'payment_promptpay_settings_update',
      entityType: 'system_settings',
      details: {
        enabled: config.enabled,
        promptpay_id_last4: config.promptpay_id.slice(-4),
        merchant_name: config.merchant_name,
      },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('❌ PUT payment settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกค่าการชำระเงินได้' }, { status: 500 });
  }
}
