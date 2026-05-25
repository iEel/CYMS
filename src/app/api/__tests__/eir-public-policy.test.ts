import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('public EIR API policy', () => {
  it('does not expose the authenticated gate EIR route as a public API path', () => {
    const source = readSource('src/proxy.ts');

    expect(source).toContain("'/api/public/eir'");
    expect(source).not.toContain("'/api/gate/eir'");
  });

  it('uses the public EIR API from the public EIR view and does not render inspection evidence', () => {
    const source = readSource('src/app/eir/[id]/EIRPublicView.tsx');

    expect(source).toContain('/api/public/eir');
    expect(source).not.toContain('/api/gate/eir');
    expect(source).not.toContain('Photo Evidence');
    expect(source).not.toContain('damagePoints.map');
  });

  it('routes public verification through the constrained EIR visibility payload', () => {
    const source = readSource('src/app/api/public/eir/route.ts');

    expect(source).toContain("viewType: 'public'");
    expect(source).toContain('buildEirViewPayload');
    expect(source).toContain("action: 'public_verify'");
  });
});
