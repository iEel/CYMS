import fs from 'fs';
import path from 'path';

describe('Booking approval inbox UI', () => {
  it('adds a staff inbox for pending customer booking requests', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/edi/page.tsx'), 'utf8');

    expect(source).toContain('/api/edi/bookings/approval');
    expect(source).toContain('Booking Approval');
    expect(source).toContain('รอพนักงานยืนยัน');
    expect(source).toContain('อนุมัติ');
    expect(source).toContain('ปฏิเสธ');
  });
});
