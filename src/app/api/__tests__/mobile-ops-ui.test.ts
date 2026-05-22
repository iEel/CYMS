import fs from 'fs';
import path from 'path';

describe('Operational mobile mode UI', () => {
  const root = process.cwd();

  it('adds a mobile-first operations hub for field workflows', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/mobile-ops/page.tsx'), 'utf8');

    expect(source).toContain('โหมดมือถือ');
    expect(source).toContain('/gate');
    expect(source).toContain('/yard');
    expect(source).toContain('/reefer');
    expect(source).toContain('/mnr');
    expect(source).toContain('Gate');
    expect(source).toContain('Reefer');
    expect(source).toContain('M&R');
  });

  it('links mobile ops from the staff sidebar', () => {
    const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(sidebar).toContain('/mobile-ops');
    expect(sidebar).toContain('Mobile Ops');
    expect(sidebar).toContain('gate.in');
    expect(sidebar).toContain('reefer.check.record');
  });
});
