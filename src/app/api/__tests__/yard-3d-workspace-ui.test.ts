import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Yard 3D workspace UI', () => {
  it('uses status colors as the default operational color mode', () => {
    const source = read('src/components/yard/YardViewer3D.tsx');
    expect(source).toContain("useState<YardColorMode>('status')");
  });

  it('uses compact legend instead of rendering long shipping names directly in YardViewer3D', () => {
    const source = read('src/components/yard/YardViewer3D.tsx');
    const legend = read('src/components/yard/Yard3DLegend.tsx');

    expect(source).toContain('Yard3DLegend');
    expect(legend).toContain('maxVisibleItems');
    expect(legend).toContain('overflowCount');
  });

  it('makes 3D a taller workspace instead of a small preview panel', () => {
    const source = read('src/components/yard/YardViewer3D.tsx');
    expect(source).toContain('min-h-[520px]');
    expect(source).toContain('h-[min(72vh,760px)]');
  });

  it('uses clearer live sync copy on the Yard page', () => {
    const source = read('src/app/(dashboard)/yard/YardPageClient.tsx');
    expect(source).toContain('เชื่อมต่ออยู่');
    expect(source).toContain('ซิงก์ล่าสุด');
    expect(source).not.toContain('อัปเดต {lastLiveRefreshLabel}');
  });

  it('keeps camera controls discoverable with labels and a disabled focus hint', () => {
    const toolbar = read('src/components/yard/Yard3DCameraToolbar.tsx');
    expect(toolbar).toContain('ภาพรวม');
    expect(toolbar).toContain('Top');
    expect(toolbar).toContain('เลือกตู้ก่อน');
  });
});
