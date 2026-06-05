import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Build hygiene scripts', () => {
  it('keeps local tmp artifacts out of git', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

    expect(gitignore).toMatch(/^\/tmp\/$/m);
    expect(gitignore).toMatch(/^\/\.next-delete-\*\/$/m);
    expect(gitignore).toMatch(/^\/\.next-clean-permission-probe-\*\/$/m);
  });

  it('provides cross-platform clean and clean-build commands', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['clean:next']).toBe('node scripts/clean-next-build.js');
    expect(pkg.scripts['build:clean']).toBe('npm run clean:next && npm run build');
    expect(pkg.scripts['clean:next']).not.toContain('rm -rf');
  });

  it('has a scoped .next cleanup script with a helpful lock message', () => {
    const scriptPath = path.join(root, 'scripts', 'clean-next-build.js');
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain("const NEXT_DIR = '.next'");
    expect(source).toContain("const TOMBSTONE_PREFIX = '.next-delete-'");
    expect(source).toContain('process.cwd()');
    expect(source).toContain('fs.rename');
    expect(source).toContain('--delete-tombstone');
    expect(source).toContain('.next-clean-permission-probe');
    expect(source).toContain('repo folder permission');
    expect(source).toContain('dev server');
    expect(source).toContain('npm run clean:next');
  });
});
