import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Transport Portal UI shell', () => {
  it('adds a separate transport route and layout guarded by transport portal roles', () => {
    const layout = readSource('src/app/(transport)/layout.tsx');
    const page = readSource('src/app/(transport)/transport/page.tsx');

    expect(layout).toContain('customerPortalRole');
    expect(layout).toContain('trucking_coordinator');
    expect(layout).toContain('driver_user');
    expect(layout).toContain('/portal');
    expect(layout).toContain('/dashboard');
    expect(page).toContain('TransportDashboard');
  });

  it('keeps transport navigation operational and free from customer billing/inventory menus', () => {
    const layout = readSource('src/app/(transport)/layout.tsx');
    const dashboard = readSource('src/components/transport/TransportDashboard.tsx');

    expect(layout).toContain('งานขนส่ง');
    expect(layout).not.toContain('ใบแจ้งหนี้');
    expect(layout).not.toContain('ตู้คอนเทนเนอร์');
    expect(layout).not.toContain('/portal/invoices');
    expect(layout).not.toContain('/portal/containers');
    expect(dashboard).toContain('/api/transport/jobs');
    expect(dashboard).toContain('/api/transport/capabilities');
    expect(dashboard).toContain('งานของฉัน');
    expect(dashboard).toContain('Driver Copy');
    expect(dashboard).toContain('Trucking Copy');
    expect(dashboard).not.toContain('invoice');
    expect(dashboard).not.toContain('billing');
  });
});
