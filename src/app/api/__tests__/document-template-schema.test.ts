import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');
const migration = fs.readFileSync(path.join(repoRoot, 'scripts/migrate-runtime-core-schema.js'), 'utf8');
const schema = fs.readFileSync(path.join(repoRoot, 'src/lib/schema.sql'), 'utf8');
const rbacSeeds = fs.readFileSync(path.join(repoRoot, 'src/lib/rbacSeeds.ts'), 'utf8');

function collectApiRoutes(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) return collectApiRoutes(relativePath);
    if (!entry.isFile() || entry.name !== 'route.ts') return [];
    return [fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')];
  });
}

const apiFiles = collectApiRoutes('src/app/api').join('\n');

describe('document template schema', () => {
  it('declares document template and print log tables in migration and canonical schema', () => {
    for (const table of [
      'DocumentTemplates',
      'DocumentTemplateVersions',
      'DocumentPrintLogs',
      'DocumentPrintSnapshots',
    ]) {
      expect(migration).toContain(table);
      expect(schema).toContain(table);
    }
  });

  it('keeps document template DDL out of API routes', () => {
    expect(apiFiles).not.toMatch(/CREATE TABLE\s+DocumentTemplates/i);
    expect(apiFiles).not.toMatch(/ALTER TABLE\s+DocumentTemplates/i);
    expect(apiFiles).not.toMatch(/CREATE TABLE\s+DocumentPrintLogs/i);
    expect(apiFiles).not.toMatch(/ALTER TABLE\s+DocumentPrintLogs/i);
  });

  it('guards print numbers with a unique document print index', () => {
    expect(schema).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+UX_DocumentPrintLogs_DocumentPrintNo/i);
    expect(schema).toMatch(/ON\s+DocumentPrintLogs\s*\(\s*document_type\s*,\s*document_id\s*,\s*print_no\s*\)/i);
    expect(migration).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+UX_DocumentPrintLogs_DocumentPrintNo/i);
    expect(migration).toMatch(/ON\s+DocumentPrintLogs\s*\(\s*document_type\s*,\s*document_id\s*,\s*print_no\s*\)/i);
  });

  it('seeds granular document template permissions', () => {
    for (const permission of [
      'document_templates.view',
      'document_templates.create',
      'document_templates.update_draft',
      'document_templates.publish',
      'document_templates.export',
      'document_templates.import',
      'document_templates.test_print',
    ]) {
      expect(rbacSeeds).toContain(permission);
      expect(migration).toContain(permission);
    }
  });
});
