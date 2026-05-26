import fs from 'fs';
import path from 'path';

describe('customer portal defaults', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'scripts/migrate-runtime-core-schema.js'), 'utf8');
  const api = fs.readFileSync(path.join(process.cwd(), 'src/app/api/settings/customers/route.ts'), 'utf8');
  const ui = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/settings/CustomerMaster.tsx'), 'utf8');

  it('adds customer portal default columns through migration', () => {
    expect(migration).toContain("COL_LENGTH('Customers', 'portal_enabled')");
    expect(migration).toContain("COL_LENGTH('Customers', 'portal_default_permission_scope')");
  });

  it('reads and writes portal defaults in customer settings API', () => {
    expect(api).toContain('portal_enabled');
    expect(api).toContain('portal_default_permission_scope');
    expect(api).toContain('customer_portal_visibility_update');
  });

  it('keeps PUT portal updates conditional for legacy customer clients', () => {
    expect(api).toContain("const portalEnabledIncluded = Object.prototype.hasOwnProperty.call(body, 'portal_enabled')");
    expect(api).toContain("const portalDefaultScopeIncluded = Object.prototype.hasOwnProperty.call(body, 'portal_default_permission_scope')");
    expect(api).toContain('${portalUpdateSql}');
  });

  it('keeps partial PUT portal field updates independent', () => {
    expect(api).toContain("if (portalEnabledIncluded) portalUpdateClauses.push('portal_enabled = @portalEnabled')");
    expect(api).toContain("if (portalDefaultScopeIncluded) portalUpdateClauses.push('portal_default_permission_scope = @portalDefaultPermissionScope')");
    expect(api).toContain('const portalChanged =');
  });

  it('renders EIR field visibility toggles in customer master', () => {
    expect(ui).toContain('Customer Portal');
    expect(ui).toContain('แสดงเกรดตู้ใน EIR ให้ลูกค้า');
    expect(ui).toContain('damage_photos');
    expect(ui).toContain('truck_plate_full');
  });

  it('renders module and reefer portal settings in customer master', () => {
    expect(ui).toContain('เปิดเมนูตู้เย็น Reefer ให้ลูกค้า');
    expect(ui).toContain('แสดงรูปหลักฐานอุณหภูมิ');
    expect(ui).toContain('แสดง Reefer Exception');
    expect(ui).toContain('ดาวน์โหลด Temperature Log');
    expect(ui).toContain('ให้ลูกค้าสอบถาม Reefer Exception');
  });

  it('normalizes portal module and reefer defaults in customer settings API', () => {
    expect(api).toContain('modules');
    expect(api).toContain('reefer');
    expect(api).toContain('show_photo_evidence');
    expect(api).toContain('show_exceptions');
    expect(api).toContain('download_temperature_log');
  });
});
