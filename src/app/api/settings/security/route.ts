import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import {
  DEFAULT_DEVICE_BINDING_POLICY,
  DEVICE_BINDING_SETTING_KEY,
  sanitizeDeviceBindingPolicy,
} from '@/lib/deviceBinding';

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

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// GET — ดึง password policy config + locked users
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์ดูการตั้งค่าความปลอดภัย');
    if (actor instanceof Response) return actor;

    // Get policy
    const policyResult = await db.request()
      .input('key', sql.NVarChar, SETTING_KEY)
      .query('SELECT setting_value FROM SystemSettings WHERE setting_key = @key');
    let policy = DEFAULT_CONFIG;
    if (policyResult.recordset.length > 0 && policyResult.recordset[0].setting_value) {
      policy = { ...DEFAULT_CONFIG, ...JSON.parse(policyResult.recordset[0].setting_value) };
    }

    const deviceBindingResult = await db.request()
      .input('key', sql.NVarChar, DEVICE_BINDING_SETTING_KEY)
      .query('SELECT setting_value FROM SystemSettings WHERE setting_key = @key');
    const deviceBindingPolicy = deviceBindingResult.recordset[0]?.setting_value
      ? sanitizeDeviceBindingPolicy({
          ...DEFAULT_DEVICE_BINDING_POLICY,
          ...JSON.parse(deviceBindingResult.recordset[0].setting_value),
        })
      : DEFAULT_DEVICE_BINDING_POLICY;

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
      device_binding_policy: deviceBindingPolicy,
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
    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', 'คุณไม่มีสิทธิ์แก้ไขการตั้งค่าความปลอดภัย');
    if (actor instanceof Response) return actor;

    const body = await request.json();

    // Action: unlock user
    const targetUserId = parsePositiveInt(body['user_id']);
    if (body.action === 'unlock' && targetUserId) {
      await db.request()
        .input('userId', sql.Int, targetUserId)
        .query(`
          UPDATE Users 
          SET failed_login_count = 0, locked_at = NULL, updated_at = GETDATE()
          WHERE user_id = @userId
        `);

      await logAudit({
        userId: actor.userId,
        action: 'account_unlock',
        entityType: 'user',
        entityId: targetUserId,
        details: { unlocked_user_id: targetUserId },
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
        userId: actor.userId,
        action: 'password_policy_update',
        entityType: 'system_settings',
        details: config,
      });

      return NextResponse.json({ success: true, policy: config });
    }

    if (body.device_binding_policy) {
      const config = sanitizeDeviceBindingPolicy({
        ...DEFAULT_DEVICE_BINDING_POLICY,
        ...body.device_binding_policy,
      });

      await db.request()
        .input('key', sql.NVarChar, DEVICE_BINDING_SETTING_KEY)
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
        action: 'device_binding_policy_update',
        entityType: 'system_settings',
        details: {
          enabled: config.enabled,
          auto_bind: config.auto_bind,
          enforce_roles: config.enforce_roles,
        },
      });

      return NextResponse.json({ success: true, device_binding_policy: config });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('❌ PUT security settings error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัพเดทได้' }, { status: 500 });
  }
}
