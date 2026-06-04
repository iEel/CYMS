import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createToken } from '@/lib/auth';
import { rateLimitLogin, getClientIP } from '@/lib/rateLimit';
import { getPasswordPolicy } from '@/lib/passwordPolicy';
import { verifyTotpCode } from '@/lib/totp';
import { getDeviceBindingPolicy, isDeviceBindingRequired, normalizeDeviceId } from '@/lib/deviceBinding';
import bcrypt from 'bcryptjs';
import sql from 'mssql';

export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIP(request);
    const rl = await rateLimitLogin(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: `ล็อกอินผิดเกินกำหนด กรุณารอ ${Math.ceil(rl.retryAfterMs / 60000)} นาที` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const { username, password, totp_code, device_id } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const policy = await getPasswordPolicy();

    // ค้นหา user + role + lockout info
    const result = await db.request()
      .input('username', sql.NVarChar, username)
      .query(`
        SELECT u.user_id, u.username, u.password_hash, u.full_name, u.status,
               u.failed_login_count, u.locked_at, u.two_fa_enabled, u.two_fa_secret,
               u.bound_device_mac, u.customer_portal_role,
               r.role_code
        FROM Users u
        JOIN Roles r ON u.role_id = r.role_id
        WHERE u.username = @username
      `);

    const user = result.recordset[0];

    if (!user) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // ตรวจสถานะผู้ใช้
    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 403 }
      );
    }

    // ===== ACCOUNT LOCKOUT CHECK =====
    if (user.locked_at) {
      const lockedTime = new Date(user.locked_at).getTime();
      const unlockTime = lockedTime + (policy.lockout_duration_min * 60 * 1000);
      const now = Date.now();

      if (now < unlockTime) {
        const remainingMin = Math.ceil((unlockTime - now) / 60000);
        return NextResponse.json(
          {
            error: `บัญชีถูกล็อคเนื่องจากล็อกอินผิดหลายครั้ง กรุณารอ ${remainingMin} นาที หรือติดต่อผู้ดูแลระบบ`,
            locked: true,
            remaining_minutes: remainingMin,
          },
          { status: 423 }
        );
      } else {
        // Lockout expired — auto-unlock
        await db.request()
          .input('userId', sql.Int, user.user_id)
          .query(`UPDATE Users SET failed_login_count = 0, locked_at = NULL WHERE user_id = @userId`);
        user.failed_login_count = 0;
        user.locked_at = null;
      }
    }

    // ตรวจรหัสผ่าน
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // ===== INCREMENT FAILED COUNT =====
      const newCount = (user.failed_login_count || 0) + 1;
      const shouldLock = newCount >= policy.max_login_attempts;

      await db.request()
        .input('userId', sql.Int, user.user_id)
        .input('count', sql.Int, newCount)
        .query(`
          UPDATE Users 
          SET failed_login_count = @count,
              locked_at = ${shouldLock ? 'GETDATE()' : 'NULL'},
              updated_at = GETDATE()
          WHERE user_id = @userId
        `);

      if (shouldLock) {
        return NextResponse.json(
          {
            error: `ล็อกอินผิด ${policy.max_login_attempts} ครั้ง บัญชีถูกล็อค ${policy.lockout_duration_min} นาที`,
            locked: true,
            remaining_minutes: policy.lockout_duration_min,
          },
          { status: 423 }
        );
      }

      const remaining = policy.max_login_attempts - newCount;
      return NextResponse.json(
        {
          error: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลือ ${remaining} ครั้ง)`,
          remaining_attempts: remaining,
        },
        { status: 401 }
      );
    }

    // ===== TWO-FACTOR AUTH CHECK =====
    if (user.two_fa_enabled) {
      const code = String(totp_code || '').trim();
      if (!user.two_fa_secret) {
        return NextResponse.json(
          { error: 'บัญชีนี้เปิด 2FA แต่ยังไม่มี secret กรุณาติดต่อผู้ดูแลระบบ' },
          { status: 500 }
        );
      }
      if (!code) {
        return NextResponse.json({
          success: false,
          requires_2fa: true,
          error: 'กรุณากรอกรหัสยืนยัน 2FA',
        });
      }
      if (!verifyTotpCode(user.two_fa_secret, code)) {
        return NextResponse.json(
          {
            success: false,
            requires_2fa: true,
            error: 'รหัสยืนยัน 2FA ไม่ถูกต้อง',
          },
          { status: 401 }
        );
      }
    }

    // ===== TRUSTED DEVICE BINDING CHECK =====
    const devicePolicy = await getDeviceBindingPolicy();
    if (isDeviceBindingRequired(devicePolicy, user.role_code)) {
      const currentDeviceId = normalizeDeviceId(device_id);
      if (!currentDeviceId) {
        return NextResponse.json(
          {
            error: 'บัญชีนี้ต้องล็อกอินจากอุปกรณ์ที่เชื่อถือได้ กรุณาเปิด browser เดิมหรือติดต่อผู้ดูแลระบบ',
            device_required: true,
          },
          { status: 403 }
        );
      }

      const boundDeviceId = normalizeDeviceId(user.bound_device_mac);
      if (!boundDeviceId) {
        if (!devicePolicy.auto_bind) {
          return NextResponse.json(
            {
              error: 'บัญชีนี้ยังไม่ได้ผูกอุปกรณ์ กรุณาติดต่อผู้ดูแลระบบเพื่ออนุมัติอุปกรณ์',
              device_unbound: true,
            },
            { status: 403 }
          );
        }

        await db.request()
          .input('userId', sql.Int, user.user_id)
          .input('deviceId', sql.NVarChar, currentDeviceId)
          .query(`
            UPDATE Users
            SET bound_device_mac = @deviceId,
                updated_at = GETDATE()
            WHERE user_id = @userId
          `);
        user.bound_device_mac = currentDeviceId;
      } else if (boundDeviceId !== currentDeviceId) {
        return NextResponse.json(
          {
            error: 'อุปกรณ์นี้ไม่ได้รับอนุญาตสำหรับบัญชีนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อล้างการผูกอุปกรณ์',
            device_mismatch: true,
          },
          { status: 403 }
        );
      }
    }

    // ===== LOGIN SUCCESS — RESET COUNTER =====
    await db.request()
      .input('userId', sql.Int, user.user_id)
      .query(`UPDATE Users SET failed_login_count = 0, locked_at = NULL WHERE user_id = @userId`);

    // ดึง yard access
    const yardResult = await db.request()
      .input('userId', sql.Int, user.user_id)
      .query(`SELECT yard_id FROM UserYardAccess WHERE user_id = @userId`);

    const yardIds = yardResult.recordset.map((r: { yard_id: number }) => r.yard_id);

    // ดึง customer_id สำหรับ customer role
    let customerId: number | undefined;
    let customerPortalRole: string | null = null;
    if (user.role_code === 'customer') {
      const custResult = await db.request()
        .input('uid', sql.Int, user.user_id)
        .query(`SELECT customer_id FROM Users WHERE user_id = @uid AND customer_id IS NOT NULL`);
      customerId = custResult.recordset[0]?.customer_id || undefined;
      customerPortalRole = user.customer_portal_role || 'customer_admin';
    }

    // สร้าง JWT token
    const token = await createToken({
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_code,
      yardIds,
      activeYardId: yardIds[0] || 1,
      customerId,
      customerPortalRole,
    });

    // บันทึก Audit Log
    await db.request()
      .input('userId', sql.Int, user.user_id)
      .input('yardId', sql.Int, yardIds[0] || null)
      .input('action', sql.NVarChar, 'login')
      .input('entityType', sql.NVarChar, 'user')
      .input('entityId', sql.Int, user.user_id)
      .input('details', sql.NVarChar, JSON.stringify({ username: user.username }))
      .query(`
        INSERT INTO AuditLog (user_id, yard_id, action, entity_type, entity_id, details, created_at)
        VALUES (@userId, @yardId, @action, @entityType, @entityId, @details, GETDATE())
      `);

    const sessionData = {
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_code,
      yardIds,
      activeYardId: yardIds[0] || 1,
      customerId,
      customerPortalRole,
      token,
    };

    // [Fix] ตั้ง httpOnly cookie ผ่าน Set-Cookie header ตรงๆ
    // เพื่อความเสถียรกับ Next.js 16 — NextResponse.cookies.set() อาจไม่ทำงาน
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
    const maxAgeSeconds = expiresIn.endsWith('h')
      ? parseInt(expiresIn) * 3600
      : expiresIn.endsWith('d')
        ? parseInt(expiresIn) * 86400
        : 28800; // default 8h

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieParts = [
      `cyms_token=${token}`,
      `Path=/`,
      `Max-Age=${maxAgeSeconds}`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];
    if (isProduction) cookieParts.push('Secure');
    const setCookieHeader = cookieParts.join('; ');

    return new Response(
      JSON.stringify({ success: true, session: sessionData }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': setCookieHeader,
        },
      }
    );

  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
