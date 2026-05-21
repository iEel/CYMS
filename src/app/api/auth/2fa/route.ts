import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireRequestActor } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';
import { generateTotpSecret, getTotpAuthUri, verifyTotpCode } from '@/lib/totp';

function getCode(value: unknown) {
  return String(value || '').replace(/\s/g, '');
}

export async function GET(request: NextRequest) {
  const actor = requireRequestActor(request);
  if (actor instanceof NextResponse) return actor;

  try {
    const db = await getDb();
    const result = await db.request()
      .input('userId', sql.Int, actor.userId)
      .query(`
        SELECT two_fa_enabled, two_fa_secret
        FROM Users
        WHERE user_id = @userId
      `);

    const row = result.recordset[0];
    return NextResponse.json({
      enabled: Boolean(row?.two_fa_enabled),
      has_secret: Boolean(row?.two_fa_secret),
    });
  } catch (error) {
    console.error('❌ GET 2FA status error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงสถานะ 2FA ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = requireRequestActor(request);
  if (actor instanceof NextResponse) return actor;

  try {
    const body = await request.json();
    const action = body.action;
    const db = await getDb();

    if (action === 'setup') {
      const secret = generateTotpSecret();
      const accountName = actor.username || `user-${actor.userId}`;
      const otpauthUri = getTotpAuthUri({ issuer: 'CYMS', accountName, secret });

      await db.request()
        .input('userId', sql.Int, actor.userId)
        .input('secret', sql.NVarChar, secret)
        .input('enabled', sql.Bit, false)
        .query(`
          UPDATE Users
          SET two_fa_secret = @secret,
              two_fa_enabled = @enabled,
              two_fa_confirmed_at = NULL,
              updated_at = GETDATE()
          WHERE user_id = @userId
        `);

      await logAudit({
        userId: actor.userId,
        action: 'two_fa_setup_started',
        entityType: 'user',
        entityId: actor.userId,
        details: { username: actor.username },
      });

      return NextResponse.json({ success: true, secret, otpauth_uri: otpauthUri });
    }

    if (action === 'verify') {
      const code = getCode(body.code);
      const secretResult = await db.request()
        .input('userId', sql.Int, actor.userId)
        .query(`
          SELECT two_fa_secret
          FROM Users
          WHERE user_id = @userId
        `);
      const secret = secretResult.recordset[0]?.two_fa_secret;
      if (!secret) {
        return NextResponse.json({ error: 'ยังไม่ได้เริ่มตั้งค่า 2FA' }, { status: 400 });
      }
      if (!verifyTotpCode(secret, code)) {
        return NextResponse.json({ error: 'รหัสยืนยัน 2FA ไม่ถูกต้อง' }, { status: 400 });
      }

      await db.request()
        .input('userId', sql.Int, actor.userId)
        .query(`
          UPDATE Users
          SET two_fa_enabled = 1,
              two_fa_confirmed_at = GETDATE(),
              updated_at = GETDATE()
          WHERE user_id = @userId
        `);

      await logAudit({
        userId: actor.userId,
        action: 'two_fa_enabled',
        entityType: 'user',
        entityId: actor.userId,
      });

      return NextResponse.json({ success: true, enabled: true });
    }

    if (action === 'disable') {
      const code = getCode(body.code);
      const secretResult = await db.request()
        .input('userId', sql.Int, actor.userId)
        .query(`
          SELECT two_fa_enabled, two_fa_secret
          FROM Users
          WHERE user_id = @userId
        `);
      const row = secretResult.recordset[0];
      if (row?.two_fa_enabled && !verifyTotpCode(row.two_fa_secret, code)) {
        return NextResponse.json({ error: 'รหัสยืนยัน 2FA ไม่ถูกต้อง' }, { status: 400 });
      }

      await db.request()
        .input('userId', sql.Int, actor.userId)
        .query(`
          UPDATE Users
          SET two_fa_enabled = 0,
              two_fa_secret = NULL,
              two_fa_confirmed_at = NULL,
              updated_at = GETDATE()
          WHERE user_id = @userId
        `);

      await logAudit({
        userId: actor.userId,
        action: 'two_fa_disabled',
        entityType: 'user',
        entityId: actor.userId,
      });

      return NextResponse.json({ success: true, enabled: false });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('❌ POST 2FA error:', error);
    return NextResponse.json({ error: 'ไม่สามารถจัดการ 2FA ได้' }, { status: 500 });
  }
}
