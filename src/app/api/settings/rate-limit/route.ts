import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { getRateLimitStats, clearRateLimitStores, invalidateRateLimitConfig } from '@/lib/rateLimit';
import { logAudit } from '@/lib/audit';

// GET — Get rate limit settings + stats
export async function GET() {
  try {
    const db = await getDb();
    const result = await db.request().query(
      "SELECT setting_value FROM SystemSettings WHERE setting_key = 'rate_limit'"
    );
    const config = result.recordset[0]
      ? JSON.parse(result.recordset[0].setting_value)
      : { enabled: true, login_limit: 5, login_window_min: 15, api_limit: 100, api_window_min: 1, upload_limit: 10, upload_window_min: 1 };

    const stats = getRateLimitStats();

    return NextResponse.json({ config, stats });
  } catch (error) {
    console.error('❌ GET rate limit settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// PUT — Update rate limit settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const config = {
      enabled: body.enabled ?? true,
      login_limit: Math.max(1, body.login_limit || 5),
      login_window_min: Math.max(1, body.login_window_min || 15),
      api_limit: Math.max(10, body.api_limit || 100),
      api_window_min: Math.max(1, body.api_window_min || 1),
      upload_limit: Math.max(1, body.upload_limit || 10),
      upload_window_min: Math.max(1, body.upload_window_min || 1),
    };

    const db = await getDb();
    await db.request()
      .input('key', sql.NVarChar, 'rate_limit')
      .input('value', sql.NVarChar, JSON.stringify(config))
      .query(`
        MERGE SystemSettings AS target
        USING (SELECT @key AS setting_key) AS source
        ON target.setting_key = source.setting_key
        WHEN MATCHED THEN UPDATE SET setting_value = @value, updated_at = GETDATE()
        WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES (@key, @value);
      `);

    invalidateRateLimitConfig();

    await logAudit({ action: 'rate_limit_update', entityType: 'system_settings', details: { enabled: config.enabled, login_limit: config.login_limit, api_limit: config.api_limit } });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('❌ PUT rate limit settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกได้' }, { status: 500 });
  }
}

// DELETE — Clear all rate limit stores
export async function DELETE() {
  try {
    clearRateLimitStores();
    await logAudit({ action: 'rate_limit_clear', entityType: 'system_settings', details: { cleared: true } });
    return NextResponse.json({ success: true, message: 'ล้าง Rate Limit ทั้งหมดแล้ว' });
  } catch (error) {
    console.error('❌ DELETE rate limit error:', error);
    return NextResponse.json({ error: 'ไม่สามารถล้างได้' }, { status: 500 });
  }
}
