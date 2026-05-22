import fs from 'fs';
import path from 'path';

describe('Customer Portal UI', () => {
  const root = process.cwd();
  const portalBookingsSource = () => fs.readFileSync(path.join(root, 'src/app/(portal)/portal/bookings/page.tsx'), 'utf8');

  it('uses EIR In/Out as the direct document action instead of a separate view button', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(portal)/portal/containers/page.tsx'), 'utf8');

    expect(source).toContain('<FileText size={12} /> {doc.label}');
    expect(source).not.toContain('<Eye size={12} /> ดู');
    expect(source).not.toContain('title={`ดู ${doc.label}`}');
  });

  it('exposes customer booking creation and booking activity progress on the portal booking page', () => {
    const source = portalBookingsSource();

    expect(source).toContain('สร้าง Booking');
    expect(source).toContain('รอพนักงานยืนยัน');
    expect(source).toContain('ภาพรวม Booking');
    expect(source).toContain('กิจกรรมตู้ใน Booking');
    expect(source).toContain("fetch('/api/portal/bookings'");
  });

  it('shows customer scoped notifications on the portal overview', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(portal)/portal/page.tsx'), 'utf8');

    expect(source).toContain('/api/portal/notifications');
    expect(source).toContain('/api/portal/notification-preferences');
    expect(source).toContain('การแจ้งเตือนล่าสุด');
    expect(source).toContain('ตั้งค่าการแจ้งเตือน');
    expect(source).toContain('reefer_exception');
    expect(source).toContain('/portal/reefer?container_id=');
  });

  it('shows a read-only customer audit trail on booking detail', () => {
    const source = portalBookingsSource();

    expect(source).toContain('/api/portal/timeline');
    expect(source).toContain('Audit Trail');
    expect(source).toContain('read-only');
  });

  it('lets customers request booking amendments instead of editing bookings directly', () => {
    const source = portalBookingsSource();

    expect(source).toContain('/api/portal/bookings/amendments');
    expect(source).toContain('ขอแก้ไข Booking');
    expect(source).toContain('ขอยกเลิก Booking');
  });

  it('lets customers upload booking documents from booking detail', () => {
    const source = portalBookingsSource();

    expect(source).toContain('/api/portal/bookings/documents');
    expect(source).toContain('อัปโหลดเอกสาร');
    expect(source).toContain('เอกสารที่ส่งแล้ว');
  });
});
