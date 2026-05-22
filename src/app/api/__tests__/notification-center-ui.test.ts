import fs from 'fs';
import path from 'path';

describe('Notification center UI', () => {
  const root = process.cwd();

  it('adds a full notification center page with filters and mark-read action', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/notifications/page.tsx'), 'utf8');

    expect(source).toContain('Notification Center');
    expect(source).toContain('/api/notifications');
    expect(source).toContain('Unread only');
    expect(source).toContain('อ่านทั้งหมดแล้ว');
    expect(source).toContain('sourceFilter');
  });

  it('links the topbar notification dropdown to the full center', () => {
    const source = fs.readFileSync(path.join(root, 'src/components/layout/Topbar.tsx'), 'utf8');

    expect(source).toContain('/notifications');
    expect(source).toContain('ดูทั้งหมด');
  });
});
