import fs from 'fs';
import path from 'path';

describe('service worker cache safety', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');

  it('never cache-serves Next.js runtime chunks', () => {
    expect(source).toContain("url.pathname.startsWith('/_next/')");
    expect(source.indexOf("url.pathname.startsWith('/_next/')")).toBeLessThan(source.indexOf('url.pathname.match'));
  });
});
