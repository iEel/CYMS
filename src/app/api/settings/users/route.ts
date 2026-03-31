import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit';
import { getPasswordPolicy, validatePassword } from '@/lib/passwordPolicy';

// [Security] ตรวจ role จาก JWT header (ตั้งโดย middleware) — ต้องเป็น yard_manager เท่านั้น
function requireYardManager(request: NextRequest): { actorId: number } | NextResponse {
  const role = request.headers.get('x-user-role');
  const userId = request.headers.get('x-user-id');
  if (role !== 'yard_manager') {
    return NextResponse.json(
      { error: 'เฉพาะ Yard Manager เท่านั้นที่จัดการผู้ใช้งานได้' },
      { status: 403 }
    );
  }
  return { actorId: parseInt(userId || '0') };
}

// GET — ดึงรายชื่อผู้ใช้ทั้งหมด (yard_manager only)
export async function GET(request: NextRequest) {
  const auth = requireYardManager(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = await getDb();
    const result = await db.request().query(`
      SELECT u.user_id, u.username, u.full_name, u.email, u.phone,
             u.status, u.two_fa_enabled, u.bound_device_mac, u.created_at,
             u.customer_id, u.failed_login_count, u.locked_at, u.password_changed_at,
             r.role_code, r.role_name,
             STRING_AGG(CAST(uya.yard_id AS VARCHAR), ',') as yard_ids
      FROM Users u
      JOIN Roles r ON u.role_id = r.role_id
      LEFT JOIN UserYardAccess uya ON u.user_id = uya.user_id
      GROUP BY u.user_id, u.username, u.full_name, u.email, u.phone,
               u.status, u.two_fa_enabled, u.bound_device_mac, u.created_at,
               u.customer_id, u.failed_login_count, u.locked_at, u.password_changed_at,
               r.role_code, r.role_name
      ORDER BY u.user_id
    `);
    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('❌ GET users error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้ได้' }, { status: 500 });
  }
}

