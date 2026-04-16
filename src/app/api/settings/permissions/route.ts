import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

const ROLE_SEEDS = [
  { code: 'yard_manager', name: 'ผู้จัดการลาน / Admin' },
  { code: 'supervisor', name: 'Supervisor / ผู้อนุมัติ' },
  { code: 'gate_clerk', name: 'Gate Clerk / พนักงานประตู' },
  { code: 'surveyor', name: 'Surveyor / พนักงานตรวจสภาพ' },
  { code: 'yard_planner', name: 'Yard Planner / ผู้วางแผนลาน' },
  { code: 'rs_driver', name: 'คนขับรถยก' },
  { code: 'billing_officer', name: 'Billing / บัญชีการเงิน' },
  { code: 'customer', name: 'ลูกค้า' },
];

const PERMISSION_SEEDS = [
  { code: 'gate.in', module: 'gate', action: 'gate_in', description: 'ทำ Gate In และบันทึกรับตู้เข้าลาน' },
  { code: 'gate.out', module: 'gate', action: 'gate_out', description: 'ทำ Gate Out และปล่อยตู้ออกจากลาน' },
  { code: 'gate.eir.print', module: 'gate', action: 'eir_print', description: 'ออกและพิมพ์เอกสาร EIR' },
  { code: 'gate.eir.cancel', module: 'gate', action: 'eir_cancel', description: 'ยกเลิกเอกสาร EIR', risk: 'high' },
  { code: 'survey.inspect', module: 'survey', action: 'inspect', description: 'ตรวจสภาพตู้และบันทึกผลสำรวจ' },
  { code: 'survey.damage.update', module: 'survey', action: 'damage_update', description: 'เพิ่มหรือแก้ไขรายการ damage ของตู้' },
  {
    code: 'survey.grade.change',
    module: 'survey',
    action: 'grade_change',
    description: 'เปลี่ยนเกรดตู้หลังบันทึกผลตรวจ',
    approval: 'survey.grade.approve',
    risk: 'high',
  },
  { code: 'survey.grade.approve', module: 'survey', action: 'grade_approve', description: 'อนุมัติการเปลี่ยนเกรดตู้', risk: 'high' },
  { code: 'yard.slot.move', module: 'yard', action: 'slot_move', description: 'ย้าย slot หรือตำแหน่งวางตู้' },
  { code: 'yard.location.assign', module: 'yard', action: 'location_assign', description: 'กำหนด location ให้ตู้' },
  { code: 'yard.hold.release', module: 'yard', action: 'hold_release', description: 'ปล่อยตู้ที่ติด hold หรือ billing hold', risk: 'high' },
  { code: 'billing.invoice.create', module: 'billing', action: 'invoice_create', description: 'ออกใบแจ้งหนี้' },
  { code: 'billing.payment.receive', module: 'billing', action: 'payment_receive', description: 'รับชำระเงินและออกใบเสร็จ' },
  {
    code: 'billing.waive.request',
    module: 'billing',
    action: 'waive_request',
    description: 'ขอยกเว้นค่าบริการหรือ no charge',
    approval: 'billing.waive.approve',
    risk: 'high',
  },
  { code: 'billing.waive.approve', module: 'billing', action: 'waive_approve', description: 'อนุมัติยกเว้นค่าบริการหรือ no charge', risk: 'high' },
  {
    code: 'billing.credit_note.create',
    module: 'billing',
    action: 'credit_note_create',
    description: 'สร้างใบลดหนี้',
    approval: 'billing.credit_note.approve',
    risk: 'high',
  },
  { code: 'billing.credit_note.approve', module: 'billing', action: 'credit_note_approve', description: 'อนุมัติใบลดหนี้', risk: 'high' },
  { code: 'billing.invoice.cancel', module: 'billing', action: 'invoice_cancel', description: 'ยกเลิกใบแจ้งหนี้', risk: 'high' },
  { code: 'billing.receipt.cancel', module: 'billing', action: 'receipt_cancel', description: 'ยกเลิกใบเสร็จรับเงิน', risk: 'high' },
  { code: 'booking.manage', module: 'bookings', action: 'manage', description: 'จัดการ Booking และยอดรับ/ปล่อยตู้' },
  { code: 'integration.send', module: 'edi', action: 'send', description: 'ส่ง EDI หรือข้อมูล integration ออกนอกระบบ' },
  { code: 'integration.logs.view', module: 'edi', action: 'integration_logs_view', description: 'ดู integration log และผลการส่งข้อมูล' },
  { code: 'audit_trail.read', module: 'audit_trail', action: 'read', description: 'ดูประวัติการใช้งานและ audit trail' },
  { code: 'settings.manage', module: 'settings', action: 'manage', description: 'ตั้งค่าระบบ' },
  { code: 'permissions.manage', module: 'settings', action: 'permissions_manage', description: 'จัดการสิทธิ์และ role ของผู้ใช้งาน', risk: 'high' },
];

