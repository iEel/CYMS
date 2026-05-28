import fs from 'fs';
import path from 'path';

describe('Gate Out business context UI', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
  const gateOutStatusRail = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/components/GateOutStatusRail.tsx'), 'utf8');
  const gateOutVisibilityPreview = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/hooks/useGateOutVisibilityPreview.ts'), 'utf8');

  it('shows business relationship labels for the selected container flow', () => {
    expect(gateOut).toContain('GateOutSelectedStatusCards');
    expect(gateOutStatusRail).toContain('Business Relationship');
    expect(gateOutStatusRail).toContain('Booking Customer');
    expect(gateOutStatusRail).toContain('Shipping Line');
    expect(gateOutStatusRail).toContain('Forwarder');
    expect(gateOutStatusRail).toContain('Shipper');
    expect(gateOutStatusRail).toContain('Consignee');
    expect(gateOutStatusRail).toContain('Trucking Company');
    expect(gateOutStatusRail).toContain('Bill To Customer');
  });

  it('wires Gate Out to the portal visibility preview endpoint', () => {
    expect(gateOutStatusRail).toContain('Portal Visibility Preview');
    expect(gateOutVisibilityPreview).toContain('/api/gate/visibility-preview');
    expect(gateOut).toContain('visibilityPreview');
    expect(gateOutVisibilityPreview).toContain('yard_id: yardId');
    expect(gateOutStatusRail).toContain('row.customerName');
    expect(gateOutVisibilityPreview).toContain('if (!controller.signal.aborted) setVisibilityPreview(json.preview)');
  });
});
