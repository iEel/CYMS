import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('yard zone reefer plug capacity wiring', () => {
  it('persists actual plug capacity in schema, migration, API, and settings UI', () => {
    const schema = fs.readFileSync(path.join(root, 'src/lib/schema.sql'), 'utf8');
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');
    const api = fs.readFileSync(path.join(root, 'src/app/api/settings/zones/route.ts'), 'utf8');
    const ui = fs.readFileSync(path.join(root, 'src/app/(dashboard)/settings/YardsSettings.tsx'), 'utf8');

    expect(schema).toContain('plug_capacity');
    expect(migration).toContain("COL_LENGTH('YardZones', 'plug_capacity')");
    expect(api).toContain(".input('plugCapacity'");
    expect(api).toContain('plug_capacity');
    expect(ui).toContain('plug_capacity');
    expect(ui).toContain('จำนวนปลั๊กจริง');
  });
});
