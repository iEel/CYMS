import fs from 'fs';
import path from 'path';

describe('Billing responsive layout', () => {
  const root = process.cwd();

  it('does not reserve desktop sidebar space below the large breakpoint', () => {
    const layout = fs.readFileSync(path.join(root, 'src/app/(dashboard)/layout.tsx'), 'utf8');
    const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(layout).toContain('lg:ml-[260px]');
    expect(layout).toContain('lg:ml-[72px]');
    expect(layout).toContain('min-w-0');
    expect(layout).toContain('data-layout="dashboard-shell"');
    expect(layout).toContain('mobileSidebarOpen');
    expect(layout).toContain('onOpenMobileMenu');
    expect(layout).toContain('lg:hidden');
    expect(layout).not.toContain("style={{ marginLeft:");
    expect(sidebar).toContain('hidden lg:flex');
    expect(sidebar).toContain('mobileOpen');
    expect(sidebar).toContain('onMobileClose');
    expect(sidebar).toContain('data-layout="dashboard-sidebar"');
  });

  it('keeps the billing header, tab rail, and invoice rows usable on narrow screens', () => {
    const topbar = fs.readFileSync(path.join(root, 'src/components/layout/Topbar.tsx'), 'utf8');
    const billing = fs.readFileSync(path.join(root, 'src/app/(dashboard)/billing/page.tsx'), 'utf8');

    expect(topbar).toContain('overflow-x-hidden');
    expect(topbar).toContain('Menu');
    expect(topbar).toContain('onOpenMobileMenu');
    expect(topbar).toContain('aria-label="เปิดเมนูหลัก"');
    expect(topbar).toContain('data-layout="dashboard-topbar"');
    expect(topbar).toContain('min-w-0 flex-1');
    expect(topbar).toContain('shrink-0');
    expect(billing).toContain('data-page="billing"');
    expect(billing).toContain('overflow-x-auto');
    expect(billing).toContain('shrink-0');
    expect(billing).toContain('flex-col sm:flex-row');
    expect(billing).toContain('flex-col lg:flex-row');
    expect(billing).toContain('flex-wrap');
  });
});