// POST — เพิ่มผู้ใช้ใหม่ (yard_manager only)
export async function POST(request: NextRequest) {
  const auth = requireYardManager(request);
  if (auth instanceof NextResponse) return auth;
  const { actorId } = auth;

  try {
    const body = await request.json();
    const db = await getDb();

    // Password validation
    const policy = await getPasswordPolicy();
    const validation = validatePassword(body.password, policy);
    if (!validation.valid) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ผ่านเกณฑ์', password_errors: validation.errors }, { status: 400 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(body.password, salt);

    // หา role_id
    const roleResult = await db.request()
      .input('roleCode', sql.NVarChar, body.role_code)
      .query('SELECT role_id FROM Roles WHERE role_code = @roleCode');

    if (roleResult.recordset.length === 0) {
      return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 });
    }

    const roleId = roleResult.recordset[0].role_id;

    const insertResult = await db.request()
      .input('username', sql.NVarChar, body.username)
      .input('passwordHash', sql.NVarChar, hash)
      .input('fullName', sql.NVarChar, body.full_name)
      .input('roleId', sql.Int, roleId)
      .input('email', sql.NVarChar, body.email || null)
      .input('phone', sql.NVarChar, body.phone || null)
      .input('customerId', sql.Int, body.role_code === 'customer' && body.customer_id ? body.customer_id : null)
      .query(`
        INSERT INTO Users (username, password_hash, full_name, role_id, email, phone, customer_id, password_changed_at)
        OUTPUT INSERTED.user_id
        VALUES (@username, @passwordHash, @fullName, @roleId, @email, @phone, @customerId, GETDATE())
      `);

    const userId = insertResult.recordset[0].user_id;

    // เพิ่มสิทธิ์เข้าลาน
    if (body.yard_ids && body.yard_ids.length > 0) {
      for (const yardId of body.yard_ids) {
        await db.request()
          .input('userId', sql.Int, userId)
          .input('yardId', sql.Int, yardId)
          .query('INSERT INTO UserYardAccess (user_id, yard_id) VALUES (@userId, @yardId)');
      }
    }

    // [Security] audit actor = ผู้ใช้ที่ล็อกอินอยู่จาก JWT (ไม่ใช้ body.created_by)
    await logAudit({ userId: actorId, action: 'user_create', entityType: 'user', entityId: userId, details: { username: body.username, full_name: body.full_name, role_code: body.role_code } });
    return NextResponse.json({ success: true, userId });
  } catch (error: unknown) {
    console.error('❌ POST user error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'ชื่อผู้ใช้นี้มีอยู่แล้ว' : 'ไม่สามารถเพิ่มผู้ใช้ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — แก้ไขผู้ใช้ (yard_manager only)
export async function PUT(request: NextRequest) {
  const auth = requireYardManager(request);
  if (auth instanceof NextResponse) return auth;
  const { actorId } = auth;

  try {
    const body = await request.json();
    const db = await getDb();

    // Action: unlock user
    if (body.action === 'unlock' && body.user_id) {
      await db.request()
        .input('userId', sql.Int, body.user_id)
        .query(`UPDATE Users SET failed_login_count = 0, locked_at = NULL, updated_at = GETDATE() WHERE user_id = @userId`);
      // [Security] audit actor = ผู้ใช้ที่ล็อกอินอยู่จาก JWT
      await logAudit({ userId: actorId, action: 'account_unlock', entityType: 'user', entityId: body.user_id, details: { unlocked_user_id: body.user_id } });
      return NextResponse.json({ success: true, message: 'ปลดล็อคบัญชีเรียบร้อย' });
    }

    // หา role_id
    const roleResult = await db.request()
      .input('roleCode', sql.NVarChar, body.role_code)
      .query('SELECT role_id FROM Roles WHERE role_code = @roleCode');

    const roleId = roleResult.recordset[0]?.role_id;
    if (!roleId) {
      return NextResponse.json({ error: 'บทบาทไม่ถูกต้อง' }, { status: 400 });
    }

    // อัปเดต user
    let query = `
      UPDATE Users SET
        full_name = @fullName, role_id = @roleId, email = @email,
        phone = @phone, status = @status, customer_id = @customerId, updated_at = GETDATE()
    `;

    const req = db.request()
      .input('userId', sql.Int, body.user_id)
      .input('fullName', sql.NVarChar, body.full_name)
      .input('roleId', sql.Int, roleId)
      .input('email', sql.NVarChar, body.email || null)
      .input('phone', sql.NVarChar, body.phone || null)
      .input('status', sql.NVarChar, body.status || 'active')
      .input('customerId', sql.Int, body.role_code === 'customer' && body.customer_id ? body.customer_id : null);

    // อัปเดต password ถ้ามีเปลี่ยน
    if (body.password) {
      const policy = await getPasswordPolicy();
      const validation = validatePassword(body.password, policy);
      if (!validation.valid) {
        return NextResponse.json({ error: 'รหัสผ่านไม่ผ่านเกณฑ์', password_errors: validation.errors }, { status: 400 });
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(body.password, salt);
      query += `, password_hash = @passwordHash, password_changed_at = GETDATE()`;
      req.input('passwordHash', sql.NVarChar, hash);
    }

    query += ` WHERE user_id = @userId`;
    await req.query(query);

    // อัปเดตสิทธิ์ลาน
    if (body.yard_ids) {
      await db.request()
        .input('userId', sql.Int, body.user_id)
        .query('DELETE FROM UserYardAccess WHERE user_id = @userId');

      for (const yardId of body.yard_ids) {
        await db.request()
          .input('userId', sql.Int, body.user_id)
          .input('yardId', sql.Int, yardId)
          .query('INSERT INTO UserYardAccess (user_id, yard_id) VALUES (@userId, @yardId)');
      }
    }

    // [Security] audit actor = ผู้ใช้ที่ล็อกอินอยู่จาก JWT
    await logAudit({ userId: actorId, action: 'user_update', entityType: 'user', entityId: body.user_id, details: { full_name: body.full_name, role_code: body.role_code, status: body.status } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT user error:', error);
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขผู้ใช้ได้' }, { status: 500 });
  }
}

// DELETE — ลบผู้ใช้ (yard_manager only)
export async function DELETE(request: NextRequest) {
  const auth = requireYardManager(request);
  if (auth instanceof NextResponse) return auth;
  const { actorId } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'กรุณาระบุ user_id' }, { status: 400 });
    }

    const db = await getDb();
    const uid = parseInt(userId);

    // ห้ามลบตัวเอง
    if (actorId === uid) {
      return NextResponse.json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, { status: 400 });
    }

    // ลบ UserYardAccess ก่อน (FK)
    await db.request().input('uid', sql.Int, uid)
      .query('DELETE FROM UserYardAccess WHERE user_id = @uid');

    // ลบ user
    await db.request().input('uid', sql.Int, uid)
      .query('DELETE FROM Users WHERE user_id = @uid');

    // [Security] audit actor = ผู้ใช้ที่ล็อกอินอยู่จาก JWT
    await logAudit({ userId: actorId, action: 'user_delete', entityType: 'user', entityId: uid, details: { deleted_user_id: uid } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE user error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบผู้ใช้ได้' }, { status: 500 });
  }
}
