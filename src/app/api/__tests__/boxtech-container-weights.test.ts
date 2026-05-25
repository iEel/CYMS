import fs from 'fs';
import path from 'path';

describe('BoxTech container technical weights', () => {
  const root = process.cwd();

  it('adds persistent container technical spec columns for fresh and existing databases', () => {
    const setup = fs.readFileSync(path.join(root, 'scripts/setup-db.js'), 'utf8');
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    for (const column of [
      'tare_weight_kg',
      'max_gross_weight_kg',
      'boxtech_group_st',
      'boxtech_source',
      'boxtech_fetched_at',
    ]) {
      expect(setup).toContain(column);
      expect(migration).toContain(`COL_LENGTH('Containers', '${column}')`);
    }
  });

  it('normalizes BoxTech tare and max gross fields for downstream persistence', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/api/boxtech/route.ts'), 'utf8');

    expect(source).toContain('response.tare_weight_kg');
    expect(source).toContain('response.max_gross_weight_kg');
    expect(source).toContain('response.max_gross_mass_kg');
    expect(source).toContain('Number(containerData?.tare_kg)');
    expect(source).toContain('Number(containerData?.max_gross_mass_kg)');
  });

  it('persists BoxTech weight specs during Gate In create and re-entry', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/api/gate/route.ts'), 'utf8');

    expect(source).toContain('tare_weight_kg: z.coerce.number().int().positive().optional().nullable()');
    expect(source).toContain('max_gross_weight_kg: z.coerce.number().int().positive().optional().nullable()');
    expect(source).toContain('boxtech_group_st: z.string().max(10).optional().nullable()');
    expect(source).toContain("boxtech_source: z.string().max(30).optional().nullable()");
    expect(source).toContain(".input('tareWeightKg', sql.Int, tare_weight_kg || null)");
    expect(source).toContain(".input('maxGrossWeightKg', sql.Int, max_gross_weight_kg || null)");
    expect(source).toContain('const hasBoxtechSpecs = tare_weight_kg || max_gross_weight_kg || boxtech_group_st || boxtech_source');
    expect(source).toContain(".input('boxtechFetchedAt', sql.DateTime2, hasBoxtechSpecs ? new Date() : null)");
    expect(source).toContain('tare_weight_kg = COALESCE(@tareWeightKg, tare_weight_kg)');
    expect(source).toContain('max_gross_weight_kg = COALESCE(@maxGrossWeightKg, max_gross_weight_kg)');
    expect(source).toContain('boxtech_fetched_at = COALESCE(@boxtechFetchedAt, boxtech_fetched_at)');
    expect(source).toContain('container_grade, seal_number, tare_weight_kg, max_gross_weight_kg,');
    expect(source).toContain('boxtech_group_st, boxtech_source, boxtech_fetched_at, gate_in_date)');
    expect(source).toContain('@containerGrade, @sealNumber, @tareWeightKg, @maxGrossWeightKg,');
    expect(source).toContain('@boxtechGroupSt, @boxtechSource, @boxtechFetchedAt, @gateInDate)');
  });
});
