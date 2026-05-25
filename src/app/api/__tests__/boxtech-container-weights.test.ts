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
    expect(source).toContain('boxtech_group_st, boxtech_source, boxtech_fetched_at,');
    expect(source).toContain('actual_gross_weight_kg, weight_source, weight_captured_at, gate_in_date)');
    expect(source).toContain('@containerGrade, @sealNumber, @tareWeightKg, @maxGrossWeightKg,');
    expect(source).toContain('@boxtechGroupSt, @boxtechSource, @boxtechFetchedAt,');
    expect(source).toContain('@actualGrossWeightKg, @weightSource, @weightCapturedAt, @gateInDate)');
  });

  it('shows BoxTech weight specs in Gate In and submits them with the transaction', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/GateInTab.tsx'), 'utf8');

    expect(source).toContain('tare_weight_kg?: number');
    expect(source).toContain('max_gross_weight_kg?: number');
    expect(source).toContain('Tare');
    expect(source).toContain('Max Gross');
    expect(source).toContain('const boxtechTareWeightKg = boxtechResult?.tare_weight_kg || boxtechResult?.tare_kg || null;');
    expect(source).toContain('const boxtechMaxGrossWeightKg = boxtechResult?.max_gross_weight_kg || boxtechResult?.max_gross_mass_kg || null;');
    expect(source).toContain('tare_weight_kg: boxtechTareWeightKg || null');
    expect(source).toContain('max_gross_weight_kg: boxtechMaxGrossWeightKg || null');
    expect(source).toContain('Number(boxtechTareWeightKg).toLocaleString()');
    expect(source).toContain('Number(boxtechMaxGrossWeightKg).toLocaleString()');
    expect(source).toContain('boxtech_group_st: boxtechResult?.group_st || null');
    expect(source).toContain("boxtech_source: boxtechResult?.source === 'boxtech' ? 'boxtech' : null");
  });

  it('shows read-only BoxTech technical specs during Gate Out', () => {
    const types = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/types.ts'), 'utf8');
    const containersRoute = fs.readFileSync(path.join(root, 'src/app/api/containers/route.ts'), 'utf8');
    const gateOut = fs.readFileSync(path.join(root, 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');

    expect(types).toContain('tare_weight_kg?: number | null');
    expect(types).toContain('max_gross_weight_kg?: number | null');
    expect(types).toContain('boxtech_group_st?: string | null');
    expect(types).toContain('boxtech_source?: string | null');
    expect(types).toContain('boxtech_fetched_at?: string | null');

    expect(containersRoute).toContain('SELECT c.*');
    expect(containersRoute).toContain('c.* includes BoxTech technical spec fields used by Gate Out and Container 360.');

    expect(gateOut).toContain('(selectedContainer.tare_weight_kg != null || selectedContainer.max_gross_weight_kg != null)');
    expect(gateOut).toContain('ข้อมูลสเปกจาก BoxTech');
    expect(gateOut).toContain('Tare');
    expect(gateOut).toContain('Max Gross');
    expect(gateOut).toContain('ไม่ใช่น้ำหนักจริง/VGM');
  });

  it('surfaces BoxTech technical weights in EIR payloads and Container 360 displays', () => {
    const eirPayload = fs.readFileSync(path.join(root, 'src/lib/eirPayload.ts'), 'utf8');
    const eirDocument = fs.readFileSync(path.join(root, 'src/components/gate/EIRDocument.tsx'), 'utf8');
    const containerDetail = fs.readFileSync(path.join(root, 'src/components/yard/ContainerDetailModal.tsx'), 'utf8');
    const dashboardEirRoute = fs.readFileSync(path.join(root, 'src/app/api/gate/eir/route.ts'), 'utf8');
    const portalEirRoute = fs.readFileSync(path.join(root, 'src/app/api/portal/eir/route.ts'), 'utf8');
    const portalEirPdfRoute = fs.readFileSync(path.join(root, 'src/app/api/portal/eir-pdf/route.ts'), 'utf8');
    const containerDetailRoute = fs.readFileSync(path.join(root, 'src/app/api/containers/detail/route.ts'), 'utf8');

    expect(eirPayload).toContain('tare_weight_kg: number');
    expect(eirPayload).toContain('max_gross_weight_kg: number');
    expect(eirPayload).toContain('tare_weight_kg: asNumber(row.tare_weight_kg)');
    expect(eirPayload).toContain('max_gross_weight_kg: asNumber(row.max_gross_weight_kg)');

    expect(eirDocument).toContain('Tare Weight');
    expect(eirDocument).toContain('Max Gross');
    expect(eirDocument).toContain("data.tare_weight_kg ? `${data.tare_weight_kg.toLocaleString()} kg` : '-'");
    expect(eirDocument).toContain("data.max_gross_weight_kg ? `${data.max_gross_weight_kg.toLocaleString()} kg` : '-'");

    expect(dashboardEirRoute).toContain('c.tare_weight_kg, c.max_gross_weight_kg');
    expect(dashboardEirRoute).toContain('buildEIRPayload(row, company)');
    expect(portalEirRoute).toContain('c.tare_weight_kg, c.max_gross_weight_kg');
    expect(portalEirPdfRoute).toContain('c.tare_weight_kg, c.max_gross_weight_kg');

    expect(containerDetail).toContain('tare_weight_kg?: number | null;');
    expect(containerDetail).toContain('max_gross_weight_kg?: number | null;');
    expect(containerDetail).toContain('Tare Weight');
    expect(containerDetail).toContain('Max Gross');
    expect(containerDetail).toContain('function formatWeightKg');
    expect(containerDetail).toContain("return value ? `${Number(value).toLocaleString()} kg` : '—';");
    expect(containerDetailRoute).toContain('tare_weight_kg: container.tare_weight_kg');
    expect(containerDetailRoute).toContain('max_gross_weight_kg: container.max_gross_weight_kg');
  });
});
