import fs from 'fs';
import path from 'path';

describe('Yard management UI', () => {
  const root = process.cwd();
  const clientPath = 'src/app/(dashboard)/yard/YardPageClient.tsx';

  it('keeps operational yard views compact before the Bay/3D canvas', () => {
    const source = fs.readFileSync(path.join(root, clientPath), 'utf8');

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
    const source = fs.readFileSync(path.join(root, clientPath), 'utf8');
    const selectedPanel = fs.readFileSync(path.join(root, 'src/app/(dashboard)/yard/components/YardSelectedContainerPanel.tsx'), 'utf8');

    expect(source).toContain('selectedContainerActionPanel');
    expect(source).toContain('YardSelectedContainerPanel');
    expect(selectedPanel).toContain('ตู้ที่เลือกในลาน');
    expect(selectedPanel).toContain('เปิดรายละเอียด');
    expect(selectedPanel).toContain('Timeline');
    expect(selectedPanel).toContain('Booking');
    expect(selectedPanel).toContain('Billing');
  });

  it('keeps the yard view live when work orders change', () => {
    const source = fs.readFileSync(path.join(root, clientPath), 'utf8');

    expect(source).toContain('/api/operations/stream?yard_id=');
    expect(source).toContain('Live Yard');
    expect(source).toContain('lastLiveRefreshAt');
    expect(source).toContain('ordersEventCountRef');
    expect(source).toContain('fetchData();');
  });

  it('keeps the operational yard route dynamic so live state is not served from stale route cache', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/yard/page.tsx'), 'utf8');

    expect(source).toContain("export const dynamic = 'force-dynamic';");
  });

  it('avoids nested button semantics in yard search results', () => {
    const source = fs.readFileSync(path.join(root, 'src/components/yard/ContainerSearch.tsx'), 'utf8');

    expect(source).not.toContain('role="button"');
    expect(source).toContain('aria-label={`Locate ${c.container_number} in 3D`}');
    expect(source).toContain('onClick={(e) => { e.stopPropagation(); handleSelect(c); }}');
  });
});
