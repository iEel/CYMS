import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function quotedLiteral(value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}['"\`]`);
}

function propertyLiteral(name: string, value: string) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${name}\\s*:\\s*['"\`]${escapedValue}['"\`]`);
}

describe('public EIR API policy', () => {
  it('does not expose the authenticated gate EIR route as a public API path', () => {
    const source = readSource('src/proxy.ts');
    const publicApiPaths = source.match(/PUBLIC_API_PATHS\s*=\s*\[[\s\S]*?\]/)?.[0] || '';

    expect(publicApiPaths).toMatch(quotedLiteral('/api/public/eir'));
    expect(publicApiPaths).not.toMatch(quotedLiteral('/api/gate/eir'));
  });

  it('uses the public EIR API from the public EIR view and does not render inspection evidence', () => {
    const source = readSource('src/app/eir/[id]/EIRPublicView.tsx');
    const sensitivePageTokens = [
      { label: 'authenticated gate EIR API', pattern: /\/api\/gate\/eir/ },
      { label: 'driver name', pattern: /data\s*\.\s*driver_name/ },
      { label: 'truck plate', pattern: /data\s*\.\s*truck_plate/ },
      { label: 'container grade', pattern: /data\s*\.\s*container_grade/ },
      { label: 'damage report', pattern: /\bdamage_report\b/ },
      { label: 'selected photo state', pattern: /\bselectedPhoto\b/ },
      { label: 'raw image renderer', pattern: /\bRawImage\b/ },
      { label: 'photo evidence heading', pattern: /Photo\s+Evidence/ },
      { label: 'damage point rendering', pattern: /damagePoints\s*\.\s*map/ },
    ];

    expect(source).toMatch(/\/api\/public\/eir/);
    for (const token of sensitivePageTokens) {
      expect(source).not.toMatch(token.pattern);
    }
  });

  it('routes public verification through the constrained EIR visibility payload', () => {
    const source = readSource('src/app/api/public/eir/route.ts');

    expect(source).toMatch(propertyLiteral('viewType', 'public'));
    expect(source).toContain('buildEirViewPayload');
    expect(source).toMatch(propertyLiteral('action', 'public_verify'));
  });
});
