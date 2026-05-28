import fs from 'fs';
import path from 'path';

describe('Gate Out focused search UI', () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const gateOut = read('src/app/(dashboard)/gate/GateOutTab.tsx');
  const searchSection = read('src/app/(dashboard)/gate/components/GateOutSearchSection.tsx');
  const searchHook = read('src/app/(dashboard)/gate/hooks/useGateOutSearch.ts');

  it('uses focused container or booking search copy and endpoint', () => {
    expect(gateOut).toContain('<GateOutSearchSection');
    expect(searchSection).toContain('ค้นหาเลขตู้ หรือ Booking No.');
    expect(searchHook).toContain('/api/gate/out-search');
    expect(searchSection).not.toContain('พิมพ์เลขตู้ หรือสายเรือ...');
  });

  it('renders container and booking result groups', () => {
    expect(searchSection).toContain("result_type: 'container'");
    expect(searchSection).toContain("result_type === 'booking'");
    expect(searchSection).toContain('Container Match');
    expect(searchSection).toContain('Booking Match');
    expect(searchSection).toContain('พบ Booking แต่ยังไม่มีตู้ในลานสำหรับปล่อยออก');
  });

  it('selects container and booking context together from booking results', () => {
    expect(gateOut).toContain('selectContainerForGateOut(container, result.booking)');
    expect(gateOut).toContain('initialBooking?: GateOutBooking | null');
    expect(gateOut).toContain('setSelectedBooking(initialBooking)');
  });
});
