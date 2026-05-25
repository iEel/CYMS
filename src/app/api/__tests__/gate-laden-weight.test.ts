import fs from 'fs';
import path from 'path';

describe('Gate laden weight capture', () => {
  const root = process.cwd();

  it('adds persistent fields for actual laden weight separately from BoxTech specs', () => {
    const setup = fs.readFileSync(path.join(root, 'scripts/setup-db.js'), 'utf8');
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    for (const column of ['actual_gross_weight_kg', 'weight_source', 'weight_captured_at']) {
      expect(setup).toContain(column);
      expect(migration).toContain(`COL_LENGTH('Containers', '${column}')`);
    }
  });

  it('persists actual laden weight on Gate In without treating it as BoxTech weight', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/api/gate/route.ts'), 'utf8');

    expect(source).toContain('actual_gross_weight_kg: z.coerce.number().int().positive().optional().nullable()');
    expect(source).toContain("weight_source: z.enum(['manual', 'scale', 'vgm_document']).optional().nullable()");
    expect(source).toContain(".input('actualGrossWeightKg', sql.Int, hasActualWeight ? actual_gross_weight_kg : null)");
    expect(source).toContain(".input('weightSource', sql.NVarChar, hasActualWeight ? (weight_source || 'manual') : null)");
    expect(source).toContain('actual_gross_weight_kg = COALESCE(@actualGrossWeightKg, actual_gross_weight_kg)');
    expect(source).toContain('weight_source = COALESCE(@weightSource, weight_source)');
    expect(source).toContain('actual_gross_weight_kg, weight_source, weight_captured_at');
  });

  it('shows BoxTech specs as read-only fields and reveals actual gross/VGM input for laden Gate In', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');

    expect(source).toContain('actual_gross_weight_kg');
    expect(source).toContain('weight_source');
    expect(source).toContain('Tare Weight');
    expect(source).toContain('Max Gross');
    expect(source).toContain('Actual Gross / VGM');
    expect(source).toContain('gateInForm.is_laden && (');
    expect(source).toContain('cargoWeightEstimateKg');
    expect(source).toContain('actual_gross_weight_kg: gateInForm.actual_gross_weight_kg ? Number(gateInForm.actual_gross_weight_kg) : null');
    expect(source).toContain("weight_source: gateInForm.actual_gross_weight_kg ? gateInForm.weight_source : null");
  });
});
