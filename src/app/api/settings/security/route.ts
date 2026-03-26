import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

const SETTING_KEY = 'password_policy';

const DEFAULT_CONFIG = {
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_number: true,
  require_special: true,
  max_login_attempts: 5,
  lockout_duration_min: 30,
};

// GET — ดึง password policy config + locked users
export async function GET() {
  try {
    const db = await getDb();

    // Get policy
    const policyResult = await db.request().query(
      `SELECT setting_value FROM SystemSettings WHERE setting_key = '${SETTING_KEY}'`
    );
    let policy = DEFAULT_CONFIG;
    if (policyResult.recordset.length > 0 && policyResult.recordset[0].setting_value) {
      policy = { ...DEFAULT_CONFIG, ...JSON.parse(policyResult.recordset[0].setting_value) };
    }

    // Get locked users
    const lockedResult = await db.request().query(`
      SELECT u.user_id, u.username, u.full_name, u.failed_login_count, u.locked_at,
             r.role_code, r.role_name
      FROM Users u
      JOIN Roles r ON u.role_id = r.role_id
      WHERE u.locked_at IS NOT NULL OR u.failed_login_count > 0
      ORDER BY u.locked_at DESC
    `);

    return NextResponse.json({
      policy,
      locked_users: lockedResult.recordset,
    });
  } catch (error) {
    console.error('❌ GET security settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// PUT — อัพเดท password policy config หรือ unlock user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    // Action: unlock user
    if (body.action === 'unlock' && body.user_id) {
      await db.request()
        .input('userId', sql.Int, body.user_id)
        .query(`
          UPDATE Users 
          SET failed_login_count = 0, locked_at = NULL, updated_at = GETDATE()
          WHERE user_id = @userId
        `);

      await logAudit({
        userId: body.admin_user_id,
        action: 'account_unlock',
        entityType: 'user',
        entityId: body.user_id,
        details: { unlocked_user_id: body.user_id },
      });

      return NextResponse.json({ success: true, message: 'ปลดล็อคบัญชีเรียบร้อย' });
    }

    // Action: update policy
    if (body.policy) {
      const config = {
        min_length: Math.max(6, Math.min(32, body.policy.min_length || 8)),
        require_uppercase: !!body.policy.require_uppercase,
        require_lowercase: !!body.policy.require_lowercase,
        require_number: !!body.policy.require_number,
        require_special: !!body.policy.require_special,
        max_login_attempts: Math.max(3, Math.min(20, body.policy.max_login_attempts || 5)),
        lockout_duration_min: Math.max(5, Math.min(1440, body.policy.lockout_duration_min || 30)),
      };

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
        userId: body.admin_user_id,
        action: 'password_policy_update',
        entityType: 'system_settings',
        details: config,
      });

      return NextResponse.json({ success: true, policy: config });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('❌ PUT security settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัพเดทได้' }, { status: 500 });
  }
}
