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
    const jobCard = readSource('src/components/transport/TransportJobCard.tsx');
    const actionDialog = readSource('src/components/transport/TransportActionDialog.tsx');
    const activityDrawer = readSource('src/components/transport/TransportActivityDrawer.tsx');
    const transportActionSources = [dashboard, jobCard, actionDialog, activityDrawer];

    expect(layout).toContain('งานขนส่ง');
    expect(layout).not.toContain('ใบแจ้งหนี้');
    expect(layout).not.toContain('ตู้คอนเทนเนอร์');
    expect(layout).not.toContain('/portal/invoices');
    expect(layout).not.toContain('/portal/containers');
    expect(dashboard).toContain('/api/transport/jobs');
    expect(dashboard).toContain('/api/transport/capabilities');
    expect(dashboard).toContain('/api/transport/actions');
    expect(dashboard).toContain('/api/transport/activity');
    expect(dashboard).toContain('งานของฉัน');
    expect(dashboard).toContain('Driver Copy');
    expect(dashboard).toContain('Trucking Copy');
    expect(jobCard).toContain('confirm_job');
    expect(jobCard).toContain('mark_arrived');
    expect(jobCard).toContain('report_issue');
    expect(jobCard).toContain('add_proof');
    expect(dashboard).not.toContain('invoice');
    expect(dashboard).not.toContain('billing');
    expect(dashboard).not.toContain('/api/billing');
    expect(jobCard).not.toContain('invoice');
    expect(jobCard).not.toContain('billing');
    for (const source of transportActionSources) {
      expect(source).not.toMatch(/invoice|billing|internal|\/api\/billing/i);
    }
  });

  it('renders transport actions from backend-provided availability and keeps proof upload flow ordered', () => {
    const dashboard = readSource('src/components/transport/TransportDashboard.tsx');
    const jobCard = readSource('src/components/transport/TransportJobCard.tsx');
    const actionDialog = readSource('src/components/transport/TransportActionDialog.tsx');
    const activityDrawer = readSource('src/components/transport/TransportActivityDrawer.tsx');

    expect(jobCard).toMatch(/job\.availableActions\.map\(\s*action\s*=>\s*\(/);
    expect(jobCard).toContain('onAction(job, action)');
    expect(jobCard.indexOf('job.availableActions.map')).toBeLessThan(jobCard.indexOf('actionLabels[action]'));

    expect(actionDialog.indexOf("fetch('/api/uploads'")).toBeGreaterThan(-1);
    expect(actionDialog.indexOf("fetch('/api/uploads'")).toBeLessThan(actionDialog.indexOf('fetch(actionEndpoint'));
    expect(actionDialog).toContain('const uploadBody = await parseJsonResponse(uploadResponse)');
    expect(actionDialog).toContain('proofUrl = uploadBody.url');
    expect(actionDialog).toContain('proof_url: proofUrl');
    expect(actionDialog).not.toContain('proof_type');

    expect(dashboard).toContain('useRef');
    expect(dashboard).toContain('requestSequenceRef');
    expect(dashboard).toContain('mountedRef');
    expect(actionDialog).toContain('if (submitting) return');
    expect(actionDialog).toContain('disabled={submitting}');
    expect(actionDialog).toContain('role="dialog"');
    expect(actionDialog).toContain('aria-modal="true"');
    expect(actionDialog).toContain('aria-labelledby="transport-action-dialog-title"');
    expect(activityDrawer).toContain('role="dialog"');
    expect(activityDrawer).toContain('aria-modal="true"');
    expect(activityDrawer).toContain('aria-labelledby="transport-activity-drawer-title"');
  });
});
