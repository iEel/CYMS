import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getDb } from '@/lib/db';
import sql from 'mssql';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

// GET /api/auth/me — ตรวจสอบ session จาก httpOnly cookie (ผ่าน x-cyms-token header ที่ proxy forward มา)
// ใช้ตอน AuthProvider init เพื่อ restore session เมื่อ localStorage ว่างเปล่า
export async function GET(request: NextRequest) {
  // อ่าน token จาก x-cyms-token header (forwarded โดย proxy) หรือ cookie โดยตรง
  const token = request.headers.get('x-cyms-token') || request.cookies.get('cyms_token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    // ดึงข้อมูล user เพิ่มเติมจาก DB เพื่อให้ session data ครบ
    const db = await getDb();
    const result = await db.request()
      .input('userId', sql.Int, payload.userId)
      .query(`
        SELECT u.user_id, u.username, u.full_name, u.email,
               r.role_code,
               STRING_AGG(CAST(uya.yard_id AS NVARCHAR), ',') AS yard_ids
        FROM Users u
        JOIN Roles r ON u.role_id = r.role_id
        LEFT JOIN UserYardAccess uya ON u.user_id = uya.user_id
        WHERE u.user_id = @userId AND u.status = 'active'
        GROUP BY u.user_id, u.username, u.full_name, u.email, r.role_code
      `);

    const user = result.recordset[0];
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const yardIds: number[] = user.yard_ids
      ? user.yard_ids.split(',').map(Number)
      : [];

    const session = {
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      role: user.role_code,
      yardIds,
      activeYardId: yardIds[0] || 1,
      customerId: (payload.customerId as number) || null,
      token, // ส่ง token กลับไปให้ client เก็บใน state
    };

    return NextResponse.json({ authenticated: true, session });

  } catch (err) {
    console.error('❌ /api/auth/me error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
