import fs from 'fs';
import path from 'path';

describe('Gate In workstation UI', () => {
  const gateIn = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');
  const documentActionStrip = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/components/GateInDocumentActionStrip.tsx'), 'utf8');

  it('uses a two-column workstation layout with a primary workspace and side rail', () => {
    expect(gateIn).toContain('gate-in-workstation-shell');
    expect(gateIn).toContain('gate-in-primary-workspace');
    expect(gateIn).toContain('gate-in-side-rail');
    expect(gateIn).toContain('xl:grid-cols-[minmax(0,1fr)_340px]');
  });

  it('keeps the main form focused by moving readiness and visibility preview into the side rail', () => {
    const sideRailStart = gateIn.indexOf('gate-in-side-rail');
    const decisionBar = gateIn.indexOf('<GateDecisionBar signals={gateInDecisionSignals} compact />', sideRailStart);
    const preview = gateIn.indexOf('<GateInVisibilityPreviewPanel', sideRailStart);

    expect(sideRailStart).toBeGreaterThan(-1);
    expect(decisionBar).toBeGreaterThan(sideRailStart);
    expect(preview).toBeGreaterThan(sideRailStart);
  });

  it('shows guardrails only when there is a warning or blocker to review', () => {
    expect(gateIn).toContain('gateInGuardrails.alerts.length > 0 &&');
    expect(gateIn).toContain('<GateGuardrailPanel title="Gate-In checks" snapshot={gateInGuardrails} compact />');
    expect(gateIn).not.toContain('<GateGuardrailPanel title="Gate-In operational guardrails" snapshot={gateInGuardrails} />');
  });

  it('supports a compact decision bar for the side rail', () => {
    const decisionBar = fs.readFileSync(path.join(process.cwd(), 'src/components/gate/GateDecisionBar.tsx'), 'utf8');

    expect(decisionBar).toContain('compact?: boolean');
    expect(decisionBar).toContain("compact ? 'relative z-0' : 'sticky top-16 z-20'");
    expect(decisionBar).toContain("compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-5'");
  });

  it('supports a compact guardrail panel for the side rail', () => {
    const guardrail = fs.readFileSync(path.join(process.cwd(), 'src/components/gate/GateGuardrailPanel.tsx'), 'utf8');

    expect(guardrail).toContain('compact?: boolean');
    expect(guardrail).toContain("compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'");
    expect(guardrail).toContain("compact ? 'px-3 py-2' : 'px-4 py-3'");
  });

  it('uses calmer business relationship copy for owner and billing fields', () => {
    expect(gateIn).toContain('Business relationship');
    expect(gateIn).toContain('Container owner');
    expect(gateIn).toContain('Billing customer');
  });

  it('extends the existing guided workflow with a document action strip instead of adding a second workflow', () => {
    expect(gateIn).toContain('GateInDocumentActionStrip');
    expect(gateIn).toContain('gateInReceiptPrintOpened');
    expect(gateIn).toContain('readyForEir={gateInEirStepActive}');
    expect(documentActionStrip).toContain('ต่อจาก Billing clearance ใน guided workflow เดิม');
    expect(documentActionStrip).toContain('งานเอกสารถัดไป');
    expect(documentActionStrip).toContain('เปิดหน้าพิมพ์แล้ว กลับมาทำ Gate-In ต่อได้');
  });
});