const ROLE_GRANTS: Record<string, string[]> = {
  gate_clerk: ['gate.in', 'gate.out', 'gate.eir.print', 'booking.manage', 'integration.logs.view'],
  surveyor: ['survey.inspect', 'survey.damage.update', 'survey.grade.change', 'yard.location.assign'],
  yard_planner: ['yard.slot.move', 'yard.location.assign', 'booking.manage'],
  rs_driver: ['yard.slot.move', 'yard.location.assign'],
  billing_officer: [
    'billing.invoice.create',
    'billing.payment.receive',
    'billing.waive.request',
    'billing.credit_note.create',
    'integration.logs.view',
  ],
  supervisor: [
    'gate.in',
    'gate.out',
    'gate.eir.print',
    'gate.eir.cancel',
    'survey.inspect',
    'survey.damage.update',
    'survey.grade.change',
    'survey.grade.approve',
    'yard.slot.move',
    'yard.location.assign',
    'yard.hold.release',
    'billing.invoice.create',
    'billing.payment.receive',
    'billing.waive.request',
    'billing.waive.approve',
    'billing.credit_note.create',
    'billing.credit_note.approve',
    'billing.invoice.cancel',
    'billing.receipt.cancel',
    'booking.manage',
    'integration.send',
    'integration.logs.view',
    'audit_trail.read',
  ],
};

async function ensureGranularRbac(db: sql.ConnectionPool) {
  await db.request().query(`
    IF COL_LENGTH('Permissions', 'requires_approval') IS NULL
      ALTER TABLE Permissions ADD requires_approval BIT NOT NULL CONSTRAINT DF_Permissions_requires_approval DEFAULT 0;

    IF COL_LENGTH('Permissions', 'approval_permission_code') IS NULL
      ALTER TABLE Permissions ADD approval_permission_code NVARCHAR(100) NULL;

    IF COL_LENGTH('Permissions', 'risk_level') IS NULL
      ALTER TABLE Permissions ADD risk_level NVARCHAR(20) NULL;
  `);

  for (const role of ROLE_SEEDS) {
    await db.request()
      .input('code', sql.NVarChar(50), role.code)
      .input('name', sql.NVarChar(100), role.name)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Roles WHERE role_code = @code)
          INSERT INTO Roles (role_code, role_name) VALUES (@code, @name)
        ELSE
          UPDATE Roles SET role_name = @name WHERE role_code = @code
      `);
  }

  for (const perm of PERMISSION_SEEDS) {
    await db.request()
      .input('code', sql.NVarChar(100), perm.code)
      .input('module', sql.NVarChar(50), perm.module)
      .input('action', sql.NVarChar(50), perm.action)
      .input('description', sql.NVarChar(255), perm.description)
      .input('requiresApproval', sql.Bit, Boolean(perm.approval))
      .input('approvalCode', sql.NVarChar(100), perm.approval || null)
      .input('riskLevel', sql.NVarChar(20), perm.risk || null)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Permissions WHERE permission_code = @code)
          INSERT INTO Permissions (permission_code, module, action, description, requires_approval, approval_permission_code, risk_level)
          VALUES (@code, @module, @action, @description, @requiresApproval, @approvalCode, @riskLevel)
        ELSE
          UPDATE Permissions
          SET module = @module,
              action = @action,
              description = @description,
              requires_approval = @requiresApproval,
              approval_permission_code = @approvalCode,
              risk_level = @riskLevel
          WHERE permission_code = @code
      `);
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_GRANTS)) {
    for (const permissionCode of permissionCodes) {
      await db.request()
        .input('roleCode', sql.NVarChar(50), roleCode)
        .input('permissionCode', sql.NVarChar(100), permissionCode)
        .query(`
          INSERT INTO RolePermissions (role_id, permission_id)
          SELECT r.role_id, p.permission_id
          FROM Roles r
          CROSS JOIN Permissions p
          WHERE r.role_code = @roleCode
            AND p.permission_code = @permissionCode
            AND NOT EXISTS (
              SELECT 1
              FROM RolePermissions rp
              WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
            )
        `);
    }
  }

  await db.request().query(`
    INSERT INTO RolePermissions (role_id, permission_id)
    SELECT r.role_id, p.permission_id
    FROM Roles r
    CROSS JOIN Permissions p
    WHERE r.role_code = 'yard_manager'
      AND NOT EXISTS (
        SELECT 1
        FROM RolePermissions rp
        WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
      )
  `);
}

// GET — ดึง Permissions ทั้งหมด + RolePermissions matrix
export async function GET() {
  try {
    const db = await getDb();
    await ensureGranularRbac(db);

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
