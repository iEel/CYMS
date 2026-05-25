import fs from 'fs';
import path from 'path';

describe('Yard management UI', () => {
  const root = process.cwd();

  it('keeps operational yard views compact before the Bay/3D canvas', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/yard/page.tsx'), 'utf8');

    expect(source).toContain('useCompactYardStats');
    expect(source).toContain('yardStats');
    expect(source).toContain('compactYardStats');
    expect(source).toContain('grid-cols-4');
    expect(source).toContain('lg:grid-cols-7');
  });

  it('makes the 3D yard color legend match the actual container color mode', () => {
    const source = fs.readFileSync(path.join(root, 'src/components/yard/YardViewer3D.tsx'), 'utf8');

    expect(source).toContain('type YardColorMode');
    expect(source).toContain('colorMode');
    expect(source).toContain('setColorMode');
    expect(source).toContain('สีตู้');
    expect(source).toContain('สายเรือ');
    expect(source).toContain('สถานะ');
    expect(source).toContain('THREE.PCFShadowMap');
    expect(source).not.toContain('THREE.PCFSoftShadowMap');
  });

  it('adds practical 3D camera controls for yard operators', () => {
    const source = fs.readFileSync(path.join(root, 'src/components/yard/YardViewer3D.tsx'), 'utf8');

    expect(source).toContain('resetYardCamera');
    expect(source).toContain('showTopDownView');
    expect(source).toContain('focusSelectedContainer');
    expect(source).toContain('รีเซ็ตมุมกล้อง');
    expect(source).toContain('มุมมองด้านบน');
    expect(source).toContain('โฟกัสตู้ที่เลือก');
  });

  it('turns 3D selected containers into an actionable yard panel', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/yard/page.tsx'), 'utf8');

    expect(source).toContain('selectedContainerActionPanel');
    expect(source).toContain('ตู้ที่เลือกในลาน');
    expect(source).toContain('เปิดรายละเอียด');
    expect(source).toContain('Timeline');
    expect(source).toContain('Booking');
    expect(source).toContain('Billing');
  });
});
