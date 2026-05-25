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
});
