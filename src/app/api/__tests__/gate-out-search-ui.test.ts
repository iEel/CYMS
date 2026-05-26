import fs from 'fs';
import path from 'path';

describe('Gate Out focused search UI', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

  it('uses focused container or booking search copy and endpoint', () => {
    expect(gateOut).toContain('ค้นหาเลขตู้ หรือ Booking No.');
    expect(gateOut).toContain('/api/gate/out-search');
    expect(gateOut).not.toContain('พิมพ์เลขตู้ หรือสายเรือ...');
  });

  it('renders container and booking result groups', () => {
    expect(gateOut).toContain("result_type: 'container'");
    expect(gateOut).toContain("result_type: 'booking'");
    expect(gateOut).toContain('Container Match');
    expect(gateOut).toContain('Booking Match');
    expect(gateOut).toContain('พบ Booking แต่ยังไม่มีตู้ในลานสำหรับปล่อยออก');
  });

  it('selects container and booking context together from booking results', () => {
    expect(gateOut).toContain('selectContainerForGateOut(container, result.booking)');
    expect(gateOut).toContain('initialBooking?: GateOutBooking | null');
    expect(gateOut).toContain('setSelectedBooking(initialBooking)');
  });
});
