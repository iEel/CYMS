import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// GET — ดึง Permissions ทั้งหมด + RolePermissions matrix
export async function GET() {
  try {
    const db = await getDb();

    // ดึง Permissions
    const permsResult = await db.request().query(
      'SELECT * FROM Permissions ORDER BY module, action'
    );

    // ดึง Roles
    const rolesResult = await db.request().query(
      'SELECT role_id, role_code, role_name FROM Roles ORDER BY role_id'
    );

    // ดึง RolePermissions
    const rpResult = await db.request().query(
      'SELECT role_id, permission_id FROM RolePermissions'
    );

    // สร้าง matrix: { roleId: Set<permissionId> }
    const matrix: Record<number, number[]> = {};
    for (const rp of rpResult.recordset) {
      if (!matrix[rp.role_id]) matrix[rp.role_id] = [];
      matrix[rp.role_id].push(rp.permission_id);
    }

    return NextResponse.json({
      permissions: permsResult.recordset,
      roles: rolesResult.recordset,
      matrix,
    });
  } catch (error) {
    console.error('❌ GET permissions error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลสิทธิ์ได้' }, { status: 500 });
  }
}

// PUT — อัปเดต RolePermissions (toggle สิทธิ์)
export async function PUT(request: NextRequest) {
  try {
    const { role_id, permission_id, granted } = await request.json();
    const db = await getDb();

    if (granted) {
      // เพิ่มสิทธิ์
      await db.request()
        .input('roleId', sql.Int, role_id)
        .input('permId', sql.Int, permission_id)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM RolePermissions WHERE role_id = @roleId AND permission_id = @permId)
          INSERT INTO RolePermissions (role_id, permission_id) VALUES (@roleId, @permId)
        `);
    } else {
      // ถอนสิทธิ์
      await db.request()
        .input('roleId', sql.Int, role_id)
        .input('permId', sql.Int, permission_id)
        .query('DELETE FROM RolePermissions WHERE role_id = @roleId AND permission_id = @permId');
    }

    await logAudit({ action: 'permission_update', entityType: 'permission', details: { role_id, permission_id, granted } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT permission error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสิทธิ์ได้' }, { status: 500 });
  }
}
