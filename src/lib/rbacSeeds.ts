import sql from 'mssql';

type RoleSeed = {
  code: string;
  name: string;
};

type PermissionSeed = {
  code: string;
  module: string;
  action: string;
  description: string;
  approval?: string;
  risk?: string;
};

export const ROLE_SEEDS: RoleSeed[] = [
  { code: 'yard_manager', name: 'ผู้จัดการลาน / Admin' },
  { code: 'supervisor', name: 'Supervisor / ผู้อนุมัติ' },
  { code: 'gate_clerk', name: 'Gate Clerk / พนักงานประตู' },
  { code: 'surveyor', name: 'Surveyor / พนักงานตรวจสภาพ' },
  { code: 'yard_planner', name: 'Yard Planner / ผู้วางแผนลาน' },
  { code: 'rs_driver', name: 'คนขับรถยก' },
  { code: 'billing_officer', name: 'Billing / บัญชีการเงิน' },
  { code: 'customer', name: 'ลูกค้า' },
];

export const PERMISSION_SEEDS: PermissionSeed[] = [
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
  { code: 'reefer.check.read', module: 'reefer', action: 'check_read', description: 'ดูคิวและประวัติการตรวจอุณหภูมิตู้เย็น' },
  { code: 'reefer.check.record', module: 'reefer', action: 'check_record', description: 'บันทึกผลตรวจอุณหภูมิตู้เย็นพร้อมหลักฐานรูปถ่าย' },
  { code: 'reefer.exception.manage', module: 'reefer', action: 'exception_manage', description: 'รับทราบ แก้ไข และปิด exception อุณหภูมิตู้เย็น', risk: 'high' },
  { code: 'reefer.policy.manage', module: 'reefer', action: 'policy_manage', description: 'กำหนดรอบตรวจและช่วงอุณหภูมิตู้เย็น', risk: 'high' },
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
  { code: 'documents.attachment.view', module: 'documents', action: 'attachment_view', description: 'ดูเอกสารแนบของรายการที่มีสิทธิ์' },
  { code: 'documents.attachment.upload', module: 'documents', action: 'attachment_upload', description: 'อัปโหลดหรือผูกเอกสารแนบกับรายการที่มีสิทธิ์' },
  { code: 'booking.manage', module: 'bookings', action: 'manage', description: 'จัดการ Booking และยอดรับ/ปล่อยตู้' },
  { code: 'mnr.eor.create', module: 'mnr', action: 'eor_create', description: 'สร้างใบประเมินซ่อม EOR' },
  { code: 'mnr.eor.approve', module: 'mnr', action: 'eor_approve', description: 'อนุมัติหรือปฏิเสธใบ EOR', risk: 'high' },
  { code: 'mnr.eor.update', module: 'mnr', action: 'eor_update', description: 'อัปเดตสถานะงานซ่อมและราคาจริง' },
  { code: 'mnr.cedex.manage', module: 'mnr', action: 'cedex_manage', description: 'จัดการรหัสความเสียหาย CEDEX', risk: 'high' },
  { code: 'integration.send', module: 'edi', action: 'send', description: 'ส่ง EDI หรือข้อมูล integration ออกนอกระบบ' },
  { code: 'integration.logs.view', module: 'edi', action: 'integration_logs_view', description: 'ดู integration log และผลการส่งข้อมูล' },
  { code: 'reports.view', module: 'reports', action: 'view', description: 'ดูรายงานและส่งออก Excel' },
  { code: 'audit_trail.read', module: 'audit_trail', action: 'read', description: 'ดูประวัติการใช้งานและ audit trail' },
  { code: 'document_templates.view', module: 'document_templates', action: 'view', description: 'ดูรายการและ preview template เอกสาร' },
  { code: 'document_templates.create', module: 'document_templates', action: 'create', description: 'สร้างหรือ duplicate template เอกสาร' },
  { code: 'document_templates.update_draft', module: 'document_templates', action: 'update_draft', description: 'แก้ไข draft version ของ template เอกสาร' },
  { code: 'document_templates.publish', module: 'document_templates', action: 'publish', description: 'publish, set default หรือ deactivate template เอกสาร', risk: 'high' },
  { code: 'document_templates.export', module: 'document_templates', action: 'export', description: 'export template JSON' },
  { code: 'document_templates.import', module: 'document_templates', action: 'import', description: 'import template JSON', risk: 'high' },
  { code: 'document_templates.test_print', module: 'document_templates', action: 'test_print', description: 'ทดสอบพิมพ์ template เอกสาร' },
  { code: 'settings.manage', module: 'settings', action: 'manage', description: 'ตั้งค่าระบบ' },
  { code: 'permissions.manage', module: 'settings', action: 'permissions_manage', description: 'จัดการสิทธิ์และ role ของผู้ใช้งาน', risk: 'high' },
];

export const ROLE_GRANTS: Record<string, string[]> = {
  gate_clerk: ['gate.in', 'gate.out', 'gate.eir.print', 'documents.attachment.view', 'documents.attachment.upload', 'booking.manage', 'integration.logs.view', 'reefer.check.read'],
  surveyor: ['survey.inspect', 'survey.damage.update', 'survey.grade.change', 'yard.location.assign', 'mnr.eor.create', 'reports.view', 'documents.attachment.view', 'documents.attachment.upload', 'reefer.check.read', 'reefer.check.record', 'reefer.exception.manage'],
  yard_planner: ['yard.slot.move', 'yard.location.assign', 'booking.manage', 'reports.view', 'reefer.check.read'],
  rs_driver: ['yard.slot.move', 'yard.location.assign'],
  billing_officer: [
    'billing.invoice.create',
    'billing.payment.receive',
    'billing.waive.request',
    'billing.credit_note.create',
    'documents.attachment.view',
    'document_templates.view',
    'document_templates.test_print',
    'document_templates.export',
    'integration.logs.view',
    'reports.view',
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
    'reefer.check.read',
    'reefer.check.record',
    'reefer.exception.manage',
    'reefer.policy.manage',
    'billing.invoice.create',
    'billing.payment.receive',
    'billing.waive.request',
    'billing.waive.approve',
    'billing.credit_note.create',
    'billing.credit_note.approve',
    'billing.invoice.cancel',
    'billing.receipt.cancel',
    'documents.attachment.view',
    'documents.attachment.upload',
    'booking.manage',
    'mnr.eor.create',
    'mnr.eor.approve',
    'mnr.eor.update',
    'mnr.cedex.manage',
    'integration.send',
    'integration.logs.view',
    'reports.view',
    'audit_trail.read',
    'document_templates.view',
    'document_templates.create',
    'document_templates.update_draft',
    'document_templates.publish',
    'document_templates.export',
    'document_templates.import',
    'document_templates.test_print',
  ],
};

export async function syncGranularRbac(db: sql.ConnectionPool) {
  await db.request().query(`
    UPDATE Permissions
    SET permission_code = CONCAT(module, '.', action, '.', permission_id)
    WHERE permission_code IS NULL;
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
