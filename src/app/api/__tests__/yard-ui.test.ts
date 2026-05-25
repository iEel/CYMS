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
});
