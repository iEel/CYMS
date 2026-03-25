import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// POST — สร้างบัญชี Portal สำหรับลูกค้า
export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-user-role');
    if (role !== 'yard_manager') {
      return NextResponse.json({ error: 'เฉพาะ admin เท่านั้น' }, { status: 403 });
    }

    const { customer_id } = await request.json();
    if (!customer_id) {
      return NextResponse.json({ error: 'กรุณาระบุ customer_id' }, { status: 400 });
    }

    const db = await getDb();

    // Get customer info
    const custResult = await db.request()
      .input('cid', sql.Int, customer_id)
      .query(`SELECT customer_id, customer_name, contact_email FROM Customers WHERE customer_id = @cid`);
    const customer = custResult.recordset[0];
    if (!customer) {
      return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
    }

    // Check if portal account already exists
    const existResult = await db.request()
      .input('cid', sql.Int, customer_id)
      .query(`SELECT user_id, username FROM Users WHERE customer_id = @cid`);
    if (existResult.recordset.length > 0) {
      return NextResponse.json({
        error: `มีบัญชี Portal อยู่แล้ว (${existResult.recordset[0].username})`,
      }, { status: 409 });
    }

    // Get customer role_id
    const roleResult = await db.request().query(`SELECT role_id FROM Roles WHERE role_code = 'customer'`);
    if (roleResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ customer role' }, { status: 500 });
    }
    const roleId = roleResult.recordset[0].role_id;

    // Generate username and password
    const username = customer.contact_email || `customer_${customer_id}`;
    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 char random
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create user
    const result = await db.request()
      .input('username', sql.NVarChar, username)
      .input('hash', sql.NVarChar, passwordHash)
      .input('fullName', sql.NVarChar, customer.customer_name)
      .input('roleId', sql.Int, roleId)
      .input('cid', sql.Int, customer_id)
      .query(`
        INSERT INTO Users (username, password_hash, full_name, role_id, customer_id, status)
        OUTPUT INSERTED.user_id
        VALUES (@username, @hash, @fullName, @roleId, @cid, 'active')
      `);

    // Enable portal on customer
    await db.request()
      .input('cid', sql.Int, customer_id)
      .query(`UPDATE Customers SET is_portal_enabled = 1 WHERE customer_id = @cid`);

    // Give access to all yards
    const yardsResult = await db.request().query(`SELECT yard_id FROM Yards`);
    for (const yard of yardsResult.recordset) {
      try {
        await db.request()
          .input('uid', sql.Int, result.recordset[0].user_id)
          .input('yid', sql.Int, yard.yard_id)
          .query(`INSERT INTO UserYardAccess (user_id, yard_id) VALUES (@uid, @yid)`);
      } catch { /* ignore dup */ }
    }

    return NextResponse.json({
      success: true,
      username,
      tempPassword,
      message: `บัญชี Portal สำหรับ ${customer.customer_name} สร้างสำเร็จ`,
    });
  } catch (error) {
    console.error('❌ Create portal account error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างบัญชีได้' }, { status: 500 });
  }
}
