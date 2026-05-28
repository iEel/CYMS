import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('CODECO export permissions', () => {
  it('requires integration permission before querying gate transactions and keeps yard access', () => {
    const source = read('src/app/api/edi/codeco/route.ts');

    expect(source).toContain('requirePermission');
    expect(source).toContain('integration.send');
    expect(source).not.toContain('integration.logs.view');
    expect(source.indexOf('requirePermission')).toBeLessThan(source.indexOf('SELECT g.transaction_id'));
    expect(source).toContain('requireYardAccess');
  });
});
