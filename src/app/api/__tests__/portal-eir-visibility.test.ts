import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function literal(value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}['"\`]`);
}

function propertyLiteral(name: string, value: string) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${name}\\s*:\\s*['"\`]${escapedValue}['"\`]`);
}

describe('portal EIR visibility wiring', () => {
  it('routes portal EIR JSON through portal permissions, EIR visibility SQL, sanitized payload, and view logging', () => {
    const source = readSource('src/app/api/portal/eir/route.ts');

    expect(source).toContain('requirePortalAction');
    expect(source).toMatch(/requirePortalAction\s*\(\s*request\s*,\s*db\s*,\s*['"`]portal\.eir\.view['"`]\s*\)/);
    expect(source).toContain('portalEirVisibilitySql');
    expect(source).toContain('buildEirViewPayload');
    expect(source).toContain('resolveEirViewType');
    expect(source).toMatch(propertyLiteral('action', 'view'));
    expect(source).toMatch(/portalActor\s*\.\s*actions/);
    expect(source).toMatch(/\baccessGrant\b/);
    expect(source).not.toContain('portalGateVisibilitySql');
  });

  it('routes portal EIR PDF through download permission and generates only from the sanitized payload', () => {
    const source = readSource('src/app/api/portal/eir-pdf/route.ts');

    expect(source).toContain('requirePortalAction');
    expect(source).toMatch(/requirePortalAction\s*\(\s*request\s*,\s*db\s*,\s*['"`]portal\.eir\.download['"`]\s*\)/);
    expect(source).toContain('portalEirVisibilitySql');
    expect(source).toContain('buildEirViewPayload');
    expect(source).toContain('resolveEirViewType');
    expect(source).toContain('generateEIRPDF');
    expect(source).toMatch(propertyLiteral('action', 'download'));
    expect(source).toMatch(/generateEIRPDF\s*\(\s*\{[\s\S]*\.{3}\s*\(?sanitizedPayload\s*\.\s*eir/);
    expect(source).not.toContain('portalGateVisibilitySql');
  });

  it('keeps copy and grade labels available to the PDF generator without forcing grade rows', () => {
    const source = readSource('src/lib/eirPdfGenerator.ts');

    expect(source).toMatch(/copy_type_label\??\s*:\s*string/);
    expect(source).toMatch(/document_status\??\s*:\s*string/);
    expect(source).toMatch(/version_no\??\s*:\s*(?:number|string|\([^)]*\))/);
    expect(source).toMatch(/container_grade_label\??\s*:\s*string/);
    expect(source).toMatch(/data\s*\.\s*copy_type_label/);
    expect(source).toMatch(/if\s*\(\s*data\s*\.\s*container_grade\s*\)/);
    expect(source).not.toMatch(/container_grade\s*\|\|\s*data\.damage_report\?\.condition_grade\s*\|\|\s*['"`]A['"`]/);
  });

  it('declares portal EIR actions in the permission action allowlist', () => {
    const source = readSource('src/lib/customerPortalPermissions.ts');

    expect(source).toMatch(literal('portal.eir.view'));
    expect(source).toMatch(literal('portal.eir.download'));
  });
});
