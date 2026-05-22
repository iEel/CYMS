import fs from 'fs';
import path from 'path';

describe('EIR print layout', () => {
  it('prints EIR on A5 landscape using physical page dimensions and larger readable text', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components/gate/EIRDocument.tsx'), 'utf8');

    expect(source).toContain('@page { size: A5 landscape; margin: 4mm; }');
    expect(source).toContain('width: 202mm !important;');
    expect(source).toContain('height: 139mm !important;');
    expect(source).toContain('box-sizing: border-box !important;');
    expect(source).toContain('.eir-value');
    expect(source).toContain('font-size: 12px !important;');
    expect(source).not.toContain('width: 210mm;');
    expect(source).not.toContain('min-height: 148mm;');
    expect(source).not.toContain('min-height: 140mm !important;');
  });
});
