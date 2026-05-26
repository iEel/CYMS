import fs from 'fs';
import path from 'path';

describe('Gate Out business context UI', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

  it('shows business relationship labels for the selected container flow', () => {
    expect(gateOut).toContain('Business Relationship');
    expect(gateOut).toContain('Booking Customer');
    expect(gateOut).toContain('Shipping Line');
    expect(gateOut).toContain('Forwarder');
    expect(gateOut).toContain('Shipper');
    expect(gateOut).toContain('Consignee');
    expect(gateOut).toContain('Trucking Company');
    expect(gateOut).toContain('Bill To Customer');
  });

  it('wires Gate Out to the portal visibility preview endpoint', () => {
    expect(gateOut).toContain('Portal Visibility Preview');
    expect(gateOut).toContain('/api/gate/visibility-preview');
    expect(gateOut).toContain('visibilityPreview');
    expect(gateOut).toContain('row.customerName');
    expect(gateOut).toContain('if (!controller.signal.aborted) setVisibilityPreview(json.preview)');
  });
});
