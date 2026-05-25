import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Dev server scripts', () => {
  it('uses webpack for the default dev server and keeps turbo opt-in', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.dev).toContain('next dev --webpack');
    expect(pkg.scripts.dev).toContain('-p 3005');
    expect(pkg.scripts['dev:turbo']).toContain('next dev --turbo');
    expect(pkg.scripts['dev:turbo']).toContain('-p 3005');
  });
});
