import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createToken } from '@/lib/auth';
import { rateLimitLogin, getClientIP } from '@/lib/rateLimit';
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

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // ค้นหา user + role
    const result = await db.request()
      .input('username', sql.NVarChar, username)
      .query(`
        SELECT u.user_id, u.username, u.password_hash, u.full_name, u.status,
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

    // ตรวจรหัสผ่าน
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    // ดึง yard access
    const yardResult = await db.request()
      .input('userId', sql.Int, user.user_id)
      .query(`
        SELECT yard_id FROM UserYardAccess WHERE user_id = @userId
      `);

    const yardIds = yardResult.recordset.map((r: { yard_id: number }) => r.yard_id);

    // สร้าง JWT token
    const token = await createToken({
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_code,
      yardIds,
      activeYardId: yardIds[0] || 1,
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

    return NextResponse.json({
      success: true,
      session: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role_code,
        yardIds,
        activeYardId: yardIds[0] || 1,
        token,
      },
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
