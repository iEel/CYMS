import fs from 'fs';
import path from 'path';

describe('Reefer monitoring UI', () => {
  const root = process.cwd();

  it('adds a staff reefer page with check recording and policy controls', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/reefer/page.tsx'), 'utf8');

    expect(source).toContain('/api/reefer/checks');
    expect(source).toContain('/api/reefer/policies');
    expect(source).toContain('/api/reefer/exceptions');
    expect(source).toContain('/api/reefer/plug-plan');
    expect(source).toContain("offlineFetch('/api/reefer/checks'");
    expect(source).toContain("operation: 'reefer_check'");
    expect(source).toContain('โหมดเดินตรวจ');
    expect(source).toContain('Plug Planning');
    expect(source).toContain('projected_shortage');
    expect(source).toContain('บันทึกอุณหภูมิ');
    expect(source).toContain('กำหนดรอบตรวจ');
    expect(source).toContain('Exception');
    expect(source).toContain('escalation_level');
    expect(source).toContain('Escalation');
    expect(source).toContain('openHistory');
    expect(source).toContain('ReeferCheckHistory');
    expect(source).toContain('ประวัติการตรวจ');
    expect(source).toContain('checked_by_name');
    expect(source).toContain('formatYardPosition');
    expect(source).toContain('ตำแหน่งปัจจุบัน');
    expect(source).toContain('Bay');
    expect(source).toContain('Row');
    expect(source).toContain('Tier');
  });

  it('adds customer portal navigation and read-only reefer tracking', () => {
    const layout = fs.readFileSync(path.join(root, 'src/app/(portal)/layout.tsx'), 'utf8');
    const source = fs.readFileSync(path.join(root, 'src/app/(portal)/portal/reefer/page.tsx'), 'utf8');

    expect(layout).toContain('/portal/reefer');
    expect(layout).toContain('ตู้เย็น');
    expect(source).toContain('/api/portal/reefer');
    expect(source).toContain('read-only');
    expect(source).toContain('ประวัติตรวจอุณหภูมิ');
  });
});
