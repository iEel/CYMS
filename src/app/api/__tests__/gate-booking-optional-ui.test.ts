import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Gate-Out optional booking UI copy', () => {
  it('labels missing booking as optional instead of required', () => {
    const parent = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
    const statusCards = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/components/GateOutStatusRail.tsx'), 'utf8');

    expect(parent).toContain('<GateOutSelectedStatusCards');
    expect(statusCards).toContain('Booking (ถ้ามี)');
    expect(statusCards).toContain('ไม่ระบุ Booking');
    expect(statusCards).toContain('ไม่มี Booking ก็ปล่อยได้');
    expect(statusCards).not.toContain('ยังไม่ได้ผูก Booking');
    expect(statusCards).not.toContain('เลือก Booking เพื่อคุมการปล่อยตู้');
  });
});
