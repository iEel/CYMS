import fs from 'fs';
import path from 'path';

describe('Gate Out workstation UI', () => {
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

  it('uses a two-column workstation layout with primary work and a side rail', () => {
    expect(gateOut).toContain('gate-out-workstation-shell');
    expect(gateOut).toContain('gate-out-primary-workspace');
    expect(gateOut).toContain('gate-out-side-rail');
    expect(gateOut).toContain('xl:grid-cols-[minmax(0,1fr)_340px]');
  });

  it('makes search and pending jobs the first primary actions', () => {
    const workspaceStart = gateOut.indexOf('gate-out-primary-workspace');
    const pendingPanel = gateOut.indexOf('{gateOutPendingJobsPanel}', workspaceStart);
    const searchLabel = gateOut.indexOf('ค้นหาตู้ในลาน', workspaceStart);
    const selectedContainer = gateOut.indexOf('{selectedContainer &&', workspaceStart);

    expect(workspaceStart).toBeGreaterThan(-1);
    expect(pendingPanel).toBeGreaterThan(workspaceStart);
    expect(searchLabel).toBeGreaterThan(pendingPanel);
    expect(selectedContainer).toBeGreaterThan(searchLabel);
  });

  it('moves readiness, warnings, and visibility preview into a compact side rail', () => {
    const sideRailStart = gateOut.indexOf('gate-out-side-rail');

    expect(sideRailStart).toBeGreaterThan(-1);
    expect(gateOut.indexOf('<GateDecisionBar signals={gateOutDecisionSignals} compact />', sideRailStart)).toBeGreaterThan(sideRailStart);
    expect(gateOut.indexOf('{gateOutGuardrails.alerts.length > 0 &&', sideRailStart)).toBeGreaterThan(sideRailStart);
    expect(gateOut.indexOf('<GateGuardrailPanel title="Gate-Out checks" snapshot={gateOutGuardrails} compact />', sideRailStart)).toBeGreaterThan(sideRailStart);
    expect(gateOut.indexOf('{gateOutVisibilityPreviewPanel}', sideRailStart)).toBeGreaterThan(sideRailStart);
  });

  it('does not render the old full-width guardrail and decision stack', () => {
    expect(gateOut).not.toContain('<GateGuardrailPanel title="Gate-Out operational guardrails" snapshot={gateOutGuardrails} />');
    expect(gateOut).not.toContain('<GateDecisionBar signals={gateOutDecisionSignals} />');
  });
});
