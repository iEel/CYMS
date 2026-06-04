import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('Transport action migration', () => {
  it('keeps action workflow DDL in canonical migration files only', () => {
    const migration = read('scripts/migrate-runtime-core-schema.js');
    const schema = read('src/lib/schema.sql');
    const transportRouteCandidates = [
      'src/app/api/transport/actions/route.ts',
      'src/app/api/transport/activity/route.ts',
      'src/app/api/transport/jobs/route.ts',
    ];

    expect(migration).toContain("OBJECT_ID('TransportJobActivities'");
    expect(migration).toContain("OBJECT_ID('TransportJobProofs'");
    expect(migration).toContain('IX_TransportJobActivities_Job');
    expect(migration).toContain('IX_TransportJobProofs_Job');

    expect(schema).toContain('TransportJobActivities');
    expect(schema).toContain('TransportJobProofs');

    for (const relativePath of transportRouteCandidates) {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(absolutePath)) continue;

      const source = fs.readFileSync(absolutePath, 'utf8');
      expect(source).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(source).not.toMatch(/\bALTER\s+TABLE\b/i);
    }
  });
});
