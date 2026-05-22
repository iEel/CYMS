import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Gate-Out optional booking UI copy', () => {
  it('labels missing booking as optional instead of required', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

    expect(source).toContain('Booking (ถ้ามี)');
    expect(source).toContain('ไม่ระบุ Booking');
    expect(source).toContain('ไม่มี Booking ก็ปล่อยได้');
    expect(source).not.toContain('ยังไม่ได้ผูก Booking');
    expect(source).not.toContain('เลือก Booking เพื่อคุมการปล่อยตู้');
  });
});
