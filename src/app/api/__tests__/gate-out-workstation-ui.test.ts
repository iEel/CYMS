import fs from 'fs';
import path from 'path';

describe('Gate Out workstation UI', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
  const gateOutStatusRail = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/components/GateOutStatusRail.tsx'), 'utf8');

  it('uses a two-column workstation layout with primary work and a side rail', () => {
    expect(gateOut).toContain('gate-out-workstation-shell');
    expect(gateOut).toContain('gate-out-primary-workspace');
    expect(gateOut).toContain('<GateOutStatusRail');
    expect(gateOut).toContain('xl:grid-cols-[minmax(0,1fr)_340px]');
  });

  it('makes search and pending jobs the first primary actions', () => {
    const workspaceStart = gateOut.indexOf('gate-out-primary-workspace');
    const pendingPanel = gateOut.indexOf('{gateOutPendingJobsPanel}', workspaceStart);
    const searchLabel = gateOut.indexOf('ค้นหาตู้ในลาน', workspaceStart);
    const selectedContainer = gateOut.indexOf('<GateOutSelectedStatusCards', workspaceStart);

    expect(workspaceStart).toBeGreaterThan(-1);
    expect(pendingPanel).toBeGreaterThan(workspaceStart);
    expect(searchLabel).toBeGreaterThan(pendingPanel);
    expect(selectedContainer).toBeGreaterThan(searchLabel);
  });

  it('moves readiness, warnings, and visibility preview into a compact side rail', () => {
    const sideRailStart = gateOut.indexOf('<GateOutStatusRail');

    expect(sideRailStart).toBeGreaterThan(-1);
    expect(gateOut.indexOf('gateOutDecisionSignals={gateOutDecisionSignals}', sideRailStart)).toBeGreaterThan(sideRailStart);
    expect(gateOut.indexOf('gateOutGuardrails={gateOutGuardrails}', sideRailStart)).toBeGreaterThan(sideRailStart);
    expect(gateOut.indexOf('visibilityPreview={visibilityPreview}', sideRailStart)).toBeGreaterThan(sideRailStart);
  });

  it('does not render the old full-width guardrail and decision stack', () => {
    expect(gateOut).not.toContain('<GateGuardrailPanel title="Gate-Out operational guardrails" snapshot={gateOutGuardrails} />');
    expect(gateOut).not.toContain('<GateDecisionBar signals={gateOutDecisionSignals} />');
  });

  it('keeps Gate Out workflow state split into focused units', () => {
    expect(gateOut).toContain('useGateOutSearch');
    expect(gateOut).toContain('useGateOutVisibilityPreview');
    expect(gateOut.length).toBeLessThan(52000);
  });

  it('keeps Gate Out status rail presentational', () => {
    expect(gateOutStatusRail).not.toContain("fetch('/api/billing/invoices'");
    expect(gateOutStatusRail).not.toContain('createGateOutClearance');
  });
});
